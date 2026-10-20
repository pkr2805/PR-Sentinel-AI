from __future__ import annotations

from typing import Any, Awaitable, Callable, Literal, Optional, Union

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from pydantic import BaseModel, Field

from sentinel.models import Assessment, PRFacts, PRState, WaitingOn

JUDGE_PROMPT = """You are PR Sentinel, a careful assistant that works out why a pull request is stuck and who must act next.

You get the facts of one PR: reviews, review threads, comments and when the last commit was pushed.
Decide:
- state: FEEDBACK_ADDRESSED (author handled the review feedback, reviewer should re-review),
  CHANGES_REQUESTED (author still has to act on feedback), DISCUSSION_STALLED (an open question is waiting
  on someone), READY_TO_MERGE (reviewers are satisfied), or NEEDS_FIRST_REVIEW (no real review yet).
- waiting_on: "author", "reviewer" or "maintainer", and the GitHub logins of the people who should act.
- reason: one or two plain sentences that cite what you saw. next_step: one short instruction.
- confidence: 0 to 1. Use a low value if the conversation is unclear.

Base every claim on the facts given (or on what your tools return). Be neutral: describe the situation, never blame.
You may call the listed tools to read more context; never invent tool names."""

_MAX_TEXT = 400


class JudgeVerdict(BaseModel):
    state: Literal["FEEDBACK_ADDRESSED", "CHANGES_REQUESTED", "DISCUSSION_STALLED", "READY_TO_MERGE",
                   "NEEDS_FIRST_REVIEW"]
    waiting_on: Literal["author", "reviewer", "maintainer"]
    people: list[str] = Field(default_factory=list, description="GitHub logins of the people who should act")
    reason: str
    next_step: str
    confidence: float = Field(0.7, ge=0, le=1)


def _short(text: str) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= _MAX_TEXT else text[:_MAX_TEXT] + "…"


def describe_pr(facts: PRFacts) -> str:
    """A compact, text-only description of the PR conversation. The diff is never included."""
    lines = [
        f"PR {facts.pr_id}: {facts.title}",
        f"Author: {facts.author}. Created {facts.created_at:%Y-%m-%d}, last updated {facts.updated_at:%Y-%m-%d %H:%M} UTC.",
        f"Last commit: {facts.last_commit_at:%Y-%m-%d %H:%M} UTC." if facts.last_commit_at else "Last commit: unknown.",
        f"CI: {facts.ci_state or 'no checks'}. Mergeable: {facts.mergeable}.",
        f"Requested reviewers: {', '.join(facts.requested_reviewers) or 'none'}.",
        "Reviews (oldest first):",
    ]
    for r in sorted(facts.reviews, key=lambda r: r.submitted_at or facts.created_at):
        when = f"{r.submitted_at:%Y-%m-%d %H:%M}" if r.submitted_at else "?"
        lines.append(f"- {when} {r.author} {r.state}: {_short(r.body) or '(no text)'}")
    lines.append("Review threads:")
    for i, t in enumerate(facts.threads, 1):
        status = "resolved" if t.is_resolved else "outdated" if t.is_outdated else "OPEN"
        lines.append(f"- Thread {i} ({status}):")
        for c in t.comments:
            when = f"{c.created_at:%Y-%m-%d %H:%M}" if c.created_at else "?"
            lines.append(f"    {when} {c.author}: {_short(c.body)}")
    lines.append("Conversation comments:")
    for c in facts.comments:
        when = f"{c.created_at:%Y-%m-%d %H:%M}" if c.created_at else "?"
        lines.append(f"- {when} {c.author}: {_short(c.body)}")
    return "\n".join(lines)


async def _run_tool_calls(tool_calls: list, tools: list) -> list[ToolMessage]:
    results = []
    for tc in tool_calls:
        tool = next((t for t in tools if t.name == tc["name"]), None)
        if tool is None:
            results.append(ToolMessage(content=f"Tool '{tc['name']}' not found", tool_call_id=tc["id"]))
            continue
        try:
            results.append(ToolMessage(content=str(await tool.ainvoke(tc["args"]))[:4000], tool_call_id=tc["id"]))
        except Exception as e:
            results.append(ToolMessage(content=f"Error: {e}", tool_call_id=tc["id"]))
    return results


class LLMJudge:
    """Asks the LLM about one ambiguous PR. Tools (e.g. MCP) are optional and used for a bounded number of rounds."""

    def __init__(self, llm: Any, tools: Union[list, Callable[[], Awaitable[list]], None] = None,
                 max_tool_rounds: int = 3, structured_output_method: str = "function_calling"):
        self.llm = llm
        self._tools = tools  # a list, or an async callable that starts the tools on first use (e.g. MCP servers)
        self.max_tool_rounds = max_tool_rounds
        self.structured_output_method = structured_output_method

    async def _get_tools(self) -> list:
        if callable(self._tools):
            return await self._tools()
        return self._tools or []

    async def judge(self, facts: PRFacts, draft: Assessment) -> tuple[Assessment, int]:
        """Returns the refined assessment and how many LLM calls it took."""
        messages = [
            SystemMessage(content=JUDGE_PROMPT),
            HumanMessage(content=(
                f"{describe_pr(facts)}\n\nThe rule engine's first guess: {draft.state.value}, waiting on "
                f"{draft.waiting_on.value} ({draft.reason}). Confirm or correct it."
            )),
        ]
        calls = 0
        tools = await self._get_tools() if self.max_tool_rounds > 0 else []
        if tools:
            llm_with_tools = self.llm.bind_tools(tools=tools, tool_choice="auto")
            for _ in range(self.max_tool_rounds):
                response = await llm_with_tools.ainvoke(messages)
                calls += 1
                messages.append(response)
                if not response.tool_calls:
                    break
                messages.extend(await _run_tool_calls(response.tool_calls, tools))

        parser = self.llm.with_structured_output(JudgeVerdict, method=self.structured_output_method)
        verdict: JudgeVerdict = await parser.ainvoke(messages + [HumanMessage(content="Give your final verdict.")])
        calls += 1

        refined = draft.model_copy(update={
            "state": PRState(verdict.state),
            "waiting_on": WaitingOn(verdict.waiting_on),
            "people": verdict.people or draft.people,
            "reason": verdict.reason,
            "next_step": verdict.next_step,
            "confidence": verdict.confidence,
            "source": "llm",
        })
        return refined, calls
