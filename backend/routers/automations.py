"""Board automation rules."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core import Automation, AutomationCreatePayload, _parse_json, get_current_user, get_db, validate_rule_target, utils


router = APIRouter()

@router.get("/api/boards/{board_id}/automations")
def get_automations(board_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="viewer", action="View automations", required_permission="viewAutomations")
    return db.query(Automation).filter(Automation.board_id == board_id).all()


@router.post("/api/boards/{board_id}/automations")
def create_automation(board_id: int, payload: AutomationCreatePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Create automation", required_permission="manageAutomations")

    # Fail here rather than at fire time: a saved rule that can never do
    # anything looks identical to a working one until you wait for it.
    problem = validate_rule_target(
        payload.action_type, _parse_json(payload.action_payload, {}) or {}, db
    )
    if problem:
        raise HTTPException(status_code=422, detail=problem)

    rule = Automation(
        board_id=board_id,
        trigger_type=payload.trigger_type,
        trigger_condition=payload.trigger_condition,
        action_type=payload.action_type,
        action_payload=payload.action_payload,
        trigger_value=payload.trigger_value or "",
        is_active=payload.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/api/boards/{board_id}/automations/{rule_id}")
def update_automation(board_id: int, rule_id: int, payload: AutomationCreatePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Update automation", required_permission="manageAutomations")
    rule = db.query(Automation).filter(Automation.id == rule_id, Automation.board_id == board_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation not found")

    problem = validate_rule_target(
        payload.action_type, _parse_json(payload.action_payload, {}) or {}, db
    )
    if problem:
        raise HTTPException(status_code=422, detail=problem)

    rule.trigger_type = payload.trigger_type
    rule.trigger_condition = payload.trigger_condition
    rule.action_type = payload.action_type
    rule.action_payload = payload.action_payload
    rule.trigger_value = payload.trigger_value or ""
    rule.is_active = payload.is_active
    
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/api/boards/{board_id}/automations/{rule_id}")
def delete_automation(board_id: int, rule_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    utils.ensure_board_access(board_id, current_user, db, required_role="administrator", action="Delete automation", required_permission="manageAutomations")
    rule = db.query(Automation).filter(Automation.id == rule_id, Automation.board_id == board_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation not found")
    
    db.delete(rule)
    db.commit()
    return {"ok": True}
