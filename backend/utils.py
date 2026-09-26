import os, json, traceback, smtplib, ssl, threading, ipaddress, socket, secrets
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

ALGORITHM = "HS256"

# Values that must never be used to sign tokens. The second one is the string
# this file used to hardcode as the fallback, which made it a *published* signing
# key: anyone holding it could mint a valid token for any user, including owner.
# It stays listed so a deploy that still has it in its environment is refused at
# startup rather than silently running with a known key.
KNOWN_WEAK_SECRET_KEYS = {
    "",
    "workflow-saas-secret-2024",
    "change-me",
    "changeme",
    "secret",
    "your-secret-key",
}

_RAW_SECRET_KEY = (os.getenv("SECRET_KEY") or "").strip()

# True when the signing key is missing or known-compromised. main.py treats this
# as fatal on a deployed service and as a loud warning in development.
SECRET_KEY_IS_DEFAULT = _RAW_SECRET_KEY.lower() in KNOWN_WEAK_SECRET_KEYS

# With no SECRET_KEY configured, fall back to a random per-process key rather than
# a hardcoded one. Development still works, and restarting the dev server
# invalidates old tokens - which is the correct outcome, not a regression.
SECRET_KEY = _RAW_SECRET_KEY or secrets.token_urlsafe(48)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def timestamp_iso():
    return datetime.now().isoformat(timespec="seconds")

# ==========================================
#    INTEGRATION SECRET ENCRYPTION
# ==========================================
# Webhook URLs, API keys and personal access tokens are bearer credentials. They
# are encrypted with Fernet before they touch the database and are never included
# in an API response.
INTEGRATION_KEY_ENV = "INTEGRATION_ENCRYPTION_KEY"

def _get_fernet():
    from cryptography.fernet import Fernet

    raw = (os.getenv(INTEGRATION_KEY_ENV) or "").strip()
    if not raw:
        raise HTTPException(
            status_code=503,
            detail=(
                f"{INTEGRATION_KEY_ENV} is not set, so integration credentials cannot be stored. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            ),
        )
    try:
        return Fernet(raw.encode() if isinstance(raw, str) else raw)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail=f"{INTEGRATION_KEY_ENV} is not a valid Fernet key.",
        )

def encrypt_config(config: dict) -> str:
    payload = json.dumps(config or {}, ensure_ascii=False).encode()
    return _get_fernet().encrypt(payload).decode()

def decrypt_config(blob: str) -> dict:
    if not blob:
        return {}
    from cryptography.fernet import InvalidToken
    try:
        return json.loads(_get_fernet().decrypt(blob.encode()).decode())
    except InvalidToken:
        # Usually means the key was rotated or the row predates encryption.
        raise HTTPException(status_code=500, detail="Stored integration credentials could not be decrypted; the encryption key may have changed.")
    except HTTPException:
        raise
    except Exception:
        return {}


# ==========================================
#           SSRF PROTECTION
# ==========================================
# Several providers are configured with a user-supplied URL that the server then
# POSTs to. Without these checks that is a server-side request forgery vector:
# a URL of http://169.254.169.254/... reaches cloud instance metadata, and
# http://127.0.0.1:PORT reaches internal admin services.
_BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "metadata.google.internal", "metadata"}

# NAT64 translation prefixes (RFC 6052 / RFC 8215). A DNS64 resolver returns
# these alongside real IPv4 addresses, and Python's ipaddress flags them as
# "reserved" - but they are not a destination in themselves, they wrap an IPv4
# address. Rejecting them outright would break every integration on an IPv6
# network, so unwrap them and validate the embedded IPv4 instead.
_NAT64_PREFIXES = (
    ipaddress.ip_network("64:ff9b::/96"),
    ipaddress.ip_network("64:ff9b:1::/48"),
)

# Operator escape hatch, comma separated. A legitimate provider whose address
# space trips the guard can be allowed explicitly rather than being stuck.
_EXTRA_ALLOWED_HOSTS = {
    h.strip().lower()
    for h in (os.getenv("INTEGRATION_ALLOWED_HOSTS") or "").split(",")
    if h.strip()
}

def _ip_is_private(ip) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True  # not parseable as an IP -> treat as unsafe

    for prefix in _NAT64_PREFIXES:
        if addr.version == prefix.version and addr in prefix:
            # RFC 6052 places the IPv4 address in the low 32 bits.
            return _ip_is_private(ipaddress.IPv4Address(int(addr) & 0xFFFFFFFF))

    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast or addr.is_unspecified:
        return True

    # IPv4-mapped IPv6 can smuggle a private v4 address.
    mapped = getattr(addr, "ipv4_mapped", None)
    if mapped is not None and _ip_is_private(str(mapped)):
        return True

    return False

def assert_safe_outbound_url(url: str) -> str:
    """Validate a user-supplied URL before the server calls it."""
    from urllib.parse import urlparse

    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="A URL is required.")

    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http and https URLs are allowed.")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL is missing a hostname.")

    host = parsed.hostname.lower().rstrip(".")
    if host in _BLOCKED_HOSTNAMES:
        raise HTTPException(status_code=400, detail="This host is not allowed.")

    if host in _EXTRA_ALLOWED_HOSTS:
        return url

    try:
        resolved = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail=f"Could not resolve hostname '{host}'.")

    for info in resolved:
        ip = info[4][0]
        if _ip_is_private(ip):
            raise HTTPException(
                status_code=400,
                detail=(
                    "This URL resolves to a private, loopback or link-local address, "
                    "which is not allowed. An administrator can allowlist it with INTEGRATION_ALLOWED_HOSTS."
                ),
            )
    return url

# ==========================================
#         PADDLE WEBHOOK VERIFICATION
# ==========================================
# Paddle signs each webhook with HMAC-SHA256 over "<ts>:<raw body>" using the
# notification destination secret, and sends it as:
#   Paddle-Signature: ts=1671552777;h1=<hex digest>
# Two things make this easy to get wrong, so both are handled here:
#   1. The digest must be computed over the RAW body. Re-serialising the parsed
#      JSON changes key order/whitespace and the digest will never match.
#   2. `ts` must be freshness-checked, or a captured request can be replayed to
#      grant a subscription that was never paid for.
PADDLE_WEBHOOK_TOLERANCE_SECONDS = 300


def verify_paddle_signature(raw_body: bytes, signature_header: str) -> bool:
    """Return True only when the header is well-formed, fresh, and matches."""
    import hashlib
    import hmac
    import time

    secret = (os.getenv("PADDLE_WEBHOOK_SECRET") or "").strip()
    if not secret or not raw_body or not signature_header:
        return False

    try:
        parts = dict(
            piece.split("=", 1) for piece in signature_header.split(";") if "=" in piece
        )
        ts = parts["ts"]
        provided = parts["h1"]
    except (KeyError, ValueError):
        return False

    # Reject stale signatures so a captured request cannot be replayed.
    try:
        age = abs(time.time() - int(ts))
    except (TypeError, ValueError):
        return False
    if age > PADDLE_WEBHOOK_TOLERANCE_SECONDS:
        return False

    payload = ts.encode() + b":" + raw_body
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)


def paddle_is_configured() -> bool:
    return bool((os.getenv("PADDLE_API_KEY") or "").strip())


def paddle_base_url() -> str:
    env = (os.getenv("PADDLE_ENV") or "sandbox").strip().lower()
    return "https://api.paddle.com" if env == "production" else "https://sandbox-api.paddle.com"


def paddle_checkout_enabled() -> bool:
    return paddle_is_configured() and bool((os.getenv("PADDLE_PRICE_ID") or "").strip())


# Outbound calls to third parties are short-lived by design; keep timeouts tight
# so a slow provider cannot occupy a worker.
OUTBOUND_TIMEOUT = 10

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
            "sender": {"email": cfg["from"], "name": "WorkFlow SaaS Automation"},
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

def log_activity_safe(board_id, user_name, action, task_id=None):
    try:
        db2 = SessionLocal()
        db2.add(models.Activity(board_id=board_id, user_name=user_name, action=action, created_at=now_str(), task_id=task_id))
        db2.commit()
        db2.close()
    except: pass

def build_professional_email_html(title: str, intro: str, rows: List[tuple], cta_text: str = "Open WorkFlow SaaS", cta_url: str = "https://workflow-saas-cof-z.onrender.com") -> str:
    details = "".join(
        f"<tr><td style='padding:14px 18px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;'><strong>{label}:</strong> {value}</td></tr>"
        for label, value in rows
    )
    return (
        "<div style='font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:32px 0;'>"
        "<div style='max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;'>"
        "<div style='background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;color:#ffffff;'>"
        f"<h1 style='margin:0;font-size:28px;line-height:1.3;'>{title}</h1>"
        "</div>"
        "<div style='padding:32px;'>"
        f"<p style='margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;'>{intro}</p>"
        "<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='width:100%;border-collapse:separate;border-spacing:0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;'>"
        f"{details}"
        "</table>"
        f"<div style='margin-top:24px;text-align:center;'><a href='{cta_url}' style='display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:bold;'>{cta_text}</a></div>"
        "<p style='margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;'>Thank you for using WorkFlow SaaS.</p>"
        "</div>"
        "<div style='padding:20px 32px 28px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:12px;color:#6b7280;'><p style='margin:0;'>This is an automated email from WorkFlow SaaS.</p></div>"
        "</div>"
        "</div>"
    )


def create_notification_safe(user_id, board_id, task_id, message, n_type="info", email_subject=None):
    try:
        db2 = SessionLocal()
        u = db2.query(models.User).filter(models.User.id == user_id).first()
        user_email = u.email if u else None
        db2.add(models.Notification(user_id=user_id, board_id=board_id, task_id=task_id, message=message, notif_type=n_type, is_read=False, created_at=now_str()))
        db2.commit()
        db2.close()
        if user_email and email_subject:
            html_body = build_professional_email_html(
                title=email_subject,
                intro=message,
                rows=[("Message", message), ("Type", n_type or "info")],
                cta_text="Open WorkFlow SaaS",
            )
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
    "viewRoleDistribution",
    "viewAutomations",
    "manageAutomations",
]

# FIXED: Added admin, member, viewer, super_admin aliases
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
    # fallback: check if already canonical
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
    # subscriber / viewer
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
    # FIXED: Return highest role, not lowest
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

    # Board owner always has full access
    if board.owner_id == user.id:
        return board

    # Check if user is global owner
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
