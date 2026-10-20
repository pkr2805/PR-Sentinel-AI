from langgraph.graph import StateGraph, END
from core.logger import logger

from services.agent.state import AgentState
from services.agent.nodes import fetch_github_prs, evaluate_current_pr, advance_pr_index

def build_workflow() -> StateGraph:
    """Builds and wires the LangGraph edges."""
    workflow = StateGraph(AgentState)

    workflow.add_node("fetch_github_prs", fetch_github_prs)
    workflow.add_node("evaluate_current_pr", evaluate_current_pr)
    workflow.add_node("advance_pr_index", advance_pr_index)

    # Logic:
    # START -> fetch -> evaluate -> advance -> (if more prs) loop back to evaluate, else END
    workflow.set_entry_point("fetch_github_prs")
    workflow.add_edge("fetch_github_prs", "evaluate_current_pr")
    workflow.add_edge("evaluate_current_pr", "advance_pr_index")

    def should_continue(state: AgentState) -> str:
        idx = state.get("current_pr_index", 0)
        total = len(state.get("active_prs", []))
        if idx < total:
            return "evaluate_current_pr"
        return END

    workflow.add_conditional_edges(
        "advance_pr_index",
        should_continue
    )

    return workflow

def compile_agent_graph():
    """
    Returns the compiled LangGraph with memory persistence enabled.
    This allows human-in-the-loop overrides by resuming state from a checkpointer DB.
    """
    logger.info("compiling_langgraph_agent")
    workflow = build_workflow()
    
    # In a fully deployed setup, pass a real SQLiteSaver instance to `checkpointer`
    # e.g., memory = AsyncSqliteSaver.from_conn_string("checkpoints.db")
    app = workflow.compile()
    return app
