from pydantic import BaseModel

class AgentRunResponse(BaseModel):
    status: str
    message: str
    run_id: str
