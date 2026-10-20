import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data with `fetcher` (keep it stable with useCallback) and reloads whenever it or `key` changes.
 * Pass the app's dataVersion as `key` to reload after scans and edits. Returns { data, loading, error, refetch }.
 */
export function useResource(fetcher, initial, key) {
    const [state, setState] = useState({ data: initial, loading: true, error: null });
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;
        fetcher()
            .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
            .catch((err) => { if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message })); });
        return () => { cancelled = true; };
    }, [fetcher, nonce, key]);

    const refetch = useCallback(() => {
        setState((s) => ({ ...s, loading: true }));
        setNonce((n) => n + 1);
    }, []);

    return { ...state, refetch };
}

/** Current time, refreshed every `intervalMs`, for relative timestamps. */
export function useNow(intervalMs = 60000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}
