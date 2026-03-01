from sqlalchemy.orm import Session
from typing import List, Optional

from sqlalchemy import select
from db.models import PRRecord, ExecutionLog
from core.exceptions import SentinelException

class PRService:
    def __init__(self, db: Session):
        self.db = db
        
    def get_prs(self, repo_id: Optional[str] = None) -> List[PRRecord]:
        stmt = select(PRRecord).order_by(PRRecord.updated_at.desc())
        if repo_id:
            stmt = stmt.where(PRRecord.repo_id == repo_id)
        
        result = self.db.execute(stmt)
        return result.scalars().all()
        
    def get_pr_by_id(self, pr_id: str) -> PRRecord:
        stmt = select(PRRecord).where(PRRecord.id == pr_id)
        res = self.db.execute(stmt)
        pr = res.scalar_one_or_none()
        if not pr:
            raise SentinelException("PR not found", status_code=404)
        return pr

    def override_decision(self, pr_id: str, new_decision: str) -> PRRecord:
        pr = self.get_pr_by_id(pr_id)
        pr.decision = new_decision
        self.db.commit()
        self.db.refresh(pr)
        return pr

    def get_logs(self, repo_id: Optional[str] = None, pr_id: Optional[str] = None) -> List[ExecutionLog]:
        stmt = select(ExecutionLog).order_by(ExecutionLog.timestamp.desc())
        if repo_id:
            stmt = stmt.where(ExecutionLog.repo_id == repo_id)
        if pr_id:
            stmt = stmt.where(ExecutionLog.pr_id == pr_id)
            
        result = self.db.execute(stmt)
        return result.scalars().all()
