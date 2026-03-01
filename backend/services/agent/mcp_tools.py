import os
import asyncio
from typing import List, Any
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_core.tools import StructuredTool
from pydantic import create_model, Field

async def load_mcp_tools(session: ClientSession) -> List[Any]:
    """Manually parse raw MCP tools from the server and convert them into LangChain StructuredTools."""
    mcp_tools = await session.list_tools()
    lc_tools = []
    
    for t in mcp_tools.tools:
        # 1. Convert the MCP JSON Schema properties into a dynamically generated Pydantic Model
        props = t.inputSchema.get("properties", {})
        fields = {}
        for name, details in props.items():
            # Simplistic mapping: default to str if type mapping is complex
            fields[name] = (str, Field(..., description=details.get("description", "")))
        
        DynamicArgsSchema = create_model(f"{t.name}Schema", **fields)
        
        # 2. Create the async closure that executes the tool over the MCP session
        async def mcp_executor(_tool_name=t.name, **kwargs):
            result = await session.call_tool(_tool_name, arguments=kwargs)
            return str(result.content)
            
        # 3. Bind it into a LangChain StructuredTool
        lc_tool = StructuredTool.from_function(
            func=None,
            coroutine=mcp_executor,
            name=t.name,
            description=t.description or f"MCP tool: {t.name}",
            args_schema=DynamicArgsSchema
        )
        lc_tools.append(lc_tool)
        
    return lc_tools

from core.logger import logger
from core.config import settings

GITHUB_SERVER_PARAMS = StdioServerParameters(
    command="npx",
    args=["-y", "@modelcontextprotocol/server-github"],
    env={"GITHUB_PERSONAL_ACCESS_TOKEN": settings.github_token or "", "PATH": os.environ.get("PATH", "")}
)

SLACK_SERVER_PARAMS = StdioServerParameters(
    command="npx",
    args=["-y", "@modelcontextprotocol/server-slack"],
    env={"SLACK_BOT_TOKEN": settings.slack_webhook or "", "PATH": os.environ.get("PATH", "")}
)

JIRA_SERVER_PARAMS = StdioServerParameters(
    command="npx",
    args=["-y", "mcp-jira-cloud"],
    env={
        "JIRA_API_TOKEN": settings.jira_api_token or "",
        "JIRA_EMAIL": settings.jira_email or "",
        "JIRA_BASE_URL": settings.jira_base_url or "",
        "PATH": os.environ.get("PATH", "")
    }
)

class MCPToolManager:
    """Manages the lifecycle of MCP server subprocesses and tool bridging."""
    
    def __init__(self):
        self.stack = AsyncExitStack()
        self.sessions: List[ClientSession] = []
        self.langchain_tools: List[Any] = []

    async def connect_to_servers(self):
        """Spawns the MCP server subprocesses via stdio and extracts their LangChain tools."""
        try:
            # 1. Connect to GitHub MCP
            if settings.github_token and settings.github_token != "mock_token":
                gh_read, gh_write = await self.stack.enter_async_context(stdio_client(GITHUB_SERVER_PARAMS))
                gh_session = await self.stack.enter_async_context(ClientSession(gh_read, gh_write))
                await gh_session.initialize()
                self.sessions.append(gh_session)
                
                # Fetch tools natively and convert to LangChain tools
                gh_tools = await load_mcp_tools(gh_session)
                self.langchain_tools.extend(gh_tools)
                logger.info("mcp_server_connected", server="github", tools_loaded=len(gh_tools))

            # 2. Connect to Slack MCP
            if settings.slack_webhook and settings.slack_webhook != "mock_webhook":
                sl_read, sl_write = await self.stack.enter_async_context(stdio_client(SLACK_SERVER_PARAMS))
                sl_session = await self.stack.enter_async_context(ClientSession(sl_read, sl_write))
                await sl_session.initialize()
                self.sessions.append(sl_session)
                
                sl_tools = await load_mcp_tools(sl_session)
                self.langchain_tools.extend(sl_tools)
                logger.info("mcp_server_connected", server="slack", tools_loaded=len(sl_tools))

            # 3. Connect to Jira MCP
            if settings.jira_api_token and settings.jira_base_url:
                jr_read, jr_write = await self.stack.enter_async_context(stdio_client(JIRA_SERVER_PARAMS))
                jr_session = await self.stack.enter_async_context(ClientSession(jr_read, jr_write))
                await jr_session.initialize()
                self.sessions.append(jr_session)
                
                jr_tools = await load_mcp_tools(jr_session)
                self.langchain_tools.extend(jr_tools)
                logger.info("mcp_server_connected", server="jira", tools_loaded=len(jr_tools))

        except Exception as e:
            logger.error("mcp_connection_failed", error=str(e))
            raise

    async def get_tools(self) -> List[Any]:
        """Returns the array of dynamically loaded LangChain tools."""
        from langchain_core.tools import tool
        import httpx
        
        tools = list(self.langchain_tools)
        
        # Native Webhook Fallback if no full Slack App is installed
        if settings.slack_webhook_url:
            @tool
            def slack_send_escalation(channel_id: str, text: str) -> str:
                """Send an escalation message to a Slack channel."""
                payload = {"text": f"*Channel Target: {channel_id}*\n\n{text}"}
                try:
                    res = httpx.post(settings.slack_webhook_url, json=payload)
                    res.raise_for_status()
                    return "Successfully sent escalation to Slack webhook."
                except Exception as e:
                    return f"Failed to send Slack message: {e}"
                    
            tools.append(slack_send_escalation)
            
        return tools

    async def cleanup(self):
        """Closes all active MCP server subprocesses cleanly."""
        await self.stack.aclose()
        logger.info("mcp_servers_disconnected")
