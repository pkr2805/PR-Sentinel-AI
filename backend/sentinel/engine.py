from __future__ import annotations

import operator
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Annotated, Any, Optional, Protocol, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field

from sentinel.actions import ActionExecutor
from sentinel.config import SentinelConfig
from sentinel.judge import LLMJudge
from sentinel.models import Action, ActionResult, Assessment, PRFacts, PRMemory
from sentinel.planner import apply_escalation, notified_pr_ids, plan_actions
from sentinel.rules import classify, should_skip


class PRSource(Protocol):
    async def fetch_open_prs(self, owner: str, name: str, first: int = 30) -> list[PRFacts]: ...


@dataclass
class ScanDeps:
    """Everything a scan needs, injected so the engine can run from the API, a CLI or tests."""
    github: PRSource
    executor: ActionExecutor
    config: SentinelConfig = field(default_factory=SentinelConfig)
    judge: Optional[LLMJudge] = None
    memory: dict[str, PRMemory] = field(default_factory=dict)
    now: Optional[datetime] = None


class ScanResult(BaseModel):
    repo: str
    assessments: list[Assessment] = Field(default_factory=list)
    skipped: list[dict] = Field(default_factory=list)
    results: list[ActionResult] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    llm_calls: int = 0
    cached: int = 0
    duration_ms: int = 0
    notified: dict[str, str] = Field(default_factory=dict)  # pr_id -> state notified (or queued) this run


class ScanState(TypedDict, total=False):
    repo: str
    prs: list[PRFacts]
    skipped: Annotated[list[dict], operator.add]
    assessments: Annotated[list[Assessment], operator.add]
    errors: Annotated[list[str], operator.add]
    llm_calls: Annotated[int, operator.add]
    cached: Annotated[int, operator.add]
    actions: list[Action]
    results: list[ActionResult]


class PRTask(TypedDict):
    facts: PRFacts


def _deps(config: RunnableConfig) -> ScanDeps:
    return config["configurable"]["deps"]


def _now(deps: ScanDeps) -> datetime:
    return deps.now or datetime.now(timezone.utc)


# ─── Nodes ────────────────────────────────────────────────────────────────────

async def fetch_prs(state: ScanState, config: RunnableConfig) -> dict:
    deps = _deps(config)
    owner, name = state["repo"].split("/", 1)
    try:
        prs = await deps.github.fetch_open_prs(owner, name, first=deps.config.max_prs)
    except Exception as e:
        return {"prs": [], "errors": [f"Fetching PRs failed: {e}"]}
    return {"prs": prs}


async def filter_prs(state: ScanState, config: RunnableConfig) -> dict:
    deps = _deps(config)
    keep, skipped = [], []
    for facts in state.get("prs", []):
        reason = should_skip(facts, deps.config)
        if reason:
            skipped.append({"pr_id": facts.pr_id, "reason": reason})
        else:
            keep.append(facts)
    return {"prs": keep, "skipped": skipped}


def fan_out(state: ScanState) -> list[Send] | str:
    prs = state.get("prs", [])
    if not prs:
        return "plan"
    return [Send("assess_pr", {"facts": facts}) for facts in prs]


async def assess_pr(task: PRTask, config: RunnableConfig) -> dict:
    """Assesses one PR: cache → rules → (only if ambiguous) LLM judge → escalation."""
    deps = _deps(config)
    facts, now = task["facts"], _now(deps)
    memory = deps.memory.get(facts.pr_id)

    crossed_abandoned = facts.inactivity_days(now) >= deps.config.abandoned_after_days
    if memory and memory.assessment and memory.cache_key == facts.cache_key() and not crossed_abandoned:
        reused = memory.assessment.model_copy(update={"inactivity_days": facts.inactivity_days(now), "source": "cache"})
        return {"assessments": [apply_escalation(reused, deps.config)], "cached": 1}

    result = classify(facts, deps.config, now)
    assessment, llm_calls, errors = result.assessment, 0, []
    if result.needs_llm and deps.judge and deps.config.use_llm:
        try:
            assessment, llm_calls = await deps.judge.judge(facts, assessment)
        except Exception as e:
            errors.append(f"{facts.pr_id}: LLM judge failed, using rule result ({e})")
            assessment = assessment.model_copy(update={"confidence": 0.5})
    elif result.needs_llm:
        assessment = assessment.model_copy(update={"confidence": 0.6})

    return {"assessments": [apply_escalation(assessment, deps.config)], "llm_calls": llm_calls, "errors": errors}


async def plan(state: ScanState, config: RunnableConfig) -> dict:
    deps = _deps(config)
    assessments = sorted(state.get("assessments", []), key=lambda a: a.number)
    return {"actions": plan_actions(assessments, deps.memory, deps.config, _now(deps))}


async def act(state: ScanState, config: RunnableConfig) -> dict:
    deps = _deps(config)
    return {"results": [await deps.executor.execute(action) for action in state.get("actions", [])]}


def build_graph():
    graph = StateGraph(ScanState)
    graph.add_node("fetch_prs", fetch_prs)
    graph.add_node("filter_prs", filter_prs)
    graph.add_node("assess_pr", assess_pr)
    graph.add_node("plan", plan)
    graph.add_node("act", act)

    graph.add_edge(START, "fetch_prs")
    graph.add_edge("fetch_prs", "filter_prs")
    graph.add_conditional_edges("filter_prs", fan_out, ["assess_pr", "plan"])
    graph.add_edge("assess_pr", "plan")  # waits for every parallel assess_pr to finish
    graph.add_edge("plan", "act")
    graph.add_edge("act", END)
    return graph.compile()


_GRAPH = build_graph()


async def run_scan(repo: str, deps: ScanDeps, extra_config: Optional[dict[str, Any]] = None) -> ScanResult:
    started = time.monotonic()
    config: dict[str, Any] = {
        "configurable": {"deps": deps},
        "max_concurrency": deps.config.max_concurrency,
        **(extra_config or {}),
    }
    final = await _GRAPH.ainvoke({"repo": repo}, config)
    results = final.get("results", [])
    return ScanResult(
        repo=repo,
        assessments=sorted(final.get("assessments", []), key=lambda a: a.number),
        skipped=final.get("skipped", []),
        results=results,
        errors=final.get("errors", []),
        llm_calls=final.get("llm_calls", 0),
        cached=final.get("cached", 0),
        duration_ms=int((time.monotonic() - started) * 1000),
        notified=notified_pr_ids([(r.action, r.status) for r in results]),
    )
