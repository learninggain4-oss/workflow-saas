"""Tests for project settings.

The sidebar had no practical way to reach settings for anything except the
already-selected project, and PUT /api/boards/{id} silently dropped the
description, so a project's description could be set at creation and never
changed afterwards.
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
def owner():
    db = SessionLocal()
    try:
        email = _unique_email("settings")
        # Deliberately NOT the global "owner" role. ensure_board_access lets a
        # global owner reach every board, so using it here would mask the
        # per-board permission checks these tests exist to verify. Registration
        # gives ordinary signups "administrator"; only the first user is "owner".
        user = models.User(email=email, name="Owner", password_hash="x", role="administrator")
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


def _board(account, name="Original", description=""):
    db = SessionLocal()
    try:
        board = models.Board(name=name, description=description, owner_id=account["id"])
        db.add(board)
        db.commit()
        db.refresh(board)
        return board.id
    finally:
        db.close()


# ---------------------------------------------------------------- reading

def test_can_read_a_single_board(owner):
    board_id = _board(owner, "One project", "Just this one")
    resp = owner["client"].get(f"/api/boards/{board_id}", headers=owner["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"] == board_id
    assert body["name"] == "One project"
    assert body["description"] == "Just this one"
    assert body["role"] == "owner"


def test_reading_one_board_needs_a_board_that_exists(owner):
    resp = owner["client"].get("/api/boards/999999", headers=owner["headers"])
    assert resp.status_code == 404, resp.text


def test_a_non_member_sees_a_subscriber_level_view(owner):
    """Non-members get a subscriber view, they do not get management rights.

    The app models read access as subscriber-by-default (every read route uses
    required_role="viewer"), so GET is intentionally lenient. This pins that
    behaviour instead of asserting a stricter rule the app does not have, and
    checks the part that does matter: the response carries no manage rights.
    """
    db = SessionLocal()
    try:
        other = models.User(email=_unique_email("other"), name="Other", password_hash="x")
        db.add(other)
        db.commit()
        db.refresh(other)
        board = models.Board(name="Theirs", owner_id=other.id)
        db.add(board)
        db.commit()
        board_id = board.id
    finally:
        db.close()

    resp = owner["client"].get(f"/api/boards/{board_id}", headers=owner["headers"])
    assert resp.status_code == 200, resp.text
    perms = resp.json()["permissions"]
    assert perms.get("viewBoard") is True
    for forbidden in ("manageBoard", "deleteTasks", "manageMembers", "manageAutomations"):
        assert perms.get(forbidden) is False, f"{forbidden} leaked to a non-member"


def test_a_non_member_cannot_change_a_project(owner):
    """The write path is what has to be locked down."""
    db = SessionLocal()
    try:
        other = models.User(email=_unique_email("other"), name="Other", password_hash="x")
        db.add(other)
        db.commit()
        db.refresh(other)
        board = models.Board(name="Theirs", owner_id=other.id)
        db.add(board)
        db.commit()
        board_id = board.id
    finally:
        db.close()

    resp = owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "Hijacked"}, headers=owner["headers"]
    )
    assert resp.status_code in (403, 404), resp.text


# ---------------------------------------------------------------- writing

def test_description_can_be_set_after_creation(owner):
    """This used to be impossible: the route only wrote the name."""
    board_id = _board(owner, "Original", "")
    resp = owner["client"].put(
        f"/api/boards/{board_id}",
        json={"name": "Original", "description": "What this project is for"},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text

    fetched = owner["client"].get(f"/api/boards/{board_id}", headers=owner["headers"]).json()
    assert fetched["description"] == "What this project is for"


def test_name_and_description_update_together(owner):
    board_id = _board(owner, "Before", "old text")
    resp = owner["client"].put(
        f"/api/boards/{board_id}",
        json={"name": "After", "description": "new text"},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "After"
    assert body["description"] == "new text"


def test_description_can_be_cleared(owner):
    board_id = _board(owner, "Keep name", "remove me")
    resp = owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "Keep name", "description": "  "}, headers=owner["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["description"] == ""


def test_names_are_trimmed(owner):
    board_id = _board(owner)
    resp = owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "   Padded name   ", "description": " x "},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Padded name"
    assert resp.json()["description"] == "x"


# ---------------------------------------------------------------- validation

@pytest.mark.parametrize("blank", ["", "   ", "\t", "\n"])
def test_a_blank_name_is_rejected(owner, blank):
    board_id = _board(owner, "Keep me")
    resp = owner["client"].put(f"/api/boards/{board_id}", json={"name": blank}, headers=owner["headers"])
    assert resp.status_code == 422, resp.text
    # The stored name must be untouched.
    assert owner["client"].get(f"/api/boards/{board_id}", headers=owner["headers"]).json()["name"] == "Keep me"


def test_an_over_long_name_is_rejected(owner):
    board_id = _board(owner)
    resp = owner["client"].put(f"/api/boards/{board_id}", json={"name": "x" * 81}, headers=owner["headers"])
    assert resp.status_code == 422, resp.text
    assert "80" in resp.json()["detail"]


def test_an_over_long_description_is_rejected(owner):
    board_id = _board(owner)
    resp = owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "Fine", "description": "y" * 501}, headers=owner["headers"]
    )
    assert resp.status_code == 422, resp.text


def test_boundary_lengths_are_accepted(owner):
    board_id = _board(owner)
    resp = owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "x" * 80, "description": "y" * 500},
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------- permissions

def test_a_viewer_member_cannot_change_a_project(owner):
    db = SessionLocal()
    try:
        board_id = _board(owner, "Shared")
        viewer = models.User(email=_unique_email("viewer"), name="Viewer", password_hash="x")
        db.add(viewer)
        db.commit()
        db.refresh(viewer)
        db.add(models.BoardMember(board_id=board_id, user_id=viewer.id, role="viewer", permissions="{}"))
        db.commit()
        token = create_token({"sub": viewer.email})
    finally:
        db.close()

    resp = owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "Viewer rename"}, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code in (403, 404), resp.text


def test_an_administrator_member_can_change_a_project(owner):
    db = SessionLocal()
    try:
        board_id = _board(owner, "Shared")
        admin = models.User(email=_unique_email("adm"), name="Admin", password_hash="x")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        db.add(models.BoardMember(board_id=board_id, user_id=admin.id, role="administrator", permissions="{}"))
        db.commit()
        token = create_token({"sub": admin.email})
    finally:
        db.close()

    resp = owner["client"].put(
        f"/api/boards/{board_id}",
        json={"name": "Renamed by admin", "description": "done"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "administrator"


def test_settings_changes_require_authentication(owner):
    board_id = _board(owner)
    resp = owner["client"].put(f"/api/boards/{board_id}", json={"name": "Nope"})
    assert resp.status_code in (401, 403), resp.text


# ---------------------------------------------------------------- side effects

def test_updating_settings_is_recorded_in_the_activity_log(owner):
    board_id = _board(owner, "Before")
    owner["client"].put(
        f"/api/boards/{board_id}", json={"name": "After", "description": "x"}, headers=owner["headers"]
    )
    db = SessionLocal()
    try:
        actions = [a.action for a in db.query(models.Activity).filter(models.Activity.board_id == board_id).all()]
    finally:
        db.close()
    assert any("updated project 'After'" in a for a in actions)


def test_a_rejected_update_writes_no_activity(owner):
    board_id = _board(owner, "Keep")
    owner["client"].put(f"/api/boards/{board_id}", json={"name": "  "}, headers=owner["headers"])
    db = SessionLocal()
    try:
        count = db.query(models.Activity).filter(models.Activity.board_id == board_id).count()
    finally:
        db.close()
    assert count == 0
