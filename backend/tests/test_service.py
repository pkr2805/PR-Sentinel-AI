import hashlib
import hmac
import json

import pytest

from core.config import settings
from db.database import SessionLocal
from db.models import ExecutionLog, PendingAction, PRRecord, Repository
from sentinel.actions import ActionExecutor
from sentinel.engine import ScanDeps
from sentinel.judge import LLMJudge
from sentinel.models import ActionResult
from services.agent_service import AgentService
from tests.factories import NOW, days_ago, make_facts, review
from tests.fakes import FakeGitHub, FakeLLM


class RecordingExecutor(ActionExecutor):
    """Pretends every action succeeded, and records it."""

    def __init__(self):
        super().__init__(dry_run=False)
        self.executed = []

    async def execute(self, action, approved=False):
        if action.requires_approval and not approved:
            return ActionResult(action=action, status="pending_approval")
        self.executed.append(action)
        return ActionResult(action=action, status="executed", detail="ok")


def open_prs():
    return [
        make_facts(number=1, requested_reviewers=["bob"]),  # stale 4 days, waiting on review
        make_facts(number=2, updated_at=days_ago(9), last_commit_at=days_ago(9),
                   reviews=[review("bob", "CHANGES_REQUESTED", 9)]),  # waiting on author 9 days → escalation
    ]


@pytest.fixture
def repo():
    with SessionLocal() as db:
        db.add(Repository(id="octocat/hello", owner="octocat", name="hello", slack_channel="#reviews"))
        db.commit()


def factory(github, executor, llm=None):
    async def make(repo, memory, config, stack):
        config = config.model_copy(update={"dry_run": False})
        return ScanDeps(github=github, executor=executor, config=config, memory=memory, now=NOW,
                        judge=LLMJudge(llm) if llm else None)
    return make


async def scan(github, executor, llm=None):
    with SessionLocal() as db:
        return await AgentService(db, deps_factory=factory(github, executor, llm)).execute_repo_scan("octocat/hello")


async def test_scan_saves_assessments_memory_and_pending_approvals(repo):
    executor = RecordingExecutor()
    result = await scan(FakeGitHub(open_prs()), executor)
    assert result["status"] == "success"

    with SessionLocal() as db:
        pr1 = db.get(PRRecord, "octocat/hello#1")
        assert (pr1.state, pr1.waiting_on, pr1.decision) == ("NEEDS_FIRST_REVIEW", "reviewer", "PING_REVIEWER")
        assert pr1.people == ["bob"] and pr1.next_step == "Review the PR." and pr1.last_notified_at
        assert pr1.assessment_json["pr_id"] == "octocat/hello#1"

        pr2 = db.get(PRRecord, "octocat/hello#2")
        assert (pr2.state, pr2.decision, pr2.escalation_level) == ("CHANGES_REQUESTED", "ESCALATE", 2)

        pending = db.query(PendingAction).all()
        assert sorted(p.kind for p in pending) == ["pr_comment", "slack_digest"]
        assert all(p.pr_id in (None, "octocat/hello#2") for p in pending)

        batch = db.query(ExecutionLog).filter_by(decision="BATCH_RUN").one()
        assert (batch.prs_seen, batch.prs_cached, batch.llm_calls) == (2, 0, 0)
        assert batch.actions_taken == len(executor.executed)

    kinds = sorted(a.kind.value for a in executor.executed)
    assert kinds == ["label", "label", "pr_comment", "slack_digest"]  # escalation comment + digest held back


async def test_second_run_uses_cache_and_does_not_repeat_notifications(repo):
    await scan(FakeGitHub(open_prs()), RecordingExecutor())

    executor = RecordingExecutor()
    llm = FakeLLM()
    result = await scan(FakeGitHub(open_prs()), executor, llm)

    assert "2 unchanged" in result["message"]
    assert executor.executed == [] and llm.calls == 0
    with SessionLocal() as db:
        assert db.query(PendingAction).count() == 2  # no duplicates
        assert db.query(ExecutionLog).filter(ExecutionLog.pr_id.isnot(None)).count() == 2  # no new per-PR logs


async def test_closed_prs_leave_the_dashboard(repo):
    await scan(FakeGitHub(open_prs()), RecordingExecutor())
    await scan(FakeGitHub(open_prs()[:1]), RecordingExecutor())
    with SessionLocal() as db:
        assert [r.id for r in db.query(PRRecord).all()] == ["octocat/hello#1"]


async def test_failed_fetch_keeps_existing_records(repo):
    await scan(FakeGitHub(open_prs()), RecordingExecutor())
    result = await scan(FakeGitHub([], fail=True), RecordingExecutor())
    assert result["status"] == "success" and "1 error(s): Fetching PRs failed" in result["message"]
    with SessionLocal() as db:
        assert db.query(PRRecord).count() == 2
        batch = db.query(ExecutionLog).filter_by(decision="BATCH_RUN").order_by(ExecutionLog.timestamp).all()[-1]
        assert batch.status == "partial_failure" and "Bad credentials" in batch.error_msg


async def test_approve_and_reject_pending_actions(repo, client):
    await scan(FakeGitHub(open_prs()), RecordingExecutor())

    pending = (await client.get("/api/actions")).json()
    assert len(pending) == 2
    comment = next(p for p in pending if p["kind"] == "pr_comment")
    assert "PR Sentinel" in comment["summary"]

    approved = await client.post(f"/api/actions/{comment['id']}/approve")  # SENTINEL_DRY_RUN defaults to true
    assert approved.status_code == 200
    assert approved.json()["status"] == "executed" and approved.json()["result"].startswith("dry_run")

    again = await client.post(f"/api/actions/{comment['id']}/approve")
    assert again.status_code == 409

    digest = next(p for p in pending if p["kind"] == "slack_digest")
    rejected = await client.post(f"/api/actions/{digest['id']}/reject")
    assert rejected.json()["status"] == "rejected"
    assert (await client.get("/api/actions")).json() == []

    stats = (await client.get("/api/stats")).json()
    assert stats["pendingApprovals"] == 0 and stats["waitingOnReview"] == 1 and stats["waitingOnAuthor"] == 1


def signed(body: dict, secret: str = "s3cret") -> tuple[bytes, str]:
    raw = json.dumps(body).encode()
    return raw, "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


async def test_webhook_requires_a_secret_and_valid_signature(repo, client, monkeypatch):
    body, signature = signed({"repository": {"full_name": "octocat/hello"}})
    headers = {"X-GitHub-Event": "pull_request_review", "X-Hub-Signature-256": signature}

    monkeypatch.setattr(settings, "github_webhook_secret", None)
    assert (await client.post("/api/webhooks/github", content=body, headers=headers)).status_code == 503

    monkeypatch.setattr(settings, "github_webhook_secret", "s3cret")
    bad = {**headers, "X-Hub-Signature-256": "sha256=" + "0" * 64}
    assert (await client.post("/api/webhooks/github", content=body, headers=bad)).status_code == 401


async def test_webhook_schedules_a_scan_for_monitored_repos(repo, client, monkeypatch):
    import api.routes_webhooks as hooks

    scanned = []

    async def fake_scan(repo_id):
        scanned.append(repo_id)

    monkeypatch.setattr(settings, "github_webhook_secret", "s3cret")
    monkeypatch.setattr(hooks, "_scan_in_background", fake_scan)

    async def send(event, payload):
        body, signature = signed(payload)
        res = await client.post("/api/webhooks/github", content=body,
                                headers={"X-GitHub-Event": event, "X-Hub-Signature-256": signature})
        return res.json()

    assert (await send("pull_request_review", {"repository": {"full_name": "octocat/hello"}}))["status"] == "scheduled"
    assert (await send("star", {"repository": {"full_name": "octocat/hello"}}))["status"] == "ignored"
    assert (await send("pull_request", {"repository": {"full_name": "someone/else"}}))["status"] == "ignored"
    assert (await send("issue_comment", {"repository": {"full_name": "octocat/hello"}, "issue": {}}))["status"] == "ignored"
    own = {"repository": {"full_name": "octocat/hello"}, "issue": {"pull_request": {}},
           "comment": {"body": "<!-- pr-sentinel -->\nupdate"}}
    assert (await send("issue_comment", own))["status"] == "ignored"
    labeled = {"repository": {"full_name": "octocat/hello"}, "action": "labeled"}
    assert (await send("pull_request", labeled))["status"] == "ignored"
    assert scanned == ["octocat/hello"]
