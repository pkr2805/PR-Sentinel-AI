from typing import Optional

import pytest

from services.agent.mcp_tools import build_args_schema, is_read_only_tool, json_schema_to_type


@pytest.mark.parametrize("name", ["get_pull_request", "get_pull_request_reviews", "list_pull_requests",
                                  "search_issues", "jira_get_issue", "jira_search"])
def test_read_tools_are_allowed(name):
    assert is_read_only_tool(name)


@pytest.mark.parametrize("name", ["merge_pull_request", "create_issue", "add_issue_comment", "slack_post_message",
                                  "slack_send_escalation", "update_pull_request_branch", "get_pull_request_files",
                                  "get_file_contents", "push_files", "jira_transition_issue"])
def test_write_and_code_tools_are_blocked(name):
    assert not is_read_only_tool(name)


def test_json_schema_types_are_mapped():
    assert json_schema_to_type({"type": "integer"}) is int
    assert json_schema_to_type({"type": "boolean"}) is bool
    assert json_schema_to_type({"type": "array", "items": {"type": "number"}}) == list[float]
    assert json_schema_to_type({"type": ["string", "null"]}) == Optional[str]


def test_args_schema_respects_required_fields():
    schema = build_args_schema("get_pull_request", {
        "properties": {"owner": {"type": "string"}, "pull_number": {"type": "integer"}, "draft": {"type": "boolean"}},
        "required": ["owner", "pull_number"],
    })
    args = schema(owner="octocat", pull_number="42")
    assert args.pull_number == 42 and args.draft is None


def test_default_llm_is_groq_gpt_oss():
    from langchain_groq import ChatGroq
    from core.llm import get_chat_model

    llm = get_chat_model()
    assert isinstance(llm, ChatGroq) and llm.model_name == "openai/gpt-oss-120b"
