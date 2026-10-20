from langchain_core.tools import StructuredTool

from sentinel.config import SentinelConfig
from sentinel.judge import LLMJudge, describe_pr
from sentinel.models import PRState, WaitingOn
from sentinel.rules import classify
from tests.factories import NOW, days_ago, make_facts, review, thread
from tests.fakes import FakeLLM


def feedback_facts():
    return make_facts(last_commit_at=days_ago(1), reviews=[review("bob", "CHANGES_REQUESTED", 3, "Add a test")],
                      threads=[thread(("bob", 3, "Missing test"), ("alice", 1, "Added in abc"))])


def test_description_contains_conversation_but_no_diff():
    text = describe_pr(feedback_facts())
    assert "bob CHANGES_REQUESTED: Add a test" in text
    assert "alice: Added in abc" in text
    assert "diff" not in text.lower()


async def test_judge_refines_the_rule_result():
    facts = feedback_facts()
    draft = classify(facts, SentinelConfig(), NOW).assessment
    llm = FakeLLM()

    refined, calls = await LLMJudge(llm).judge(facts, draft)

    assert calls == 1 and llm.structured_method == "function_calling"
    assert refined.state == PRState.FEEDBACK_ADDRESSED and refined.waiting_on == WaitingOn.REVIEWER
    assert refined.source == "llm" and refined.confidence == 0.9
    assert refined.reason == "Alice pushed the requested test."
    assert refined.pr_id == draft.pr_id and refined.cache_key == draft.cache_key


async def test_judge_uses_lazy_tools_for_bounded_rounds():
    started = []

    async def get_diff_stats(pull_number: int) -> str:
        return f"stats for {pull_number}"

    tool = StructuredTool.from_function(coroutine=get_diff_stats, name="get_diff_stats", description="Diff stats")

    async def provider():
        started.append(True)
        return [tool]

    call = {"name": "get_diff_stats", "args": {"pull_number": 1}, "id": "c1"}
    llm = FakeLLM(tool_calls=[call, {**call, "id": "c2"}, {**call, "id": "c3"}])
    facts = feedback_facts()
    _, calls = await LLMJudge(llm, tools=provider, max_tool_rounds=2).judge(
        facts, classify(facts, SentinelConfig(), NOW).assessment)

    assert started == [True]
    assert calls == 3  # two tool rounds (capped), then the verdict
    tool_results = [m.content for m in llm.prompts[-1] if m.type == "tool"]
    assert tool_results == ["stats for 1", "stats for 1"]
