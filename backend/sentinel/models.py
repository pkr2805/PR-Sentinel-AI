from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PRState(str, Enum):
    DRAFT = "DRAFT"
    CI_FAILING = "CI_FAILING"
    CI_PENDING = "CI_PENDING"
    MERGE_CONFLICT = "MERGE_CONFLICT"
    NEEDS_FIRST_REVIEW = "NEEDS_FIRST_REVIEW"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    FEEDBACK_ADDRESSED = "FEEDBACK_ADDRESSED"
    READY_TO_MERGE = "READY_TO_MERGE"
    DISCUSSION_STALLED = "DISCUSSION_STALLED"
    ABANDONED = "ABANDONED"


class WaitingOn(str, Enum):
    AUTHOR = "author"
    REVIEWER = "reviewer"
    MAINTAINER = "maintainer"
    NOBODY = "nobody"


# ─── Facts collected from GitHub ──────────────────────────────────────────────

class Review(BaseModel):
    author: str
    state: str  # APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING
    submitted_at: Optional[datetime] = None
    body: str = ""
    url: Optional[str] = None


class Comment(BaseModel):
    author: str
    body: str = ""
    created_at: Optional[datetime] = None
    url: Optional[str] = None


class ReviewThread(BaseModel):
    is_resolved: bool = False
    is_outdated: bool = False
    comments: list[Comment] = Field(default_factory=list)


class PRFacts(BaseModel):
    repo: str  # owner/name
    number: int
    title: str
    url: str = ""
    author: str
    author_is_bot: bool = False
    is_draft: bool = False
    created_at: datetime
    updated_at: datetime
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    labels: list[str] = Field(default_factory=list)
    mergeable: str = "UNKNOWN"  # MERGEABLE, CONFLICTING, UNKNOWN
    ci_state: Optional[str] = None  # SUCCESS, FAILURE, ERROR, PENDING, EXPECTED, or None when no checks
    head_sha: str = ""
    last_commit_at: Optional[datetime] = None
    requested_reviewers: list[str] = Field(default_factory=list)
    reviews: list[Review] = Field(default_factory=list)
    threads: list[ReviewThread] = Field(default_factory=list)
    comments: list[Comment] = Field(default_factory=list)

    @property
    def pr_id(self) -> str:
        return f"{self.repo}#{self.number}"

    def inactivity_days(self, now: datetime) -> int:
        return max((now - self.updated_at).days, 0)

    def latest_reviews(self) -> dict[str, Review]:
        """Each reviewer's most recent decisive review (comment-only reviews don't override a verdict)."""
        latest: dict[str, Review] = {}
        for review in sorted(self.reviews, key=lambda r: r.submitted_at or self.created_at):
            if review.author == self.author or review.state == "PENDING":
                continue
            current = latest.get(review.author)
            if review.state == "COMMENTED" and current and current.state in ("APPROVED", "CHANGES_REQUESTED"):
                continue
            latest[review.author] = review
        return latest

    def unresolved_threads(self) -> list[ReviewThread]:
        return [t for t in self.threads if not t.is_resolved and not t.is_outdated and t.comments]

    def cache_key(self) -> str:
        """Changes whenever anything that could change the assessment changes."""
        activity = [r.submitted_at for r in self.reviews] + [c.created_at for c in self.comments]
        activity += [c.created_at for t in self.threads for c in t.comments]
        latest = max((a for a in activity if a), default=None)
        resolved = sum(t.is_resolved for t in self.threads)
        return "|".join(str(x) for x in (
            self.head_sha, self.ci_state, self.mergeable, self.is_draft, len(self.reviews),
            len(self.comments), len(self.threads), resolved, latest, sorted(self.requested_reviewers),
        ))


# ─── Results ──────────────────────────────────────────────────────────────────

class Assessment(BaseModel):
    pr_id: str
    repo: str
    number: int
    title: str
    url: str = ""
    author: str
    state: PRState
    waiting_on: WaitingOn
    people: list[str] = Field(default_factory=list)  # GitHub logins who should act
    reason: str
    next_step: str
    confidence: float = 1.0
    source: str = "rules"  # rules | llm | cache
    evidence: list[str] = Field(default_factory=list)
    inactivity_days: int = 0
    additions: int = 0
    deletions: int = 0
    labels: list[str] = Field(default_factory=list)
    cache_key: str = ""
    escalate: bool = False

    @property
    def decision(self) -> str:
        """Legacy decision used by the dashboard."""
        if self.escalate or self.state == PRState.ABANDONED:
            return "ESCALATE"
        if self.state == PRState.READY_TO_MERGE:
            return "ASK_TO_MERGE"
        if self.waiting_on == WaitingOn.REVIEWER:
            return "PING_REVIEWER"
        if self.waiting_on == WaitingOn.AUTHOR and self.state != PRState.DRAFT:
            return "PING_AUTHOR"
        return "IGNORE"


class PRMemory(BaseModel):
    """What the previous run knew about a PR, used to skip unchanged PRs and avoid repeat notifications."""
    cache_key: str = ""
    state: Optional[PRState] = None
    last_notified_at: Optional[datetime] = None
    last_notified_state: Optional[PRState] = None
    assessment: Optional[Assessment] = None


class ActionKind(str, Enum):
    PR_COMMENT = "pr_comment"
    LABEL = "label"
    SLACK_DIGEST = "slack_digest"


class Action(BaseModel):
    kind: ActionKind
    repo: str
    pr_id: Optional[str] = None
    number: Optional[int] = None
    payload: dict = Field(default_factory=dict)
    requires_approval: bool = False


class ActionResult(BaseModel):
    action: Action
    status: str  # executed | dry_run | pending_approval | failed | skipped
    detail: str = ""
