from __future__ import annotations

from datetime import datetime

from sentinel.models import Assessment, PRState, WaitingOn

COMMENT_MARKER = "<!-- pr-sentinel -->"

STATE_TITLES = {
    PRState.DRAFT: "Draft",
    PRState.CI_FAILING: "CI failing",
    PRState.CI_PENDING: "CI running",
    PRState.MERGE_CONFLICT: "Merge conflict",
    PRState.NEEDS_FIRST_REVIEW: "Needs a first review",
    PRState.CHANGES_REQUESTED: "Changes requested",
    PRState.FEEDBACK_ADDRESSED: "Feedback addressed",
    PRState.READY_TO_MERGE: "Ready to merge",
    PRState.DISCUSSION_STALLED: "Discussion stalled",
    PRState.ABANDONED: "Inactive",
}

WAITING_TITLES = {
    WaitingOn.AUTHOR: "the author",
    WaitingOn.REVIEWER: "review",
    WaitingOn.MAINTAINER: "a maintainer",
    WaitingOn.NOBODY: "nobody",
}


def mention(login: str) -> str:
    return login.removeprefix("team:") if login.startswith("team:") else f"@{login}"


def format_comment(a: Assessment, now: datetime) -> str:
    """The single PR Sentinel comment on a PR; edited in place on later runs."""
    people = " ".join(mention(p) for p in a.people)
    evidence = " ".join(f"[{i}]({url})" for i, url in enumerate(a.evidence[:5], 1))
    footer = [f"confidence {round(a.confidence * 100)}%", f"updated {now:%Y-%m-%d %H:%M} UTC"]
    if evidence:
        footer.insert(0, f"evidence {evidence}")
    return "\n".join([
        COMMENT_MARKER,
        "### 🛡️ PR Sentinel",
        f"**Status:** {STATE_TITLES[a.state]} · waiting on {WAITING_TITLES[a.waiting_on]}",
        f"**Next step:** {(people + ' ') if people else ''}{a.next_step}",
        f"**Why:** {a.reason}",
        "",
        f"<sub>{' · '.join(footer)}</sub>",
    ])


def format_digest(repo: str, entries: list[dict], escalation: bool = False) -> str:
    """One Slack message for the run, grouped by the person who should act."""
    by_person: dict[str, list[dict]] = {}
    for entry in entries:
        for person in entry["people"] or ["unassigned"]:
            by_person.setdefault(person, []).append(entry)

    title = "🚨 PR Sentinel escalations" if escalation else "🛡️ PR Sentinel"
    lines = [f"*{title} — {repo}*"]
    for person in sorted(by_person):
        items = by_person[person]
        lines.append(f"\n*{mention(person) if person != 'unassigned' else 'Unassigned'}* ({len(items)})")
        for e in items:
            lines.append(f"• <{e['url']}|#{e['number']} {e['title']}> — {e['next_step']} "
                         f"_({STATE_TITLES[PRState(e['state'])]}, {e['inactivity_days']}d)_")
    return "\n".join(lines)
