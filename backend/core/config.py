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
    llm_max_tool_rounds: int = 3
    groq_api_key: Optional[str] = None  # without it, ambiguous PRs keep the rule engine's answer

    # Core Integrations (via MCP / REST)
    github_token: str = ""  # needed to scan; the dashboard and demo data work without it
    jira_email: Optional[str] = None
    jira_api_token: Optional[str] = None
    jira_base_url: Optional[str] = None
    slack_bot_token: Optional[str] = None    # used by the Slack MCP server
    slack_team_id: Optional[str] = None      # used by the Slack MCP server
    slack_webhook_url: Optional[str] = None  # fallback: incoming webhook, no Slack app needed

    github_webhook_secret: Optional[str] = None  # enables POST /api/webhooks/github

    # Sentinel behaviour (see sentinel/config.py)
    sentinel_dry_run: bool = True
    sentinel_stale_after_days: int = 2
    sentinel_escalate_after_days: int = 7
    sentinel_abandoned_after_days: int = 21
    sentinel_reminder_interval_hours: int = 24
    sentinel_quiet_hours_utc: Optional[tuple[int, int]] = None
    sentinel_require_approval_for_escalation: bool = True
    sentinel_enable_pr_comments: bool = True
    sentinel_enable_labels: bool = True
    sentinel_enable_slack_digest: bool = True
    sentinel_use_mcp_tools: bool = True
    sentinel_max_concurrency: int = 5

    # DB
    database_url: str = "sqlite:///./sentinel.db"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

settings = Settings()
