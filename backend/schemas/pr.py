from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PRRecordBase(BaseModel):
    id: str
    number: Optional[int] = None
    repo_id: str
    title: str
    author: str
    inactivity_days: int
    additions: int
    deletions: int
    decision: str
    escalation_level: int
    jira_id: Optional[str] = None
    jira_status: Optional[str] = None

class PRRecordResponse(PRRecordBase):
    updated_at: datetime

    class Config:
        from_attributes = True

class PRDecisionOverride(BaseModel):
    decision: str

class ExecutionLogResponse(BaseModel):
    id: str
    pr_id: Optional[str] = None
    repo_id: str
    decision: str
    slack_sent: bool
    status: str
    error_msg: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
