"""Tests for the automation Value field.

Two defects prompted these:
  1. "Move to Board" was offered in the action dropdown but implemented nowhere,
     so it only produced rules that saved cleanly and never did anything.
  2. assign_to wrote whatever string it was given. Task.assigned_to is matched
     against users.email before anyone is notified, so a typo silently stored a
     value no user could ever satisfy.
"""
import json
import os
import re
import uuid
from datetime import date, timedelta
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest

import core
import main
import models
from database import SessionLocal
from utils import create_token


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def clean_database():
    def clear():
        db = SessionLocal()
        try:
            for model in (
                main.Automation, models.Notification, models.Activity, models.Comment,
                models.Subtask, models.Task, models.BoardMember, models.Board, models.User,
            ):
                db.query(model).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    clear()
    yield
    clear()


@pytest.fixture
def board():
    db = SessionLocal()
    try:
        email = _unique_email("assign")
        user = models.User(email=email, name="Owner", password_hash="x", role="owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        b = models.Board(name="Assign Board", owner_id=user.id)
        db.add(b)
        db.commit()
        db.refresh(b)
        yield {"id": b.id, "owner_email": email}
    finally:
        db.close()


def _rule(board_id, action_type, payload, **overrides):
    fields = {
        "trigger_type": "status_change",
        "trigger_condition": "done",
    }
    fields.update(overrides)
    db = SessionLocal()
    try:
        rule = main.Automation(
            board_id=board_id,
            action_type=action_type,
            action_payload=json.dumps(payload),
            is_active=True,
            **fields,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule.id
    finally:
        db.close()


def _task(board_id, status="todo"):
    db = SessionLocal()
    try:
        t = models.Task(board_id=board_id, title="Automate me", status=status)
        db.add(t)
        db.commit()
        db.refresh(t)
        return t.id
    finally:
        db.close()


def _assigned_to(task_id):
    db = SessionLocal()
    try:
        return db.query(models.Task).filter(models.Task.id == task_id).one().assigned_to
    finally:
        db.close()


def _fire_status_change(board_id, task_id, new_status="done", old_status="todo"):
    """Mirror what update_task does: the status is already changed on the object
    when apply_automations runs, and the old value is passed in."""
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).one()
        task.status = new_status
        core.apply_automations(task, board_id, "update", old_status, db)
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------- assign_to

def test_assign_to_writes_a_real_users_email(board):
    db = SessionLocal()
    try:
        teammate = models.User(email=_unique_email("mate"), name="Teammate", password_hash="x")
        db.add(teammate)
        db.commit()
        teammate_email = teammate.email
    finally:
        db.close()

    _rule(board["id"], "assign_to", {"email": teammate_email})
    task_id = _task(board["id"])
    _fire_status_change(board["id"], task_id)

    assert _assigned_to(task_id) == teammate_email


def test_assign_to_is_case_insensitive(board):
    db = SessionLocal()
    try:
        teammate = models.User(email=_unique_email("case"), name="Case", password_hash="x")
        db.add(teammate)
        db.commit()
        teammate_email = teammate.email
    finally:
        db.close()

    _rule(board["id"], "assign_to", {"email": teammate_email.upper()})
    task_id = _task(board["id"])
    _fire_status_change(board["id"], task_id)

    assert _assigned_to(task_id) == teammate_email


def test_assign_to_to_an_unknown_address_is_skipped(board):
    """The core fix: a dead value is no longer stored on the task."""
    _rule(board["id"], "assign_to", {"email": "nobody@nowhere.test"})
    task_id = _task(board["id"])
    _fire_status_change(board["id"], task_id)

    assert _assigned_to(task_id) == ""


def test_assign_to_a_username_instead_of_an_email_is_skipped(board):
    db = SessionLocal()
    try:
        teammate = models.User(email=_unique_email("uname"), name="Teammate", password_hash="x")
        db.add(teammate)
        db.commit()
    finally:
        db.close()

    _rule(board["id"], "assign_to", {"email": "teammate"})
    task_id = _task(board["id"])
    _fire_status_change(board["id"], task_id)

    assert _assigned_to(task_id) == ""


def test_assign_to_with_a_blank_target_is_a_no_op(board):
    _rule(board["id"], "assign_to", {"email": "   "})
    task_id = _task(board["id"])
    _fire_status_change(board["id"], task_id)
    assert _assigned_to(task_id) == ""


def test_the_due_date_scan_resolves_assignees_too(board):
    """Both paths share the validation; the scan must not be the leaky one."""
    today = date.today()
    due = (today + timedelta(days=1)).isoformat()

    def add_task(due_date):
        db = SessionLocal()
        try:
            t = models.Task(board_id=board["id"], title="Automate me", status="todo", due_date=due_date)
            db.add(t)
            db.commit()
            db.refresh(t)
            return t.id
        finally:
            db.close()

    def scan():
        db = SessionLocal()
        try:
            core.run_due_date_automations(db, today=today)
        finally:
            db.close()

    # An unknown address must not be written.
    _rule(board["id"], "assign_to", {"email": "ghost@nowhere.test"},
          trigger_type="due_date", trigger_condition="todo", trigger_value="1")
    unknown_task = add_task(due)
    scan()
    assert _assigned_to(unknown_task) == ""

    # A known address must be.
    db = SessionLocal()
    try:
        teammate = models.User(email=_unique_email("scan"), name="Teammate", password_hash="x")
        db.add(teammate)
        db.commit()
        teammate_email = teammate.email
    finally:
        db.close()

    _rule(board["id"], "assign_to", {"email": teammate_email},
          trigger_type="due_date", trigger_condition="todo", trigger_value="1")
    known_task = add_task(due)
    scan()
    assert _assigned_to(known_task) == teammate_email


# ---------------------------------------------------------------- other actions

def test_add_label_still_works(board):
    _rule(board["id"], "add_label", {"label": "auto-done"})
    task_id = _task(board["id"])
    _fire_status_change(board["id"], task_id)

    db = SessionLocal()
    try:
        assert "auto-done" in db.query(models.Task).filter(models.Task.id == task_id).one().labels
    finally:
        db.close()


# ---------------------------------------------------------------- the UI

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"
AUTOMATIONS = FRONTEND / "components" / "views" / "AdvancedAutomations.jsx"
I18N = FRONTEND / "i18n.js"


def _action_options():
    """Only the Action (THEN) select, not the trigger/condition selects."""
    source = AUTOMATIONS.read_text(encoding="utf-8")
    block = source.split("value={newRule.action_type}")[1].split("</select>")[0]
    return re.findall(r'<option value="([a-z_]+)"', block)


def test_move_board_is_not_offered_in_the_dropdown():
    options = _action_options()
    assert "move_board" not in options, "an unimplemented action is still offered"
    assert set(options) == {"send_email", "assign_to", "add_label"}


def test_every_offered_action_has_a_value_hint():
    """The dropdown and the per-action metadata must not drift apart."""
    source = AUTOMATIONS.read_text(encoding="utf-8")
    offered = set(_action_options())
    documented = set(re.findall(r"^  ([a-z_]+): \{$", source, re.MULTILINE))
    assert offered == documented, f"offered={offered} documented={documented}"
    for key in offered:
        block = source.split(f"  {key}: {{")[1].split("\n  },")[0]
        assert "placeholder:" in block, f"{key} has no example placeholder"
        assert "hint:" in block, f"{key} has no explanation"


def test_the_misleading_username_hint_is_gone():
    """Only the strings that reach the UI matter, so check t() keys."""
    source = AUTOMATIONS.read_text(encoding="utf-8")
    user_facing = " ".join(re.findall(r"t\(\s*'([^']*)'", source))
    bundle = I18N.read_text(encoding="utf-8")
    assert "Please provide a target value (e.g." not in user_facing
    assert "Please provide a target value (e.g." not in bundle
    assert "or Username" not in bundle
    assert "Please provide a target value" in user_facing


def test_the_value_field_is_labelled_and_described():
    source = AUTOMATIONS.read_text(encoding="utf-8")
    assert 'id="automation-target"' in source
    assert 'htmlFor="automation-target"' in source
    assert 'aria-describedby="automation-target-hint"' in source
    assert 'id="automation-target-hint"' in source
