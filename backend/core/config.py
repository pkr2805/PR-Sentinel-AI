from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal, Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App Settings
    project_name: str = "PR Sentinel AI"
    environment: str = "development"

    # LLM
    llm_provider: Literal["groq"] = "groq"
    llm_model: str = "openai/gpt-oss-120b"
    llm_temperature: float = 0.1
    llm_structured_output_method: Literal["function_calling", "json_schema", "json_mode"] = "function_calling"
    llm_max_tool_rounds: int = 5
    groq_api_key: str

    # Core Integrations (via MCP / REST)
    github_token: str
    jira_email: Optional[str] = None
    jira_api_token: Optional[str] = None
    jira_base_url: Optional[str] = None
    slack_bot_token: Optional[str] = None    # used by the Slack MCP server
    slack_team_id: Optional[str] = None      # used by the Slack MCP server
    slack_webhook_url: Optional[str] = None  # fallback: incoming webhook, no Slack app needed

    # DB
    database_url: str = "sqlite:///./sentinel.db"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

settings = Settings()
