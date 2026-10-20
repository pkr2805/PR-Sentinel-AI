from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from urllib.parse import quote

import httpx

from sentinel.messages import COMMENT_MARKER
from sentinel.models import Comment, PRFacts, Review, ReviewThread

GITHUB_API = "https://api.github.com"

OPEN_PRS_QUERY = """
query OpenPullRequests($owner: String!, $name: String!, $first: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        url
        isDraft
        createdAt
        updatedAt
        additions
        deletions
        changedFiles
        mergeable
        author { login __typename }
        labels(first: 20) { nodes { name } }
        reviewRequests(first: 10) {
          nodes { requestedReviewer { __typename ... on User { login } ... on Team { slug } } }
        }
        reviews(last: 30) { nodes { author { login } state submittedAt body url } }
        reviewThreads(last: 30) {
          nodes {
            isResolved
            isOutdated
            comments(last: 5) { nodes { author { login } body createdAt url } }
          }
        }
        comments(last: 10) { nodes { author { login } body createdAt url } }
        commits(last: 1) { nodes { commit { oid committedDate statusCheckRollup { state } } } }
      }
    }
  }
}
"""


class GitHubError(Exception):
    pass


def _dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _login(actor: Optional[dict]) -> str:
    # Deleted accounts come back as null ("ghost" on github.com)
    return (actor or {}).get("login") or "ghost"


def _nodes(connection: Optional[dict]) -> list[dict]:
    return [n for n in ((connection or {}).get("nodes") or []) if n]


def _comment(node: dict) -> Comment:
    return Comment(author=_login(node.get("author")), body=node.get("body") or "",
                   created_at=_dt(node.get("createdAt")), url=node.get("url"))


def parse_pull_request(repo: str, node: dict[str, Any]) -> PRFacts:
    """Turns one GraphQL pull request node into PRFacts."""
    author = node.get("author") or {}
    commits = _nodes(node.get("commits"))
    head = commits[-1]["commit"] if commits else {}
    rollup = head.get("statusCheckRollup") or {}

    requested = []
    for req in _nodes(node.get("reviewRequests")):
        reviewer = req.get("requestedReviewer") or {}
        if reviewer.get("login"):
            requested.append(reviewer["login"])
        elif reviewer.get("slug"):
            requested.append(f"team:{reviewer['slug']}")

    return PRFacts(
        repo=repo,
        number=node["number"],
        title=node.get("title") or "",
        url=node.get("url") or "",
        author=_login(author),
        author_is_bot=author.get("__typename") == "Bot" or _login(author).endswith("[bot]"),
        is_draft=bool(node.get("isDraft")),
        created_at=_dt(node["createdAt"]),
        updated_at=_dt(node.get("updatedAt") or node["createdAt"]),
        additions=node.get("additions") or 0,
        deletions=node.get("deletions") or 0,
        changed_files=node.get("changedFiles") or 0,
        labels=[label["name"] for label in _nodes(node.get("labels"))],
        mergeable=node.get("mergeable") or "UNKNOWN",
        ci_state=rollup.get("state"),
        head_sha=head.get("oid") or "",
        last_commit_at=_dt(head.get("committedDate")),
        requested_reviewers=requested,
        reviews=[
            Review(author=_login(r.get("author")), state=r.get("state") or "COMMENTED",
                   submitted_at=_dt(r.get("submittedAt")), body=r.get("body") or "", url=r.get("url"))
            for r in _nodes(node.get("reviews"))
        ],
        threads=[
            ReviewThread(is_resolved=bool(t.get("isResolved")), is_outdated=bool(t.get("isOutdated")),
                         comments=[_comment(c) for c in _nodes(t.get("comments"))])
            for t in _nodes(node.get("reviewThreads"))
        ],
        # PR Sentinel's own comment is not activity on the PR
        comments=[_comment(c) for c in _nodes(node.get("comments")) if COMMENT_MARKER not in (c.get("body") or "")],
    )


class GitHubClient:
    """Small async GitHub client: GraphQL for reading PRs, REST for comments and labels."""

    def __init__(self, token: str, client: Optional[httpx.AsyncClient] = None):
        self._client = client or httpx.AsyncClient(timeout=30)
        self._headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def aclose(self):
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        response = await self._client.request(method, f"{GITHUB_API}{path}", headers=self._headers, **kwargs)
        if response.status_code >= 400:
            raise GitHubError(f"{method} {path} -> {response.status_code}: {response.text[:300]}")
        return response.json() if response.content else None

    async def fetch_open_prs(self, owner: str, name: str, first: int = 30) -> list[PRFacts]:
        data = await self._request("POST", "/graphql", json={
            "query": OPEN_PRS_QUERY,
            "variables": {"owner": owner, "name": name, "first": first},
        })
        if data.get("errors"):
            raise GitHubError(f"GraphQL errors: {data['errors']}")
        repository = (data.get("data") or {}).get("repository")
        if repository is None:
            raise GitHubError(f"Repository {owner}/{name} not found or not accessible")
        repo = f"{owner}/{name}"
        return [parse_pull_request(repo, node) for node in _nodes(repository.get("pullRequests"))]

    async def list_issue_comments(self, repo: str, number: int) -> list[dict]:
        return await self._request("GET", f"/repos/{repo}/issues/{number}/comments", params={"per_page": 100})

    async def create_issue_comment(self, repo: str, number: int, body: str) -> dict:
        return await self._request("POST", f"/repos/{repo}/issues/{number}/comments", json={"body": body})

    async def update_issue_comment(self, repo: str, comment_id: int, body: str) -> dict:
        return await self._request("PATCH", f"/repos/{repo}/issues/comments/{comment_id}", json={"body": body})

    async def add_labels(self, repo: str, number: int, labels: list[str]) -> Any:
        return await self._request("POST", f"/repos/{repo}/issues/{number}/labels", json={"labels": labels})

    async def remove_label(self, repo: str, number: int, label: str) -> None:
        try:
            await self._request("DELETE", f"/repos/{repo}/issues/{number}/labels/{quote(label, safe='')}")
        except GitHubError as e:
            if "-> 404" not in str(e):  # label wasn't on the PR
                raise
