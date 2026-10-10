from datetime import datetime, timezone
from uuid import uuid4

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def now():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return str(uuid4())


class Shelter(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    name = db.Column(db.String(160), nullable=False)
    region = db.Column(db.String(80), nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=0)
    occupancy = db.Column(db.Integer, nullable=False, default=0)
    power_status = db.Column(db.String(30), nullable=False, default="unknown")
    updated_at = db.Column(db.String(40), nullable=False, default=now)
    __table_args__ = (db.CheckConstraint("capacity >= 0 AND occupancy >= 0"),)


class User(UserMixin, db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(30), nullable=False)
    shelter_id = db.Column(db.String(36), db.ForeignKey("shelter.id"))
    volunteer_approved = db.Column(db.Boolean, nullable=False, default=False)
    __table_args__ = (db.CheckConstraint("role IN ('resident','coordinator','donor','volunteer','ministry')"),)


class Need(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    reference = db.Column(db.String(20), unique=True, nullable=False)
    resident_id = db.Column(db.String(36), db.ForeignKey("user.id"), nullable=False)
    shelter_id = db.Column(db.String(36), db.ForeignKey("shelter.id"), nullable=False)
    category = db.Column(db.String(30), nullable=False)
    details = db.Column(db.JSON, nullable=False, default=dict)
    private_note = db.Column(db.Text, nullable=False, default="")
    item = db.Column(db.String(100))
    unit = db.Column(db.String(30))
    quantity = db.Column(db.Integer, nullable=False, default=0)
    committed = db.Column(db.Integer, nullable=False, default=0)
    received = db.Column(db.Integer, nullable=False, default=0)
    distributed = db.Column(db.Integer, nullable=False, default=0)
    confirmed = db.Column(db.Integer, nullable=False, default=0)
    reviewed = db.Column(db.Boolean, nullable=False, default=False)
    published = db.Column(db.Boolean, nullable=False, default=False)
    public_description = db.Column(db.String(400), nullable=False, default="")
    reported_urgent = db.Column(db.Boolean, nullable=False, default=False)
    coordinator_note = db.Column(db.String(400), nullable=False, default="")
    created_at = db.Column(db.String(40), nullable=False, default=now)
    updated_at = db.Column(db.String(40), nullable=False, default=now)
    resident = db.relationship("User")
    shelter = db.relationship("Shelter")
    __table_args__ = (
        db.CheckConstraint("quantity >= 0 AND committed >= 0 AND received >= 0 AND distributed >= 0 AND confirmed >= 0"),
        db.CheckConstraint("confirmed <= distributed AND distributed <= received AND received + committed <= quantity"),
    )


class Pledge(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    command_id = db.Column(db.String(36), unique=True, nullable=False)
    need_id = db.Column(db.String(36), db.ForeignKey("need.id"), nullable=False)
    donor_id = db.Column(db.String(36), db.ForeignKey("user.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    accepted_quantity = db.Column(db.Integer)
    receipt_note = db.Column(db.String(400), nullable=False, default="")
    created_at = db.Column(db.String(40), nullable=False, default=now)
    need = db.relationship("Need")
    donor = db.relationship("User")
    task = db.relationship("Task", uselist=False, back_populates="pledge")
    __table_args__ = (db.CheckConstraint("quantity > 0 AND (accepted_quantity IS NULL OR (accepted_quantity >= 0 AND accepted_quantity <= quantity))"),)


class Task(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    pledge_id = db.Column(db.String(36), db.ForeignKey("pledge.id"), unique=True, nullable=False)
    volunteer_id = db.Column(db.String(36), db.ForeignKey("user.id"))
    status = db.Column(db.String(30), nullable=False, default="available")
    pickup_instructions = db.Column(db.String(400), nullable=False)
    created_at = db.Column(db.String(40), nullable=False, default=now)
    updated_at = db.Column(db.String(40), nullable=False, default=now)
    pledge = db.relationship("Pledge", back_populates="task")
    volunteer = db.relationship("User")
    __table_args__ = (db.CheckConstraint("status IN ('available','assigned','picked_up','delivered','received')"),)


class Stock(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    shelter_id = db.Column(db.String(36), db.ForeignKey("shelter.id"), nullable=False)
    item = db.Column(db.String(100), nullable=False)
    unit = db.Column(db.String(30), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.String(40), nullable=False, default=now)
    __table_args__ = (db.UniqueConstraint("shelter_id", "item", "unit"), db.CheckConstraint("quantity >= 0"))


class ActionEvent(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=uid)
    need_id = db.Column(db.String(36), db.ForeignKey("need.id"), nullable=False)
    actor_id = db.Column(db.String(36), db.ForeignKey("user.id"), nullable=False)
    kind = db.Column(db.String(40), nullable=False)
    quantity = db.Column(db.Integer)
    created_at = db.Column(db.String(40), nullable=False, default=now)
    actor = db.relationship("User")


class Movement(db.Model):
    id = db.Column(db.String(36), primary_key=True)  # caller idempotency key
    need_id = db.Column(db.String(36), db.ForeignKey("need.id"), nullable=False)
    actor_id = db.Column(db.String(36), db.ForeignKey("user.id"), nullable=False)
    kind = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.String(40), nullable=False, default=now)


class Submission(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    actor_id = db.Column(db.String(36), db.ForeignKey("user.id"), nullable=False)
    need_id = db.Column(db.String(36), db.ForeignKey("need.id"), nullable=False)
    payload_hash = db.Column(db.String(64), nullable=False)
