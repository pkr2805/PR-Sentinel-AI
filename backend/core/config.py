from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    project_name: str = "PR Sentinel AI"
    environment: str = "development"
    
    # Core Integrations (via MCP / REST)
    gemini_api_key: str
    github_token: str
    jira_email: Optional[str] = None
    jira_api_token: Optional[str] = None
    jira_base_url: Optional[str] = None
    slack_webhook: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    
    # DB
    database_url: str = "sqlite+aiosqlite:///./sentinel.db"
    
    # MCP Servers Config (if running external MCP servers)
    github_mcp_command: str = "npx"
    github_mcp_args: list[str] = ["-y", "@modelcontextprotocol/server-github"]

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = "ignore"

settings = Settings()
