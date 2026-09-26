"""Auth and user profile routes."""
import base64
import threading
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core import CLOUDINARY_ENABLED, _dump_json, _parse_json, cloudinary, create_token, get_current_user, get_db, models, pwd_context, schemas, send_email_safe, utils


router = APIRouter()

@router.post("/api/register")
def register(req: schemas.RegisterRequest, db: Session = Depends(get_db)):
    email = (req.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="User exists")

    # The frontend sends a role on signup, but honouring it verbatim would let a
    # crafted request self-assign "owner". Only non-privileged roles are
    # self-serviceable; owner/administrator are granted by an existing owner via
    # PUT /api/admin/users/{user_id}.
    self_service_roles = {"editor", "guest", "subscriber"}
    requested = utils.normalize_role(req.role)
    is_first_user = db.query(models.User).count() == 0
    if is_first_user:
        assigned_role = "owner"
    elif requested in self_service_roles:
        assigned_role = requested
    else:
        assigned_role = "administrator"

    u = models.User(
        email=email,
        name=req.name,
        password_hash=pwd_context.hash(req.password),
        role=assigned_role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    # No board is created here on purpose: the workspace starts empty and the
    # owner names the first project themselves. GET /api/boards no longer
    # backfills a default board either, so nothing is auto-named.
    return {"ok": True}


@router.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # register normalises to lowercase, so match the same way. The frontend
    # lowercases the username too, but older rows may predate that.
    user = db.query(models.User).filter(models.User.email == (form_data.username or "").strip().lower()).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    
    return {
        "access_token": create_token({"sub": user.email}), 
        "token_type": "bearer", 
        "id": user.id
    }


@router.get("/api/users/me")
def get_user_profile(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": utils.normalize_role(getattr(current_user, "role", "administrator")),
        "subscription_tier": current_user.subscription_tier,
        "avatar_url": current_user.avatar_url or "",
        "email_verified": bool(current_user.email_verified),
        "two_factor_enabled": bool(current_user.two_factor_enabled),
        "profile_preferences": _parse_json(current_user.profile_preferences, {}),
        "workspace_defaults": _parse_json(current_user.workspace_defaults, {}),
        "connected_apps": _parse_json(current_user.connected_apps, []),
        "security_settings": {
            "emailVerified": bool(current_user.email_verified),
            "twoFactorEnabled": bool(current_user.two_factor_enabled),
            "connectedApps": _parse_json(current_user.connected_apps, []),
        },
    }


@router.get("/api/admin/users")
def list_registered_users(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not utils.is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    users = []
    for user in db.query(models.User).order_by(models.User.id.asc()).all():
        users.append({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": utils.normalize_role(getattr(user, "role", "administrator")),
        })
    return users


@router.put("/api/admin/users/{user_id}")
def update_registered_user_role(user_id: int, payload: dict, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not utils.is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot change own role here")

    role = utils.normalize_role(payload.get("role", "administrator") or "administrator")
    if role not in {"owner", "administrator", "editor", "guest", "subscriber"}:
        raise HTTPException(status_code=400, detail="Role must be owner, administrator, editor, guest, subscriber")

    target.role = role
    db.commit()
    return {"ok": True, "id": target.id, "email": target.email, "role": role}


@router.delete("/api/admin/users/{user_id}")
def delete_registered_user(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not utils.is_owner_user(current_user, db):
        raise HTTPException(status_code=403, detail="Owner access required")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot delete self")

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    owned_board_ids = [board.id for board in db.query(models.Board).filter(models.Board.owner_id == user_id).all()]
    if owned_board_ids:
        owned_task_ids = [task.id for task in db.query(models.Task).filter(models.Task.board_id.in_(owned_board_ids)).all()]
        if owned_task_ids:
            db.query(models.Comment).filter(models.Comment.task_id.in_(owned_task_ids)).delete(synchronize_session=False)
            db.query(models.Subtask).filter(models.Subtask.task_id.in_(owned_task_ids)).delete(synchronize_session=False)
            db.query(models.Notification).filter(models.Notification.task_id.in_(owned_task_ids)).delete(synchronize_session=False)
        db.query(models.Task).filter(models.Task.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.BoardMember).filter(models.BoardMember.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.Activity).filter(models.Activity.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.board_id.in_(owned_board_ids)).delete(synchronize_session=False)
        db.query(models.Board).filter(models.Board.id.in_(owned_board_ids)).delete(synchronize_session=False)

    user_task_ids = [task.id for task in db.query(models.Task).filter(models.Task.user_id == user_id).all()]
    if user_task_ids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(user_task_ids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(user_task_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.task_id.in_(user_task_ids)).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.user_id == user_id).delete(synchronize_session=False)

    db.query(models.BoardMember).filter(models.BoardMember.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Comment).filter(models.Comment.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)

    assigned_task_ids = [task.id for task in db.query(models.Task).filter(models.Task.assigned_to == target.email).all()]
    if assigned_task_ids:
        db.query(models.Comment).filter(models.Comment.task_id.in_(assigned_task_ids)).delete(synchronize_session=False)
        db.query(models.Subtask).filter(models.Subtask.task_id.in_(assigned_task_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.task_id.in_(assigned_task_ids)).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.assigned_to == target.email).delete(synchronize_session=False)

    db.delete(target)
    db.commit()
    return {"ok": True, "deleted": True, "id": user_id}


@router.put("/api/users/me")
def update_user_profile(payload: schemas.UserProfileUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    old_email = current_user.email
    new_name = payload.name.strip() if payload.name else current_user.name
    new_email = payload.email.strip() if payload.email else current_user.email
    new_password = payload.password.strip() if payload.password else None

    if not new_name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not new_email:
        raise HTTPException(status_code=400, detail="Email is required")

    if new_email != old_email:
        existing = db.query(models.User).filter(models.User.email == new_email, models.User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    current_user.name = new_name
    current_user.email = new_email
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url or ""
    if payload.email_verified is not None:
        current_user.email_verified = bool(payload.email_verified)
    if payload.two_factor_enabled is not None:
        current_user.two_factor_enabled = bool(payload.two_factor_enabled)
    if payload.profile_preferences is not None:
        current_user.profile_preferences = _dump_json(payload.profile_preferences, {})
    if payload.workspace_defaults is not None:
        current_user.workspace_defaults = _dump_json(payload.workspace_defaults, {})
    if payload.connected_apps is not None:
        current_user.connected_apps = _dump_json(payload.connected_apps, [])
    if payload.security_settings is not None:
        security_settings = payload.security_settings or {}
        if "emailVerified" in security_settings:
            current_user.email_verified = bool(security_settings.get("emailVerified"))
        if "twoFactorEnabled" in security_settings:
            current_user.two_factor_enabled = bool(security_settings.get("twoFactorEnabled"))
        if "connectedApps" in security_settings:
            current_user.connected_apps = _dump_json(security_settings.get("connectedApps"), [])
    if new_password:
        current_user.password_hash = pwd_context.hash(new_password)

    db.commit()
    db.refresh(current_user)

    new_token = create_token({"sub": current_user.email})
    security_payload = {
        "emailVerified": bool(current_user.email_verified),
        "twoFactorEnabled": bool(current_user.two_factor_enabled),
        "connectedApps": _parse_json(current_user.connected_apps, []),
    }
    return {
        "ok": True,
        "message": "Profile updated successfully",
        "access_token": new_token,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "subscription_tier": current_user.subscription_tier,
            "avatar_url": current_user.avatar_url or "",
            "email_verified": bool(current_user.email_verified),
            "two_factor_enabled": bool(current_user.two_factor_enabled),
            "profile_preferences": _parse_json(current_user.profile_preferences, {}),
            "workspace_defaults": _parse_json(current_user.workspace_defaults, {}),
            "connected_apps": _parse_json(current_user.connected_apps, []),
            "security_settings": security_payload,
        }
    }


@router.post("/api/upgrade")
def upgrade_to_pro(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.subscription_tier = "pro"
    db.commit()
    return {"ok": True, "message": "Upgraded to Pro successfully!"}


@router.post("/api/test-email")
def test_email(current_user=Depends(get_current_user)):
    html_body = utils.build_professional_email_html(
        title="WorkFlow SaaS Email Test",
        intro=f"Hi <strong>{current_user.name}</strong>, this is a test email to confirm your email configuration is working correctly.",
        rows=[
            ("Recipient", current_user.email),
            ("Status", "Email configuration verified"),
            ("Message", "Your WorkFlow SaaS email delivery is active."),
        ],
    )
    threading.Thread(
        target=send_email_safe,
        args=(current_user.email, "✅ WorkFlow SaaS - Email Test", html_body)
    ).start()
    return {"sent": True, "to": current_user.email}


@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    # The 5MB / 2MB limits are enforced only in the browser, so an untrusted
    # client can otherwise push an arbitrary body that gets base64'd and stored
    # on the task. Cap it here too.
    MAX_UPLOAD_BYTES = 5 * 1024 * 1024
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 5MB limit")

    if CLOUDINARY_ENABLED:
        try:
            result = cloudinary.uploader.upload(contents, folder="workflow-saas", resource_type="auto")
            return {"url": result.get("secure_url")}
        except Exception:
            pass

    base64_encoded = base64.b64encode(contents).decode('utf-8')
    return {"url": f"data:{file.content_type or 'application/octet-stream'};base64,{base64_encoded}"}
