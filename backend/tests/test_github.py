import json

import httpx

from sentinel.github import GitHubClient, parse_pull_request

NODE = {
    "number": 42, "title": "Fix login", "url": "https://github.com/o/r/pull/42", "isDraft": False,
    "createdAt": "2026-10-10T10:00:00Z", "updatedAt": "2026-10-18T09:30:00Z",
    "additions": 12, "deletions": 3, "changedFiles": 2, "mergeable": "MERGEABLE",
    "author": {"login": "alice", "__typename": "User"},
    "labels": {"nodes": [{"name": "bug"}]},
    "reviewRequests": {"nodes": [
        {"requestedReviewer": {"__typename": "User", "login": "bob"}},
        {"requestedReviewer": {"__typename": "Team", "slug": "core"}},
    ]},
    "reviews": {"nodes": [
        {"author": {"login": "carol"}, "state": "CHANGES_REQUESTED", "submittedAt": "2026-10-12T08:00:00Z",
         "body": "Please add a test", "url": "https://github.com/o/r/pull/42#r1"},
        {"author": None, "state": "COMMENTED", "submittedAt": "2026-10-13T08:00:00Z", "body": "", "url": None},
    ]},
    "reviewThreads": {"nodes": [{"isResolved": False, "isOutdated": False, "comments": {"nodes": [
        {"author": {"login": "carol"}, "body": "Why this?", "createdAt": "2026-10-12T08:01:00Z", "url": "u1"}]}}]},
    "comments": {"nodes": [{"author": {"login": "alice"}, "body": "Done", "createdAt": "2026-10-14T08:00:00Z", "url": "u2"}]},
    "commits": {"nodes": [{"commit": {"oid": "deadbeef", "committedDate": "2026-10-14T07:00:00Z",
                                      "statusCheckRollup": {"state": "SUCCESS"}}}]},
}


def test_parse_pull_request():
    facts = parse_pull_request("o/r", NODE)

    assert facts.pr_id == "o/r#42"
    assert facts.author == "alice" and not facts.author_is_bot
    assert facts.requested_reviewers == ["bob", "team:core"]
    assert facts.labels == ["bug"]
    assert facts.ci_state == "SUCCESS" and facts.head_sha == "deadbeef"
    assert facts.reviews[0].state == "CHANGES_REQUESTED"
    assert facts.reviews[1].author == "ghost"  # deleted account
    assert facts.threads[0].comments[0].body == "Why this?"
    assert facts.last_commit_at.isoformat() == "2026-10-14T07:00:00+00:00"


def test_parse_handles_missing_checks_and_bots():
    node = {**NODE, "author": {"login": "dependabot", "__typename": "Bot"}, "commits": {"nodes": []},
            "reviews": None, "reviewThreads": {"nodes": None}}
    facts = parse_pull_request("o/r", node)

    assert facts.author_is_bot
    assert facts.ci_state is None and facts.head_sha == ""
    assert facts.reviews == [] and facts.threads == []


async def test_fetch_open_prs_sends_one_graphql_query():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"data": {"repository": {"pullRequests": {"nodes": [NODE]}}}})

    client = GitHubClient("token", client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    prs = await client.fetch_open_prs("o", "r", first=5)

    assert [p.number for p in prs] == [42]
    assert len(requests) == 1
    assert requests[0].url.path == "/graphql"
    assert requests[0].headers["Authorization"] == "Bearer token"
    assert json.loads(requests[0].content)["variables"] == {"owner": "o", "name": "r", "first": 5}


async def test_fetch_open_prs_raises_on_graphql_errors():
    def handler(request):
        return httpx.Response(200, json={"errors": [{"message": "Bad credentials"}]})

    client = GitHubClient("token", client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    try:
        await client.fetch_open_prs("o", "r")
        raise AssertionError("expected GitHubError")
    except Exception as e:
        assert "Bad credentials" in str(e)


def test_sentinels_own_comment_is_not_activity():
    own = {"author": {"login": "github-actions"}, "body": "<!-- pr-sentinel -->\\n### PR Sentinel", "createdAt": "2026-10-19T08:00:00Z", "url": "u3"}
    node = {**NODE, "comments": {"nodes": NODE["comments"]["nodes"] + [own]}}
    assert parse_pull_request("o/r", node).cache_key() == parse_pull_request("o/r", NODE).cache_key()
