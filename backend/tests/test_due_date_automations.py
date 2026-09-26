"""Tests for time-based automations ("Due Date is Approaching").

The rule was selectable in the UI and saved happily, but nothing implemented it:
apply_automations() only understands status_change and task_created, and no scan
ran, so the saved rule could never fire. These cover the scan that now runs.
"""
import json
import os
import uuid
from datetime import date, timedelta

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
def sent_emails(monkeypatch):
    """Capture what the scanner would have sent, without an SMTP server."""
    captured = []
    monkeypatch.setattr(
        core, "send_email_safe",
        lambda to, subject, html: captured.append({"to": to, "subject": subject, "html": html}) or True,
    )
    return captured


@pytest.fixture
def board():
    db = SessionLocal()
    try:
        email = _unique_email("due")
        user = models.User(email=email, name="Owner", password_hash="x", role="owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        b = models.Board(name="Due Board", owner_id=user.id)
        db.add(b)
        db.commit()
        db.refresh(b)
        yield b.id
    finally:
        db.close()


def _make_rule(board_id, **overrides):
    db = SessionLocal()
    try:
        payload = {
            "trigger_type": "due_date",
            "trigger_condition": "todo",
            "action_type": "send_email",
            "action_payload": json.dumps({"to": "client@gmail.com"}),
            "trigger_value": "3",
            "is_active": True,
        }
        payload.update(overrides)
        rule = main.Automation(board_id=board_id, **payload)
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule.id
    finally:
        db.close()


def _make_task(board_id, due, status="todo", title="Client deliverable"):
    db = SessionLocal()
    try:
        task = models.Task(
            board_id=board_id, title=title, status=status, priority="medium",
            due_date=due,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task.id
    finally:
        db.close()


def _run(today):
    db = SessionLocal()
    try:
        return core.run_due_date_automations(db, today=today)
    finally:
        db.close()


# ---------------------------------------------------------------- firing

def test_fires_for_a_due_date_inside_the_window(board, sent_emails):
    _make_rule(board)
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=2)).isoformat())

    assert _run(today) == 1
    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == "client@gmail.com"
    assert "Client deliverable" in sent_emails[0]["subject"]


def test_does_not_fire_beyond_the_lead_window(board, sent_emails):
    _make_rule(board, trigger_value="2")
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=5)).isoformat())

    assert _run(today) == 0
    assert sent_emails == []


def test_fires_on_the_due_date_itself_for_a_zero_day_lead(board, sent_emails):
    _make_rule(board, trigger_value="0")
    today = date(2026, 7, 1)
    _make_task(board, today.isoformat())
    assert _run(today) == 1
    assert sent_emails[0]["to"] == "client@gmail.com"


def test_does_not_fire_for_an_overdue_task(board, sent_emails):
    _make_rule(board)
    today = date(2026, 7, 10)
    _make_task(board, (today - timedelta(days=3)).isoformat())

    assert _run(today) == 0
    assert sent_emails == []


def test_ignores_tasks_with_no_due_date(board, sent_emails):
    _make_rule(board)
    _make_task(board, "")
    assert _run(date(2026, 7, 1)) == 0
    assert sent_emails == []


# ---------------------------------------------------------------- dedupe

def test_the_same_reminder_never_fires_twice(board, sent_emails):
    _make_rule(board)
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 1
    # A second scan, and later scans on the following days, must stay silent
    # until the due date changes.
    assert _run(today) == 0
    assert _run(today + timedelta(days=1)) == 0
    assert _run(today + timedelta(days=2)) == 0
    assert len(sent_emails) == 1


def test_rescheduling_a_task_rearms_the_reminder(board, sent_emails):
    _make_rule(board)
    today = date(2026, 7, 1)
    task_id = _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 1
    assert _run(today) == 0

    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).one()
        # Still inside the 3-day window, so it re-arms on this same scan.
        task.due_date = (today + timedelta(days=3)).isoformat()
        db.commit()
    finally:
        db.close()

    # New due date => the reminder is allowed to fire again.
    assert _run(today) == 1
    assert len(sent_emails) == 2


def test_two_rules_on_one_task_both_fire(board, sent_emails):
    _make_rule(board, action_payload=json.dumps({"to": "a@example.com"}))
    _make_rule(board, action_payload=json.dumps({"to": "b@example.com"}))
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 2
    assert sorted(e["to"] for e in sent_emails) == ["a@example.com", "b@example.com"]
    assert _run(today) == 0


# ---------------------------------------------------------------- conditions

def test_respects_the_status_condition(board, sent_emails):
    _make_rule(board, trigger_condition="todo")
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat(), status="doing")

    assert _run(today) == 0
    assert sent_emails == []


def test_empty_condition_matches_any_status(board, sent_emails):
    _make_rule(board, trigger_condition="")
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat(), status="doing")
    assert _run(today) == 1


def test_unusable_status_condition_is_skipped_not_faked(board, sent_emails):
    """high_priority is a priority, not a status - a due_date rule must not
    silently match nothing forever."""
    _make_rule(board, trigger_condition="high_priority")
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 0
    assert sent_emails == []


def test_condition_matching_is_case_insensitive(board, sent_emails):
    _make_rule(board, trigger_condition="TODO")
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat(), status="todo")
    assert _run(today) == 1


# ---------------------------------------------------------------- rule state

def test_inactive_rules_do_not_fire(board, sent_emails):
    _make_rule(board, is_active=False)
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 0
    assert sent_emails == []


def test_event_driven_rules_are_not_double_fired_by_the_scan(board, sent_emails):
    """status_change rules must keep firing from the event hook, not the scan."""
    _make_rule(board, trigger_type="status_change", trigger_condition="done",
               action_payload=json.dumps({"to": "client@gmail.com"}))
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 0
    assert sent_emails == []


def test_rule_with_no_email_target_does_not_mark_itself_notified(board, sent_emails):
    _make_rule(board, action_payload=json.dumps({"to": ""}))
    today = date(2026, 7, 1)
    task_id = _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 0
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).one()
        assert (task.automation_notifications or "{}") == "{}"
    finally:
        db.close()


# ---------------------------------------------------------------- defaults

def test_blank_lead_time_falls_back_to_the_default():
    db = SessionLocal()
    try:
        assert core._reminder_days(main.Automation(trigger_value="")) == core.DEFAULT_DUE_REMINDER_DAYS
        assert core._reminder_days(main.Automation(trigger_value="  ")) == core.DEFAULT_DUE_REMINDER_DAYS
        assert core._reminder_days(main.Automation(trigger_value="abc")) == core.DEFAULT_DUE_REMINDER_DAYS
        assert core._reminder_days(main.Automation(trigger_value="-4")) == 0
        assert core._reminder_days(main.Automation(trigger_value="9999")) == 90
        assert core._reminder_days(main.Automation(trigger_value="7")) == 7
    finally:
        db.close()


def test_blank_lead_time_uses_the_default_window(board, sent_emails):
    _make_rule(board, trigger_value="")
    today = date(2026, 7, 1)
    _make_task(board, (today + timedelta(days=core.DEFAULT_DUE_REMINDER_DAYS)).isoformat())
    assert _run(today) == 1


@pytest.mark.parametrize("raw,expected", [
    ("2026-07-01", date(2026, 7, 1)),
    ("", None),
    (None, None),
    ("not-a-date", None),
    ("2026-07-01T00:00:00", date(2026, 7, 1)),
])
def test_due_date_parsing(raw, expected):
    assert core._parse_due_date(raw) == expected


# ---------------------------------------------------------------- other actions

def test_add_label_action_works_from_the_scan(board, sent_emails):
    _make_rule(board, action_type="add_label", action_payload=json.dumps({"label": "due-soon"}))
    today = date(2026, 7, 1)
    task_id = _make_task(board, (today + timedelta(days=1)).isoformat())

    assert _run(today) == 1
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).one()
        assert "due-soon" in task.labels
    finally:
        db.close()


def test_move_board_action_is_not_faked_by_the_scan(board, sent_emails):
    """Moving a task needs destination membership validation, so the scan
    refuses rather than relocating a task the user cannot access."""
    _make_rule(board, action_type="move_board", action_payload=json.dumps({"value": "99"}))
    today = date(2026, 7, 1)
    task_id = _make_task(board, (today + timedelta(days=1)).isoformat())

    _run(today)
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).one()
        assert task.board_id == board
    finally:
        db.close()


# ---------------------------------------------------------------- API surface

def test_rule_persists_the_lead_time_through_the_api(board):
    from fastapi.testclient import TestClient

    db = SessionLocal()
    try:
        email = db.query(models.Board).filter(models.Board.id == board).one().owner_id
        owner = db.query(models.User).filter(models.User.id == email).one()
        token = create_token({"sub": owner.email})
    finally:
        db.close()

    client = TestClient(main.app)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        f"/api/boards/{board}/automations",
        json={
            "trigger_type": "due_date", "trigger_condition": "todo",
            "action_type": "send_email",
            "action_payload": json.dumps({"to": "client@gmail.com"}),
            "trigger_value": "2",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["trigger_value"] == "2"

    listed = client.get(f"/api/boards/{board}/automations", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()[0]["trigger_value"] == "2"


def test_scheduler_is_off_in_tests():
    """The scan loop must never run against a throwaway database."""
    assert os.getenv("AUTOMATION_SCHEDULER") == "off"
    main.start_automation_scheduler()  # idempotent no-op while disabled
