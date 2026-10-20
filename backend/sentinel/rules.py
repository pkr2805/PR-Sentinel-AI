from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sentinel.config import SentinelConfig
from sentinel.models import Assessment, PRFacts, PRState, WaitingOn


@dataclass
class RuleResult:
    assessment: Assessment
    needs_llm: bool = False  # the rules can't be sure; ask the LLM judge


def should_skip(facts: PRFacts, config: SentinelConfig) -> str | None:
    """Returns why a PR is skipped entirely, or None to assess it."""
    if facts.author_is_bot:
        return "bot author"
    if facts.author in config.ignore_authors:
        return "ignored author"
    ignored = set(config.ignore_labels) & set(facts.labels)
    if ignored:
        return f"ignored label {sorted(ignored)[0]}"
    return None


def _assessment(facts: PRFacts, now: datetime, state: PRState, waiting_on: WaitingOn, people: list[str],
                reason: str, next_step: str, evidence: list[str] | None = None) -> Assessment:
    return Assessment(
        pr_id=facts.pr_id, repo=facts.repo, number=facts.number, title=facts.title, url=facts.url,
        author=facts.author, state=state, waiting_on=waiting_on, people=people, reason=reason,
        next_step=next_step, evidence=[e for e in (evidence or []) if e],
        inactivity_days=facts.inactivity_days(now), additions=facts.additions, deletions=facts.deletions,
        labels=facts.labels, cache_key=facts.cache_key(),
    )


def _reviewers_to_ping(facts: PRFacts) -> list[str]:
    reviewers = list(facts.requested_reviewers)
    for login in facts.latest_reviews():
        if login not in reviewers:
            reviewers.append(login)
    return reviewers


def classify(facts: PRFacts, config: SentinelConfig, now: datetime) -> RuleResult:
    """Decides every state that plain facts make certain, and flags the ambiguous ones for the LLM."""
    a = lambda *args, **kw: _assessment(facts, now, *args, **kw)  # noqa: E731
    inactive = facts.inactivity_days(now)
    author = [facts.author]

    if facts.is_draft:
        return RuleResult(a(PRState.DRAFT, WaitingOn.AUTHOR, author,
                            "The PR is still a draft.", "Mark it ready for review when it's done."))

    if inactive >= config.abandoned_after_days:
        return RuleResult(a(PRState.ABANDONED, WaitingOn.AUTHOR, author,
                            f"Nobody has touched this PR for {inactive} days.",
                            "Decide whether to finish it or close it."))

    if facts.mergeable == "CONFLICTING":
        return RuleResult(a(PRState.MERGE_CONFLICT, WaitingOn.AUTHOR, author,
                            "The branch has merge conflicts with the base branch.",
                            "Merge or rebase the base branch and resolve the conflicts."))

    if facts.ci_state in ("FAILURE", "ERROR"):
        return RuleResult(a(PRState.CI_FAILING, WaitingOn.AUTHOR, author,
                            "CI is failing on the latest commit.", "Fix the failing checks and push again."))

    latest = facts.latest_reviews()
    changes_requested = {login: r for login, r in latest.items() if r.state == "CHANGES_REQUESTED"}
    approved = [login for login, r in latest.items() if r.state == "APPROVED"]
    unresolved = facts.unresolved_threads()

    if changes_requested:
        newest_request = max(r.submitted_at or facts.created_at for r in changes_requested.values())
        evidence = [r.url for r in changes_requested.values()]
        if facts.last_commit_at and facts.last_commit_at > newest_request:
            return RuleResult(a(PRState.FEEDBACK_ADDRESSED, WaitingOn.REVIEWER, sorted(changes_requested),
                                "New commits were pushed after changes were requested.",
                                "Re-review the latest changes.", evidence), needs_llm=True)
        return RuleResult(a(PRState.CHANGES_REQUESTED, WaitingOn.AUTHOR, author,
                            f"{', '.join(sorted(changes_requested))} requested changes and nothing was pushed since.",
                            "Address the requested changes and push.", evidence))

    if approved and not unresolved:
        if facts.ci_state in ("PENDING", "EXPECTED"):
            return RuleResult(a(PRState.CI_PENDING, WaitingOn.NOBODY, [],
                                "Approved; CI is still running.", "Wait for CI to finish."))
        if facts.mergeable == "MERGEABLE":
            return RuleResult(a(PRState.READY_TO_MERGE, WaitingOn.MAINTAINER, sorted(approved),
                                f"Approved by {', '.join(sorted(approved))}, CI is green and there are no conflicts.",
                                "Merge it."))

    if unresolved:
        evidence = [t.comments[-1].url for t in unresolved]
        return RuleResult(a(PRState.DISCUSSION_STALLED, WaitingOn.AUTHOR, author,
                            f"{len(unresolved)} review thread(s) are still open.",
                            "Reply to or resolve the open review threads.", evidence), needs_llm=True)

    if not latest:
        reviewers = facts.requested_reviewers
        return RuleResult(a(PRState.NEEDS_FIRST_REVIEW, WaitingOn.REVIEWER, reviewers,
                            "No one has reviewed this PR yet." if reviewers
                            else "No one has reviewed this PR yet and no reviewer is assigned.",
                            "Review the PR." if reviewers else "Assign a reviewer."))

    # Reviewed with comments only, or approved but mergeability unknown: let the LLM read the conversation.
    return RuleResult(a(PRState.DISCUSSION_STALLED, WaitingOn.REVIEWER, _reviewers_to_ping(facts),
                        "The PR has review comments but no final verdict.",
                        "Approve or request changes."), needs_llm=True)
