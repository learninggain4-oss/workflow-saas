from datetime import datetime, timezone


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def audit_now_str():
    """Timestamp for audit evidence, always UTC.

    Deliberately not now_str(): that one is naive local time, which is fine for
    a task's created_at but unusable for an audit trail - you cannot line events
    up across servers, and a DST jump silently shifts them by an hour. Audit
    rows are evidence, so they get an explicit clock and are formatted to match
    the rest of the schema. ISO-8601 sorts lexicographically, which is what the
    ordering and date-range queries rely on.
    """
    from datetime import timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
