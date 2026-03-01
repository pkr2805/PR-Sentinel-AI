import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.database import SessionLocal
from db.models import Repository
from services.agent_service import AgentService
from core.logger import logger

scheduler = AsyncIOScheduler()

async def execute_scheduled_scans():
    """
    Finds all active repositories and triggers an agent run for each.
    The AgentService enforces concurrency locks so we don't overlap runs.
    """
    logger.info("scheduler_tick_start")
    
    # We use a pure manual session block since this is an async function
    # mixing standard synchronous SQLAlchemy code
    db = SessionLocal()
    try:
        stmt = select(Repository).where(Repository.active == True)
        res = db.execute(stmt)
        active_repos = res.scalars().all()
        
        service = AgentService(db)
        
        for repo in active_repos:
            try:
                # Triggering runs asynchronously but awaiting result so connection pool isn't exhausted
                # In heavy prod environments, we would async.gather or push to Celery/SQS.
                await service.execute_repo_scan(repo.id)
            except Exception as e:
                logger.error("scheduler_run_failed", repo_id=repo.id, error=str(e))
                continue
    finally:
        db.close()

def start_scheduler():
    # Run every 6 hours by default
    scheduler.add_job(
        execute_scheduled_scans,
        CronTrigger(hour="*/6"),
        id="pr_sentinel_agent_scans",
        replace_existing=True
    )
    scheduler.start()
    logger.info("scheduler_started")

def stop_scheduler():
    scheduler.shutdown()
    logger.info("scheduler_stopped")
