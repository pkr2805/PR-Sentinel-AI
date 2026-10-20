import {
    PencilLine, CircleX, LoaderCircle, GitCompareArrows, Eye, MessageSquareWarning, MessageSquareReply,
    GitMerge, MessagesSquare, Hourglass, UserRound, Clock3, Siren, Radar,
} from 'lucide-react';

/** What each PR state means, how it looks, and who it usually waits on. */
export const STATES = {
    DRAFT: { label: 'Draft', icon: PencilLine, tone: 'neutral', hint: 'Still being written' },
    CI_FAILING: { label: 'CI failing', icon: CircleX, tone: 'danger', hint: 'Checks fail on the latest commit' },
    CI_PENDING: { label: 'CI running', icon: LoaderCircle, tone: 'info', spin: true, hint: 'Approved, waiting for checks' },
    MERGE_CONFLICT: { label: 'Merge conflict', icon: GitCompareArrows, tone: 'danger', hint: 'Branch conflicts with base' },
    NEEDS_FIRST_REVIEW: { label: 'Needs review', icon: Eye, tone: 'review', hint: 'Nobody has reviewed it yet' },
    CHANGES_REQUESTED: { label: 'Changes requested', icon: MessageSquareWarning, tone: 'author', hint: 'Author has feedback to address' },
    FEEDBACK_ADDRESSED: { label: 'Feedback addressed', icon: MessageSquareReply, tone: 'review', hint: 'Ready for a re-review' },
    READY_TO_MERGE: { label: 'Ready to merge', icon: GitMerge, tone: 'ready', hint: 'Approved, green, no conflicts' },
    DISCUSSION_STALLED: { label: 'Discussion stalled', icon: MessagesSquare, tone: 'author', hint: 'An open thread is waiting' },
    ABANDONED: { label: 'Inactive', icon: Hourglass, tone: 'neutral', hint: 'No activity for weeks' },
};

export const WAITING = {
    reviewer: { label: 'Reviewers', long: 'Waiting on review', icon: Eye, tone: 'review' },
    author: { label: 'Authors', long: 'Waiting on the author', icon: UserRound, tone: 'author' },
    maintainer: { label: 'Maintainers', long: 'Waiting on a maintainer', icon: GitMerge, tone: 'ready' },
    nobody: { label: 'Nobody', long: 'Nothing to do yet', icon: Clock3, tone: 'neutral' },
};

/** Legacy decisions, still used by overrides and the run history. */
export const DECISIONS = {
    ASK_TO_MERGE: { label: 'Ask to merge', icon: GitMerge, tone: 'ready' },
    PING_REVIEWER: { label: 'Ping reviewer', icon: Eye, tone: 'review' },
    PING_AUTHOR: { label: 'Ping author', icon: UserRound, tone: 'author' },
    ESCALATE: { label: 'Escalate', icon: Siren, tone: 'danger' },
    IGNORE: { label: 'No action', icon: Clock3, tone: 'neutral' },
    PENDING: { label: 'Pending', icon: Clock3, tone: 'neutral' },
    BATCH_RUN: { label: 'Scan', icon: Radar, tone: 'brand' },
};

const DECISION_TO_STATE = {
    ASK_TO_MERGE: 'READY_TO_MERGE',
    PING_REVIEWER: 'NEEDS_FIRST_REVIEW',
    PING_AUTHOR: 'CHANGES_REQUESTED',
};

export function stateOf(pr) {
    return STATES[pr.state] || STATES[DECISION_TO_STATE[pr.decision]] || {
        label: DECISIONS[pr.decision]?.label || 'Unknown', icon: Clock3, tone: 'neutral', hint: '',
    };
}

export function isEscalated(pr) {
    return pr.decision === 'ESCALATE' || pr.escalationLevel > 0;
}

export function waitingOf(pr) {
    return WAITING[pr.waitingOn] || WAITING.nobody;
}

/** Higher = needs attention sooner. */
export function priority(pr) {
    let score = pr.inactivityDays || 0;
    if (isEscalated(pr)) score += 1000;
    if (pr.state === 'READY_TO_MERGE') score += 500;
    if (pr.state === 'CI_FAILING' || pr.state === 'MERGE_CONFLICT') score += 200;
    if (pr.waitingOn === 'nobody' || pr.state === 'DRAFT') score -= 400;
    return score;
}
