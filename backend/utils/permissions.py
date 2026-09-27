import json
from typing import Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models
from database import SessionLocal

from .timestamp import now_str
from .email import send_email_safe, build_professional_email_html


PERMISSION_KEYS = [
    "viewBoard",
    "createTasks",
    "editTasks",
    "deleteTasks",
    "manageMembers",
    "manageBoard",
    "viewRoleDistribution",
    "viewAutomations",
    "manageAutomations",
]

ROLE_ALIASES = {
    "owner": "owner",
    "super_admin": "owner",
    "superadmin": "owner",
    "administrator": "administrator",
    "admin": "administrator",
    "editor": "editor",
    "member": "editor",
    "contributor": "editor",
    "guest": "guest",
    "subscriber": "subscriber",
    "viewer": "subscriber",
}

ROLE_HIERARCHY = {
    "owner": 5,
    "administrator": 4,
    "editor": 3,
    "guest": 2,
    "subscriber": 1,
}


def normalize_role(role):
    if role is None:
        return "editor"
    candidate = str(role).strip().lower().replace("-", "_").replace(" ", "_")
    if candidate in ROLE_ALIASES:
        return ROLE_ALIASES[candidate]
    for alias, canonical in ROLE_ALIASES.items():
        if candidate == alias or candidate == canonical:
            return canonical
    return "editor"


def default_permissions_for_role(role):
    role_name = normalize_role(role)
    if role_name in {"owner", "administrator"}:
        return {key: True for key in PERMISSION_KEYS}
    if role_name == "editor":
        return {
            "viewBoard": True,
            "createTasks": True,
            "editTasks": True,
            "deleteTasks": True,
            "manageMembers": False,
            "manageBoard": False,
            "viewRoleDistribution": True,
            "viewAutomations": True,
            "manageAutomations": False,
        }
    if role_name == "guest":
        return {
            "viewBoard": True,
            "createTasks": True,
            "editTasks": False,
            "deleteTasks": False,
            "manageMembers": False,
            "manageBoard": False,
            "viewRoleDistribution": False,
            "viewAutomations": False,
            "manageAutomations": False,
        }
    return {
        "viewBoard": True,
        "createTasks": False,
        "editTasks": False,
        "deleteTasks": False,
        "manageMembers": False,
        "manageBoard": False,
        "viewRoleDistribution": False,
        "viewAutomations": False,
        "manageAutomations": False,
    }


def normalize_permissions(role, custom_permissions=None):
    permissions = default_permissions_for_role(role)
    if isinstance(custom_permissions, dict):
        for key in PERMISSION_KEYS:
            if key in custom_permissions and isinstance(custom_permissions[key], bool):
                permissions[key] = bool(custom_permissions[key])
    return permissions


def is_owner_user(user, db: Session = None):
    if user is None:
        return False
    if normalize_role(getattr(user, "role", "administrator")) == "owner":
        return True
    if db is None:
        return False
    first_user = db.query(models.User).order_by(models.User.id.asc()).first()
    if first_user is None:
        return False
    return user.id == first_user.id


def get_board_member_role(board_id: int, user_id: int, db: Session):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        return None
    if board.owner_id == user_id:
        return "owner"
    members = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).all()
    if not members:
        return None
    highest_role = None
    highest_level = -1
    for m in members:
        r = normalize_role((m.role or "editor").strip())
        level = ROLE_HIERARCHY.get(r, 0)
        if level > highest_level:
            highest_level = level
            highest_role = r
    return highest_role or normalize_role((members[0].role or "editor").strip())


def get_board_member_permissions(board_id: int, user_id: int, db: Session):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        return default_permissions_for_role("subscriber")
    if board.owner_id == user_id:
        return default_permissions_for_role("owner")
    members = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).all()
    if not members:
        return default_permissions_for_role("subscriber")

    resolved_role = get_board_member_role(board_id, user_id, db)
    selected_members = [m for m in members if normalize_role((m.role or "editor").strip()) == resolved_role]
    if not selected_members:
        selected_members = members

    custom_permissions = {}
    for member in selected_members:
        if not member.permissions:
            continue
        try:
            parsed = json.loads(member.permissions)
            if isinstance(parsed, dict):
                for key, value in parsed.items():
                    if key in PERMISSION_KEYS and isinstance(value, bool):
                        custom_permissions[key] = bool(value)
        except Exception:
            pass

    return normalize_permissions(resolved_role, custom_permissions)


def ensure_board_access(board_id: int, user, db: Session, required_role: str = "subscriber", action: str = "Board access", required_permission: str = None):
    if board_id is None:
        raise HTTPException(status_code=403, detail=f"{action} denied")

    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if board.owner_id == user.id:
        return board

    if normalize_role(getattr(user, "role", "")) == "owner":
        return board

    permissions = get_board_member_permissions(board_id, user.id, db)
    permission_map = {
        "owner": "manageBoard",
        "administrator": "manageBoard",
        "admin": "manageBoard",
        "editor": "createTasks",
        "member": "createTasks",
        "guest": "viewBoard",
        "subscriber": "viewBoard",
        "viewer": "viewBoard",
    }
    resolved_permission = required_permission or permission_map.get((required_role or "subscriber").lower(), "viewBoard")
    if not permissions.get(resolved_permission, False):
        raise HTTPException(status_code=403, detail=f"{action} requires {resolved_permission} permission")

    return board


def get_user_boards(user, db: Session):
    owned = db.query(models.Board).filter(models.Board.owner_id == user.id).all()
    mids = [m.board_id for m in db.query(models.BoardMember).filter(models.BoardMember.user_id == user.id).all()]
    mboards = db.query(models.Board).filter(models.Board.id.in_(mids)).all() if mids else []
    return list({b.id: b for b in owned + mboards}.values())
