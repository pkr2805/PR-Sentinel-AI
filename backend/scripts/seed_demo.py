"""Load demo data so you can explore the dashboard without GitHub or Groq.

    python -m scripts.seed_demo          # adds demo repos, PRs, activity and an approval
    python -m scripts.seed_demo --reset  # wipes the local database first

Uses DATABASE_URL from .env (default: backend/sentinel.db). Demo repos are under the "acme" owner; real scans
of them will fail because they don't exist on GitHub. Remove them from the Repositories page when done.
"""
import sys
import uuid
from datetime import datetime, timedelta, timezone

from db.database import Base, engine, SessionLocal
import db.models  # noqa: F401  (registers the tables)
from db.models import Repository, PRRecord, ExecutionLog, PendingAction


def main():
    if "--reset" in sys.argv:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    if db.get(Repository, "acme/payments-api"):
        print("Demo data is already loaded (use --reset to start over).")
        return
    for owner, name, slack, jira, active in [("acme", "payments-api", "#payments-reviews", "PAY", True), ("acme", "web-app", "#frontend", None, True), ("acme", "infra", None, "OPS", False)]:
        db.add(Repository(id=f"{owner}/{name}", owner=owner, name=name, slack_channel=slack, jira_project_key=jira, active=active))
    prs = [
     ("acme/payments-api", 412, "Add idempotency keys to refund endpoint", "torvalds", "FEEDBACK_ADDRESSED", "reviewer", ["gaearon"], "The author pushed two commits after gaearon asked for a test; both review threads now have replies.", "Re-review the latest changes.", 0.86, "llm", 3, 240, 31, False),
     ("acme/payments-api", 409, "Migrate ledger service to Postgres 16", "yyx990803", "NEEDS_FIRST_REVIEW", "reviewer", ["sindresorhus", "tj"], "No one has reviewed this PR yet.", "Review the PR.", 1.0, "rules", 9, 1210, 402, True),
     ("acme/payments-api", 415, "Fix currency rounding for JPY", "addyosmani", "READY_TO_MERGE", "maintainer", ["gaearon"], "Approved by gaearon, CI is green and there are no conflicts.", "Merge it.", 1.0, "rules", 1, 18, 6, False),
     ("acme/web-app", 88, "Dark mode for settings pages", "sindresorhus", "CHANGES_REQUESTED", "author", ["sindresorhus"], "tj requested changes and nothing was pushed since.", "Address the requested changes and push.", 1.0, "rules", 4, 96, 12, False),
     ("acme/web-app", 91, "Upgrade to React Router 7", "tj", "CI_FAILING", "author", ["tj"], "CI is failing on the latest commit.", "Fix the failing checks and push again.", 1.0, "rules", 2, 340, 290, False),
     ("acme/web-app", 85, "Checkout: inline address validation", "gaearon", "DISCUSSION_STALLED", "author", ["gaearon"], "Two review threads ask about error copy and are still unanswered by the author.", "Reply to the open review threads.", 0.72, "llm", 5, 150, 40, False),
     ("acme/web-app", 93, "WIP: new onboarding flow", "addyosmani", "DRAFT", "author", ["addyosmani"], "The PR is still a draft.", "Mark it ready for review when it's done.", 1.0, "rules", 1, 800, 20, False),
     ("acme/payments-api", 401, "Rate-limit webhook retries", "torvalds", "MERGE_CONFLICT", "author", ["torvalds"], "The branch has merge conflicts with the base branch.", "Merge or rebase the base branch and resolve the conflicts.", 1.0, "cache", 6, 60, 14, False),
    ]
    for repo, num, title, author, state, waiting, people, reason, nxt, conf, src, idle, add, dele, esc in prs:
        decision = "ESCALATE" if esc else {"READY_TO_MERGE": "ASK_TO_MERGE", "reviewer": "PING_REVIEWER"}.get(state) or ("PING_REVIEWER" if waiting == "reviewer" else "IGNORE" if state == "DRAFT" else "PING_AUTHOR")
        pid = f"{repo}#{num}"
        db.add(PRRecord(id=pid, number=num, repo_id=repo, title=title, author=author, url=f"https://github.com/{repo}/pull/{num}", inactivity_days=idle, additions=add, deletions=dele,
            decision=decision, escalation_level=2 if esc else 0, state=state, waiting_on=waiting, people=people, reason=reason, next_step=nxt, confidence=conf, source=src,
            last_notified_at=now - timedelta(hours=idle * 3) if idle > 2 else None))
        db.add(ExecutionLog(id=str(uuid.uuid4()), pr_id=pid, repo_id=repo, decision=decision, status="success", slack_sent=idle > 2, timestamp=now - timedelta(hours=idle * 2 + 1)))
    for i, (repo, seen, cached, llm, ms, ok) in enumerate([("acme/payments-api", 4, 1, 1, 4120, True), ("acme/web-app", 4, 2, 1, 3380, True), ("acme/payments-api", 4, 4, 0, 610, True), ("acme/web-app", 4, 0, 2, 5230, False)]):
        db.add(ExecutionLog(id=str(uuid.uuid4()), repo_id=repo, decision="BATCH_RUN", status="success" if ok else "partial_failure", prs_seen=seen, prs_cached=cached, llm_calls=llm, duration_ms=ms, actions_taken=3, timestamp=now - timedelta(minutes=35 + i * 360)))
    db.add(PendingAction(id=str(uuid.uuid4()), repo_id="acme/payments-api", pr_id="acme/payments-api#409", kind="pr_comment", status="pending",
        action_json={"kind": "pr_comment", "repo": "acme/payments-api", "pr_id": "acme/payments-api#409", "number": 409, "requires_approval": True,
                     "payload": {"state": "NEEDS_FIRST_REVIEW", "body": "<!-- pr-sentinel -->\n### PR Sentinel\n**Next step:** @sindresorhus @tj Review the PR."}},
        summary="<!-- pr-sentinel -->\n### 🛡️ PR Sentinel\n**Status:** Needs a first review · waiting on review\n**Next step:** @sindresorhus @tj Review the PR.\n**Why:** No one has reviewed this PR yet."))
    db.commit()
    db.close()
    print("Demo data loaded: 3 repositories, 8 pull requests, scan history and 1 approval.")


if __name__ == "__main__":
    main()
