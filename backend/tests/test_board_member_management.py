import json
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_workflow.db"

import pytest
from fastapi.testclient import TestClient

import main
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


def test_member_alias_uses_editor_permissions():
    permissions = main.utils.normalize_permissions("member", {})
    assert permissions == {
        "viewBoard": True,
        "createTasks": True,
        "editTasks": True,
        "deleteTasks": True,
        "manageMembers": False,
        "manageBoard": False,
    }


def test_role_aliases_are_normalized_to_canonical_roles():
    assert main.utils.normalize_role("super_admin") == "owner"
    assert main.utils.normalize_role("admin") == "administrator"
    assert main.utils.normalize_role("member") == "editor"
    assert main.utils.normalize_role("contributor") == "editor"
    assert main.utils.normalize_role("viewer") == "subscriber"


def test_first_user_is_treated_as_owner_for_owner_access_checks():
    db = SessionLocal()
    db.query(models.User).delete()
    db.commit()

    owner_email = _unique_email("owner")
    owner = models.User(email=owner_email, name="Owner", password_hash="x", role="admin")
    db.add(owner)
    db.commit()
    db.refresh(owner)

    assert main.utils.is_owner_user(owner, db) is True

    db.query(models.User).delete()
    db.commit()
    db.close()


def test_owner_can_invite_new_user_with_password_without_separate_registration():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    invited_email = _unique_email("invited")
    invite_password = "StrongPass123!"

    owner = models.User(email=owner_email, name="Owner", password_hash="x", role="owner")
    db.add(owner)
    db.commit()
    db.refresh(owner)

    board = models.Board(name="Invite Board", owner_id=owner.id)
    db.add(board)
    db.commit()
    db.refresh(board)

    captured = {}
    original_send = main.send_email_safe

    def fake_send(to_email, subject, html_body):
        captured["to"] = to_email
        captured["subject"] = subject
        captured["body"] = html_body
        return True

    main.send_email_safe = fake_send
    try:
        client = TestClient(main.app)
        token = create_token({"sub": owner_email})
        invite_resp = client.post(
            f"/api/boards/{board.id}/invite",
            json={"email": invited_email, "role": "member", "password": invite_password},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert invite_resp.status_code == 200, invite_resp.text

        created_user = db.query(models.User).filter(models.User.email == invited_email).first()
        assert created_user is not None
        assert main.pwd_context.verify(invite_password, created_user.password_hash) is True
        assert invited_email in captured.get("body", "")
        assert invite_password in captured.get("body", "")

        login_resp = client.post(
            "/api/login",
            data={"username": invited_email, "password": invite_password},
        )
        assert login_resp.status_code == 200, login_resp.text
        assert login_resp.json().get("access_token")
    finally:
        main.send_email_safe = original_send

    db.delete(board)
    db.delete(created_user)
    db.delete(owner)
    db.commit()
    db.close()


def test_owner_can_manage_registered_users():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    target_email = _unique_email("member")

    owner = models.User(email=owner_email, name="Owner", password_hash="x", role="owner")
    target = models.User(email=target_email, name="Target", password_hash="x", role="admin")
    db.add_all([owner, target])
    db.commit()
    db.refresh(owner)
    db.refresh(target)

    client = TestClient(main.app)
    token = create_token({"sub": owner_email})
    list_resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.status_code == 200, list_resp.text
    assert any(u["email"] == target_email for u in list_resp.json())

    update_resp = client.put(
        f"/api/admin/users/{target.id}",
        json={"role": "viewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["role"] == "subscriber"

    delete_resp = client.delete(
        f"/api/admin/users/{target.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 200, delete_resp.text
    assert delete_resp.json()["deleted"] is True

    db.delete(owner)
    db.commit()
    db.close()


def test_owner_delete_user_removes_target_data_from_database():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    target_email = _unique_email("target")

    owner = models.User(email=owner_email, name="Owner", password_hash="x", role="owner")
    target = models.User(email=target_email, name="Target", password_hash="x", role="member")
    db.add_all([owner, target])
    db.commit()
    db.refresh(owner)
    db.refresh(target)

    board = models.Board(name="Delete Me Board", owner_id=target.id)
    db.add(board)
    db.commit()
    db.refresh(board)
    board_id = board.id

    db.add(models.BoardMember(board_id=board_id, user_id=target.id, role="member"))
    task = models.Task(title="Target task", status="todo", priority="medium", board_id=board_id, user_id=target.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    task_id = task.id

    db.add(models.Comment(text="Target comment", task_id=task_id, user_id=target.id, user_name=target.name))
    db.add(models.Notification(user_id=target.id, board_id=board_id, message="Target notification"))
    db.commit()

    client = TestClient(main.app)
    token = create_token({"sub": owner_email})
    delete_resp = client.delete(
        f"/api/admin/users/{target.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 200, delete_resp.text

    verify_db = SessionLocal()
    try:
        assert verify_db.query(models.User).filter(models.User.id == target.id).first() is None
        assert verify_db.query(models.Board).filter(models.Board.id == board_id).first() is None
        assert verify_db.query(models.BoardMember).filter(models.BoardMember.user_id == target.id).count() == 0
        assert verify_db.query(models.Task).filter(models.Task.id == task_id).first() is None
        assert verify_db.query(models.Comment).filter(models.Comment.user_id == target.id).count() == 0
        assert verify_db.query(models.Notification).filter(models.Notification.user_id == target.id).count() == 0
    finally:
        verify_db.close()

    db.delete(owner)
    db.commit()
    db.close()


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
    assert update_response.json()["role"] == "subscriber"

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


def test_board_list_returns_current_users_board_role():
    db = SessionLocal()
    owner_email = _unique_email("owner")
    member_email = _unique_email("member")

    owner = models.User(email=owner_email, name="Owner", password_hash="x", role="owner")
    member = models.User(email=member_email, name="Member", password_hash="x", role="administrator")
    db.add_all([owner, member])
    db.commit()
    db.refresh(owner)
    db.refresh(member)

    board = models.Board(name="Member Role Board", owner_id=owner.id)
    db.add(board)
    db.commit()
    db.refresh(board)

    db.add(models.BoardMember(board_id=board.id, user_id=member.id, role="guest"))
    db.commit()

    client = TestClient(main.app)
    token = create_token({"sub": member_email})
    headers = {"Authorization": f"Bearer {token}"}

    boards_resp = client.get("/api/boards", headers=headers)
    assert boards_resp.status_code == 200, boards_resp.text
    board_payload = next(item for item in boards_resp.json() if item["id"] == board.id)
    assert board_payload["role"] == "guest"
    assert board_payload["permissions"]["editTasks"] is False

    members_resp = client.get(f"/api/boards/{board.id}/members", headers=headers)
    assert members_resp.status_code == 200, members_resp.text
    current_member = next(item for item in members_resp.json() if item["email"] == member_email)
    assert current_member["role"] == "guest"
    assert current_member["is_current_user"] is True
    assert current_member["board_id"] == board.id

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
