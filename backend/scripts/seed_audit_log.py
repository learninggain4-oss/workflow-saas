"""Generate a realistic mock audit log for local development and demos.

Deterministic: same --seed and --days produce byte-identical rows, so the
verifier and any screenshot stay stable.

    python -m scripts.seed_audit_log --days 30 --events 1200
    python -m scripts.seed_audit_log --days 30 --events 1200 --reset

Safety: refuses to run against what looks like a production database unless
--force is passed. Writing a year of fabricated security events into a live
audit table is the kind of mistake that has to be impossible to make by
accident.
"""
import argparse
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow `python scripts/seed_audit_log.py` as well as `python -m scripts...`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import models
from database import SessionLocal, engine
from utils import now_str


# ---------------------------------------------------------------------------
# Cast
# ---------------------------------------------------------------------------
# Each person has a home network so their events cluster the way real ones do -
# a reviewer who never appears from two countries at once reads as real.

PEOPLE = [
    # name, email, role, org unit, ip, location
    ("Maya Chen", "maya.chen@northwind.test", "owner", "Platform", "203.0.113.24", "Singapore"),
    ("Alex Rivera", "alex.rivera@northwind.test", "administrator", "Engineering", "203.0.113.31", "Austin"),
    ("Nora Patel", "nora.patel@northwind.test", "editor", "Design", "198.51.100.17", "London"),
    ("Sam Green", "sam.green@northwind.test", "editor", "Engineering", "198.51.100.52", "Berlin"),
    ("Priya Raman", "priya.raman@northwind.test", "editor", "QA", "192.168.10.41", "Bangalore"),
    ("Tomas Novak", "tomas.novak@northwind.test", "viewer", "Support", "10.24.8.19", "Prague"),
    ("Leila Haddad", "leila.haddad@northwind.test", "administrator", "Security", "203.0.113.88", "Dubai"),
    ("Ben Okafor", "ben.okafor@northwind.test", "editor", "Marketing", "172.16.4.30", "Lagos"),
    ("Ingrid Berg", "ingrid.berg@northwind.test", "viewer", "Finance", "192.168.10.77", "Oslo"),
    ("Hiro Tanaka", "hiro.tanaka@northwind.test", "editor", "Platform", "198.51.100.90", "Tokyo"),
]

# A person whose sessions come from a different country than their home network.
TRAVELLER_IP = "185.199.108.6"
TRAVELLER = "hiro.tanaka@northwind.test"

# A hostile address for the security events. Kept out of the cast.
SUSPICIOUS_IP = "45.155.205.233"

SYSTEM_ACTOR = ("System", "system@northwind.test", None)

BROWSERS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
]
CLI_AGENTS = ["curl/8.5.0", "python-requests/2.32.3", "workflow-cli/1.4.2"]

# event_type -> (weight, severity, action template)
# Weights shape a believable day; they are not random noise.
EVENT_CATALOG = [
    ("auth.login", 18, "info", "{name} signed in"),
    ("auth.logout", 6, "info", "{name} signed out"),
    ("auth.login_failed", 3, "warning", "Failed sign-in for {name}"),
    ("auth.password_changed", 1, "notice", "{name} changed their password"),
    ("auth.two_factor_enabled", 1, "notice", "{name} enabled two-factor authentication"),
    ("auth.two_factor_disabled", 1, "warning", "{name} disabled two-factor authentication"),
    ("board.created", 3, "notice", "{name} created project {target}"),
    ("board.renamed", 2, "notice", "{name} renamed project {target}"),
    ("board.deleted", 1, "warning", "{name} deleted project {target}"),
    ("board.settings_updated", 3, "notice", "{name} updated settings for {target}"),
    ("board.exported", 2, "notice", "{name} exported {target}"),
    ("task.created", 22, "info", "{name} created task {target}"),
    ("task.updated", 12, "info", "{name} updated task {target}"),
    ("task.status_changed", 14, "info", "{name} moved {target} to {status}"),
    ("task.deleted", 3, "warning", "{name} deleted task {target}"),
    ("task.assigned", 6, "info", "{name} assigned {target} to {assignee}"),
    ("member.invited", 2, "notice", "{name} invited {assignee}"),
    ("member.role_changed", 1, "notice", "{name} changed a member role"),
    ("member.removed", 1, "warning", "{name} removed a member from {target}"),
    ("automation.created", 2, "notice", "{name} created an automation rule"),
    ("automation.updated", 2, "notice", "{name} changed an automation rule"),
    ("automation.deleted", 1, "warning", "{name} deleted an automation rule"),
    ("integration.connected", 1, "notice", "{name} connected an integration"),
    ("integration.revoked", 1, "warning", "{name} revoked an integration"),
    ("security.access_denied", 2, "warning", "Access denied for {name} on {target}"),
    ("security.suspicious_login", 1, "critical", "Sign-in from an unrecognised network for {name}"),
    ("system.backup", 1, "info", "Automated backup completed"),
    ("system.migration", 1, "notice", "Schema migration applied"),
]

PROJECTS = [
    ("Atlas rollout", "board"),
    ("Payments revamp", "board"),
    ("Mobile parity", "board"),
    ("Support triage", "board"),
    ("Data retention", "board"),
]
TASK_WORDS = [
    "Draft the release notes", "Fix the retry path", "Review the migration plan",
    "Confirm the rollback steps", "Add regression coverage", "Update the runbook",
    "Schedule the QA pass", "Check the webhook retries", "Split the epic",
    "Write the handover doc", "Triage the flaky suite", "Rotate the credentials",
]
STATUSES = ["todo", "doing", "done", "blocked"]
INTEGRATIONS = ["github", "slack", "google-drive", "jira"]


def _weighted_event_type(rng):
    total = sum(w for _, w, _, _ in EVENT_CATALOG)
    pick = rng.uniform(0, total)
    upto = 0.0
    for event_type, weight, _, _ in EVENT_CATALOG:
        upto += weight
        if pick <= upto:
            return event_type
    return EVENT_CATALOG[0][0]


def _business_hour(rng, day, now=None):
    """One plausible working-hours timestamp on `day`, or None for none.

    Weekday 09:00-18:00 UTC mostly, with a thin evening tail. A flat 24-hour
    distribution is the giveaway of generated data. Returns None rather than a
    future stamp: a seeded log that claims to know what happens later today is
    worse than a sparse one.
    """
    now = now or datetime.now(timezone.utc)
    weekend = day.weekday() >= 5

    if weekend:
        if rng.random() > 0.15:
            return None
        hour, minute = rng.randint(10, 16), rng.randint(0, 59)
    else:
        r = rng.random()
        if r < 0.78:
            hour, minute = rng.randint(9, 17), rng.randint(0, 59)
        elif r < 0.95:
            hour = rng.choice([8, 18, 19, 20])
            minute = rng.randint(0, 59)
        else:
            hour = rng.choice([21, 22, 23])
            minute = rng.randint(0, 59)

    stamp = datetime(day.year, day.month, day.day, tzinfo=timezone.utc).replace(
        hour=hour, minute=minute, second=rng.randint(0, 59)
    )
    return None if stamp > now else stamp


def _iso(stamp):
    return stamp.strftime("%Y-%m-%d %H:%M:%S")


def generate(days, total_events, seed, boards, user_ids=None):
    rng = random.Random(seed)
    rows = []
    user_ids = user_ids or {}
    by_name = {p[1]: p for p in PEOPLE}
    today = datetime.now(timezone.utc).date()

    # An explicit count per day keeps the distribution intentional. Looping
    # "until this day happens to return None" made whole days vanish.
    pool = []
    now = datetime.now(timezone.utc)
    for offset in range(days):
        day = today - timedelta(days=offset)
        weekend = day.weekday() >= 5
        candidates = rng.randint(1, 4) if weekend else rng.randint(18, 36)
        for _ in range(candidates):
            stamp = _business_hour(rng, day, now=now)
            if stamp is not None:
                pool.append(stamp)
    if not pool:
        raise SystemExit("no candidate timestamps in the requested window")

    # Newest first, weighted so recent days are a little denser (an adoption
    # curve) without collapsing the whole log into the last two days.
    pool.sort(reverse=True)
    weight = lambda i: 1.0 / (1.0 + i / 120.0)
    weights = [weight(i) for i in range(len(pool))]
    chosen = rng.choices(pool, weights=weights, k=total_events)

    for stamp in chosen:
        event_type, _, severity, template = _catalog_entry(rng, _weighted_event_type(rng))
        person = rng.choices(PEOPLE, weights=[9, 8, 7, 7, 5, 4, 4, 4, 3, 5], k=1)[0]
        name, email, role, unit, ip, location = person

        # Some sessions come from the traveller's other network.
        if email == TRAVELLER and rng.random() < 0.18:
            ip = TRAVELLER_IP

        project_label, _ = rng.choice(PROJECTS)
        board = rng.choice(boards) if boards else None
        assignee = rng.choice(PEOPLE)[0]

        outcome = "success"
        agent = rng.choices(BROWSERS + CLI_AGENTS, weights=[40, 40, 20, 8, 2, 1, 1], k=1)[0]

        if event_type == "auth.login_failed":
            outcome = "failure"
        elif event_type == "security.access_denied":
            outcome = "denied"
            ip = rng.choice([ip, SUSPICIOUS_IP])
        elif event_type == "security.suspicious_login":
            outcome = "failure"
            ip = SUSPICIOUS_IP
        elif event_type in ("automation.deleted", "board.deleted", "member.removed"):
            outcome = "success"

        action = template.format(
            name=name, target=project_label, status=rng.choice(STATUSES), assignee=assignee
        )

        rows.append({
            "created_at": _iso(stamp),
            "actor_user_id": user_ids.get(email),
            "actor_email": email,
            "actor_name": name,
            "event_type": event_type,
            "action": action,
            "target_type": _target_type(event_type),
            "target_id": _target_id(event_type, rng, project_label),
            "target_label": project_label,
            "ip_address": ip,
            "user_agent": agent,
            "severity": severity,
            "outcome": outcome,
            "board_id": board.id if board else None,
            "details": json.dumps(_metadata(event_type, rng, role, unit, location)),
        })

        # A few system events with no human actor.
        if rng.random() < 0.02:
            rows.append({
                "created_at": _iso(stamp + timedelta(minutes=1)),
                "actor_user_id": None,
                "actor_email": SYSTEM_ACTOR[1],
                "actor_name": SYSTEM_ACTOR[0],
                "event_type": rng.choice(["system.backup", "system.migration"]),
                "action": rng.choice(["Automated backup completed", "Schema migration applied"]),
                "target_type": "system",
                "target_id": "postgres-primary",
                "target_label": "Primary datastore",
                "ip_address": "127.0.0.1",
                "user_agent": "internal/worker",
                "severity": "info",
                "outcome": "success",
                "board_id": None,
                "details": "{}",
            })

    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows


def _catalog_entry(rng, event_type):
    for entry in EVENT_CATALOG:
        if entry[0] == event_type:
            return entry
    return EVENT_CATALOG[0]


def _target_type(event_type):
    prefix = event_type.split(".", 1)[0]
    return {
        "auth": "session",
        "board": "board",
        "task": "task",
        "member": "member",
        "automation": "automation",
        "integration": "integration",
        "security": "security",
        "system": "system",
    }.get(prefix, "unknown")


def _target_id(event_type, rng, project_label):
    prefix = event_type.split(".", 1)[0]
    if prefix == "task":
        return f"task-{rng.randint(100, 9999)}"
    if prefix == "automation":
        return f"rule-{rng.randint(1, 40)}"
    if prefix == "integration":
        return rng.choice(INTEGRATIONS)
    if prefix == "auth":
        return f"session-{uuid.UUID(int=rng.getrandbits(128)).hex[:12]}"
    if prefix == "board":
        return f"board-{rng.randint(1, 5)}"
    return ""


def _metadata(event_type, rng, role, unit, location):
    prefix = event_type.split(".", 1)[0]
    if prefix == "auth":
        return {"method": rng.choice(["password", "sso", "magic_link"]),
                "geo": location, "unit": unit}
    if prefix == "task":
        return {"status": rng.choice(STATUSES), "unit": unit}
    if prefix == "security":
        return {"reason": "policy", "unit": unit}
    if prefix == "member":
        return {"new_role": rng.choice(["editor", "viewer", "administrator"])}
    return {"unit": unit}


def ensure_cast(db, reset):
    """Create the people in the dataset as real users.

    Without this the audit rows reference actors that do not exist, which makes
    the referential check warn and makes the data useless for demoing an
    actor-filtered audit view. Idempotent on email.
    """
    if reset:
        existing = {u.email for u in db.query(models.User).all()}
        db.query(models.User).filter(models.User.email.notin_(list(existing))).delete(synchronize_session=False)

    user_ids = {}
    by_email = {u.email: u for u in db.query(models.User).all()}
    for name, email, role, unit, _ip, _loc in PEOPLE:
        user = by_email.get(email)
        if user is None:
            user = models.User(
                email=email,
                name=name,
                password_hash="mock-audit-dataset-not-a-real-hash",
                role=role,
            )
            db.add(user)
            db.flush()
        user_ids[email] = user.id

    system = by_email.get(SYSTEM_ACTOR[1])
    if system is None:
        system = models.User(
            email=SYSTEM_ACTOR[1],
            name=SYSTEM_ACTOR[0],
            password_hash="mock-audit-dataset-not-a-real-hash",
            role="administrator",
        )
        db.add(system)
        db.flush()
    user_ids[SYSTEM_ACTOR[1]] = system.id

    db.commit()
    return user_ids


def looks_like_production():
    url = (os.getenv("DATABASE_URL") or "").lower()
    return any(host in url for host in ("prod", "live")) and "sqlite" not in url


def main():
    parser = argparse.ArgumentParser(description="Seed a mock audit log")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--events", type=int, default=1200)
    parser.add_argument("--seed", type=int, default=20260927)
    parser.add_argument("--reset", action="store_true", help="delete existing audit rows first")
    parser.add_argument("--force", action="store_true", help="allow against a production-looking DATABASE_URL")
    args = parser.parse_args()

    if looks_like_production() and not args.force:
        raise SystemExit(
            "refusing to seed: DATABASE_URL looks like production.\n"
            "This writes fabricated security events into the audit trail.\n"
            "Re-run with --force only if that is genuinely what you want."
        )

    db = SessionLocal()
    try:
        models.Base.metadata.create_all(bind=engine)
        if args.reset:
            removed = db.query(models.AuditEvent).delete(synchronize_session=False)
            db.commit()
            print(f"reset: removed {removed} existing audit row(s)")

        boards = db.query(models.Board).all()
        if not boards and args.reset:
            # The dataset is far more legible against real projects.
            for label in [p[0] for p in PROJECTS]:
                db.add(models.Board(name=label, owner_id=next(iter(ensure_cast(db, False).values()))))
            db.commit()
            boards = db.query(models.Board).all()

        user_ids = ensure_cast(db, args.reset)
        rows = generate(args.days, args.events, args.seed, boards, user_ids)
        db.bulk_save_objects([models.AuditEvent(**r) for r in rows])
        db.commit()
        print(f"seeded {len(rows)} audit events across {args.days} day(s) (seed={args.seed})")
        print(f"cast: {len(user_ids)} user(s), {len(boards)} project(s) referenced")
        print("now run: python -m scripts.verify_audit_dataset")
    finally:
        db.close()


if __name__ == "__main__":
    main()
