import os
import smtplib
import ssl
import threading
from email.message import EmailMessage
from typing import List

import requests


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
    except Exception:
        return False


def send_email_safe(to_email: str, subject: str, html_body: str) -> bool:
    cfg = get_smtp_config()

    if cfg["brevo_key"] and send_email_via_brevo_api(to_email, subject, html_body):
        return True

    if not cfg["host"] or not cfg["user"] or not cfg["pass"]:
        print("[EMAIL] Invite email skipped: missing SMTP_HOST / SMTP_USER / SMTP_PASS or BREVO_API_KEY")
        return False

    for p in [cfg["port"], 2525, 587, 465]:
        if try_smtp_once(cfg["host"], p, cfg["user"], cfg["pass"],
                         cfg["from"], to_email, subject, html_body, use_ssl=(p == 465)):
            return True

    print(f"[EMAIL] Failed to send message to {to_email} via configured SMTP relay")
    return False


def build_professional_email_html(title: str, intro: str, rows: List[tuple],
                                  cta_text: str = "Open WorkFlow SaaS",
                                  cta_url: str = "https://workflow-saas-production.up.railway.app/") -> str:
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
