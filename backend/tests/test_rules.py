import pytest

from sentinel.config import SentinelConfig
from sentinel.models import PRState, WaitingOn
from sentinel.rules import classify, should_skip
from tests.factories import NOW, days_ago, make_facts, review, thread

CONFIG = SentinelConfig()


def state_of(facts):
    result = classify(facts, CONFIG, NOW)
    return result.assessment.state, result.assessment.waiting_on, result.needs_llm, result.assessment


@pytest.mark.parametrize("overrides, expected_state, expected_waiting", [
    ({"is_draft": True}, PRState.DRAFT, WaitingOn.AUTHOR),
    ({"updated_at": days_ago(30)}, PRState.ABANDONED, WaitingOn.AUTHOR),
    ({"mergeable": "CONFLICTING"}, PRState.MERGE_CONFLICT, WaitingOn.AUTHOR),
    ({"ci_state": "FAILURE"}, PRState.CI_FAILING, WaitingOn.AUTHOR),
    ({"requested_reviewers": ["bob"]}, PRState.NEEDS_FIRST_REVIEW, WaitingOn.REVIEWER),
])
def test_certain_states(overrides, expected_state, expected_waiting):
    state, waiting, needs_llm, _ = state_of(make_facts(**overrides))
    assert (state, waiting, needs_llm) == (expected_state, expected_waiting, False)


def test_conflict_wins_over_failing_ci():
    state, *_ = state_of(make_facts(mergeable="CONFLICTING", ci_state="FAILURE"))
    assert state == PRState.MERGE_CONFLICT


def test_changes_requested_and_nothing_pushed():
    state, waiting, needs_llm, a = state_of(make_facts(
        last_commit_at=days_ago(5), reviews=[review("bob", "CHANGES_REQUESTED", 3)]))
    assert (state, waiting, needs_llm) == (PRState.CHANGES_REQUESTED, WaitingOn.AUTHOR, False)
    assert a.people == ["alice"]
    assert a.evidence  # links the review


def test_pushed_after_changes_requested_asks_llm():
    state, waiting, needs_llm, a = state_of(make_facts(
        last_commit_at=days_ago(1), reviews=[review("bob", "CHANGES_REQUESTED", 3)]))
    assert (state, waiting, needs_llm) == (PRState.FEEDBACK_ADDRESSED, WaitingOn.REVIEWER, True)
    assert a.people == ["bob"]


def test_approved_green_mergeable_is_ready():
    state, waiting, needs_llm, a = state_of(make_facts(reviews=[review("bob", "APPROVED", 1)]))
    assert (state, waiting, needs_llm) == (PRState.READY_TO_MERGE, WaitingOn.MAINTAINER, False)


def test_approved_but_ci_running():
    state, waiting, *_ = state_of(make_facts(ci_state="PENDING", reviews=[review("bob", "APPROVED", 1)]))
    assert (state, waiting) == (PRState.CI_PENDING, WaitingOn.NOBODY)


def test_later_comment_does_not_hide_a_verdict():
    reviews = [review("bob", "CHANGES_REQUESTED", 3), review("bob", "COMMENTED", 2)]
    state, *_ = state_of(make_facts(last_commit_at=days_ago(5), reviews=reviews))
    assert state == PRState.CHANGES_REQUESTED


def test_new_approval_replaces_changes_requested():
    reviews = [review("bob", "CHANGES_REQUESTED", 3), review("bob", "APPROVED", 1)]
    state, *_ = state_of(make_facts(reviews=reviews))
    assert state == PRState.READY_TO_MERGE


def test_open_threads_ask_llm():
    facts = make_facts(reviews=[review("bob", "APPROVED", 2)], threads=[thread(("bob", 2, "nit: rename?"))])
    state, _, needs_llm, a = state_of(facts)
    assert state == PRState.DISCUSSION_STALLED and needs_llm
    assert a.evidence == ["https://github.com/c/bob-2"]


def test_comment_only_review_asks_llm():
    state, waiting, needs_llm, a = state_of(make_facts(reviews=[review("bob", "COMMENTED", 2, "Looks ok?")]))
    assert (state, waiting, needs_llm) == (PRState.DISCUSSION_STALLED, WaitingOn.REVIEWER, True)
    assert a.people == ["bob"]


def test_authors_own_review_is_ignored():
    state, *_ = state_of(make_facts(reviews=[review("alice", "COMMENTED", 1)]))
    assert state == PRState.NEEDS_FIRST_REVIEW


@pytest.mark.parametrize("overrides, reason", [
    ({"author": "dependabot[bot]", "author_is_bot": True}, "bot author"),
    ({"labels": ["wip"]}, "ignored label wip"),
    ({"author": "skipme"}, "ignored author"),
])
def test_skips(overrides, reason):
    config = SentinelConfig(ignore_authors=["skipme"])
    assert should_skip(make_facts(**overrides), config) == reason
    assert should_skip(make_facts(), config) is None


def test_cache_key_changes_with_activity():
    base = make_facts()
    assert base.cache_key() == make_facts().cache_key()
    assert base.cache_key() != make_facts(head_sha="new").cache_key()
    assert base.cache_key() != make_facts(reviews=[review("bob", "APPROVED", 1)]).cache_key()
    assert base.cache_key() != make_facts(ci_state="FAILURE").cache_key()
