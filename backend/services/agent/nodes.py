import httpx
from datetime import datetime, timezone
from typing import Literal
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from services.agent.state import AgentState
from services.agent.mcp_tools import MCPToolManager
from core.logger import logger
from core.config import settings

# Strict schema parsing
class PRDecision(BaseModel):
    decision: Literal["ASK_TO_MERGE", "PING_REVIEWER", "ESCALATE", "IGNORE"]
    reasoning: str
    jira_referenced: bool
    escalation_level: int = Field(0, description="0=None, 1=Minor, 2=Major, 3=Critical")

SYSTEM_PROMPT = """You are an elite, autonomous PR Sentinel Agent.
Your job is to read pull request metadata, use your MCP tools to gather deep context
from GitHub (reviews/CI checks) and Jira (ticket status), and decide the next course of action.

Possible decisions:
- IGNORE: The PR is active, fresh, or already approved.
- PING_REVIEWER: The PR is stale (>3 days) and waiting on review.
- ASK_TO_MERGE: The PR is approved and CI passes, but it's sitting untouched.
- ESCALATE: The PR is stale for a long time (>7 days) or blocked tightly in Jira.

ALWAYS invoke the `jira_lookup_ticket` tool if a Jira Project Key is provided.
If the decision is ESCALATE, you MUST invoke `slack_send_escalation` before returning execution.
"""

async def fetch_github_prs(state: AgentState) -> dict:
    """Node: fetches open PRs for the configured repository directly from GitHub API"""
    repo_full_name = f"{state['github_owner']}/{state['github_repo']}"
    logger.info("node_start", node="fetch_github_prs", repo=repo_full_name)
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"Bearer {settings.github_token}",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    active_prs = []
    
    try:
        async with httpx.AsyncClient() as client:
            url = f"https://api.github.com/repos/{repo_full_name}/pulls?state=open&per_page=15"
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                logger.error("github_fetch_error", status=response.status_code, text=response.text)
                return {"active_prs": [], "current_pr_index": 0, "errors": [f"GitHub API Error: {response.text}"]}
                
            prs_data = response.json()
            
            for pr_raw in prs_data:
                updated_at_str = pr_raw.get("updated_at", pr_raw.get("created_at"))
                if updated_at_str.endswith("Z"):
                    updated_at_str = updated_at_str.replace("Z", "+00:00")
                updated_at = datetime.fromisoformat(updated_at_str)
                
                now_utc = datetime.now(timezone.utc)
                inactivity_days = (now_utc - updated_at).days
                
                additions = 0
                deletions = 0
                mergeable = None
                mergeable_state = None
                
                detail_url = pr_raw.get("url")
                if detail_url:
                    detail_resp = await client.get(detail_url, headers=headers)
                    if detail_resp.status_code == 200:
                        detail_data = detail_resp.json()
                        additions = detail_data.get("additions", 0)
                        deletions = detail_data.get("deletions", 0)
                        mergeable = detail_data.get("mergeable")
                        mergeable_state = detail_data.get("mergeable_state")
                
                user_login = pr_raw.get("user", {}).get("login", "unknown")
                labels = [label["name"] for label in pr_raw.get("labels", [])]
                
                active_prs.append({
                    "number": pr_raw["number"],
                    "title": pr_raw["title"],
                    "author": user_login,
                    "inactivity_days": max(inactivity_days, 0),
                    "additions": additions,
                    "deletions": deletions,
                    "mergeable": mergeable,
                    "mergeable_state": mergeable_state,
                    "labels": labels
                })
                
    except Exception as e:
        logger.error("github_fetch_exception", error=str(e))
        return {"active_prs": [], "current_pr_index": 0, "errors": [f"Exception fetching PRs: {str(e)}"]}
        
    return {"active_prs": active_prs, "current_pr_index": 0}

async def evaluate_current_pr(state: AgentState) -> dict:
    """Node: Evaluates the PR using the LLM & True MCP Tools dynamically loaded via stdio."""
    idx = state.get("current_pr_index", 0)
    prs = state.get("active_prs", [])
    
    if idx >= len(prs):
        return {} # Done

    pr = prs[idx]
    logger.info("node_start", node="evaluate_pr", pr=pr["number"], title=pr["title"])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"Evaluate PR #{pr['number']}: '{pr['title']}'. Author: {pr['author']}. Inactivity: {pr['inactivity_days']} days. Jira Project Key: {state.get('jira_project_key', 'None')}")
    ]

    mcp_manager = MCPToolManager()
    
    try:
        # 1. Start External MCP Servers and Load LangChain Tools array
        await mcp_manager.connect_to_servers()
        mcp_tools = await mcp_manager.get_tools()

        # 2. Instantiate LLM & Bind the real tools
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", api_key=settings.gemini_api_key, temperature=0.1)
        llm_with_tools = llm.bind_tools(tools=mcp_tools, tool_choice="auto")
        
        # 3. Decision Parser (second chain without tools to force JSON output)
        decision_parser = llm.with_structured_output(PRDecision)

        # Phase 1: Exploration
        tool_response = await llm_with_tools.ainvoke(messages)
        messages.append(tool_response)
        
        if tool_response.tool_calls:
            from langchain_core.messages import ToolMessage
            for tc in tool_response.tool_calls:
                logger.info("llm_issued_mcp_tool_call", tool=tc["name"])
                target_tool = next((t for t in mcp_tools if t.name == tc["name"]), None)
                if target_tool:
                    try:
                        t_res = await target_tool.ainvoke(tc["args"])
                        messages.append(ToolMessage(content=str(t_res), tool_call_id=tc["id"]))
                        logger.info("mcp_tool_success", tool=tc["name"])
                    except Exception as e:
                        logger.error("mcp_tool_error", tool=tc["name"], error=str(e))
                        messages.append(ToolMessage(content=f"Error: {e}", tool_call_id=tc["id"]))
                else:
                    messages.append(ToolMessage(content="Tool not found", tool_call_id=tc["id"]))
                    
            # Let the LLM observe the tool results
            tool_response_2 = await llm_with_tools.ainvoke(messages)
            messages.append(tool_response_2)

        # Phase 2: Force extraction into our rigid pydantic schema
        final_decision: PRDecision = await decision_parser.ainvoke(
            messages + [HumanMessage(content="Extract the final evaluation decision.")]
        )

        logger.info("llm_decision_made", pr=pr["number"], decision=final_decision.decision, reason=final_decision.reasoning)
        
        extracted_pr = {
            "id": str(pr["number"]),
            "title": pr["title"],
            "author": pr["author"],
            "inactivity_days": pr.get("inactivity_days", 0),
            "additions": pr.get("additions", 0),
            "deletions": pr.get("deletions", 0),
            "mergeable": pr.get("mergeable"),
            "mergeable_state": pr.get("mergeable_state"),
            "decision": final_decision.decision,
            "escalation_level": final_decision.escalation_level,
        }
        
        return {
            "prs_evaluated": 1,
            "evaluated_prs": [extracted_pr]
        }

    except Exception as e:
        logger.error("evaluate_pr_error", pr=pr["number"], error=str(e))
        return {"errors": [f"PR {pr['number']}: {str(e)}"]}
        
    finally:
        # 4. Clean up Subprocesses!
        await mcp_manager.cleanup()

async def advance_pr_index(state: AgentState) -> dict:
    """Node: Moves to the next PR in the list"""
    return {"current_pr_index": state.get("current_pr_index", 0) + 1}
