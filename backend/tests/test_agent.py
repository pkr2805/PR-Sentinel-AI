from typing import Optional

from langchain_core.messages import AIMessage
from langchain_core.tools import StructuredTool

from core.llm import get_chat_model
from services.agent.mcp_tools import build_args_schema, json_schema_to_type
from services.agent.nodes import PRDecision, evaluate_current_pr, make_pr_id


def test_default_llm_is_groq_gpt_oss():
    from langchain_groq import ChatGroq

    llm = get_chat_model()
    assert isinstance(llm, ChatGroq)
    assert llm.model_name == "openai/gpt-oss-120b"


def test_json_schema_types_are_mapped():
    assert json_schema_to_type({"type": "integer"}) is int
    assert json_schema_to_type({"type": "boolean"}) is bool
    assert json_schema_to_type({"type": "array", "items": {"type": "number"}}) == list[float]
    assert json_schema_to_type({"type": ["string", "null"]}) == Optional[str]


def test_args_schema_respects_required_fields():
    schema = build_args_schema("get_pull_request", {
        "properties": {
            "owner": {"type": "string"},
            "pull_number": {"type": "integer"},
            "draft": {"type": "boolean"},
        },
        "required": ["owner", "pull_number"],
    })
    args = schema(owner="octocat", pull_number="42")
    assert args.pull_number == 42  # coerced to int, not left as a string
    assert args.draft is None


class FakeLLM:
    """Stands in for ChatGroq: asks for one tool call, then answers; returns a fixed structured decision."""

    def __init__(self):
        self.calls = 0
        self.structured_method = None

    def bind_tools(self, tools, tool_choice=None):
        return self

    async def ainvoke(self, messages):
        self.calls += 1
        if self.calls == 1:
            return AIMessage(content="", tool_calls=[{"name": "get_reviews", "args": {"pull_number": 7}, "id": "c1"}])
        return AIMessage(content="It has waited 9 days for a review.")

    def with_structured_output(self, schema, method=None):
        self.structured_method = method
        decision = PRDecision(decision="ESCALATE", reasoning="Stale", jira_referenced=False, escalation_level=2)

        class Parser:
            async def ainvoke(self, messages):
                return decision

        return Parser()


async def test_evaluate_runs_tools_then_returns_decision():
    seen_args = []

    async def get_reviews(pull_number: int) -> str:
        seen_args.append(pull_number)
        return "no reviews"

    tool = StructuredTool.from_function(coroutine=get_reviews, name="get_reviews", description="Get reviews")
    llm = FakeLLM()
    state = {
        "repo_id": "octocat/hello",
        "github_owner": "octocat",
        "github_repo": "hello",
        "jira_project_key": None,
        "slack_channel": "#reviews",
        "active_prs": [{"number": 7, "title": "Add feature", "author": "me", "inactivity_days": 9}],
        "current_pr_index": 0,
    }

    result = await evaluate_current_pr(state, {"configurable": {"llm": llm, "tools": [tool]}})

    assert seen_args == [7]
    assert llm.calls == 2  # tool round, then the final answer
    assert llm.structured_method == "function_calling"
    pr = result["evaluated_prs"][0]
    assert pr["id"] == make_pr_id("octocat/hello", 7) == "octocat/hello#7"
    assert pr["decision"] == "ESCALATE"
    assert pr["escalation_level"] == 2
