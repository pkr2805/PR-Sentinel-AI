from typing import Optional

from pydantic import BaseModel, Field


class SentinelConfig(BaseModel):
    """Behaviour of a scan. Built from app settings, or from a config file for the CLI / GitHub Action."""

    dry_run: bool = True
    stale_after_days: int = 2          # don't nudge anyone about PRs fresher than this
    escalate_after_days: int = 7       # waiting this long on someone → escalation
    abandoned_after_days: int = 21     # no activity at all for this long → ABANDONED
    reminder_interval_hours: int = 24  # re-notify about an unchanged state at most this often
    quiet_hours_utc: Optional[tuple[int, int]] = None  # e.g. (22, 7): no notifications in that window
    require_approval_for_escalation: bool = True
    enable_pr_comments: bool = True
    enable_labels: bool = True
    enable_slack_digest: bool = True
    slack_channel: Optional[str] = None
    ignore_labels: list[str] = Field(default_factory=lambda: ["sentinel:ignore", "wip", "do-not-merge"])
    ignore_authors: list[str] = Field(default_factory=list)
    max_prs: int = 30
    max_concurrency: int = 5
    use_llm: bool = True
