from __future__ import annotations

from typing import Optional

import httpx

from sentinel.github import GitHubClient
from sentinel.messages import COMMENT_MARKER
from sentinel.models import Action, ActionKind, ActionResult


class ActionExecutor:
    """The only place that changes anything outside PR Sentinel. The LLM never calls this directly."""

    def __init__(self, github: Optional[GitHubClient] = None, dry_run: bool = True,
                 slack_webhook_url: Optional[str] = None, slack_bot_token: Optional[str] = None,
                 http: Optional[httpx.AsyncClient] = None):
        self.github = github
        self.dry_run = dry_run
        self.slack_webhook_url = slack_webhook_url
        self.slack_bot_token = slack_bot_token
        self._http = http

    async def execute(self, action: Action, approved: bool = False) -> ActionResult:
        if action.requires_approval and not approved:
            return ActionResult(action=action, status="pending_approval", detail="Waiting for approval")
        if self.dry_run:
            return ActionResult(action=action, status="dry_run", detail=_describe(action))
        try:
            if action.kind == ActionKind.PR_COMMENT:
                detail = await self._upsert_comment(action)
            elif action.kind == ActionKind.LABEL:
                detail = await self._set_labels(action)
            elif action.kind == ActionKind.SLACK_DIGEST:
                detail = await self._send_slack(action)
            else:
                return ActionResult(action=action, status="skipped", detail=f"Unknown action {action.kind}")
        except Exception as e:
            return ActionResult(action=action, status="failed", detail=str(e))
        if detail.startswith("skipped:"):
            return ActionResult(action=action, status="skipped", detail=detail.removeprefix("skipped:").strip())
        return ActionResult(action=action, status="executed", detail=detail)

    async def _upsert_comment(self, action: Action) -> str:
        if not self.github:
            return "skipped: no GitHub client"
        body = action.payload["body"]
        for comment in await self.github.list_issue_comments(action.repo, action.number):
            if COMMENT_MARKER in (comment.get("body") or ""):
                if comment["body"] == body:
                    return "Comment already up to date"
                await self.github.update_issue_comment(action.repo, comment["id"], body)
                return f"Updated comment {comment['id']}"
        created = await self.github.create_issue_comment(action.repo, action.number, body)
        return f"Created comment {created.get('id')}"

    async def _set_labels(self, action: Action) -> str:
        if not self.github:
            return "skipped: no GitHub client"
        for label in action.payload.get("remove", []):
            await self.github.remove_label(action.repo, action.number, label)
        if action.payload.get("add"):
            await self.github.add_labels(action.repo, action.number, action.payload["add"])
        return f"Labels set to {action.payload.get('add') or 'none'}"

    async def _send_slack(self, action: Action) -> str:
        text, channel = action.payload["text"], action.payload.get("channel")
        http = self._http or httpx.AsyncClient(timeout=15)
        try:
            if self.slack_bot_token and channel:
                res = await http.post("https://slack.com/api/chat.postMessage",
                                      headers={"Authorization": f"Bearer {self.slack_bot_token}"},
                                      json={"channel": channel, "text": text})
                res.raise_for_status()
                if not res.json().get("ok"):
                    raise RuntimeError(f"Slack error: {res.json().get('error')}")
                return f"Sent Slack digest to {channel}"
            if self.slack_webhook_url:
                res = await http.post(self.slack_webhook_url, json={"text": text})
                res.raise_for_status()
                return "Sent Slack digest via webhook"
            return "skipped: Slack is not configured"
        finally:
            if self._http is None:
                await http.aclose()


def _describe(action: Action) -> str:
    if action.kind == ActionKind.PR_COMMENT:
        return f"Would comment on {action.pr_id}"
    if action.kind == ActionKind.LABEL:
        return f"Would set labels on {action.pr_id} to {action.payload.get('add') or 'none'}"
    return f"Would send Slack digest for {len(action.payload.get('prs', {}))} PR(s)"
