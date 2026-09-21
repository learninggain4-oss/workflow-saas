import json
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"

from fastapi.testclient import TestClient

import main
from database import SessionLocal
import models
from utils import create_token


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def test_registered_users_default_to_admin_permissions():
    from utils import PERMISSION_KEYS
    permissions = main.utils.normalize_permissions("member", {})
    assert permissions == {key: True for key in PERMISSION_KEYS}


def test_role_aliases_are_normalized_to_canonical_roles():
    assert main.utils.normalize_role("super_admin") == "owner"
    assert main.utils.normalize_role("administrator") == "admin"
    assert main.utils.normalize_role("editor") == "member"
    assert main.utils.normalize_role("guest") == "contributor"
    assert main.utils.normalize_role("subscriber") == "viewer"


def test_board_member_role_update_and_remove():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    member_email = _unique_email("member")

    owner = models.User(email=owner_email, name="Owner", password_hash="x")
    member = models.User(email=member_email, name="Member", password_hash="x")
    db.add_all([owner, member])
    db.commit()
    db.refresh(owner)
    db.refresh(member)

    board = models.Board(name="Team Board", owner_id=owner.id)
    db.add(board)
    db.commit()
    db.refresh(board)

    db.add(models.BoardMember(board_id=board.id, user_id=member.id, role="member"))
    db.commit()

    token = create_token({"sub": owner_email})
    client = TestClient(main.app)
    headers = {"Authorization": f"Bearer {token}"}

    update_response = client.put(
        f"/api/boards/{board.id}/members/{member.id}",
        json={"role": "viewer"},
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["role"] == "viewer"

    remove_response = client.delete(
        f"/api/boards/{board.id}/members/{member.id}",
        headers=headers,
    )
    assert remove_response.status_code == 200, remove_response.text
    assert remove_response.json()["removed"] is True

    db.delete(board)
    db.delete(member)
    db.delete(owner)
    db.commit()
    db.close()


def test_viewer_cannot_create_tasks():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    viewer_email = _unique_email("viewer")

    owner = models.User(email=owner_email, name="Owner", password_hash="x")
    viewer = models.User(email=viewer_email, name="Viewer", password_hash="x")
    db.add_all([owner, viewer])
    db.commit()
    db.refresh(owner)
    db.refresh(viewer)

    board = models.Board(name="Read Only Board", owner_id=owner.id)
    db.add(board)
    db.commit()
    db.refresh(board)

    db.add(models.BoardMember(board_id=board.id, user_id=viewer.id, role="viewer"))
    db.commit()

    client = TestClient(main.app)
    token = create_token({"sub": viewer_email})
    resp = client.post(
        "/api/tasks",
        json={"title": "Should fail", "status": "todo", "priority": "medium", "board_id": board.id},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403, resp.text

    db.delete(board)
    db.delete(viewer)
    db.delete(owner)
    db.commit()
    db.close()


def test_member_without_edit_permission_cannot_update_task():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    member_email = _unique_email("member")

    owner = models.User(email=owner_email, name="Owner", password_hash="x")
    member = models.User(email=member_email, name="Member", password_hash="x")
    db.add_all([owner, member])
    db.commit()
    db.refresh(owner)
    db.refresh(member)

    board = models.Board(name="Restricted Board", owner_id=owner.id)
    db.add(board)
    db.commit()
    db.refresh(board)

    permissions = {
        "viewBoard": True,
        "createTasks": True,
        "editTasks": False,
        "deleteTasks": False,
        "manageMembers": False,
        "manageBoard": False,
    }
    db.add(models.BoardMember(board_id=board.id, user_id=member.id, role="member", permissions=json.dumps(permissions)))
    db.commit()

    task = models.Task(title="Locked task", status="todo", priority="medium", board_id=board.id, user_id=owner.id)
    db.add(task)
    db.commit()
    db.refresh(task)

    client = TestClient(main.app)
    token = create_token({"sub": member_email})
    resp = client.put(
        f"/api/tasks/{task.id}",
        json={"status": "done"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403, resp.text

    db.delete(task)
    db.delete(board)
    db.delete(member)
    db.delete(owner)
    db.commit()
    db.close()
