import os, json, traceback, smtplib, ssl, threading
from datetime import datetime, timedelta
from typing import Dict, List
from fastapi import WebSocket, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from email.message import EmailMessage
import models
from database import SessionLocal, get_db
import requests

SECRET_KEY = os.getenv("SECRET_KEY", "workflow-saas-secret-2024")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def create_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(days=30)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token no sub")
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}")

class ConnectionManager:
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}
        
    async def connect(self, ws: WebSocket, board_id: int):
        await ws.accept()
        if board_id not in self.active:
            self.active[board_id] = []
        self.active[board_id].append(ws)
        
    def disconnect(self, ws: WebSocket, board_id: int):
        if board_id in self.active and ws in self.active[board_id]:
            self.active[board_id].remove(ws)
            
    async def broadcast(self, board_id: int, msg: dict):
        if board_id in self.active:
            for c in list(self.active[board_id]):
                try:
                    await c.send_json(msg)
                except:
                    pass

manager = ConnectionManager()

def get_smtp_config():
    host = (os.getenv("SMTP_HOST") or "").strip()
    port = (os.getenv("SMTP_PORT") or "2525").strip()
    user = (os.getenv("SMTP_USER") or "").strip()
    pwd = (os.getenv("SMTP_PASS") or "").strip()
    from_email = (os.getenv("FROM_EMAIL") or user or "").strip()
    brevo_key = (os.getenv("BREVO_API_KEY") or "").strip()

    return {
        "host": host or "smtp-relay.brevo.com",
        "port": int(port or 2525),
        "user": user,
        "pass": pwd,
        "from": from_email,
        "brevo_key": brevo_key,
    }

def send_email_via_brevo_api(to_email: str, subject: str, html_body: str) -> bool:
    cfg = get_smtp_config()
    api_key = cfg["brevo_key"]
    if not api_key.startswith("xkeysib-") or not cfg["from"]:
        return False
    try:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {"accept": "application/json", "api-key": api_key, "content-type": "application/json"}
        payload = {
            "sender": {"email": cfg["from"], "name": "WorkFlow SaaS"},
            "to": [{"email": to_email.strip()}],
            "subject": subject,
            "htmlContent": f"<html><body>{html_body}</body></html>"
        }
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        return resp.status_code in [200, 201, 202]
    except Exception as e:
        print(f"Brevo API fail: {e}")
        return False

def try_smtp_once(host, port, user, pwd, from_email, to_email, subject, html_body, use_ssl=False):
    try:
        msg = EmailMessage()
        msg["Subject"], msg["From"], msg["To"] = subject, from_email, to_email
        msg.set_content(html_body, subtype='html')
        ctx = ssl.create_default_context()
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as server:
                server.login(user, pwd)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()
                server.login(user, pwd)
                server.send_message(msg)
        return True
    except Exception as e:
        return False

def send_email_safe(to_email: str, subject: str, html_body: str) -> bool:
    cfg = get_smtp_config()

    if cfg["brevo_key"] and send_email_via_brevo_api(to_email, subject, html_body):
        return True

    if not cfg["host"] or not cfg["user"] or not cfg["pass"]:
        print("[EMAIL] Invite email skipped: missing SMTP_HOST / SMTP_USER / SMTP_PASS or BREVO_API_KEY")
        return False

    for p in [cfg["port"], 2525, 587, 465]:
        if try_smtp_once(cfg["host"], p, cfg["user"], cfg["pass"], cfg["from"], to_email, subject, html_body, use_ssl=(p == 465)):
            return True

    print(f"[EMAIL] Failed to send message to {to_email} via configured SMTP relay")
    return False

def log_activity_safe(board_id, user_name, action):
    try:
        db2 = SessionLocal()
        db2.add(models.Activity(board_id=board_id, user_name=user_name, action=action, created_at=now_str()))
        db2.commit()
        db2.close()
    except: pass

def create_notification_safe(user_id, board_id, task_id, message, n_type="info", email_subject=None):
    try:
        db2 = SessionLocal()
        u = db2.query(models.User).filter(models.User.id == user_id).first()
        user_email = u.email if u else None
        db2.add(models.Notification(user_id=user_id, board_id=board_id, task_id=task_id, message=message, notif_type=n_type, is_read=False, created_at=now_str()))
        db2.commit()
        db2.close()
        if user_email and email_subject:
            html_body = f"<div style='font-family:Arial'><h3>{email_subject}</h3><p>{message}</p><p>Open WorkFlow SaaS dashboard.</p></div>"
            threading.Thread(target=send_email_safe, args=(user_email, email_subject, html_body)).start()
    except: pass

def get_user_boards(user, db: Session):
    owned = db.query(models.Board).filter(models.Board.owner_id == user.id).all()
    mids = [m.board_id for m in db.query(models.BoardMember).filter(models.BoardMember.user_id == user.id).all()]
    mboards = db.query(models.Board).filter(models.Board.id.in_(mids)).all() if mids else []
    return list({b.id: b for b in owned + mboards}.values())


PERMISSION_KEYS = [
    "viewBoard",
    "createTasks",
    "editTasks",
    "deleteTasks",
    "manageMembers",
    "manageBoard",
]


def default_permissions_for_role(role):
    role_name = (role or "member").lower()
    if role_name == "admin":
        return {key: True for key in PERMISSION_KEYS}
    if role_name == "viewer":
        return {"viewBoard": True, "createTasks": False, "editTasks": False, "deleteTasks": False, "manageMembers": False, "manageBoard": False}
    return {"viewBoard": True, "createTasks": True, "editTasks": True, "deleteTasks": True, "manageMembers": False, "manageBoard": False}


def normalize_permissions(role, custom_permissions=None):
    permissions = default_permissions_for_role(role)
    if isinstance(custom_permissions, dict):
        for key in PERMISSION_KEYS:
            if key in custom_permissions and isinstance(custom_permissions[key], bool):
                permissions[key] = bool(custom_permissions[key])
    return permissions


def get_board_member_role(board_id: int, user_id: int, db: Session):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        return None
    if board.owner_id == user_id:
        return "admin"
    member = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).first()
    if not member:
        return None
    return (member.role or "member").strip().lower()


def get_board_member_permissions(board_id: int, user_id: int, db: Session):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        return default_permissions_for_role("viewer")
    if board.owner_id == user_id:
        return default_permissions_for_role("admin")
    member = db.query(models.BoardMember).filter(models.BoardMember.board_id == board_id, models.BoardMember.user_id == user_id).first()
    if not member:
        return default_permissions_for_role("viewer")
    custom_permissions = {}
    if member.permissions:
        try:
            custom_permissions = json.loads(member.permissions)
        except Exception:
            custom_permissions = {}
    return normalize_permissions((member.role or "member").strip().lower(), custom_permissions)


def ensure_board_access(board_id: int, user, db: Session, required_role: str = "viewer", action: str = "Board access", required_permission: str = None):
    if board_id is None:
        raise HTTPException(status_code=403, detail=f"{action} denied")

    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if board.owner_id == user.id:
        return board

    permissions = get_board_member_permissions(board_id, user.id, db)
    permission_map = {
        "viewer": "viewBoard",
        "member": "createTasks",
        "admin": "manageBoard",
    }
    resolved_permission = required_permission or permission_map.get((required_role or "viewer").lower(), "viewBoard")
    if not permissions.get(resolved_permission, False):
        raise HTTPException(status_code=403, detail=f"{action} requires {resolved_permission} permission")

    return board

#(Email, JWT, Security, WebSockets)