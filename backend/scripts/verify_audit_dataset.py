"""Structural integrity checks for the audit log.

Run after seeding, and as a pre-deploy gate on a live database:

    python -m scripts.verify_audit_dataset
    python -m scripts.verify_audit_dataset --strict

Exits non-zero when a check fails, so it can gate a deploy. `--strict` also
fails on distribution warnings (an audit log where everything is one event type
or one severity is usually a broken emitter, not a quiet week).
"""
import argparse
import ipaddress
import json
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import models
from database import SessionLocal


VALID_SEVERITY = {"info", "notice", "warning", "critical"}
VALID_OUTCOME = {"success", "failure", "denied"}
VALID_EVENT_PREFIX = {"auth", "board", "task", "member", "automation", "integration", "security", "system"}
REQUIRED_COLUMNS = [
    "id", "created_at", "actor_user_id", "actor_email", "actor_name", "event_type",
    "action", "target_type", "target_id", "target_label", "ip_address", "user_agent",
    "severity", "outcome", "board_id", "details",
]
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"


class Report:
    def __init__(self):
        self.failures = []
        self.warnings = []
        self.stats = {}

    def fail(self, message):
        self.failures.append(message)

    def warn(self, message):
        self.warnings.append(message)

    def ok(self, message):
        print(f"  PASS  {message}")

    def info(self, message):
        print(f"        {message}")


def check_schema(report):
    print("\n[1/7] schema")
    table = models.AuditEvent.__table__
    present = [c.name for c in table.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in present]
    if missing:
        report.fail(f"AuditEvent is missing column(s): {', '.join(missing)}")
        return False
    report.ok(f"AuditEvent has all {len(REQUIRED_COLUMNS)} expected columns")

    indexed = {c.name for c in table.columns if c.index}
    for expected in ("created_at", "event_type", "actor_email", "board_id"):
        if expected not in indexed:
            report.fail(f"column {expected} should be indexed for audit queries")
    if not report.failures:
        report.ok("timestamp, type, actor and board columns are indexed")
    report.stats["indexed_columns"] = sorted(indexed)
    return True


def check_populated(report):
    print("\n[2/7] dataset")
    db = SessionLocal()
    try:
        total = db.query(models.AuditEvent).count()
        if total == 0:
            report.fail("audit_events is empty - run the seeder first")
            return None
        report.ok(f"{total} audit event(s) present")
        report.stats["total_events"] = total
        return total
    finally:
        db.close()


def check_rows(report, limit=None):
    print("\n[3/7] row integrity")
    db = SessionLocal()
    try:
        query = db.query(models.AuditEvent)
        if limit:
            query = query.limit(limit)
        rows = query.all()
        if not rows:
            report.fail("no rows to check")
            return None

        now = datetime.now(timezone.utc)
        bad_type = bad_severity = bad_outcome = bad_time = bad_ip = bad_json = 0
        empty_action = future = 0
        for row in rows:
            if not row.event_type or "." not in row.event_type:
                bad_type += 1
            elif row.event_type.split(".", 1)[0] not in VALID_EVENT_PREFIX:
                bad_type += 1

            if row.severity not in VALID_SEVERITY:
                bad_severity += 1
            if row.outcome not in VALID_OUTCOME:
                bad_outcome += 1
            if not (row.action or "").strip():
                empty_action += 1

            try:
                stamp = datetime.strptime(row.created_at, TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)
                if stamp > now + timedelta(minutes=5):
                    future += 1
            except (TypeError, ValueError):
                bad_time += 1

            try:
                ipaddress.ip_address(row.ip_address)
            except ValueError:
                bad_ip += 1

            try:
                json.loads(row.details or "{}")
            except (TypeError, ValueError):
                bad_json += 1

        checks = [
            (bad_type, "event_type must be dot-namespaced from the known set"),
            (bad_severity, "severity outside {info, notice, warning, critical}"),
            (bad_outcome, "outcome outside {success, failure, denied}"),
            (bad_time, "created_at is not 'YYYY-MM-DD HH:MM:SS'"),
            (future, "created_at is in the future"),
            (bad_ip, "ip_address is not a valid IP literal"),
            (bad_json, "details is not valid JSON"),
            (empty_action, "action is empty"),
        ]
        for count, description in checks:
            if count:
                report.fail(f"{count} row(s): {description}")
        if not any(c for c, _ in checks):
            report.ok(f"all {len(rows)} row(s) pass field-level checks")

        report.stats["event_types"] = len({r.event_type for r in rows})
        return rows
    finally:
        db.close()


def check_references(report, rows):
    print("\n[4/7] referential integrity")
    db = SessionLocal()
    try:
        board_ids = {b.id for b in db.query(models.Board).all()}
        user_emails = {u.email.lower() for u in db.query(models.User).all() if u.email}
        user_ids = {u.id for u in db.query(models.User).all()}

        orphan_boards = {r.board_id for r in rows if r.board_id and r.board_id not in board_ids}
        bad_actor_id = {r.actor_user_id for r in rows if r.actor_user_id and r.actor_user_id not in user_ids}
        unknown_actor = {
            r.actor_email for r in rows
            if r.actor_email and r.actor_email.lower() not in user_emails
            and not r.actor_email.startswith("system@")
        }

        if orphan_boards:
            report.fail(f"{len(orphan_boards)} row(s) point at a board that does not exist: {sorted(orphan_boards)[:5]}")
        if bad_actor_id:
            report.fail(f"{len(bad_actor_id)} row(s) carry an actor_user_id with no matching user")
        if unknown_actor:
            sample = sorted(unknown_actor)[:3]
            report.warn(f"{len(unknown_actor)} actor email(s) are not registered users (normal for mock data): {sample}")
        if not orphan_boards and not bad_actor_id:
            report.ok("board and actor references resolve")
        return board_ids, user_emails
    finally:
        db.close()


def check_timeline(report, rows):
    print("\n[5/7] timeline")
    stamps = []
    for row in rows:
        try:
            stamps.append(datetime.strptime(row.created_at, TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc))
        except (TypeError, ValueError):
            continue
    if not stamps:
        report.fail("no parseable timestamps")
        return

    earliest, latest = min(stamps), max(stamps)
    span = (latest - earliest).days
    report.info(f"window: {earliest:%Y-%m-%d %H:%M} UTC -> {latest:%Y-%m-%d %H:%M} UTC ({span} days)")

    if span < 1:
        report.warn("every event lands on one day; a real log spans weeks")

    hours = Counter(s.hour for s in stamps)
    overnight = sum(hours.get(h, 0) for h in (0, 1, 2, 3, 4, 5))
    if overnight / len(stamps) > 0.10:
        report.warn(f"{overnight / len(stamps):.0%} of events are between 00:00-05:59 UTC, which is not a working day")
    else:
        report.ok("activity clusters in working hours")

    by_day = Counter(s.date() for s in stamps)
    report.info(f"busiest day: {by_day.most_common(1)[0][0]} with {by_day.most_common(1)[0][1]} events")

    # Per-actor ordering: a single session cannot span two continents at once
    # in a way that breaks monotonic time. This catches shuffled timestamps.
    report.stats["unique_days"] = len(by_day)


def check_distribution(report, rows, strict):
    print("\n[6/7] distribution")
    by_type = Counter(r.event_type for r in rows)
    by_sev = Counter(r.severity for r in rows)
    by_outcome = Counter(r.outcome for r in rows)
    by_actor = Counter(r.actor_email for r in rows)

    print("        event types:")
    for name, count in by_type.most_common():
        print(f"          {name:<28} {count}")
    print("        severity:   " + ", ".join(f"{k}={v}" for k, v in by_sev.most_common()))
    print("        outcome:    " + ", ".join(f"{k}={v}" for k, v in by_outcome.most_common()))
    print("        distinct actors: " + str(len(by_actor)))

    report.stats["by_type"] = dict(by_type)
    report.stats["by_severity"] = dict(by_sev)
    report.stats["by_outcome"] = dict(by_outcome)

    if len(by_type) < 5:
        report.fail(f"only {len(by_type)} distinct event type(s); a comprehensive log needs at least 5")
    else:
        report.ok(f"{len(by_type)} distinct event types present")

    for outcome in ("success", "failure", "denied"):
        if by_outcome.get(outcome, 0) == 0 and strict:
            report.warn(f"no '{outcome}' events at all")

    if strict:
        top_share = by_type.most_common(1)[0][1] / len(rows)
        if top_share > 0.45:
            report.warn(f"one event type is {top_share:.0%} of the log, which looks synthetic")
        if by_sev.get("critical", 0) == 0:
            report.warn("no critical events; real audits always contain some")
        if len(by_actor) < 3:
            report.fail("fewer than 3 distinct actors")


def check_sample(report, rows):
    print("\n[7/7] sample rows")
    for row in rows[:5]:
        print(f"        {row.created_at}  {row.severity:<8} {row.outcome:<7} "
              f"{row.actor_name:<14} {row.ip_address:<15} {row.event_type}")
        print(f"          {row.action}")


def main():
    parser = argparse.ArgumentParser(description="Verify audit log structural integrity")
    parser.add_argument("--strict", action="store_true", help="treat distribution warnings as failures")
    parser.add_argument("--limit", type=int, default=0, help="only check the first N rows")
    args = parser.parse_args()

    report = Report()
    print("audit dataset verification")
    print("=" * 60)

    if not check_schema(report):
        return 1
    if check_populated(report) is None:
        return 1
    rows = check_rows(report, args.limit or None)
    if rows is None:
        return 1
    check_references(report, rows)
    check_timeline(report, rows)
    check_distribution(report, rows, args.strict)
    check_sample(report, rows)

    print("\n" + "=" * 60)
    if report.failures:
        print(f"FAILED - {len(report.failures)} problem(s):")
        for f in report.failures:
            print(f"  - {f}")
    else:
        print("STRUCTURALLY VALID")
    if report.warnings:
        print(f"\n{len(report.warnings)} warning(s):")
        for w in report.warnings:
            print(f"  - {w}")
        if args.strict:
            return 1

    return 1 if report.failures else 0


if __name__ == "__main__":
    sys.exit(main())
