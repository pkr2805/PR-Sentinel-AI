from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sentinel.config import SentinelConfig
from sentinel.messages import format_comment, format_digest
from sentinel.models import Action, ActionKind, Assessment, PRMemory, PRState, WaitingOn

LABEL_PREFIX = "sentinel:"
STATE_LABELS = {
    WaitingOn.AUTHOR: "sentinel:waiting-on-author",
    WaitingOn.REVIEWER: "sentinel:waiting-on-review",
    WaitingOn.MAINTAINER: "sentinel:ready-to-merge",
}
ALL_LABELS = sorted(set(STATE_LABELS.values()))


def label_for(a: Assessment) -> Optional[str]:
    if a.state == PRState.DRAFT:
        return None
    return STATE_LABELS.get(a.waiting_on)


def apply_escalation(a: Assessment, config: SentinelConfig) -> Assessment:
    """Marks PRs that have waited on someone for too long."""
    escalate = (a.state not in (PRState.DRAFT, PRState.CI_PENDING) and a.waiting_on != WaitingOn.NOBODY
                and a.inactivity_days >= config.escalate_after_days)
    return a.model_copy(update={"escalate": escalate})


def in_quiet_hours(now: datetime, quiet: Optional[tuple[int, int]]) -> bool:
    if not quiet:
        return False
    start, end = quiet
    hour = now.hour
    return start <= hour < end if start <= end else hour >= start or hour < end


def is_notifiable(a: Assessment, config: SentinelConfig) -> bool:
    if a.state in (PRState.DRAFT, PRState.CI_PENDING) or a.waiting_on == WaitingOn.NOBODY:
        return False
    # Ready-to-merge is worth saying straight away; everything else only once the PR is stale.
    return a.state == PRState.READY_TO_MERGE or a.inactivity_days >= config.stale_after_days


def is_due(a: Assessment, memory: Optional[PRMemory], config: SentinelConfig, now: datetime) -> bool:
    """Notify on a new state, or again after the reminder interval."""
    if memory is None or memory.last_notified_at is None or memory.last_notified_state != a.state:
        return True
    return now - memory.last_notified_at >= timedelta(hours=config.reminder_interval_hours)


def plan_actions(assessments: list[Assessment], memory: dict[str, PRMemory], config: SentinelConfig,
                 now: datetime) -> list[Action]:
    actions: list[Action] = []
    digest: list[dict] = []
    escalations: list[dict] = []
    quiet = in_quiet_hours(now, config.quiet_hours_utc)

    for a in assessments:
        mem = memory.get(a.pr_id)

        # Labels mirror the current state; they're not notifications, so quiet hours don't apply.
        if config.enable_labels:
            label = label_for(a)
            previous = label_for(mem.assessment) if mem and mem.assessment else "unknown"
            if label != previous:
                actions.append(Action(kind=ActionKind.LABEL, repo=a.repo, pr_id=a.pr_id, number=a.number,
                                      payload={"add": [label] if label else [],
                                               "remove": [x for x in ALL_LABELS if x != label]}))

        if quiet or not is_notifiable(a, config) or not is_due(a, mem, config, now):
            continue

        needs_approval = a.escalate and config.require_approval_for_escalation
        if config.enable_pr_comments:
            actions.append(Action(kind=ActionKind.PR_COMMENT, repo=a.repo, pr_id=a.pr_id, number=a.number,
                                  payload={"body": format_comment(a, now), "state": a.state.value},
                                  requires_approval=needs_approval))
        entry = {"pr_id": a.pr_id, "number": a.number, "title": a.title, "url": a.url, "people": a.people,
                 "next_step": a.next_step, "state": a.state.value, "inactivity_days": a.inactivity_days}
        (escalations if a.escalate else digest).append(entry)

    if config.enable_slack_digest:
        repo = assessments[0].repo if assessments else ""
        for entries, escalation in ((digest, False), (escalations, True)):
            if entries:
                actions.append(Action(
                    kind=ActionKind.SLACK_DIGEST, repo=repo,
                    payload={"text": format_digest(repo, entries, escalation), "channel": config.slack_channel,
                             "prs": {e["pr_id"]: e["state"] for e in entries}, "escalation": escalation},
                    requires_approval=escalation and config.require_approval_for_escalation,
                ))
    return actions


def notified_pr_ids(actions_and_statuses: list[tuple[Action, str]]) -> dict[str, str]:
    """PR ids that were notified this run (or queued for approval), mapped to the notified state."""
    notified = {}
    for action, status in actions_and_statuses:
        if status not in ("executed", "pending_approval"):
            continue
        if action.kind == ActionKind.PR_COMMENT:
            notified[action.pr_id] = action.payload["state"]
        elif action.kind == ActionKind.SLACK_DIGEST:
            notified.update(action.payload["prs"])
    return notified
