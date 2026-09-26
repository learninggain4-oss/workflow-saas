"""Board, template, membership and export routes."""
import io
import csv
import json
import traceback
import threading
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from core import _board_response, _parse_json, create_notification_safe, get_current_user, get_db, get_user_boards, log_activity_safe, models, now_str, pwd_context, schemas, send_email_safe, templates_catalog, utils


router = APIRouter()

@router.get("/api/boards")
def list_boards(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Read-only: an empty list is a valid workspace state. Do not create a
    # placeholder board here, otherwise every first page load would invent a
    # project name the user never chose.
    boards = get_user_boards(current_user, db)
    return [_board_response(board, current_user, db) for board in boards]


@router.get("/api/templates")
def list_templates(current_user=Depends(get_current_user)):
    # Catalog is data, not code, so the Templates screen can filter and preview it
    # without hardcoding 236 entries in the bundle.
    return templates_catalog.list_templates()


@router.post("/api/boards/from-template", status_code=201)
def create_board_from_template(payload: schemas.BoardFromTemplate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    template = templates_catalog.get_template(payload.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Unknown template")

    if current_user.subscription_tier == "free":
        board_count = db.query(models.Board).filter(models.Board.owner_id == current_user.id).count()
        if board_count >= 3:
            raise HTTPException(status_code=402, detail="Free plan limit reached (Max 3 boards).")

    # A user-supplied name always wins; the template name is only a default.
    override = (payload.name or "").strip()
    board_name = override or template["name"]

    # One transaction: either the board and every task land, or nothing does.
    # A client-side loop over POST /api/tasks would leave half-built projects
    # behind on the first failure.
    try:
        board = models.Board(
            name=board_name,
            description=template.get("description", ""),
            owner_id=current_user.id,
        )
        db.add(board)
        db.flush()  # assigns board.id without ending the transaction

        for tile in template.get("tiles", []):
            db.add(models.Task(
                board_id=board.id,
                user_id=current_user.id,
                title=tile,
                status="todo",
                priority="medium",
                created_at=now_str(),
                updated_at=now_str(),
            ))
        db.commit()
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not create project from template.")

    db.refresh(board)
    log_activity_safe(board.id, current_user.name, f"created board {board.name} from template {template['id']}")
    return _board_response(board, current_user, db)


@router.post("/api/boards")
def create_board(payload: schemas.BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.subscription_tier == "free":
        board_count = db.query(models.Board).filter(models.Board.owner_id == current_user.id).count()
        if board_count >= 3:
            raise HTTPException(status_code=402, detail="Free plan limit reached (Max 3 boards).")
            
    b = models.Board(name=payload.name, description=payload.description or "", owner_id=current_user.id)
    db.add(b)
    db.commit()
    db.refresh(b)
    
    log_activity_safe(b.id, current_user.name, f"created board {b.name}")
    return _board_response(b, current_user, db)


@router.get("/api/boards/{board_id}")
def get_board(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Read a single project. Project settings needs the current values, and
    the listing is the only other way to get them, which forces the whole list
    to load just to open one dialog."""
    b = utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board view")
    return _board_response(b, current_user, db)


@router.put("/api/boards/{board_id}")
def rename_board(board_id: int, payload: schemas.BoardCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Board rename", required_permission="manageBoard")

    # Trim, then reject a blank name. boards.name is NOT NULL, so an empty
    # string would silently produce an unnamed project that the UI has to guess
    # how to display.
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="A project name is required.")
    if len(name) > 80:
        raise HTTPException(status_code=422, detail="Project name must be 80 characters or fewer.")

    description = (payload.description or "").strip()
    if len(description) > 500:
        raise HTTPException(status_code=422, detail="Description must be 500 characters or fewer.")

    # The description used to be dropped here: the route was called "rename" and
    # only wrote the name, so a project's description could be set at creation
    # and never changed afterwards.
    b.name = name
    b.description = description
    db.commit()
    db.refresh(b)
    log_activity_safe(b.id, current_user.name, f"updated project '{b.name}'")
    return _board_response(b, current_user, db)


@router.delete("/api/boards/{board_id}")
async def delete_board(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    b = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Board delete", required_permission="manageBoard")
    tids = [t.id for t in db.query(models.Task).filter(models.Task.board_id == board_id).all()]
    if tids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(tids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(tids)).delete(synchronize_session=False)
        
    db.query(models.Task).filter(models.Task.board_id == board_id).delete(synchronize_session=False)
    db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.board_id == board_id).delete(synchronize_session=False)
    
    db.delete(b)
    db.commit()
    return {"ok": True}


@router.get("/api/boards/{board_id}/export")
def export_board_csv(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board export")
    tasks = db.query(models.Task).filter(models.Task.board_id == board_id).all()
    stream = io.StringIO()
    writer = csv.writer(stream)
    
    writer.writerow(["ID", "Title", "Status", "Priority", "Assigned To", "Start Date", "Due Date", "Time Est", "Time Spent", "Labels"])
    for t in tasks:
        assigned_val = t.assigned_to_name or t.assigned_to
        writer.writerow([t.id, t.title, t.status, t.priority, assigned_val, t.start_date, t.due_date, t.time_estimated, t.time_spent, t.labels])
        
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=board_{board_id}_export.csv"
    return response


@router.post("/api/boards/{board_id}/invite")
def invite(board_id: int, payload: schemas.InviteRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Board invite", required_permission="manageMembers")
    target = db.query(models.User).filter(models.User.email == payload.email).first()
    # FIXED: normalize with admin alias support
    role = utils.normalize_role(payload.role or "editor")
    
    # FIXED: Only owner can invite owner role
    if role == "owner" and utils.normalize_role(getattr(current_user, "role", "")) != "owner":
        if not utils.is_owner_user(current_user, db):
            raise HTTPException(status_code=403, detail="Only owner can invite with owner role")
    
    # FIX APPLIED: Retain viewRoleDistribution permission when saving
    permissions_payload = getattr(payload, "permissions", {}) or {}
    if hasattr(permissions_payload, "dict"):
        permissions_payload = permissions_payload.dict()
        
    permissions = utils.normalize_permissions(role, permissions_payload)
    if isinstance(permissions_payload, dict) and "viewRoleDistribution" in permissions_payload:
        permissions["viewRoleDistribution"] = bool(permissions_payload["viewRoleDistribution"])

    if not target:
        password = (payload.password or "").strip()
        if not password:
            raise HTTPException(status_code=400, detail="Password is required when inviting a new user")

        invited_name = payload.email.split("@", 1)[0].strip() or "New member"
        target = models.User(
            email=payload.email,
            name=invited_name,
            password_hash=pwd_context.hash(password),
            role=role,
        )
        db.add(target)
        db.commit()
        db.refresh(target)

        subject = f"Invitation to join {board.name} on WorkFlow SaaS"
        html_body = utils.build_professional_email_html(
            title="Welcome to WorkFlow SaaS ",
            intro=f"<strong>{current_user.name}</strong> has invited you to join <strong>{board.name}</strong> as <strong>{role}</strong>.",
            rows=[
                ("Board", board.name),
                ("Role", role),
                ("Email", payload.email),
                ("Password", password),
            ],
        )
        threading.Thread(target=send_email_safe, args=(payload.email, subject, html_body)).start()
        log_activity_safe(board_id, current_user.name, f"created account and invited {payload.email} as {role}")

    bm = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == target.id).first()
    if not bm:
        db.add(models.BoardMember(board_id=board_id, user_id=target.id, role=role, permissions=json.dumps(permissions, ensure_ascii=False)))
        db.commit()
        log_activity_safe(board_id, current_user.name, f"invited {payload.email} as {role}")
        create_notification_safe(target.id, board_id, None, f"You were invited to board '{board.name}'", "invite", f"Invited to {board.name}")
    else:
        # FIXED: Preserve correct role position - update with normalized role
        bm.role = role
        bm.permissions = json.dumps(permissions, ensure_ascii=False)
        db.commit()
        log_activity_safe(board_id, current_user.name, f"updated {payload.email} role to {role}")

    return {"ok": True, "message": "Invite sent successfully", "role": role, "user_created": target.id is not None}


@router.get("/api/boards/{board_id}/members")
def get_board_members(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board members")
    members = []
    if board:
        owner = db.query(models.User).filter(models.User.id == board.owner_id).first()
        if owner: 
            members.append({"email": owner.email, "name": owner.name, "role": "owner", "id": owner.id, "board_id": board_id, "is_current_user": owner.id == current_user.id, "permissions": utils.default_permissions_for_role("owner")})
            
        for m in db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id).all():
            # Skip if this member is the board owner (already added)
            if m.user_id == board.owner_id:
                continue
            u = db.query(models.User).filter(models.User.id == m.user_id).first()
            if u: 
                normalized_role = utils.normalize_role((m.role or "editor").strip())
                # FIX APPLIED: Ensure viewRoleDistribution is not stripped out when fetching members
                raw_perms = _parse_json(m.permissions, {})
                permissions = utils.normalize_permissions(normalized_role, raw_perms)
                
                if isinstance(raw_perms, dict) and "viewRoleDistribution" in raw_perms:
                    permissions["viewRoleDistribution"] = bool(raw_perms["viewRoleDistribution"])
                    
                members.append({"email": u.email, "name": u.name, "role": normalized_role, "id": u.id, "board_id": board_id, "is_current_user": u.id == current_user.id, "permissions": permissions})
                
    return members


@router.put("/api/boards/{board_id}/members/{user_id}")
def update_board_member_role(board_id: int, user_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Member role update", required_permission="manageMembers")

    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if user_id == board.owner_id:
        raise HTTPException(status_code=400, detail="Board owner role cannot be changed")

    role = utils.normalize_role(payload.get("role", "editor") or "editor")
    if role not in {"owner", "administrator", "editor", "guest", "subscriber"}:
        raise HTTPException(status_code=400, detail="Role must be owner, administrator, editor, guest, subscriber")

    # FIXED: Only owner can assign owner role
    if role == "owner" and utils.normalize_role(getattr(current_user, "role", "")) != "owner":
        if not utils.is_owner_user(current_user, db):
            raise HTTPException(status_code=403, detail="Only owner can assign owner role")

    # FIX APPLIED: Retain viewRoleDistribution permission when saving
    permissions_payload = payload.get("permissions") or {}
    permissions = utils.normalize_permissions(role, permissions_payload)
    if isinstance(permissions_payload, dict) and "viewRoleDistribution" in permissions_payload:
        permissions["viewRoleDistribution"] = bool(permissions_payload["viewRoleDistribution"])

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    member = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).first()
    if member:
        member.role = role
        member.permissions = json.dumps(permissions, ensure_ascii=False)
    else:
        member = models.BoardMember(board_id=board_id, user_id=user_id, role=role, permissions=json.dumps(permissions, ensure_ascii=False))
        db.add(member)

    db.commit()
    log_activity_safe(board_id, current_user.name, f"updated {target.email} access to {role}")
    return {"ok": True, "message": "Member role updated", "role": role, "permissions": permissions}


@router.delete("/api/boards/{board_id}/members/{user_id}")
def remove_board_member(board_id: int, user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board = utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Member removal", required_permission="manageMembers")

    if user_id == board.owner_id:
        raise HTTPException(status_code=400, detail="Board owner cannot be removed")

    member = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    db.delete(member)
    db.commit()
    log_activity_safe(board_id, current_user.name, f"removed {target.email if target else user_id} from board")
    return {"ok": True, "removed": True, "message": "Member removed from board"}


@router.get("/api/boards/{board_id}/activities")
def get_activities(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Board activity")
    return db.query(models.Activity).filter(models.Activity.board_id == board_id).order_by(models.Activity.id.desc()).limit(30).all()
