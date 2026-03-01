import uuid
from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import select

from db.models import ExecutionLog, PRRecord, Repository
from services.agent.graph import compile_agent_graph
from core.logger import logger
from core.exceptions import AgentExecutionError

# In-memory execution lock for concurrency protection
# Key: repo_id, Value: run_id
_ACTIVE_RUNS: Dict[str, str] = {}

class AgentService:
    def __init__(self, db: Session):
        self.db = db
        self.graph = compile_agent_graph()

    async def execute_repo_scan(self, repo_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Triggers an agent scan for a specific repository. If repo_id is None or 'null', 
        it picks the first active repository.
        Enforces concurrency locking to prevent overlapping runs.
        """
        # 1. Resolve repository identifier
        if not repo_id or repo_id == "null":
            active_stmt = select(Repository).where(Repository.active == True).limit(1)
            active_res = self.db.execute(active_stmt)
            target_repo = active_res.scalar_one_or_none()
            if not target_repo:
                raise AgentExecutionError("No active repositories found to scan")
            repo_id = target_repo.id
            
        if repo_id in _ACTIVE_RUNS:
            logger.warning("agent_run_skipped_concurrency", repo_id=repo_id, run_id=_ACTIVE_RUNS[repo_id])
            return {"error": True, "message": "Agent is already running for this repository."}

        run_id = str(uuid.uuid4())
        _ACTIVE_RUNS[repo_id] = run_id
        logger.info("agent_run_started", repo_id=repo_id, run_id=run_id)

        try:
            # Verify repo exists
            repo_stmt = select(Repository).where(Repository.id == repo_id)
            repo_res = self.db.execute(repo_stmt)
            repo = repo_res.scalar_one_or_none()
            if not repo:
                raise AgentExecutionError("Repository not found")

            # 2. Initialize State
            initial_state = {
                "repo_id": repo_id,
                "github_owner": repo.owner,
                "github_repo": repo.name,
                "jira_project_key": repo.jira_project_key,
                "slack_channel": repo.slack_channel,
                "prs_evaluated": 0,
                "errors": []
            }

            # 2. Invoke Graph (Async)
            # Checkpointer requires thread config
            config = {"configurable": {"thread_id": run_id}}
            
            logger.info("langgraph_invoke_start", run_id=run_id)
            final_state = await self.graph.ainvoke(initial_state, config)
            logger.info("langgraph_invoke_complete", run_id=run_id, prs_evaluated=final_state.get("prs_evaluated", 0))

            evaluated_prs_data = final_state.get("evaluated_prs", [])
            for pr_data in evaluated_prs_data:
                # Upsert PR Record (query first to avoid sqlite integrity issues)
                existing_pr_stmt = select(PRRecord).where(PRRecord.id == pr_data["id"])
                existing_pr = self.db.execute(existing_pr_stmt).scalar_one_or_none()
                
                if existing_pr:
                    existing_pr.decision = pr_data["decision"]
                    existing_pr.escalation_level = pr_data["escalation_level"]
                    existing_pr.inactivity_days = pr_data["inactivity_days"]
                else:
                    new_pr = PRRecord(
                        id=pr_data["id"],
                        repo_id=repo_id,
                        title=pr_data["title"],
                        author=pr_data["author"],
                        inactivity_days=pr_data["inactivity_days"],
                        additions=pr_data["additions"],
                        deletions=pr_data["deletions"],
                        decision=pr_data["decision"],
                        escalation_level=pr_data["escalation_level"]
                    )
                    self.db.add(new_pr)
                
                # Create detailed Execution Log for THIS pr
                pr_log = ExecutionLog(
                    id=str(uuid.uuid4()),
                    pr_id=pr_data["id"],
                    repo_id=repo_id,
                    decision=pr_data["decision"],
                    status="success" if not final_state.get("errors") else "partial_failure"
                )
                self.db.add(pr_log)

            # 3. Create Repo-wide Execution Log
            log = ExecutionLog(
                id=run_id,
                repo_id=repo_id,
                decision="BATCH_RUN",
                status="success" if not final_state.get("errors") else "partial_failure"
            )
            self.db.add(log)
            self.db.commit()

            return {
                "status": "success",
                "run_id": run_id,
                "message": f"Successfully evaluated {final_state.get('prs_evaluated', 0)} PRs."
            }

        except Exception as e:
            logger.exception("agent_run_failed", repo_id=repo_id, run_id=run_id, error=str(e))
            self.db.rollback()
            raise AgentExecutionError(str(e))
        finally:
            # Release Lock
            _ACTIVE_RUNS.pop(repo_id, None)

    async def get_active_runs(self) -> Dict[str, str]:
        return _ACTIVE_RUNS
