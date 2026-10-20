import httpx
from datetime import datetime, timezone
from typing import Literal
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field

from services.agent.state import AgentState
from core.llm import get_chat_model
from core.logger import logger
from core.config import settings

# Strict schema parsing
class PRDecision(BaseModel):
    decision: Literal["ASK_TO_MERGE", "PING_REVIEWER", "ESCALATE", "IGNORE"]
    reasoning: str
    jira_referenced: bool
    escalation_level: int = Field(0, description="0=None, 1=Minor, 2=Major, 3=Critical")

SYSTEM_PROMPT = """You are an elite, autonomous PR Sentinel Agent.
Your job is to read pull request metadata, use your tools to gather deep context
from GitHub (reviews/CI checks) and Jira (ticket status), and decide the next course of action.

Possible decisions:
- IGNORE: The PR is active, fresh, or already approved.
- PING_REVIEWER: The PR is stale (>3 days) and waiting on review.
- ASK_TO_MERGE: The PR is approved and CI passes, but it's sitting untouched.
- ESCALATE: The PR is stale for a long time (>7 days) or blocked tightly in Jira.

If a Jira Project Key is provided and a Jira tool is available, look up the related ticket.
If the decision is ESCALATE and a Slack channel is provided, send an escalation message to that channel
with a Slack tool (for example `slack_post_message` or `slack_send_escalation`) before answering.
Only call tools that are listed; never invent tool names.
"""

def make_pr_id(repo_id: str, number: int) -> str:
    """Unique PR id across repositories, e.g. 'octocat/hello#42'."""
    return f"{repo_id}#{number}"

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
                
                detail_url = pr_raw.get("url")
                if detail_url:
                    detail_resp = await client.get(detail_url, headers=headers)
                    if detail_resp.status_code == 200:
                        detail_data = detail_resp.json()
                        additions = detail_data.get("additions", 0)
                        deletions = detail_data.get("deletions", 0)
                
                user_login = pr_raw.get("user", {}).get("login", "unknown")
                labels = [label["name"] for label in pr_raw.get("labels", [])]
                
                active_prs.append({
                    "number": pr_raw["number"],
                    "title": pr_raw["title"],
                    "author": user_login,
                    "inactivity_days": max(inactivity_days, 0),
                    "additions": additions,
                    "deletions": deletions,
                    "labels": labels
                })
                
    except Exception as e:
        logger.error("github_fetch_exception", error=str(e))
        return {"active_prs": [], "current_pr_index": 0, "errors": [f"Exception fetching PRs: {str(e)}"]}
        
    return {"active_prs": active_prs, "current_pr_index": 0}

async def run_tool_calls(tool_calls: list, tools: list) -> list[ToolMessage]:
    """Executes the tool calls the LLM asked for and returns their results as ToolMessages."""
    results = []
    for tc in tool_calls:
        logger.info("llm_issued_tool_call", tool=tc["name"])
        target_tool = next((t for t in tools if t.name == tc["name"]), None)
        if not target_tool:
            results.append(ToolMessage(content=f"Tool '{tc['name']}' not found", tool_call_id=tc["id"]))
            continue
        try:
            t_res = await target_tool.ainvoke(tc["args"])
            results.append(ToolMessage(content=str(t_res), tool_call_id=tc["id"]))
            logger.info("tool_success", tool=tc["name"])
        except Exception as e:
            logger.error("tool_error", tool=tc["name"], error=str(e))
            results.append(ToolMessage(content=f"Error: {e}", tool_call_id=tc["id"]))
    return results

async def evaluate_current_pr(state: AgentState, config: RunnableConfig = None) -> dict:
    """Node: lets the LLM explore the PR with the run's tools, then extracts a structured decision.

    The LLM and tools are created once per run by the caller and passed in `config["configurable"]`.
    """
    idx = state.get("current_pr_index", 0)
    prs = state.get("active_prs", [])

    if idx >= len(prs):
        return {} # Done

    pr = prs[idx]
    logger.info("node_start", node="evaluate_pr", pr=pr["number"], title=pr["title"])

    configurable = (config or {}).get("configurable", {})
    llm = configurable.get("llm") or get_chat_model()
    tools = configurable.get("tools", [])

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=(
            f"Repository: {state['github_owner']}/{state['github_repo']}. "
            f"Evaluate PR #{pr['number']}: '{pr['title']}'. Author: {pr['author']}. "
            f"Inactivity: {pr['inactivity_days']} days. "
            f"Jira Project Key: {state.get('jira_project_key') or 'None'}. "
            f"Slack channel: {state.get('slack_channel') or 'None'}."
        )),
    ]

    try:
        # Phase 1: Exploration — let the LLM call tools for a bounded number of rounds
        if tools:
            llm_with_tools = llm.bind_tools(tools=tools, tool_choice="auto")
            for _ in range(settings.llm_max_tool_rounds):
                response = await llm_with_tools.ainvoke(messages)
                messages.append(response)
                if not response.tool_calls:
                    break
                messages.extend(await run_tool_calls(response.tool_calls, tools))

        # Phase 2: Force extraction into our rigid pydantic schema
        decision_parser = llm.with_structured_output(PRDecision, method=settings.llm_structured_output_method)
        final_decision: PRDecision = await decision_parser.ainvoke(
            messages + [HumanMessage(content="Extract the final evaluation decision.")]
        )

        logger.info("llm_decision_made", pr=pr["number"], decision=final_decision.decision, reason=final_decision.reasoning)

        extracted_pr = {
            "id": make_pr_id(state["repo_id"], pr["number"]),
            "number": pr["number"],
            "title": pr["title"],
            "author": pr["author"],
            "inactivity_days": pr.get("inactivity_days", 0),
            "additions": pr.get("additions", 0),
            "deletions": pr.get("deletions", 0),
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

async def advance_pr_index(state: AgentState) -> dict:
    """Node: Moves to the next PR in the list"""
    return {"current_pr_index": state.get("current_pr_index", 0) + 1}
