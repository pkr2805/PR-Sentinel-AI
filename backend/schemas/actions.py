from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PendingActionResponse(BaseModel):
    id: str
    repo_id: str
    pr_id: Optional[str] = None
    kind: str
    summary: Optional[str] = None
    status: str
    result: Optional[str] = None
    created_at: datetime
    decided_at: Optional[datetime] = None

    class Config:
        from_attributes = True
