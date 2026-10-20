import asyncio
import uuid
from contextlib import AsyncExitStack
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AgentExecutionError
from core.logger import logger
from db.models import ExecutionLog, PendingAction, PRRecord, Repository
from sentinel.actions import ActionExecutor
from sentinel.config import SentinelConfig
from sentinel.engine import ScanDeps, ScanResult, run_scan
from sentinel.github import GitHubClient
from sentinel.judge import LLMJudge
from sentinel.models import Assessment, PRMemory, PRState

# In-memory execution lock for concurrency protection
# Key: repo_id, Value: run_id
_ACTIVE_RUNS: Dict[str, str] = {}

DepsFactory = Callable[[Repository, dict, SentinelConfig, AsyncExitStack], Awaitable[ScanDeps]]


def build_config(repo: Repository) -> SentinelConfig:
    return SentinelConfig(
        dry_run=settings.sentinel_dry_run,
        stale_after_days=settings.sentinel_stale_after_days,
        escalate_after_days=settings.sentinel_escalate_after_days,
        abandoned_after_days=settings.sentinel_abandoned_after_days,
        reminder_interval_hours=settings.sentinel_reminder_interval_hours,
        quiet_hours_utc=settings.sentinel_quiet_hours_utc,
        require_approval_for_escalation=settings.sentinel_require_approval_for_escalation,
        enable_pr_comments=settings.sentinel_enable_pr_comments,
        enable_labels=settings.sentinel_enable_labels,
        enable_slack_digest=settings.sentinel_enable_slack_digest,
        slack_channel=repo.slack_channel,
        max_concurrency=settings.sentinel_max_concurrency,
        use_llm=bool(settings.groq_api_key),
    )


def build_executor(github: Optional[GitHubClient], dry_run: bool) -> ActionExecutor:
    return ActionExecutor(github=github, dry_run=dry_run, slack_webhook_url=settings.slack_webhook_url,
                          slack_bot_token=settings.slack_bot_token)


class LazyMCPTools:
    """Starts the MCP servers the first time an ambiguous PR needs them, once per run."""

    def __init__(self, stack: AsyncExitStack):
        self._stack = stack
        self._lock = asyncio.Lock()
        self._tools: Optional[list] = None

    async def __call__(self) -> list:
        async with self._lock:
            if self._tools is None:
                from services.agent.mcp_tools import MCPToolManager

                manager = await self._stack.enter_async_context(MCPToolManager(include_slack=False))
                self._tools = manager.get_read_only_tools()
            return self._tools


async def default_deps(repo: Repository, memory: dict, config: SentinelConfig, stack: AsyncExitStack) -> ScanDeps:
    github = GitHubClient(settings.github_token)
    stack.push_async_callback(github.aclose)

    judge = None
    if config.use_llm:
        from core.llm import get_chat_model

        judge = LLMJudge(
            llm=get_chat_model(),
            tools=LazyMCPTools(stack) if settings.sentinel_use_mcp_tools else None,
            max_tool_rounds=settings.llm_max_tool_rounds,
            structured_output_method=settings.llm_structured_output_method,
        )
    return ScanDeps(github=github, executor=build_executor(github, config.dry_run), config=config,
                    judge=judge, memory=memory)


def load_memory(db: Session, repo_id: str) -> dict[str, PRMemory]:
    memory = {}
    for record in db.execute(select(PRRecord).where(PRRecord.repo_id == repo_id)).scalars():
        assessment = None
        if record.assessment_json:
            try:
                assessment = Assessment.model_validate(record.assessment_json)
            except Exception:
                assessment = None
        memory[record.id] = PRMemory(
            cache_key=record.cache_key or "",
            state=PRState(record.state) if record.state else None,
            last_notified_at=_aware(record.last_notified_at),
            last_notified_state=PRState(record.last_notified_state) if record.last_notified_state else None,
            assessment=assessment,
        )
    return memory


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    # SQLite returns naive datetimes; everything here is UTC.
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class AgentService:
    def __init__(self, db: Session, deps_factory: Optional[DepsFactory] = None):
        self.db = db
        self.deps_factory = deps_factory or default_deps

    async def execute_repo_scan(self, repo_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Runs a scan for one repository. If repo_id is None or 'null', it picks the first active repository.
        Enforces concurrency locking to prevent overlapping runs.
        """
        if not repo_id or repo_id == "null":
            target_repo = self.db.execute(
                select(Repository).where(Repository.active == True).limit(1)  # noqa: E712
            ).scalar_one_or_none()
            if not target_repo:
                raise AgentExecutionError("No active repositories found to scan")
            repo_id = target_repo.id

        if repo_id in _ACTIVE_RUNS:
            logger.warning("agent_run_skipped_concurrency", repo_id=repo_id, run_id=_ACTIVE_RUNS[repo_id])
            return {"error": True, "message": "Agent is already running for this repository."}

        run_id = str(uuid.uuid4())
        _ACTIVE_RUNS[repo_id] = run_id
        logger.info("agent_run_started", repo_id=repo_id, run_id=run_id)

        try:
            repo = self.db.get(Repository, repo_id)
            if not repo:
                raise AgentExecutionError("Repository not found")

            config = build_config(repo)
            memory = load_memory(self.db, repo_id)
            async with AsyncExitStack() as stack:
                deps = await self.deps_factory(repo, memory, config, stack)
                result = await run_scan(repo_id, deps)

            self._save(repo_id, run_id, result)
            logger.info("agent_run_complete", run_id=run_id, prs=len(result.assessments), cached=result.cached,
                        llm_calls=result.llm_calls, duration_ms=result.duration_ms, errors=len(result.errors))
            return {
                "status": "success",
                "run_id": run_id,
                "message": (f"Assessed {len(result.assessments)} PRs ({result.cached} unchanged, "
                            f"{result.llm_calls} LLM calls, {len(result.skipped)} skipped)."
                            + (f" {len(result.errors)} error(s): {result.errors[0][:200]}" if result.errors else "")),
            }

        except AgentExecutionError:
            self.db.rollback()
            raise
        except Exception as e:
            logger.exception("agent_run_failed", repo_id=repo_id, run_id=run_id, error=str(e))
            self.db.rollback()
            raise AgentExecutionError(str(e))
        finally:
            _ACTIVE_RUNS.pop(repo_id, None)

    def _save(self, repo_id: str, run_id: str, result: ScanResult):
        now = datetime.now(timezone.utc)
        status = "success" if not result.errors else "partial_failure"
        open_ids = {a.pr_id for a in result.assessments} | {s["pr_id"] for s in result.skipped}

        for a in result.assessments:
            record = self.db.get(PRRecord, a.pr_id)
            previous_state = record.state if record else None
            if record is None:
                record = PRRecord(id=a.pr_id, repo_id=repo_id, title=a.title, author=a.author)
                self.db.add(record)

            record.number = a.number
            record.title = a.title
            record.author = a.author
            record.url = a.url
            record.inactivity_days = a.inactivity_days
            record.additions = a.additions
            record.deletions = a.deletions
            record.decision = a.decision
            record.escalation_level = 2 if a.escalate else 0
            record.state = a.state.value
            record.waiting_on = a.waiting_on.value
            record.people = a.people
            record.reason = a.reason
            record.next_step = a.next_step
            record.confidence = a.confidence
            record.source = a.source
            record.cache_key = a.cache_key
            record.assessment_json = a.model_dump(mode="json")

            notified_state = result.notified.get(a.pr_id)
            if notified_state:
                record.last_notified_at = now
                record.last_notified_state = notified_state

            # Per-PR log entries only when something changed, so the timeline stays meaningful.
            if notified_state or previous_state != a.state.value:
                self.db.add(ExecutionLog(id=str(uuid.uuid4()), pr_id=a.pr_id, repo_id=repo_id,
                                         decision=a.decision, status=status, slack_sent=bool(notified_state)))

        # PRs that are no longer open (merged or closed) leave the dashboard, unless the fetch itself failed.
        if not any(e.startswith("Fetching PRs failed") for e in result.errors):
            for record in self.db.execute(select(PRRecord).where(PRRecord.repo_id == repo_id)).scalars():
                if record.id not in open_ids:
                    self.db.delete(record)

        for r in result.results:
            if r.status == "pending_approval":
                self.db.add(PendingAction(
                    id=str(uuid.uuid4()), repo_id=repo_id, pr_id=r.action.pr_id, kind=r.action.kind.value,
                    action_json=r.action.model_dump(mode="json"), status="pending",
                    summary=r.action.payload.get("body") or r.action.payload.get("text"),
                ))

        self.db.add(ExecutionLog(
            id=run_id, repo_id=repo_id, decision="BATCH_RUN", status=status,
            error_msg="; ".join(result.errors)[:2000] or None,
            slack_sent=any(r.action.kind.value == "slack_digest" and r.status == "executed" for r in result.results),
            duration_ms=result.duration_ms, prs_seen=len(result.assessments) + len(result.skipped),
            prs_cached=result.cached, llm_calls=result.llm_calls,
            actions_taken=sum(r.status == "executed" for r in result.results),
        ))
        self.db.commit()

    async def get_active_runs(self) -> Dict[str, str]:
        return _ACTIVE_RUNS
