from datetime import timedelta

from sentinel.config import SentinelConfig
from sentinel.models import ActionKind, PRMemory, PRState
from sentinel.planner import apply_escalation, in_quiet_hours, notified_pr_ids, plan_actions
from sentinel.rules import classify
from tests.factories import NOW, days_ago, make_facts, review

CONFIG = SentinelConfig(dry_run=False)


def assess(config=CONFIG, **overrides):
    return apply_escalation(classify(make_facts(**overrides), config, NOW).assessment, config)


def kinds(actions):
    return [a.kind for a in actions]


def test_stale_pr_gets_label_comment_and_digest():
    a = assess(requested_reviewers=["bob"])  # 4 days inactive
    actions = plan_actions([a], {}, CONFIG, NOW)

    assert kinds(actions) == [ActionKind.LABEL, ActionKind.PR_COMMENT, ActionKind.SLACK_DIGEST]
    label, comment, digest = actions
    assert label.payload["add"] == ["sentinel:waiting-on-review"]
    assert "sentinel:waiting-on-author" in label.payload["remove"]
    assert "@bob Review the PR." in comment.payload["body"]
    assert "<!-- pr-sentinel -->" in comment.payload["body"]
    assert "*@bob* (1)" in digest.payload["text"]
    assert not any(x.requires_approval for x in actions)


def test_fresh_pr_only_gets_a_label():
    a = assess(updated_at=days_ago(0.5), requested_reviewers=["bob"])
    assert kinds(plan_actions([a], {}, CONFIG, NOW)) == [ActionKind.LABEL]


def test_ready_to_merge_is_notified_even_when_fresh():
    a = assess(updated_at=days_ago(0.2), reviews=[review("bob", "APPROVED", 0.2)])
    assert ActionKind.PR_COMMENT in kinds(plan_actions([a], {}, CONFIG, NOW))


def test_drafts_and_ci_pending_are_never_notified():
    draft = assess(is_draft=True, updated_at=days_ago(5))
    pending = assess(ci_state="PENDING", reviews=[review("bob", "APPROVED", 4)])
    actions = plan_actions([draft, pending], {}, CONFIG, NOW)
    assert ActionKind.PR_COMMENT not in kinds(actions)
    assert ActionKind.SLACK_DIGEST not in kinds(actions)


def test_same_state_is_not_repeated_until_the_reminder_is_due():
    a = assess(requested_reviewers=["bob"])
    recent = PRMemory(assessment=a, state=a.state, last_notified_state=a.state, last_notified_at=NOW - timedelta(hours=3))
    assert plan_actions([a], {a.pr_id: recent}, CONFIG, NOW) == []  # label unchanged, already told 3h ago

    old = recent.model_copy(update={"last_notified_at": NOW - timedelta(hours=25)})
    assert ActionKind.PR_COMMENT in kinds(plan_actions([a], {a.pr_id: old}, CONFIG, NOW))


def test_state_change_notifies_immediately():
    before = assess(requested_reviewers=["bob"])
    after = assess(reviews=[review("bob", "APPROVED", 0.1)])
    memory = PRMemory(assessment=before, state=before.state, last_notified_state=before.state,
                      last_notified_at=NOW - timedelta(hours=1))
    actions = plan_actions([after], {after.pr_id: memory}, CONFIG, NOW)
    assert kinds(actions) == [ActionKind.LABEL, ActionKind.PR_COMMENT, ActionKind.SLACK_DIGEST]
    assert actions[0].payload["add"] == ["sentinel:ready-to-merge"]


def test_escalations_wait_for_approval_and_get_their_own_digest():
    a = assess(updated_at=days_ago(9), requested_reviewers=["bob"])
    assert a.escalate
    actions = plan_actions([a], {}, CONFIG, NOW)
    comment = next(x for x in actions if x.kind == ActionKind.PR_COMMENT)
    digest = next(x for x in actions if x.kind == ActionKind.SLACK_DIGEST)
    assert comment.requires_approval and digest.requires_approval
    assert digest.payload["escalation"] and "escalations" in digest.payload["text"]

    no_gate = SentinelConfig(dry_run=False, require_approval_for_escalation=False)
    assert not any(x.requires_approval for x in plan_actions([a], {}, no_gate, NOW))


def test_quiet_hours_hold_notifications_but_not_labels():
    config = SentinelConfig(quiet_hours_utc=(22, 7))
    a = assess(config, requested_reviewers=["bob"])
    assert kinds(plan_actions([a], {}, config, NOW.replace(hour=23))) == [ActionKind.LABEL]
    assert in_quiet_hours(NOW.replace(hour=3), (22, 7))
    assert not in_quiet_hours(NOW.replace(hour=12), (22, 7))
    assert in_quiet_hours(NOW.replace(hour=13), (12, 14))


def test_features_can_be_switched_off():
    config = SentinelConfig(enable_labels=False, enable_pr_comments=False, enable_slack_digest=False)
    assert plan_actions([assess(config, requested_reviewers=["bob"])], {}, config, NOW) == []


def test_notified_pr_ids_counts_comments_digests_and_pending():
    a = assess(updated_at=days_ago(9), requested_reviewers=["bob"])
    actions = plan_actions([a], {}, CONFIG, NOW)
    statuses = [(x, "pending_approval" if x.requires_approval else "executed") for x in actions]
    assert notified_pr_ids(statuses) == {a.pr_id: PRState.NEEDS_FIRST_REVIEW.value}
    assert notified_pr_ids([(x, "dry_run") for x in actions]) == {}
