import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"

import pytest
from fastapi.testclient import TestClient

import main
import templates_catalog
from database import SessionLocal
import models
from utils import create_token


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(autouse=True)
def clean_database():
    def clear():
        db = SessionLocal()
        try:
            for model in (
                main.Automation,
                models.Notification,
                models.Activity,
                models.Comment,
                models.Subtask,
                models.Task,
                models.BoardMember,
                models.Board,
                models.User,
            ):
                db.query(model).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()

    clear()
    yield
    clear()


def _register_user(email: str, role: str = "owner") -> str:
    db = SessionLocal()
    try:
        user = models.User(email=email, name="Tester", password_hash="x", role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return create_token({"sub": email})
    finally:
        db.close()


def test_registration_creates_no_board():
    """No project is auto-named at signup: the workspace starts empty."""
    email = _unique_email("signup")
    client = TestClient(main.app)
    resp = client.post("/api/register", json={"email": email, "password": "secret123", "name": "Tester"})

    assert resp.status_code == 200, resp.text

    token = create_token({"sub": email})
    boards = client.get("/api/boards", headers={"Authorization": f"Bearer {token}"})
    assert boards.status_code == 200, boards.text
    assert boards.json() == [], "register must not create a placeholder board"


def test_listing_boards_does_not_create_one():
    """GET /api/boards is read-only, so repeated loads stay empty."""
    email = _unique_email("empty")
    token = _register_user(email)
    client = TestClient(main.app)

    for _ in range(3):
        resp = client.get("/api/boards", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        assert resp.json() == []

    db = SessionLocal()
    try:
        assert db.query(models.Board).count() == 0
    finally:
        db.close()


def test_template_catalog_is_served_with_stable_ids():
    email = _unique_email("catalog")
    token = _register_user(email)
    client = TestClient(main.app)

    resp = client.get("/api/templates", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text

    payload = resp.json()
    assert len(payload) == len(templates_catalog.TEMPLATES) > 100
    ids = [t["id"] for t in payload]
    assert len(ids) == len(set(ids)), "template ids must be unique"
    for entry in payload:
        assert entry["id"] and entry["name"] and entry["category"]
        assert len(entry["tiles"]) >= 1
    assert "product-launch" in ids


def test_creating_board_from_template_is_atomic():
    email = _unique_email("template")
    token = _register_user(email)
    client = TestClient(main.app)
    headers = {"Authorization": f"Bearer {token}"}

    template = templates_catalog.get_template("product-launch")
    resp = client.post("/api/boards/from-template", json={"template_id": "product-launch"}, headers=headers)
    assert resp.status_code == 201, resp.text

    board_id = resp.json()["id"]
    db = SessionLocal()
    try:
        board = db.query(models.Board).filter(models.Board.id == board_id).one()
        assert board.name == template["name"]
        assert board.owner_id is not None

        tasks = db.query(models.Task).filter(models.Task.board_id == board_id).all()
        assert [t.title for t in tasks] == template["tiles"]
        # Wire values must match the TaskCreate contract exactly.
        for task in tasks:
            assert task.status == "todo"
            assert task.priority == "medium"
    finally:
        db.close()

    # And the new board shows up in the normal listing.
    listed = client.get("/api/boards", headers=headers)
    assert [b["id"] for b in listed.json()] == [board_id]


def test_user_supplied_name_overrides_template_name():
    """A template must never name the project for the user."""
    email = _unique_email("override")
    token = _register_user(email)
    client = TestClient(main.app)

    resp = client.post(
        "/api/boards/from-template",
        json={"template_id": "product-launch", "name": "  Acme Launch  "},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "Acme Launch"


def test_unknown_template_returns_404():
    email = _unique_email("unknown")
    token = _register_user(email)
    client = TestClient(main.app)

    resp = client.post(
        "/api/boards/from-template",
        json={"template_id": "does-not-exist"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Unknown template"


def test_free_plan_limit_blocks_template_creation():
    """Quota is enforced server-side and no board is left behind."""
    email = _unique_email("quota")
    token = _register_user(email)
    client = TestClient(main.app)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).one()
        for i in range(3):
            db.add(models.Board(name=f"Existing {i}", owner_id=user.id))
        db.commit()
    finally:
        db.close()

    resp = client.post("/api/boards/from-template", json={"template_id": "bug-tracking"}, headers=headers)
    assert resp.status_code == 402, resp.text

    db = SessionLocal()
    try:
        assert db.query(models.Board).count() == 3
        assert db.query(models.Task).count() == 0
    finally:
        db.close()


def test_template_creation_requires_authentication():
    client = TestClient(main.app)
    resp = client.post("/api/boards/from-template", json={"template_id": "product-launch"})
    assert resp.status_code in (401, 403), resp.text
