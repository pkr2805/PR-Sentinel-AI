import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext, SCAN_STEPS } from './app-context';
import { getRepos, triggerAgent } from '../services/api';
import { load, save } from '../lib/storage';

const STEP_MS = 850;

/** "Assessed 0 PRs (…). 1 error(s): Fetching PRs failed: POST /graphql -> 403: {…}" → "Fetching PRs failed (403)" */
function shortError(message = '') {
    const detail = message.split('error(s):')[1] || message;
    const status = detail.match(/-> (\d{3})/)?.[1];
    const first = detail.split(':')[0].trim();
    return status ? `${first} (${status})` : detail.slice(0, 90);
}

export default function AppProvider({ children }) {
    const [theme, setTheme] = useState(() => load('sentinel.theme', 'dark'));
    const [collapsed, setCollapsed] = useState(() => load('sentinel.sidebarCollapsed', false));
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [repoId, setRepoIdState] = useState(() => load('sentinel.repo', null));
    const [repos, setRepos] = useState([]);
    const [reposLoading, setReposLoading] = useState(true);
    const [dataVersion, setDataVersion] = useState(0);
    const [toasts, setToasts] = useState([]);
    const [scan, setScan] = useState({ running: false, step: 0, target: null });
    const toastId = useRef(0);

    // Theme lives on <html> so CSS tokens switch everywhere at once.
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        save('sentinel.theme', theme);
    }, [theme]);

    useEffect(() => { save('sentinel.sidebarCollapsed', collapsed); }, [collapsed]);

    useEffect(() => {
        let cancelled = false;
        getRepos()
            .then((data) => { if (!cancelled) { setRepos(data); setReposLoading(false); } })
            .catch(() => { if (!cancelled) setReposLoading(false); });
        return () => { cancelled = true; };
    }, [dataVersion]);

    const setRepoId = useCallback((id) => {
        setRepoIdState(id || null);
        save('sentinel.repo', id || null);
    }, []);

    const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

    const toast = useCallback((title, { description, tone = 'brand', duration = 5000 } = {}) => {
        toastId.current += 1;
        const id = toastId.current;
        setToasts((list) => [...list.slice(-3), { id, title, description, tone }]);
        if (duration) setTimeout(() => dismissToast(id), duration);
    }, [dismissToast]);

    const refresh = useCallback(() => setDataVersion((v) => v + 1), []);

    const runScan = useCallback(async () => {
        const targets = repoId ? [repoId] : repos.filter((r) => r.active).map((r) => r.id);
        if (targets.length === 0) {
            toast('Nothing to scan', { description: 'Add or resume a repository first.', tone: 'author' });
            return;
        }

        setScan({ running: true, step: 0, target: targets.length === 1 ? targets[0] : `${targets.length} repositories` });
        // The backend runs the whole scan in one request; animate the stages while it works.
        const ticker = setInterval(() => {
            setScan((s) => ({ ...s, step: Math.min(s.step + 1, SCAN_STEPS.length - 1) }));
        }, STEP_MS);

        const results = [];
        for (const id of targets) {
            try {
                const res = await triggerAgent(id);
                results.push({ id, ok: res.status !== 'error' && !/error\(s\)/.test(res.message || ''), message: res.message });
            } catch (err) {
                results.push({ id, ok: false, message: err.message });
            }
        }
        clearInterval(ticker);
        setScan((s) => ({ ...s, step: SCAN_STEPS.length }));
        setTimeout(() => setScan({ running: false, step: 0, target: null }), 900);
        refresh();

        const failed = results.filter((r) => !r.ok);
        if (failed.length === 0) {
            toast(targets.length === 1 ? 'Scan complete' : `Scanned ${targets.length} repositories`, {
                description: results.map((r) => r.message).join(' '),
                tone: 'ready',
                duration: 8000,
            });
        } else {
            toast('Scan finished with problems', {
                description: failed.map((r) => `${r.id}: ${shortError(r.message)}`).join(' · '),
                tone: 'danger',
                duration: 10000,
            });
        }
    }, [repoId, repos, refresh, toast]);

    const value = useMemo(() => ({
        theme,
        toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
        collapsed,
        toggleCollapsed: () => setCollapsed((c) => !c),
        mobileNavOpen,
        setMobileNavOpen,
        paletteOpen,
        setPaletteOpen,
        repos,
        reposLoading,
        repoId,
        setRepoId,
        selectedRepo: repos.find((r) => r.id === repoId) || null,
        dataVersion,
        refresh,
        toasts,
        toast,
        dismissToast,
        scan,
        runScan,
    }), [theme, collapsed, mobileNavOpen, paletteOpen, repos, reposLoading, repoId, setRepoId, dataVersion,
        refresh, toasts, toast, dismissToast, scan, runScan]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
