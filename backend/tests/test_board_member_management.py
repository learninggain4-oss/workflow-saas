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
