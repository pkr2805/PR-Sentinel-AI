import os
from typing import Any, List, Optional
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_core.tools import StructuredTool
from pydantic import create_model, Field

from core.logger import logger
from core.config import settings

_JSON_TYPES = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
    "object": dict,
}


def json_schema_to_type(details: dict) -> Any:
    """Maps a JSON-schema property to a Python type, so tools get numbers, booleans and lists, not just strings."""
    json_type = details.get("type", "string")
    nullable = False
    if isinstance(json_type, list):
        nullable = "null" in json_type
        json_type = next((t for t in json_type if t != "null"), "string")

    if json_type == "array":
        item_type = json_schema_to_type(details.get("items", {}))
        py_type = list[item_type]
    else:
        py_type = _JSON_TYPES.get(json_type, str)

    return Optional[py_type] if nullable else py_type


def build_args_schema(tool_name: str, input_schema: dict):
    """Builds a Pydantic model from an MCP tool's input JSON schema."""
    props = input_schema.get("properties", {})
    required = set(input_schema.get("required", []))
    fields = {}
    for name, details in props.items():
        py_type = json_schema_to_type(details)
        description = details.get("description", "")
        if name in required:
            fields[name] = (py_type, Field(..., description=description))
        else:
            fields[name] = (Optional[py_type], Field(None, description=description))
    return create_model(f"{tool_name}Schema", **fields)


_READ_VERBS = {"get", "list", "search", "read", "fetch", "lookup", "find", "query", "describe", "show"}
_CODE_WORDS = {"file", "files", "diff", "patch", "contents", "blob", "tree"}


def is_read_only_tool(name: str) -> bool:
    """The LLM judge may only read, and never sees code: deciding is separate from acting.

    Accepts e.g. `get_pull_request_reviews`, `jira_get_issue`; rejects `merge_pull_request`, `create_issue`,
    `slack_post_message` and `get_pull_request_files`.
    """
    words = name.lower().replace("-", "_").split("_")
    if _CODE_WORDS & set(words):
        return False
    return bool(words) and (words[0] in _READ_VERBS or (len(words) > 1 and words[1] in _READ_VERBS))


def _make_executor(session: ClientSession, tool_name: str):
    async def mcp_executor(**kwargs):
        arguments = {k: v for k, v in kwargs.items() if v is not None}
        result = await session.call_tool(tool_name, arguments=arguments)
        return str(result.content)
    return mcp_executor


async def load_mcp_tools(session: ClientSession) -> List[Any]:
    """Converts the tools an MCP server exposes into LangChain StructuredTools."""
    mcp_tools = await session.list_tools()
    lc_tools = []

    for t in mcp_tools.tools:
        lc_tools.append(StructuredTool.from_function(
            func=None,
            coroutine=_make_executor(session, t.name),
            name=t.name,
            description=t.description or f"MCP tool: {t.name}",
            args_schema=build_args_schema(t.name, t.inputSchema or {}),
        ))

    return lc_tools


def _server_params(package: str, env: dict) -> StdioServerParameters:
    return StdioServerParameters(
        command="npx",
        args=["-y", package],
        env={**env, "PATH": os.environ.get("PATH", "")},
    )


class MCPToolManager:
    """Manages the lifecycle of MCP server subprocesses and tool bridging.

    Use as an async context manager so the servers are started once per agent run and always cleaned up.
    """

    def __init__(self, include_slack: bool = True):
        self.include_slack = include_slack
        self.stack = AsyncExitStack()
        self.sessions: List[ClientSession] = []
        self.langchain_tools: List[Any] = []

    async def __aenter__(self):
        await self.connect_to_servers()
        return self

    async def __aexit__(self, *exc):
        await self.cleanup()

    def _configured_servers(self) -> List[tuple[str, StdioServerParameters]]:
        servers = []
        if settings.github_token:
            servers.append(("github", _server_params(
                "@modelcontextprotocol/server-github",
                {"GITHUB_PERSONAL_ACCESS_TOKEN": settings.github_token},
            )))
        if settings.slack_bot_token and self.include_slack:
            servers.append(("slack", _server_params(
                "@modelcontextprotocol/server-slack",
                {"SLACK_BOT_TOKEN": settings.slack_bot_token, "SLACK_TEAM_ID": settings.slack_team_id or ""},
            )))
        if settings.jira_api_token and settings.jira_base_url:
            servers.append(("jira", _server_params(
                "mcp-jira-cloud",
                {
                    "JIRA_API_TOKEN": settings.jira_api_token,
                    "JIRA_EMAIL": settings.jira_email or "",
                    "JIRA_BASE_URL": settings.jira_base_url,
                },
            )))
        return servers

    async def connect_to_servers(self):
        """Spawns the configured MCP servers via stdio and loads their tools.

        A server that fails to start is logged and skipped, so one broken integration doesn't stop the run.
        """
        for name, params in self._configured_servers():
            try:
                read, write = await self.stack.enter_async_context(stdio_client(params))
                session = await self.stack.enter_async_context(ClientSession(read, write))
                await session.initialize()
                self.sessions.append(session)

                tools = await load_mcp_tools(session)
                self.langchain_tools.extend(tools)
                logger.info("mcp_server_connected", server=name, tools_loaded=len(tools))
            except Exception as e:
                logger.error("mcp_connection_failed", server=name, error=str(e))

    def get_read_only_tools(self) -> List[Any]:
        """Tools safe to hand to the LLM judge: read-only, no code."""
        return [t for t in self.langchain_tools if is_read_only_tool(t.name)]

    def get_tools(self) -> List[Any]:
        """Returns the MCP tools plus the Slack webhook fallback when it is configured."""
        tools = list(self.langchain_tools)
        if settings.slack_webhook_url:
            tools.append(slack_send_escalation)
        return tools

    async def cleanup(self):
        """Closes all active MCP server subprocesses cleanly."""
        await self.stack.aclose()
        logger.info("mcp_servers_disconnected")


async def _send_slack_webhook(channel_id: str, text: str) -> str:
    import httpx

    payload = {"text": f"*Channel Target: {channel_id}*\n\n{text}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(settings.slack_webhook_url, json=payload)
            res.raise_for_status()
        return "Successfully sent escalation to Slack webhook."
    except Exception as e:
        return f"Failed to send Slack message: {e}"


slack_send_escalation = StructuredTool.from_function(
    func=None,
    coroutine=_send_slack_webhook,
    name="slack_send_escalation",
    description="Send an escalation message to a Slack channel.",
)
