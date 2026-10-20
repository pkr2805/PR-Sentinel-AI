const UNITS = [
    ['y', 365 * 24 * 3600], ['mo', 30 * 24 * 3600], ['w', 7 * 24 * 3600],
    ['d', 24 * 3600], ['h', 3600], ['m', 60],
];

/** "3d ago" style relative time. `now` is passed in so components stay pure. */
export function timeAgo(value, now) {
    if (!value) return '—';
    const seconds = Math.max(0, Math.round((now - toDate(value).getTime()) / 1000));
    if (seconds < 45) return 'just now';
    for (const [unit, size] of UNITS) {
        if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
    }
    return `${Math.max(1, Math.round(seconds / 60))}m ago`;
}

/** The API returns naive UTC timestamps; treat them as UTC. */
export function toDate(value) {
    if (value instanceof Date) return value;
    const s = String(value);
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

export function formatDateTime(value) {
    if (!value) return '—';
    return toDate(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(ms) {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms} ms`;
    const s = ms / 1000;
    return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function initials(name = '') {
    const clean = name.replace(/^team:/, '').replace(/\[bot\]$/, '');
    const parts = clean.split(/[\s._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function plural(n, word, pluralWord = `${word}s`) {
    return `${n} ${n === 1 ? word : pluralWord}`;
}

export function shortRunId(id = '') {
    return id.slice(0, 8);
}
