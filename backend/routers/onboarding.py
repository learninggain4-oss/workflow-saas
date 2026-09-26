"""Onboarding progress.

Every step is derived from rows that already exist. Nothing is stored here on
purpose: a stored checklist goes stale the moment someone creates a project in
another tab, and then the page lies. Derived state cannot drift.

The response carries state only - keys, done, and counts. Titles, descriptions
and call-to-action targets live in the frontend, which owns both the view-id enum
and the translation bundles.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core import Automation, _parse_json, get_current_user, get_db, get_user_boards, models


router = APIRouter()


def _count(db, model, board_ids, column):
    if not board_ids:
        return 0
    return db.query(model).filter(column.in_(board_ids)).count()


@router.get("/api/onboarding")
def get_onboarding(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    board_ids = [b.id for b in get_user_boards(current_user, db)]

    projects = len(board_ids)
    tasks = _count(db, models.Task, board_ids, models.Task.board_id)
    automations = _count(db, Automation, board_ids, Automation.board_id)

    # An invite is the only thing that writes a BoardMember row, so its presence
    # is a real signal rather than an assumed one.
    invited_boards = 0
    if board_ids:
        invited_boards = (
            db.query(models.BoardMember.board_id)
            .filter(models.BoardMember.board_id.in_(board_ids))
            .distinct()
            .count()
        )

    # create_board_from_template logs this exact wording, which is a durable
    # record that survives a project being deleted.
    template_projects = 0
    if board_ids:
        template_projects = (
            db.query(models.Activity)
            .filter(
                models.Activity.board_id.in_(board_ids),
                models.Activity.action.like("%from template%"),
            )
            .count()
        )

    preferences = _parse_json(getattr(current_user, "profile_preferences", "{}"), {}) or {}

    def step(key, kind, done, count=None, target=None):
        return {"key": key, "kind": kind, "done": bool(done), "count": count, "target": target}

    steps = [
        step("create_project", "auto", projects > 0, projects, 1),
        step("start_from_template", "auto", template_projects > 0, template_projects, 1),
        step("create_first_task", "auto", tasks > 0, tasks, 1),
        step("invite_teammate", "auto", invited_boards > 0, invited_boards, 1),
        step("add_automation", "auto", automations > 0, automations, 1),
        step("enable_two_factor", "auto", bool(getattr(current_user, "two_factor_enabled", False))),
        step("email_notifications", "preference", bool(preferences.get("emailNotifications"))),
        step("weekly_digest", "preference", bool(preferences.get("weeklyDigest"))),
    ]

    completed = sum(1 for s in steps if s["done"])
    total = len(steps)
    # Round rather than truncate, and never claim 100% until every step is done,
    # so the number matches the checklist the user is looking at.
    percent = 100 if completed == total else int(round(completed / total * 100))

    return {
        "completed": completed,
        "total": total,
        "percent": percent,
        "projects": projects,
        "tasks": tasks,
        "automations": automations,
        "steps": steps,
    }
