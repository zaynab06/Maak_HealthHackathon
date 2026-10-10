"""Maak's synthetic-data hackathon API. Run from backend with Flask or Gunicorn."""
from datetime import timedelta
from functools import wraps
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
from uuid import UUID

import click
from flask import Flask, abort, jsonify, request, send_from_directory, session
from flask_login import LoginManager, current_user, login_required, login_user, logout_user
from sqlalchemy import event, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

from models import ActionEvent, Movement, Need, Pledge, Shelter, Stock, Submission, Task, User, db, now, uid

DEMO_PASSWORD = "MaakDemo!2026"  # Public synthetic demo only, never production credentials.
ITEMS = {"hygiene_kits": "kits", "blankets": "items", "baby_wipes": "packs", "food_packages": "packs"}
ROLES = ("resident", "coordinator", "donor", "volunteer", "ministry")


@event.listens_for(Engine, "connect")
def sqlite_constraints(connection, _record):
    if isinstance(connection, sqlite3.Connection):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=10000")


def fail(code, message, status=400):
    response = jsonify(error=message, code=code)
    response.status_code = status
    abort(response)


def role_required(*roles):
    def wrap(function):
        @wraps(function)
        @login_required
        def guarded(*args, **kwargs):
            if current_user.role not in roles:
                fail("role_forbidden", "This action is not available to your role.", 403)
            return function(*args, **kwargs)
        return guarded
    return wrap


def payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        fail("invalid_input", "Send a valid JSON object.")
    return data


def text(data, field, maximum=400, required=False):
    value = data.get(field, "")
    if not isinstance(value, str) or len(value.strip()) > maximum:
        fail("invalid_input", f"{field} must be text of at most {maximum} characters.")
    value = value.strip()
    if required and not value:
        fail("required_field", f"Please provide {field}.")
    return value


def integer(data, field, minimum=1, maximum=10000):
    value = data.get(field)
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        fail("invalid_quantity", f"{field} must be a whole number from {minimum} to {maximum}.")
    return value


def command(data):
    value = data.get("command_id")
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        fail("invalid_command", "A valid action reference is required.")


def token():
    if "csrf" not in session:
        session["csrf"] = secrets.token_urlsafe(32)
    return session["csrf"]


def user_json(user):
    return dict(id=user.id, name=user.name, email=user.email, role=user.role,
                shelter_id=user.shelter_id, volunteer_approved=user.volunteer_approved)


def shelter_json(shelter):
    return dict(id=shelter.id, name=shelter.name, region=shelter.region,
                capacity=shelter.capacity, occupancy=shelter.occupancy,
                available_spaces=max(0, shelter.capacity-shelter.occupancy),
                overcrowded=shelter.occupancy > shelter.capacity,
                power_status=shelter.power_status, updated_at=shelter.updated_at)


def need_status(need):
    if need.quantity and need.confirmed >= need.quantity:
        return "fulfilled"
    if need.distributed > need.confirmed:
        return "awaiting_confirmation"
    if need.received > need.distributed:
        return "distribution_pending"
    if need.committed:
        return "coordinating"
    if need.published:
        return "published"
    return "reviewed" if need.reviewed else "submitted"


def need_json(need, history=False):
    data = dict(id=need.id, reference=need.reference, category=need.category,
                shelter=shelter_json(need.shelter), item=need.item, unit=need.unit,
                quantity=need.quantity, committed=need.committed, received=need.received,
                distributed=need.distributed, confirmed=need.confirmed,
                remaining=max(0, need.quantity-need.received),
                can_pledge=max(0, need.quantity-need.received-need.committed),
                reviewed=need.reviewed, published=need.published, status=need_status(need),
                details=need.details, private_note=need.private_note,
                reported_urgent=need.reported_urgent, coordinator_note=need.coordinator_note,
                created_at=need.created_at, updated_at=need.updated_at,
                resident_name=need.resident.name)
    if history:
        events = db.session.scalars(select(ActionEvent).where(ActionEvent.need_id == need.id).order_by(ActionEvent.created_at)).all()
        data["events"] = [dict(id=e.id, kind=e.kind, quantity=e.quantity, actor_role=e.actor.role, created_at=e.created_at) for e in events]
    return data


def opportunity_json(need):
    # Deliberately constructed projection, never the private need serializer.
    return dict(id=need.id, shelter_name=need.shelter.name, region=need.shelter.region,
                item=need.item, unit=need.unit, quantity=need.quantity,
                remaining=max(0, need.quantity-need.received),
                can_pledge=max(0, need.quantity-need.received-need.committed),
                received=need.received, committed=need.committed,
                description=need.public_description, updated_at=need.updated_at,
                coordinator_reviewed=need.reviewed)


def task_json(task):
    need = task.pledge.need
    data = dict(id=task.id, status=task.status, quantity=task.pledge.quantity,
                item=need.item, unit=need.unit, shelter_name=need.shelter.name,
                region=need.shelter.region, created_at=task.created_at,
                updated_at=task.updated_at, assigned_to_me=task.volunteer_id == current_user.id)
    if current_user.role == "coordinator" or task.volunteer_id == current_user.id:
        data["pickup_instructions"] = task.pickup_instructions
    return data


def pledge_json(pledge):
    data = dict(id=pledge.id, quantity=pledge.quantity, item=pledge.need.item,
                unit=pledge.need.unit, shelter_name=pledge.need.shelter.name,
                region=pledge.need.shelter.region, accepted_quantity=pledge.accepted_quantity,
                receipt_note=pledge.receipt_note, created_at=pledge.created_at,
                task=task_json(pledge.task) if pledge.task else None,
                status="received" if pledge.accepted_quantity is not None else pledge.task.status if pledge.task else "pledged")
    if current_user.role == "coordinator":
        data.update(donor_name=pledge.donor.name, need_id=pledge.need_id, need_reference=pledge.need.reference)
    return data


def scoped_need(need_id):
    need = db.session.get(Need, need_id)
    if not need or not ((current_user.role == "resident" and need.resident_id == current_user.id)
                         or (current_user.role == "coordinator" and need.shelter_id == current_user.shelter_id)):
        fail("not_found", "This request is not available.", 404)
    return need


def add_event(need, kind, quantity=None):
    need.updated_at = now()
    db.session.add(ActionEvent(need_id=need.id, actor_id=current_user.id, kind=kind, quantity=quantity))


def seed_demo():
    if db.session.scalar(select(User.id).limit(1)):
        return
    first = Shelter(name="Demo Cedar Shelter", region="Beirut", capacity=80, occupancy=68, power_status="reported_available")
    second = Shelter(name="Demo Olive Shelter", region="Mount Lebanon", capacity=50, occupancy=45)
    db.session.add_all([first, second]); db.session.flush()
    profiles = [("resident", "Rana · Demo"), ("coordinator", "Layla · Demo"),
                ("donor", "Karim · Demo"), ("volunteer", "Nour · Demo"), ("ministry", "Oversight · Demo")]
    users = {}
    password_hash = generate_password_hash(DEMO_PASSWORD)
    for role, name in profiles:
        user = User(name=name, email=f"{role}@maak.demo", password_hash=password_hash, role=role,
                    shelter_id=first.id if role in ("resident", "coordinator") else None,
                    volunteer_approved=role == "volunteer")
        users[role] = user; db.session.add(user)
    db.session.flush()
    need = Need(reference="MAAK-DEMO01", resident_id=users["resident"].id, shelter_id=first.id,
                category="essentials", item="hygiene_kits", unit="kits", quantity=10,
                details={}, private_note="Synthetic example — no real patient information.")
    db.session.add(need); db.session.flush()
    db.session.add(ActionEvent(need_id=need.id, actor_id=users["resident"].id, kind="submitted"))
    db.session.commit()


def create_app(config=None):
    app = Flask(__name__, instance_relative_config=True)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    secret_path = Path(app.instance_path) / ".session-key"
    if not secret_path.exists():
        try:
            fd = os.open(secret_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w") as stream:
                stream.write(secrets.token_hex(32))
        except FileExistsError:
            pass
    app.config.update(SECRET_KEY=os.getenv("MAAK_SECRET_KEY") or secret_path.read_text().strip(),
                      SQLALCHEMY_DATABASE_URI=os.getenv("MAAK_DATABASE_URL", "sqlite:///maak.db"),
                      SQLALCHEMY_TRACK_MODIFICATIONS=False, MAX_CONTENT_LENGTH=64*1024,
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                      SESSION_COOKIE_SECURE=os.getenv("MAAK_COOKIE_SECURE") == "1",
                      PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
                      SEED_DEMO=True)
    if config: app.config.update(config)
    db.init_app(app)
    login = LoginManager(app)
    login.user_loader(lambda user_id: db.session.get(User, user_id))
    login.unauthorized_handler(lambda: (jsonify(error="Please sign in to continue.", code="sign_in_required"), 401))

    @app.before_request
    def csrf_guard():
        if request.path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE"):
            expected = session.get("csrf", "")
            actual = request.headers.get("X-CSRF-Token", "")
            if not expected or not secrets.compare_digest(expected, actual):
                fail("csrf_failed", "Your session changed. Refresh and try again.", 403)

    @app.after_request
    def headers(response):
        if request.path.startswith("/api/"): response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        if error.response: return error.response
        return jsonify(error=error.description, code="request_failed"), error.code

    @app.errorhandler(IntegrityError)
    def database_conflict(_error):
        db.session.rollback()
        return jsonify(error="This record changed or already exists. Refresh and try again.", code="conflict"), 409

    @app.get("/api/health")
    def health():
        db.session.execute(select(1))
        return jsonify(status="ok", mode="synthetic_demo")

    @app.get("/api/session")
    def get_session():
        return jsonify(user=user_json(current_user) if current_user.is_authenticated else None, csrf=token(), mode="synthetic_demo")

    @app.post("/api/login")
    def signin():
        data = payload(); email = text(data, "email", 254, True).lower(); password = text(data, "password", 128, True)
        user = db.session.scalar(select(User).where(User.email == email))
        if not user or not check_password_hash(user.password_hash, password):
            fail("invalid_credentials", "Email or password is incorrect.", 401)
        session.clear(); login_user(user); session.permanent = True
        return jsonify(user=user_json(user), csrf=token())

    @app.post("/api/logout")
    @login_required
    def signout():
        logout_user(); session.clear()
        return jsonify(user=None, csrf=token())

    @app.post("/api/register")
    def register():
        data = payload(); role = data.get("role")
        if role not in ("resident", "donor", "volunteer"):
            fail("role_forbidden", "Only resident, donor, or volunteer registration is available.", 403)
        name = text(data, "name", 100, True); email = text(data, "email", 254, True).lower(); password = text(data, "password", 128, True)
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email): fail("invalid_email", "Provide a valid email address.")
        if len(password) < 10: fail("weak_password", "Use a password with at least 10 characters.")
        if db.session.scalar(select(User.id).where(User.email == email)): fail("email_exists", "An account already uses this email.", 409)
        shelter_id = data.get("shelter_id") if role == "resident" else None
        if role == "resident" and not db.session.get(Shelter, shelter_id): fail("invalid_shelter", "Select an available shelter.")
        user = User(name=name, email=email, password_hash=generate_password_hash(password), role=role, shelter_id=shelter_id)
        db.session.add(user); db.session.commit(); session.clear(); login_user(user); session.permanent = True
        return jsonify(user=user_json(user), csrf=token()), 201

    @app.get("/api/shelters")
    def shelters():
        return jsonify(shelters=[shelter_json(s) for s in db.session.scalars(select(Shelter).order_by(Shelter.name))])

    @app.get("/api/needs")
    @role_required("resident", "coordinator")
    def needs():
        query = select(Need).order_by(Need.created_at.desc())
        query = query.where(Need.resident_id == current_user.id) if current_user.role == "resident" else query.where(Need.shelter_id == current_user.shelter_id)
        return jsonify(needs=[need_json(n) for n in db.session.scalars(query)])

    @app.get("/api/needs/<need_id>")
    @role_required("resident", "coordinator")
    def need_detail(need_id):
        return jsonify(need=need_json(scoped_need(need_id), history=True))

    @app.post("/api/needs")
    @role_required("resident")
    def create_need():
        data = payload(); key = command(data)
        digest = sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        existing = db.session.get(Submission, key)
        if existing:
            if existing.actor_id != current_user.id or existing.payload_hash != digest: fail("conflict", "This action reference was already used.", 409)
            return jsonify(need=need_json(db.session.get(Need, existing.need_id), history=True))
        category = data.get("category")
        if category not in ("essentials", "oxygen", "power"): fail("category_unavailable", "This care service is planned for a later phase.")
        if not current_user.shelter_id: fail("invalid_shelter", "A shelter assignment is required.")
        item = None; unit = None; quantity = 0; details = {}
        if category == "essentials":
            item = data.get("item")
            if item not in ITEMS: fail("invalid_item", "Choose an available essential supply.")
            unit = ITEMS[item]; quantity = integer(data, "quantity")
        else:
            device = text(data, "device_type", 80, True)
            if device not in ("oxygen_concentrator", "ventilator", "suction_device", "feeding_device", "oxygen_cylinder", "other", "unknown"):
                fail("invalid_device", "Choose an available device type.")
            other = text(data, "other_device", 100, device == "other")
            power = data.get("power_status", "unknown")
            if power not in ("available", "unavailable", "unknown"): fail("invalid_input", "Choose a valid power status.")
            details = dict(device_type=device, other_device=other, power_status=power,
                           remaining_supply=text(data, "remaining_supply", 100), backup=text(data, "backup", 100))
        urgent = data.get("reported_urgent", False)
        if not isinstance(urgent, bool): fail("invalid_input", "Urgency must be a yes/no value.")
        need = Need(reference="MAAK-"+secrets.token_hex(4).upper(), resident_id=current_user.id,
                    shelter_id=current_user.shelter_id, category=category, item=item, unit=unit, quantity=quantity,
                    details=details, private_note=text(data, "private_note", 1000), reported_urgent=urgent)
        db.session.add(need); db.session.flush(); add_event(need, "submitted")
        db.session.add(Submission(id=key, actor_id=current_user.id, need_id=need.id, payload_hash=digest))
        db.session.commit()
        return jsonify(need=need_json(need, history=True)), 201

    @app.post("/api/needs/<need_id>/review")
    @role_required("coordinator")
    def review(need_id):
        need = scoped_need(need_id); data = payload()
        if need.reviewed: return jsonify(need=need_json(need, history=True))
        need.reviewed = True; need.coordinator_note = text(data, "coordinator_note", 400, True)
        add_event(need, "reviewed"); db.session.commit()
        return jsonify(need=need_json(need, history=True))

    @app.post("/api/needs/<need_id>/publish")
    @role_required("coordinator")
    def publish(need_id):
        need = scoped_need(need_id)
        if not need.reviewed or need.category != "essentials": fail("needs_review", "Only reviewed essential-supply needs can be published.", 409)
        if need.published: return jsonify(need=need_json(need, history=True))
        need.public_description = text(payload(), "description", 400, True)
        need.published = True; add_event(need, "published"); db.session.commit()
        return jsonify(need=need_json(need, history=True))

    @app.get("/api/opportunities")
    @role_required("donor")
    def opportunities():
        rows = db.session.scalars(select(Need).where(Need.published.is_(True), Need.received < Need.quantity).order_by(Need.updated_at.desc()))
        return jsonify(opportunities=[opportunity_json(n) for n in rows])

    @app.get("/api/pledges")
    @role_required("donor", "coordinator")
    def pledges():
        query = select(Pledge).join(Need).order_by(Pledge.created_at.desc())
        query = query.where(Pledge.donor_id == current_user.id) if current_user.role == "donor" else query.where(Need.shelter_id == current_user.shelter_id)
        return jsonify(pledges=[pledge_json(p) for p in db.session.scalars(query)])

    @app.post("/api/pledges")
    @role_required("donor")
    def pledge():
        data = payload(); key = command(data); quantity = integer(data, "quantity")
        existing = db.session.scalar(select(Pledge).where(Pledge.command_id == key))
        if existing:
            if existing.donor_id != current_user.id or existing.need_id != data.get("need_id") or existing.quantity != quantity: fail("conflict", "This action reference was already used.", 409)
            return jsonify(pledge=pledge_json(existing))
        need = db.session.get(Need, data.get("need_id"))
        if not need or not need.published: fail("not_found", "This opportunity is not available.", 404)
        claim = db.session.execute(update(Need).where(Need.id == need.id, Need.quantity-Need.received-Need.committed >= quantity).values(committed=Need.committed+quantity).execution_options(synchronize_session=False))
        if claim.rowcount != 1: fail("quantity_unavailable", "This quantity is no longer available to pledge.", 409)
        row = Pledge(command_id=key, need_id=need.id, donor_id=current_user.id, quantity=quantity)
        db.session.add(row); add_event(need, "pledged", quantity); db.session.commit()
        return jsonify(pledge=pledge_json(row)), 201

    @app.post("/api/pledges/<pledge_id>/task")
    @role_required("coordinator")
    def create_task(pledge_id):
        pledge = db.session.get(Pledge, pledge_id)
        if not pledge or pledge.need.shelter_id != current_user.shelter_id: fail("not_found", "This pledge is not available.", 404)
        if pledge.task: return jsonify(task=task_json(pledge.task))
        task = Task(pledge_id=pledge.id, pickup_instructions=text(payload(), "pickup_instructions", 400, True))
        db.session.add(task); add_event(pledge.need, "task_created", pledge.quantity); db.session.commit()
        return jsonify(task=task_json(task)), 201

    @app.get("/api/tasks")
    @role_required("volunteer", "coordinator")
    def tasks():
        query = select(Task).join(Pledge).join(Need).order_by(Task.created_at.desc())
        if current_user.role == "volunteer":
            query = query.where((Task.volunteer_id == current_user.id) | (Task.status == "available"))
        else: query = query.where(Need.shelter_id == current_user.shelter_id)
        return jsonify(tasks=[task_json(t) for t in db.session.scalars(query)])

    @app.post("/api/tasks/<task_id>/<action>")
    @role_required("volunteer")
    def task_action(task_id, action):
        task = db.session.get(Task, task_id)
        if not task: fail("not_found", "This task is not available.", 404)
        if not current_user.volunteer_approved: fail("volunteer_pending", "Your volunteer eligibility must be approved first.", 403)
        transitions = {"accept": ("available", "assigned"), "pickup": ("assigned", "picked_up"), "deliver": ("picked_up", "delivered")}
        if action not in transitions: fail("invalid_action", "This task action is not available.")
        before, after = transitions[action]
        if task.volunteer_id == current_user.id and task.status == after: return jsonify(task=task_json(task))
        condition = [Task.id == task_id, Task.status == before]
        condition += [Task.volunteer_id.is_(None)] if action == "accept" else [Task.volunteer_id == current_user.id]
        claimed = db.session.execute(update(Task).where(*condition).values(status=after, volunteer_id=current_user.id, updated_at=now()).execution_options(synchronize_session=False))
        if claimed.rowcount != 1: fail("task_conflict", "This task changed or belongs to someone else. Refresh the list.", 409)
        add_event(task.pledge.need, after, task.pledge.quantity); db.session.commit(); db.session.expire_all()
        return jsonify(task=task_json(db.session.get(Task, task_id)))

    @app.post("/api/pledges/<pledge_id>/receive")
    @role_required("coordinator")
    def receive(pledge_id):
        pledge = db.session.get(Pledge, pledge_id)
        if not pledge or pledge.need.shelter_id != current_user.shelter_id: fail("not_found", "This pledge is not available.", 404)
        data = payload(); accepted = integer(data, "quantity", 0, pledge.quantity); note = text(data, "receipt_note", 400, accepted < pledge.quantity)
        if pledge.accepted_quantity is not None:
            if pledge.accepted_quantity != accepted: fail("receipt_exists", "Receipt was already recorded with a different quantity.", 409)
            return jsonify(pledge=pledge_json(pledge))
        if not pledge.task or pledge.task.status != "delivered": fail("not_delivered", "The volunteer must report delivery before receipt is confirmed.", 409)
        claim = db.session.execute(update(Pledge).where(Pledge.id == pledge.id, Pledge.accepted_quantity.is_(None)).values(accepted_quantity=accepted, receipt_note=note).execution_options(synchronize_session=False))
        if claim.rowcount != 1: fail("conflict", "Receipt was already recorded. Refresh.", 409)
        need = pledge.need
        db.session.execute(update(Need).where(Need.id == need.id).values(committed=Need.committed-pledge.quantity, received=Need.received+accepted).execution_options(synchronize_session=False))
        if accepted:
            stock_insert = sqlite_insert(Stock).values(id=uid(), shelter_id=need.shelter_id, item=need.item, unit=need.unit, quantity=accepted, updated_at=now())
            db.session.execute(stock_insert.on_conflict_do_update(index_elements=["shelter_id", "item", "unit"], set_={"quantity": Stock.quantity+accepted, "updated_at": now()}))
        pledge.task.status = "received"; pledge.task.updated_at = now(); add_event(need, "received", accepted)
        db.session.commit(); db.session.expire_all()
        return jsonify(pledge=pledge_json(db.session.get(Pledge, pledge_id)))

    @app.post("/api/needs/<need_id>/<action>")
    @role_required("resident", "coordinator")
    def distribution(need_id, action):
        need = scoped_need(need_id)
        if (action == "distribute" and current_user.role != "coordinator") or (action == "confirm" and current_user.role != "resident"):
            fail("role_forbidden", "This distribution action is not available to your role.", 403)
        if action not in ("distribute", "confirm"): fail("invalid_action", "This request action is not available.")
        data = payload(); key = command(data); quantity = integer(data, "quantity")
        existing = db.session.get(Movement, key)
        if existing:
            if (existing.actor_id, existing.need_id, existing.kind, existing.quantity) != (current_user.id, need_id, action, quantity):
                fail("conflict", "This action reference was already used.", 409)
            return jsonify(need=need_json(need, history=True))
        if action == "distribute":
            claim = db.session.execute(update(Need).where(Need.id == need.id, Need.received-Need.distributed >= quantity).values(distributed=Need.distributed+quantity).execution_options(synchronize_session=False))
            stock_claim = db.session.execute(update(Stock).where(Stock.shelter_id == need.shelter_id, Stock.item == need.item, Stock.unit == need.unit, Stock.quantity >= quantity).values(quantity=Stock.quantity-quantity, updated_at=now()).execution_options(synchronize_session=False))
            if claim.rowcount != 1 or stock_claim.rowcount != 1: fail("quantity_unavailable", "That quantity has not been received or is already distributed.", 409)
        else:
            claim = db.session.execute(update(Need).where(Need.id == need.id, Need.distributed-Need.confirmed >= quantity).values(confirmed=Need.confirmed+quantity).execution_options(synchronize_session=False))
            if claim.rowcount != 1: fail("quantity_unavailable", "Only supplies issued to you can be confirmed.", 409)
        db.session.add(Movement(id=key, need_id=need.id, actor_id=current_user.id, kind=action, quantity=quantity))
        add_event(need, "distributed" if action == "distribute" else "confirmed", quantity)
        db.session.commit(); db.session.expire_all()
        return jsonify(need=need_json(db.session.get(Need, need.id), history=True))

    @app.get("/api/shelter")
    @role_required("coordinator")
    def own_shelter():
        shelter = db.session.get(Shelter, current_user.shelter_id)
        stock = db.session.scalars(select(Stock).where(Stock.shelter_id == shelter.id))
        return jsonify(shelter=shelter_json(shelter), stock=[dict(item=s.item, unit=s.unit, quantity=s.quantity, updated_at=s.updated_at) for s in stock])

    @app.post("/api/shelter")
    @role_required("coordinator")
    def report_shelter():
        data = payload(); shelter = db.session.get(Shelter, current_user.shelter_id)
        shelter.capacity = integer(data, "capacity", 0, 100000); shelter.occupancy = integer(data, "occupancy", 0, 100000)
        status = data.get("power_status", "unknown")
        if status not in ("unknown", "reported_available", "reported_unavailable"): fail("invalid_input", "Choose a valid shelter power status.")
        shelter.power_status = status; shelter.updated_at = now(); db.session.commit()
        return jsonify(shelter=shelter_json(shelter))

    @app.get("/api/overview")
    @role_required("ministry")
    def overview():
        needs = db.session.scalars(select(Need)).all(); shelters = db.session.scalars(select(Shelter)).all()
        groups = {}
        for n in needs:
            if n.category != "essentials": continue
            key = (n.shelter_id, n.item, n.unit)
            row = groups.setdefault(key, dict(shelter_name=n.shelter.name, region=n.shelter.region, item=n.item, unit=n.unit, requested=0, committed=0, received=0, distributed=0, confirmed=0, remaining=0))
            for field, value in (("requested", n.quantity), ("committed", n.committed), ("received", n.received), ("distributed", n.distributed), ("confirmed", n.confirmed), ("remaining", max(0,n.quantity-n.received))): row[field] += value
        pledges = db.session.scalars(select(Pledge)).all()
        return jsonify(metrics=dict(shelters=len(shelters), open_needs=sum(need_status(n) != "fulfilled" for n in needs),
                                    pledges=len(pledges), received_deliveries=sum(p.accepted_quantity is not None for p in pledges),
                                    fulfilled_needs=sum(need_status(n) == "fulfilled" for n in needs)),
                       shelters=[shelter_json(s) for s in shelters], distribution=list(groups.values()), generated_at=now(), mode="synthetic_demo")

    @app.get("/")
    @app.get("/<path:path>")
    def frontend(path=""):
        if path.startswith("api/"): return jsonify(error="Endpoint not found.", code="not_found"), 404
        dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
        if not dist.exists(): return jsonify(message="Frontend not built. Run npm run build in frontend, or use Vite on port 5173."), 503
        target = (dist / path).resolve()
        if target.is_relative_to(dist) and target.is_file(): return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    @app.cli.command("reset-demo")
    @click.option("--yes", is_flag=True, help="Confirm deletion of the current synthetic demo database contents.")
    def reset_demo(yes):
        if not yes: raise click.ClickException("Pass --yes only for a disposable synthetic demo database.")
        db.drop_all(); db.create_all(); seed_demo(); click.echo("Synthetic demo reset.")

    with app.app_context():
        db.create_all()
        if app.config["SEED_DEMO"]: seed_demo()
    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5000, debug=False)
