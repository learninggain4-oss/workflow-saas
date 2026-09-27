"""utils package: infrastructure utilities for the WorkFlow SaaS backend.

This package was split from the original single utils.py God module. The
__init__.py re-exports every name that was previously available at the top
level of utils.py, so existing imports (`from utils import X`, `import utils;
utils.X`) continue to work unchanged.

New code should import from the specific submodule for clarity:
    from utils.permissions import ensure_board_access
    from utils.audit import log_audit_event

Submodule layout:
    config       - SECRET_KEY, ALGORITHM, pwd_context, oauth2_scheme
    timestamp    - now_str, audit_now_str
    auth         - create_token, get_current_user
    websocket    - ConnectionManager, manager
    email        - SMTP/Brevo email sending, email templates
    audit        - audit event logging, replay buffer, health, PII scrub
    permissions  - RBAC, roles, board access control
    notifications - in-app + email notifications
"""
import os
import json
import traceback
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from fastapi import Depends, HTTPException, WebSocket
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from email.message import EmailMessage

import models
from database import SessionLocal, get_db
import requests

from .config import SECRET_KEY, ALGORITHM, pwd_context, oauth2_scheme
from .timestamp import now_str, audit_now_str
from .auth import create_token, get_current_user
from .websocket import ConnectionManager, manager
from .email import (
    get_smtp_config,
    send_email_via_brevo_api,
    try_smtp_once,
    send_email_safe,
    build_professional_email_html,
)
from .audit import (
    AUDIT_COUNTERS,
    log_activity_safe,
    log_audit_event,
    _record_audit_failure,
    drain_audit_failures,
    audit_health,
    trusted_proxies,
    client_ip,
    scrub_audit_pii,
)
from .permissions import (
    PERMISSION_KEYS,
    ROLE_ALIASES,
    ROLE_HIERARCHY,
    normalize_role,
    default_permissions_for_role,
    normalize_permissions,
    is_owner_user,
    get_board_member_role,
    get_board_member_permissions,
    ensure_board_access,
    get_user_boards,
)
from .notifications import create_notification_safe
