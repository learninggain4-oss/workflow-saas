"""Task routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core import _dump_json, _parse_json, _task_response, _to_int, apply_automations, create_notification_safe, get_current_user, get_db, log_activity_safe, manager, models, now_str, schemas, utils


router = APIRouter()

@router.get("/api/tasks")
def list_tasks(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="Task list")
    tasks = db.query(models.Task).filter(models.Task.board_id == board_id).all()

    # Activities are exposed separately via /api/tasks/{task_id}/activities to
    # keep this payload small.
    return [_task_response(t) for t in tasks]


@router.post("/api/tasks")
async def create_task(payload: schemas.TaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.board_id:
        utils.ensure_board_access(payload.board_id, current_user, db, required_role="editor", action="Task creation", required_permission="createTasks")
        board_owner = db.query(models.Board).filter(models.Board.id == payload.board_id).first()
        if board_owner:
            owner_u = db.query(models.User).filter(models.User.id == board_owner.owner_id).first()
            task_count = db.query(models.Task).filter(models.Task.board_id == payload.board_id).count()
            if owner_u and owner_u.subscription_tier == "free" and task_count >= 20:
                raise HTTPException(status_code=402, detail="Board limit reached (20 tasks for Free plan).")

    # dependencies/recurring are TEXT columns; binding the parsed Python objects
    # directly makes the driver reject them ("can't adapt type 'list'" on psycopg2).
    # board_id is set explicitly below: it is excluded from TASK_WRITABLE_FIELDS
    # so that updates can never relocate a task to another board.
    task_kwargs = {
        k: v for k, v in payload.model_dump().items()
        if k in TASK_WRITABLE_FIELDS or k == "board_id"
    }
    task_kwargs["board_id"] = payload.board_id
    task_kwargs["dependencies"] = _dump_json(task_kwargs.get("dependencies") or [], [])
    task_kwargs["recurring"] = _dump_json(task_kwargs.get("recurring"), {}) if task_kwargs.get("recurring") else ""
    stamp = now_str()
    task_kwargs["created_at"] = stamp
    task_kwargs["updated_at"] = stamp

    t = models.Task(**task_kwargs, user_id=current_user.id)
    db.add(t)
    db.commit()
    db.refresh(t)

    if payload.board_id:
        log_activity_safe(payload.board_id, current_user.name, f"created task '{payload.title}'", task_id=t.id)

        if apply_automations(t, payload.board_id, "create", "", db):
            t.updated_at = now_str()
            db.commit()
            db.refresh(t)

        await manager.broadcast(payload.board_id, {"type": "update"})

    return _task_response(t)


@router.put("/api/tasks/{task_id}")
async def update_task(task_id: int, payload: schemas.TaskUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    utils.ensure_board_access(t.board_id, current_user, db, required_role="editor", action="Task update", required_permission="editTasks")

    # TaskUpdate declares no id/user_id/board_id field, so Pydantic drops them.
    # This blocks primary-key and cross-board writes while still accepting the full
    # task object the offline queue replays (App.jsx saveEdit -> saveOfflineAction).
    changes = payload.model_dump(exclude_unset=True)

    old_status, old_assign, old_title = t.status, t.assigned_to, t.title

    # Blocker validation: doing/done requires every dependency to be done.
    new_status = changes.get("status", t.status)
    if new_status in ("doing", "done"):
        raw_deps = changes.get("dependencies", getattr(t, "dependencies", "[]"))
        dep_ids = [d for d in (_to_int(x) for x in (_parse_json(raw_deps, []) or [])) if d is not None]
        if dep_ids:
            for dt in db.query(models.Task).filter(models.Task.id.in_(dep_ids)).all():
                if dt.status != "done":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot change status to '{new_status}' because dependency task '{dt.title}' is not done."
                    )

    for k, v in changes.items():
        if k not in TASK_WRITABLE_FIELDS:
            continue
        if k == "dependencies":
            setattr(t, k, _dump_json([str(d) for d in (_to_int(x) for x in (v or [])) if d is not None], []))
        elif k == "recurring":
            setattr(t, k, _dump_json(v, {}) if v else "")
        else:
            setattr(t, k, v)

    # Rules run against the in-session object and ride the same commit, so they
    # cannot recurse back through this endpoint.
    if t.board_id and "status" in changes and new_status != old_status:
        apply_automations(t, t.board_id, "update", old_status, db)

    t.updated_at = now_str()
    db.commit()
    db.refresh(t)

    if t.board_id:
        actor = current_user.name if current_user.name else "Someone"
        if old_status != t.status:
            log_activity_safe(t.board_id, actor, f"moved '{t.title}' {old_status}->{t.status}", task_id=t.id)
        if old_title != t.title:
            log_activity_safe(t.board_id, actor, f"renamed task to '{t.title}'", task_id=t.id)
        if old_assign != t.assigned_to and t.assigned_to:
            au = db.query(models.User).filter(models.User.email == t.assigned_to).first()
            if au:
                create_notification_safe(au.id, t.board_id, t.id, f"You were assigned to '{t.title}'", "assign", f"Assigned: {t.title}")

        await manager.broadcast(t.board_id, {"type": "update"})

    return _task_response(t)


@router.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404)
    utils.ensure_board_access(t.board_id, current_user, db, required_role="editor", action="Task deletion", required_permission="deleteTasks")

    bid = t.board_id
    db.query(models.Comment).filter(models.Comment.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Subtask).filter(models.Subtask.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Activity).filter(models.Activity.task_id == task_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.task_id == task_id).delete(synchronize_session=False)

    # Drop this task from any blocker list that still references it, otherwise
    # the ids accumulate forever and the blocker check keeps querying dead rows.
    if bid:
        for other in db.query(models.Task).filter(models.Task.board_id == bid).all():
            deps = _parse_json(getattr(other, "dependencies", "[]"), []) or []
            if str(task_id) in [str(d) for d in deps]:
                remaining = [str(d) for d in deps if str(d) != str(task_id)]
                other.dependencies = _dump_json(remaining, [])
                other.updated_at = now_str()

    db.delete(t)
    db.commit()
    
    if bid: 
        await manager.broadcast(bid, {"type": "update"})
        
    return {"ok": True}


@router.get("/api/tasks/{task_id}/activities")
def get_task_activities(task_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.board_id:
        utils.ensure_board_access(task.board_id, current_user, db, required_role="subscriber", action="Task activity view")

    # No blanket except: silently returning [] here would hide a missing
    # activities.task_id column as a permanently empty log.
    rows = (db.query(models.Activity)
              .filter(models.Activity.task_id == task_id)
              .order_by(models.Activity.id.desc()).limit(50).all())
    return [{"user": r.user_name, "action": r.action, "timestamp": r.created_at} for r in rows]
