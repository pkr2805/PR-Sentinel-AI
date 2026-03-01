from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy.orm import Session
from db.database import get_db
from services.agent_service import AgentService
from schemas.agent import AgentRunResponse
import logging

logger = logging.getLogger("pr_sentinel.api.agent")

router = APIRouter(prefix="/api/agent", tags=["Agent"])

@router.post("/run", response_model=AgentRunResponse)
async def trigger_agent(repo_id: Optional[str] = None, db: Session = Depends(get_db)):
    service = AgentService(db)
    
    # Kicks off execution - locks concurrently, parses, and commits to DB
    result = await service.execute_repo_scan(repo_id)
    
    if result.get("error"):
        return AgentRunResponse(
            status="error",
            message=result["message"],
            run_id=result.get("run_id", "N/A")
        )
    
    return AgentRunResponse(
        status="started",
        message=result["message"],
        run_id=result["run_id"]
    )
