from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RepoBase(BaseModel):
    owner: str
    name: str
    jira_project_key: Optional[str] = None
    slack_channel: Optional[str] = None
    active: bool = True

class RepoCreate(RepoBase):
    pass

class RepoResponse(RepoBase):
    id: str
    created_at: datetime
    open_prs: int = 0

    class Config:
        from_attributes = True
