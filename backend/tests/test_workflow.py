from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import select

from app import DEMO_PASSWORD, create_app
from models import Need, Shelter, User, db
from werkzeug.security import generate_password_hash


@pytest.fixture()
def app(tmp_path):
    return create_app({"TESTING": True, "SECRET_KEY": "test-only-session-key", "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}"})


def post(client, path, data=None):
    csrf = client.get('/api/session').json['csrf']
    return client.post(path, json=data or {}, headers={'X-CSRF-Token': csrf})


def signed_in(app, role):
    client = app.test_client()
    response = post(client, '/api/login', {'email': f'{role}@maak.demo', 'password': DEMO_PASSWORD})
    assert response.status_code == 200
    return client


def publish(app):
    coordinator = signed_in(app, 'coordinator')
    need = coordinator.get('/api/needs').json['needs'][0]
    assert post(coordinator, f"/api/needs/{need['id']}/review", {'coordinator_note': 'Supply quantity checked.'}).status_code == 200
    assert post(coordinator, f"/api/needs/{need['id']}/publish", {'description': 'Demo shelter needs hygiene kits.'}).status_code == 200
    return coordinator, need['id']


def deliver(app, coordinator, need_id, quantity):
    donor = signed_in(app, 'donor')
    response = post(donor, '/api/pledges', {'command_id': str(uuid4()), 'need_id': need_id, 'quantity': quantity})
    assert response.status_code == 201
    pledge_id = response.json['pledge']['id']
    response = post(coordinator, f'/api/pledges/{pledge_id}/task', {'pickup_instructions': 'Meet the demo logistics coordinator.'})
    assert response.status_code == 201
    task_id = response.json['task']['id']
    volunteer = signed_in(app, 'volunteer')
    for action in ['accept', 'pickup', 'deliver']:
        assert post(volunteer, f'/api/tasks/{task_id}/{action}').status_code == 200
    return pledge_id


def test_full_journey_partial_receipt_then_fulfillment(app):
    coordinator, need_id = publish(app)
    pledge_id = deliver(app, coordinator, need_id, 10)
    receipt = {'quantity': 6, 'receipt_note': 'Only six arrived in acceptable condition.'}
    assert post(coordinator, f'/api/pledges/{pledge_id}/receive', receipt).status_code == 200
    # A retry cannot increase stock twice, and a conflicting receipt is rejected.
    assert post(coordinator, f'/api/pledges/{pledge_id}/receive', receipt).status_code == 200
    assert post(coordinator, f'/api/pledges/{pledge_id}/receive', {'quantity': 10}).status_code == 409
    assert coordinator.get('/api/shelter').json['stock'][0]['quantity'] == 6
    resident = signed_in(app, 'resident')
    need = resident.get(f'/api/needs/{need_id}').json['need']
    assert (need['status'], need['received'], need['confirmed'], need['remaining']) == ('distribution_pending', 6, 0, 4)
    issue = {'command_id': str(uuid4()), 'quantity': 6}
    assert post(coordinator, f'/api/needs/{need_id}/distribute', issue).status_code == 200
    assert post(coordinator, f'/api/needs/{need_id}/distribute', issue).status_code == 200
    assert coordinator.get('/api/shelter').json['stock'][0]['quantity'] == 0
    confirm = {'command_id': str(uuid4()), 'quantity': 6}
    assert post(resident, f'/api/needs/{need_id}/confirm', confirm).status_code == 200
    assert post(resident, f'/api/needs/{need_id}/confirm', confirm).json['need']['confirmed'] == 6
    overview = signed_in(app, 'ministry').get('/api/overview').json
    assert overview['distribution'][0]['remaining'] == 4
    assert overview['metrics']['fulfilled_needs'] == 0
    remaining_pledge = deliver(app, coordinator, need_id, 4)
    assert post(coordinator, f'/api/pledges/{remaining_pledge}/receive', {'quantity': 4}).status_code == 200
    assert post(coordinator, f'/api/needs/{need_id}/distribute', {'command_id': str(uuid4()), 'quantity': 4}).status_code == 200
    last = post(resident, f'/api/needs/{need_id}/confirm', {'command_id': str(uuid4()), 'quantity': 4})
    assert last.json['need']['status'] == 'fulfilled'
    assert signed_in(app, 'ministry').get('/api/overview').json['metrics']['fulfilled_needs'] == 1


def test_public_projection_and_privileged_routes(app):
    coordinator, need_id = publish(app)
    donor = signed_in(app, 'donor')
    public = donor.get('/api/opportunities').json['opportunities'][0]
    for key in ['resident_name', 'resident_id', 'private_note', 'details', 'reported_urgent', 'events']:
        assert key not in public
    assert donor.get(f'/api/needs/{need_id}').status_code == 403
    assert donor.get('/api/overview').status_code == 403
    assert signed_in(app, 'ministry').get(f'/api/needs/{need_id}').status_code == 403
    assert app.test_client().get('/api/needs').status_code == 401


def test_unrelated_resident_cannot_read_or_confirm(app):
    resident = signed_in(app, 'resident')
    need_id = resident.get('/api/needs').json['needs'][0]['id']
    new = app.test_client()
    shelter_id = new.get('/api/shelters').json['shelters'][0]['id']
    assert post(new, '/api/register', {'name': 'Another demo resident', 'email': 'other@example.test', 'password': 'TestPassword!1', 'role': 'resident', 'shelter_id': shelter_id}).status_code == 201
    assert new.get(f'/api/needs/{need_id}').status_code == 404
    assert post(new, f'/api/needs/{need_id}/confirm', {'quantity': 1, 'command_id': str(uuid4())}).status_code == 404


def test_coordinator_scope(app):
    with app.app_context():
        coordinator = db.session.scalar(select(User).where(User.role == 'coordinator'))
        coordinator.shelter_id = db.session.scalar(select(Shelter).where(Shelter.name == 'Demo Olive Shelter')).id
        db.session.commit()
    client = signed_in(app, 'coordinator')
    assert client.get('/api/needs').json['needs'] == []
    need_id = signed_in(app, 'resident').get('/api/needs').json['needs'][0]['id']
    assert post(client, f'/api/needs/{need_id}/review', {'coordinator_note': 'Not mine'}).status_code == 404


def test_csrf_and_no_privileged_self_registration(app):
    client = app.test_client()
    assert client.post('/api/login', json={'email': 'resident@maak.demo', 'password': DEMO_PASSWORD}).status_code == 403
    assert post(client, '/api/register', {'name': 'Not authorized', 'email': 'bad@example.test', 'password': 'TestPassword!1', 'role': 'ministry'}).status_code == 403
    assert post(client, '/api/register', {'name': 'Not authorized', 'email': 'bad@example.test', 'password': 'TestPassword!1', 'role': 'coordinator'}).status_code == 403


def test_need_submission_is_idempotent_and_device_other(app):
    client = signed_in(app, 'resident')
    data = {'command_id': str(uuid4()), 'category': 'power', 'device_type': 'other', 'other_device': 'Synthetic device', 'power_status': 'unknown', 'backup': 'Unknown', 'reported_urgent': True}
    first = post(client, '/api/needs', data)
    assert first.status_code == 201
    second = post(client, '/api/needs', data)
    assert second.status_code == 200 and first.json['need']['id'] == second.json['need']['id']
    changed = {**data, 'backup': 'Different'}
    assert post(client, '/api/needs', changed).status_code == 409
    coordinator = signed_in(app, 'coordinator')
    need_id = first.json['need']['id']
    assert post(coordinator, f'/api/needs/{need_id}/publish', {'description': 'No clinical listing'}).status_code == 409


@pytest.mark.parametrize('quantity', [-1, 0, True, 1.5, '10', 10001])
def test_invalid_supply_quantities(app, quantity):
    client = signed_in(app, 'resident')
    response = post(client, '/api/needs', {'command_id': str(uuid4()), 'category': 'essentials', 'item': 'hygiene_kits', 'quantity': quantity})
    assert response.status_code == 400


def test_receipt_requires_delivery_and_confirmation_requires_issue(app):
    coordinator, need_id = publish(app)
    donor = signed_in(app, 'donor')
    pledge = post(donor, '/api/pledges', {'command_id': str(uuid4()), 'need_id': need_id, 'quantity': 5}).json['pledge']
    assert post(coordinator, f"/api/pledges/{pledge['id']}/receive", {'quantity': 5}).status_code == 409
    resident = signed_in(app, 'resident')
    assert post(resident, f'/api/needs/{need_id}/confirm', {'command_id': str(uuid4()), 'quantity': 1}).status_code == 409
    assert post(coordinator, f'/api/needs/{need_id}/distribute', {'command_id': str(uuid4()), 'quantity': 1}).status_code == 409
    assert resident.get(f'/api/needs/{need_id}').json['need']['distributed'] == 0


def test_one_task_has_one_atomic_winner(app):
    coordinator, need_id = publish(app)
    donor = signed_in(app, 'donor')
    pledge_id = post(donor, '/api/pledges', {'command_id': str(uuid4()), 'need_id': need_id, 'quantity': 5}).json['pledge']['id']
    task_id = post(coordinator, f'/api/pledges/{pledge_id}/task', {'pickup_instructions': 'Private demo meeting point.'}).json['task']['id']
    with app.app_context():
        db.session.add(User(name='Second volunteer', email='second@maak.demo', password_hash=generate_password_hash(DEMO_PASSWORD), role='volunteer', volunteer_approved=True))
        db.session.commit()
    clients = [signed_in(app, 'volunteer'), app.test_client()]
    assert post(clients[1], '/api/login', {'email': 'second@maak.demo', 'password': DEMO_PASSWORD}).status_code == 200
    available = clients[0].get('/api/tasks').json['tasks'][0]
    assert 'pickup_instructions' not in available
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda c: post(c, f'/api/tasks/{task_id}/accept').status_code, clients))
    assert sorted(results) == [200, 409]
    for client in clients:
        tasks = client.get('/api/tasks').json['tasks']
        if tasks:
            assert tasks[0]['assigned_to_me'] is True and 'pickup_instructions' in tasks[0]


def test_overpledge_and_duplicate_pledge(app):
    coordinator, need_id = publish(app)
    donor = signed_in(app, 'donor')
    data = {'command_id': str(uuid4()), 'need_id': need_id, 'quantity': 8}
    assert post(donor, '/api/pledges', data).status_code == 201
    assert post(donor, '/api/pledges', data).status_code == 200
    assert post(donor, '/api/pledges', {'command_id': str(uuid4()), 'need_id': need_id, 'quantity': 3}).status_code == 409
    assert coordinator.get(f'/api/needs/{need_id}').json['need']['committed'] == 8


def test_truthful_overcapacity(app):
    coordinator = signed_in(app, 'coordinator')
    response = post(coordinator, '/api/shelter', {'capacity': 20, 'occupancy': 24, 'power_status': 'unknown'})
    assert response.status_code == 200
    assert response.json['shelter']['overcrowded'] is True
    assert response.json['shelter']['available_spaces'] == 0
