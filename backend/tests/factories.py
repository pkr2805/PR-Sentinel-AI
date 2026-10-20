from datetime import datetime, timedelta, timezone

from sentinel.models import Comment, PRFacts, Review, ReviewThread

NOW = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


def make_facts(**overrides) -> PRFacts:
    values = dict(
        repo="octocat/hello", number=1, title="Add feature", url="https://github.com/octocat/hello/pull/1",
        author="alice", created_at=days_ago(5), updated_at=days_ago(4), mergeable="MERGEABLE",
        ci_state="SUCCESS", head_sha="abc123", last_commit_at=days_ago(5),
    )
    values.update(overrides)
    return PRFacts(**values)


def review(author: str, state: str, age_days: float, body: str = "", url: str | None = None) -> Review:
    return Review(author=author, state=state, submitted_at=days_ago(age_days), body=body,
                  url=url or f"https://github.com/octocat/hello/pull/1#review-{author}-{state}")


def thread(*comments: tuple[str, float, str], resolved: bool = False) -> ReviewThread:
    return ReviewThread(is_resolved=resolved, comments=[
        Comment(author=a, created_at=days_ago(age), body=body, url=f"https://github.com/c/{a}-{age}")
        for a, age, body in comments
    ])
