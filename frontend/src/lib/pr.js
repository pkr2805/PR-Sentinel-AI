const ESCALATE_AFTER_DAYS = 7;

export function prPath(pr) {
    return `/prs/${encodeURIComponent(pr.id)}`;
}

/** How close a PR is to escalation, as a 0–100 meter. */
export function urgency(pr) {
    return Math.min(100, Math.round(((pr.inactivityDays || 0) / ESCALATE_AFTER_DAYS) * 100));
}
