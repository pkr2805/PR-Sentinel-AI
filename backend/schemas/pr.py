from pydantic import BaseModel
from typing import List, Optional
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
    url: Optional[str] = None
    state: Optional[str] = None
    waiting_on: Optional[str] = None
    people: Optional[List[str]] = None
    reason: Optional[str] = None
    next_step: Optional[str] = None
    confidence: Optional[float] = None
    source: Optional[str] = None
    last_notified_at: Optional[datetime] = None

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
    duration_ms: Optional[int] = None
    prs_seen: Optional[int] = None
    prs_cached: Optional[int] = None
    llm_calls: Optional[int] = None
    actions_taken: Optional[int] = None

    class Config:
        from_attributes = True
