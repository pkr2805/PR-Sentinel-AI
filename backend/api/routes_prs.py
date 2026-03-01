from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from schemas.pr import PRRecordResponse, ExecutionLogResponse, PRDecisionOverride
from services.pr_service import PRService

router = APIRouter(prefix="/api", tags=["Pull Requests"])

@router.get("/prs", response_model=List[PRRecordResponse])
def list_prs(repo_id: str = None, db: Session = Depends(get_db)):
    service = PRService(db)
    return service.get_prs(repo_id=repo_id)

@router.get("/prs/{pr_id}", response_model=PRRecordResponse)
def get_pr(pr_id: str, db: Session = Depends(get_db)):
    service = PRService(db)
    return service.get_pr_by_id(pr_id)

@router.post("/prs/{pr_id}/override", response_model=PRRecordResponse)
def override_pr_decision(pr_id: str, payload: PRDecisionOverride, db: Session = Depends(get_db)):
    service = PRService(db)
    return service.override_decision(pr_id, payload.decision)

@router.get("/logs", response_model=List[ExecutionLogResponse])
def list_logs(repo_id: str = None, pr_id: str = None, db: Session = Depends(get_db)):
    service = PRService(db)
    return service.get_logs(repo_id=repo_id, pr_id=pr_id)
