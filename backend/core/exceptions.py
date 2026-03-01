from fastapi import Request
from fastapi.responses import JSONResponse
from core.logger import logger

class SentinelException(Exception):
    """Base exception for all custom PR Sentinel errors"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class AgentExecutionError(SentinelException):
    """Raised when the LangGraph agent fails during execution"""
    def __init__(self, message: str, step: str = "unknown"):
        super().__init__(f"Agent execution failed at step '{step}': {message}", status_code=500)

class IntegrationError(SentinelException):
    """Raised when an external MCP tool / API (GitHub/Jira/Slack) fails"""
    def __init__(self, service: str, details: str):
        super().__init__(f"{service} Integration Error: {details}", status_code=502)

async def sentinel_exception_handler(request: Request, exc: SentinelException):
    logger.error("application_error", error=exc.message, status_code=exc.status_code, path=request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": exc.message}
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_error", path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "An unexpected internal server error occurred."}
    )
