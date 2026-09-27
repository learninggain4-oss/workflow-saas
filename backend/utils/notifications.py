import json
import threading

import models
from database import SessionLocal

from .timestamp import now_str
from .email import send_email_safe, build_professional_email_html


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
    except Exception:
        pass
