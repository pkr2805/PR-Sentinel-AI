/** localStorage that never throws (private windows, blocked storage). */
export function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function save(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage unavailable */
    }
}
