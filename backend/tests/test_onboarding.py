"""Tests for the live onboarding endpoint.

The Onboarding page used to be entirely mock: four hardcoded steps with fake
statuses, a literal "72% complete", and buttons that did nothing. These assert
the progress the API reports is derived from real rows, and that a brand-new
account honestly reports zero rather than a flattering number.
"""
import json
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"
os.environ["AUTOMATION_SCHEDULER"] = "off"

import pytest
from fastapi.testclient import TestClient

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
def account():
    """A registered user with a client, as the page would see them."""
    db = SessionLocal()
    try:
        email = _unique_email("onboarding")
        user = models.User(email=email, name="Owner", password_hash="x", role="owner")
        db.add(user)
        db.commit()
        db.refresh(user)
        yield {
            "id": user.id,
            "email": email,
            "client": TestClient(main.app),
            "headers": {"Authorization": f"Bearer {create_token({'sub': email})}"},
        }
    finally:
        db.close()


def _get(account):
    resp = account["client"].get("/api/onboarding", headers=account["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()


def _by_key(payload, key):
    return next(s for s in payload["steps"] if s["key"] == key)


def _board(account, name="Project", **overrides):
    db = SessionLocal()
    try:
        board = models.Board(name=name, owner_id=account["id"], **overrides)
        db.add(board)
        db.commit()
        db.refresh(board)
        return board.id
    finally:
        db.close()


# ---------------------------------------------------------------- baseline

def test_new_account_reports_zero_not_a_flattering_number(account):
    payload = _get(account)
    assert payload["completed"] == 0
    assert payload["percent"] == 0
    assert payload["projects"] == 0
    assert payload["tasks"] == 0
    assert all(s["done"] is False for s in payload["steps"])


def test_step_keys_are_stable_and_complete(account):
    payload = _get(account)
    keys = [s["key"] for s in payload["steps"]]
    assert keys == [
        "create_project", "start_from_template", "create_first_task",
        "invite_teammate", "add_automation", "enable_two_factor",
        "email_notifications", "weekly_digest",
    ]
    assert payload["total"] == len(keys)
    assert all(s["kind"] in ("auto", "preference") for s in payload["steps"])


def test_requires_authentication(account):
    resp = TestClient(main.app).get("/api/onboarding")
    assert resp.status_code in (401, 403), resp.text


# ---------------------------------------------------------------- derivation

def test_creating_a_project_completes_its_step(account):
    _board(account)
    payload = _get(account)
    step = _by_key(payload, "create_project")
    assert step["done"] is True
    assert step["count"] == 1
    assert payload["projects"] == 1


def test_a_task_on_a_board_completes_the_task_step(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        db.add(models.Task(board_id=board_id, title="Real work", status="todo"))
        db.commit()
    finally:
        db.close()

    payload = _get(account)
    assert _by_key(payload, "create_first_task")["done"] is True
    assert payload["tasks"] == 1


def test_a_task_on_someone_elses_board_does_not_count(account):
    """The only board here belongs to somebody else, so nothing is done."""
    db = SessionLocal()
    try:
        other = models.User(email=_unique_email("other"), name="Other", password_hash="x")
        db.add(other)
        db.commit()
        db.refresh(other)
        board = models.Board(name="Theirs", owner_id=other.id)
        db.add(board)
        db.commit()
        db.refresh(board)
        db.add(models.Task(board_id=board.id, title="Not mine", status="todo"))
        db.commit()
    finally:
        db.close()

    payload = _get(account)
    assert payload["projects"] == 0
    assert payload["tasks"] == 0
    assert payload["completed"] == 0


def test_a_board_member_means_someone_was_invited(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        assert _by_key(_get(account), "invite_teammate")["done"] is False

        invitee = models.User(email=_unique_email("invitee"), name="Invitee", password_hash="x")
        db.add(invitee)
        db.commit()
        db.refresh(invitee)
        db.add(models.BoardMember(board_id=board_id, user_id=invitee.id, role="editor", permissions="{}"))
        db.commit()

        step = _by_key(_get(account), "invite_teammate")
        assert step["done"] is True
        assert step["count"] == 1
    finally:
        db.close()


def test_an_automation_rule_completes_its_step(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        db.add(main.Automation(
            board_id=board_id, trigger_type="status_change", trigger_condition="done",
            action_type="add_label", action_payload=json.dumps({"label": "x"}), is_active=True,
        ))
        db.commit()

        step = _by_key(_get(account), "add_automation")
        assert step["done"] is True
        assert step["count"] == 1
    finally:
        db.close()


def test_a_template_project_is_recognised_from_the_activity_log(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        db.add(models.Activity(
            board_id=board_id, user_name="Owner",
            action="created board Project from template product-launch",
        ))
        db.commit()

        step = _by_key(_get(account), "start_from_template")
        assert step["done"] is True
        assert step["count"] == 1
    finally:
        db.close()


def test_ordinary_activity_is_not_mistaken_for_a_template(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        db.add(models.Activity(board_id=board_id, user_name="Owner", action="created board Project"))
        db.commit()
        assert _by_key(_get(account), "start_from_template")["done"] is False
    finally:
        db.close()


def test_two_factor_reflects_the_real_column(account):
    assert _by_key(_get(account), "enable_two_factor")["done"] is False

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == account["id"]).one()
        user.two_factor_enabled = True
        db.commit()
    finally:
        db.close()

    assert _by_key(_get(account), "enable_two_factor")["done"] is True


def test_preference_steps_reflect_profile_preferences(account):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == account["id"]).one()
        user.profile_preferences = json.dumps({"emailNotifications": True, "weeklyDigest": False})
        db.commit()
    finally:
        db.close()

    assert _by_key(_get(account), "email_notifications")["done"] is True
    assert _by_key(_get(account), "weekly_digest")["done"] is False


def test_unparseable_preferences_do_not_crash_the_endpoint(account):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == account["id"]).one()
        user.profile_preferences = "not json at all"
        db.commit()
    finally:
        db.close()

    payload = _get(account)
    assert _by_key(payload, "email_notifications")["done"] is False


# ---------------------------------------------------------------- progress

def test_percent_tracks_completion(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        task = models.Task(board_id=board_id, title="Work", status="todo")
        db.add(task)
        db.commit()
    finally:
        db.close()

    payload = _get(account)
    # create_project + create_first_task = 2 of 8 = 25%
    assert payload["completed"] == 2
    assert payload["percent"] == 25


def test_percent_is_exactly_100_only_when_everything_is_done(account):
    board_id = _board(account)
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == account["id"]).one()
        user.two_factor_enabled = True
        user.profile_preferences = json.dumps({"emailNotifications": True, "weeklyDigest": True})
        invitee = models.User(email=_unique_email("invitee"), name="Invitee", password_hash="x")
        db.add(invitee)
        db.commit()
        db.refresh(invitee)
        db.add(models.BoardMember(board_id=board_id, user_id=invitee.id, role="editor", permissions="{}"))
        db.add(models.Task(board_id=board_id, title="Work", status="todo"))
        db.add(models.Activity(
            board_id=board_id, user_name="Owner",
            action="created board Project from template product-launch",
        ))
        db.add(main.Automation(
            board_id=board_id, trigger_type="task_created", trigger_condition="",
            action_type="add_label", action_payload=json.dumps({"label": "x"}), is_active=True,
        ))
        db.commit()
    finally:
        db.close()

    payload = _get(account)
    assert payload["completed"] == payload["total"] == 8
    assert payload["percent"] == 100


def test_progress_updates_without_any_write_from_the_page(account):
    """The point of deriving: doing the thing elsewhere is enough."""
    _board(account)
    assert _by_key(_get(account), "create_project")["done"] is True

    _board(account, name="Second project")
    payload = _get(account)
    assert payload["projects"] == 2
    assert _by_key(payload, "create_project")["count"] == 2


def test_deleting_projects_reduces_progress(account):
    _board(account, name="One")
    board_two = _board(account, name="Two")
    assert _get(account)["projects"] == 2

    db = SessionLocal()
    try:
        db.query(models.Board).filter(models.Board.id == board_two).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    assert _get(account)["projects"] == 1
