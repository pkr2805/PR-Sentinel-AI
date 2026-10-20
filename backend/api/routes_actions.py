from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from db.database import get_db
from db.models import PendingAction
from schemas.actions import PendingActionResponse
from sentinel.github import GitHubClient
from sentinel.models import Action
from services.agent_service import build_executor

router = APIRouter(prefix="/api/actions", tags=["Actions"])


@router.get("", response_model=List[PendingActionResponse])
def list_actions(status: Optional[str] = "pending", repo_id: Optional[str] = None, db: Session = Depends(get_db)):
    stmt = select(PendingAction).order_by(PendingAction.created_at.desc())
    if status:
        stmt = stmt.where(PendingAction.status == status)
    if repo_id:
        stmt = stmt.where(PendingAction.repo_id == repo_id)
    return db.execute(stmt).scalars().all()


def _get_pending(db: Session, action_id: str) -> PendingAction:
    pending = db.get(PendingAction, action_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Action not found")
    if pending.status != "pending":
        raise HTTPException(status_code=409, detail=f"Action is already {pending.status}")
    return pending


@router.post("/{action_id}/approve", response_model=PendingActionResponse)
async def approve_action(action_id: str, db: Session = Depends(get_db)):
    pending = _get_pending(db, action_id)
    github = GitHubClient(settings.github_token)
    try:
        result = await build_executor(github, settings.sentinel_dry_run).execute(
            Action.model_validate(pending.action_json), approved=True)
    finally:
        await github.aclose()

    pending.status = "failed" if result.status == "failed" else "executed"
    pending.result = f"{result.status}: {result.detail}"
    pending.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pending)
    return pending


@router.post("/{action_id}/reject", response_model=PendingActionResponse)
def reject_action(action_id: str, db: Session = Depends(get_db)):
    pending = _get_pending(db, action_id)
    pending.status = "rejected"
    pending.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pending)
    return pending
