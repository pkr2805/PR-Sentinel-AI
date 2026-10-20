import hashlib
import hmac
import json

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from core.config import settings
from core.logger import logger
from db.database import SessionLocal
from db.models import Repository
from sentinel.messages import COMMENT_MARKER
from services.agent_service import AgentService

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])

# Events that can change why a PR is stuck
TRIGGER_EVENTS = {"pull_request", "pull_request_review", "pull_request_review_comment",
                  "pull_request_review_thread", "check_suite", "issue_comment"}
# Label changes (including PR Sentinel's own) don't change why a PR is stuck
IGNORED_PR_ACTIONS = {"labeled", "unlabeled", "assigned", "unassigned", "milestoned", "demilestoned"}


def verify_signature(secret: str, body: bytes, signature: str | None) -> bool:
    if not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


async def _scan_in_background(repo_id: str):
    db = SessionLocal()
    try:
        await AgentService(db).execute_repo_scan(repo_id)
    except Exception as e:
        logger.error("webhook_scan_failed", repo_id=repo_id, error=str(e))
    finally:
        db.close()


@router.post("/github", status_code=202)
async def github_webhook(
    request: Request,
    background: BackgroundTasks,
    x_github_event: str = Header(""),
    x_hub_signature_256: str | None = Header(None),
):
    if not settings.github_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhooks are disabled: GITHUB_WEBHOOK_SECRET is not set")
    body = await request.body()
    if not verify_signature(settings.github_webhook_secret, body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    if x_github_event not in TRIGGER_EVENTS:
        return {"status": "ignored", "reason": f"event {x_github_event or 'unknown'}"}
    payload = json.loads(body or b"{}")
    if x_github_event == "issue_comment":
        if "pull_request" not in payload.get("issue", {}):
            return {"status": "ignored", "reason": "comment is not on a pull request"}
        if COMMENT_MARKER in ((payload.get("comment") or {}).get("body") or ""):
            return {"status": "ignored", "reason": "PR Sentinel's own comment"}
    if x_github_event == "pull_request" and payload.get("action") in IGNORED_PR_ACTIONS:
        return {"status": "ignored", "reason": f"pull_request {payload['action']}"}

    repo_id = (payload.get("repository") or {}).get("full_name")
    db = SessionLocal()
    try:
        repo = db.get(Repository, repo_id) if repo_id else None
        if not repo or not repo.active:
            return {"status": "ignored", "reason": "repository is not monitored"}
    finally:
        db.close()

    background.add_task(_scan_in_background, repo_id)
    return {"status": "scheduled", "repo_id": repo_id}
