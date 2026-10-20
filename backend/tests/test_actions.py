import json

import httpx

from sentinel.actions import ActionExecutor
from sentinel.github import GitHubClient
from sentinel.models import Action, ActionKind

BODY = "<!-- pr-sentinel -->\n### 🛡️ PR Sentinel\nnew text"


def comment_action(**kw):
    return Action(kind=ActionKind.PR_COMMENT, repo="o/r", pr_id="o/r#7", number=7,
                  payload={"body": BODY, "state": "NEEDS_FIRST_REVIEW"}, **kw)


def fake_github(existing_comments):
    calls = []

    def handler(request: httpx.Request):
        calls.append((request.method, request.url.raw_path.decode().split("?")[0], json.loads(request.content) if request.content else None))
        if request.method == "GET":
            return httpx.Response(200, json=existing_comments)
        if request.method == "DELETE":
            return httpx.Response(404, json={"message": "Label does not exist"})
        return httpx.Response(200, json={"id": 99})

    return GitHubClient("t", client=httpx.AsyncClient(transport=httpx.MockTransport(handler))), calls


async def test_creates_comment_when_none_exists():
    github, calls = fake_github([{"id": 1, "body": "unrelated"}])
    result = await ActionExecutor(github=github, dry_run=False).execute(comment_action())

    assert result.status == "executed"
    assert calls[-1] == ("POST", "/repos/o/r/issues/7/comments", {"body": BODY})


async def test_edits_the_existing_sentinel_comment():
    github, calls = fake_github([{"id": 5, "body": "<!-- pr-sentinel -->\nold"}])
    result = await ActionExecutor(github=github, dry_run=False).execute(comment_action())

    assert result.status == "executed" and "Updated comment 5" in result.detail
    assert calls[-1] == ("PATCH", "/repos/o/r/issues/comments/5", {"body": BODY})


async def test_unchanged_comment_is_not_rewritten():
    github, calls = fake_github([{"id": 5, "body": BODY}])
    result = await ActionExecutor(github=github, dry_run=False).execute(comment_action())
    assert result.detail == "Comment already up to date"
    assert [c[0] for c in calls] == ["GET"]


async def test_dry_run_and_approval_gate_never_call_github():
    github, calls = fake_github([])
    assert (await ActionExecutor(github=github, dry_run=True).execute(comment_action())).status == "dry_run"
    gated = comment_action(requires_approval=True)
    assert (await ActionExecutor(github=github, dry_run=False).execute(gated)).status == "pending_approval"
    assert calls == []


async def test_labels_ignore_missing_ones():
    github, calls = fake_github([])
    action = Action(kind=ActionKind.LABEL, repo="o/r", pr_id="o/r#7", number=7,
                    payload={"add": ["sentinel:ready-to-merge"], "remove": ["sentinel:waiting-on-author"]})
    result = await ActionExecutor(github=github, dry_run=False).execute(action)

    assert result.status == "executed"
    assert calls[0][:2] == ("DELETE", "/repos/o/r/issues/7/labels/sentinel%3Awaiting-on-author")
    assert calls[1] == ("POST", "/repos/o/r/issues/7/labels", {"labels": ["sentinel:ready-to-merge"]})


async def test_slack_digest_via_webhook_and_unconfigured():
    sent = []
    http = httpx.AsyncClient(transport=httpx.MockTransport(
        lambda r: sent.append(json.loads(r.content)) or httpx.Response(200, text="ok")))
    action = Action(kind=ActionKind.SLACK_DIGEST, repo="o/r", payload={"text": "hi", "prs": {}})

    result = await ActionExecutor(dry_run=False, slack_webhook_url="https://hooks.slack/x", http=http).execute(action)
    assert result.status == "executed" and sent == [{"text": "hi"}]

    skipped = await ActionExecutor(dry_run=False, http=http).execute(action)
    assert skipped.status == "skipped"


async def test_failures_are_reported_not_raised():
    def handler(request):
        return httpx.Response(403, json={"message": "Resource not accessible"})

    github = GitHubClient("t", client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    result = await ActionExecutor(github=github, dry_run=False).execute(comment_action())
    assert result.status == "failed" and "403" in result.detail
