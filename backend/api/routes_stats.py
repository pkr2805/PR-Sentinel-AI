from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from db.database import get_db
from db.models import PRRecord, Repository, ExecutionLog, PendingAction

router = APIRouter(prefix="/api/stats", tags=["Stats"])

@router.get("")
def get_dashboard_stats(repo_id: str = None, db: Session = Depends(get_db)):
    # Base queries
    pr_query = select(PRRecord)
    repo_query = select(func.count(Repository.id)).where(Repository.active == True)
    log_query = select(ExecutionLog)

    if repo_id:
        pr_query = pr_query.where(PRRecord.repo_id == repo_id)
        repo_query = repo_query.where(Repository.id == repo_id)
        log_query = log_query.where(ExecutionLog.repo_id == repo_id)

    # Execute aggregates
    prs_res = db.execute(pr_query)
    prs = prs_res.scalars().all()
    
    repos_res = db.execute(repo_query)
    monitored_repos = repos_res.scalar() or 0

    logs_res = db.execute(log_query)
    logs = logs_res.scalars().all()

    total_prs = len(prs)
    stale_prs = sum(1 for p in prs if p.inactivity_days >= 3)
    escalated = sum(1 for p in prs if p.decision == "ESCALATE")
    merge_ready = sum(1 for p in prs if p.decision == "ASK_TO_MERGE")
    avg_inactivity = round(sum(p.inactivity_days for p in prs) / total_prs, 1) if total_prs > 0 else 0

    pending_query = select(func.count(PendingAction.id)).where(PendingAction.status == "pending")
    if repo_id:
        pending_query = pending_query.where(PendingAction.repo_id == repo_id)
    batch_runs = [l for l in logs if l.decision == "BATCH_RUN"]

    return {
        "totalPRs": total_prs,
        "stalePRs": stale_prs,
        "escalated": escalated,
        "mergeReady": merge_ready,
        "agentRunsToday": len(logs), # Note: in prod filter by today
        "slackSentToday": sum(1 for l in logs if l.slack_sent),
        "reposMonitored": monitored_repos,
        "avgInactivity": avg_inactivity,
        "waitingOnAuthor": sum(1 for p in prs if p.waiting_on == "author"),
        "waitingOnReview": sum(1 for p in prs if p.waiting_on == "reviewer"),
        "pendingApprovals": db.execute(pending_query).scalar() or 0,
        "llmCalls": sum(l.llm_calls or 0 for l in batch_runs),
    }
