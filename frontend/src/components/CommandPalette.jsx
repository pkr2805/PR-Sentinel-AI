import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Search, LayoutGrid, GitPullRequest, Activity, FolderGit2, Workflow, Radar, Sun, Moon, Plus, CornerDownLeft, Layers,
} from 'lucide-react';
import { useApp } from '../context/app-context';
import { getPRs } from '../services/api';
import { useResource } from '../lib/useResource';
import { stateOf } from '../lib/states';
import { prPath } from '../lib/pr';
import { ToneIcon } from './ui/Chip';

function PaletteBody({ onClose }) {
    const app = useApp();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const fetchPRs = useCallback(() => getPRs(), []);
    const { data: prs = [] } = useResource(fetchPRs, []);

    const items = useMemo(() => {
        const go = (path) => () => navigate(path);
        const base = [
            { group: 'Go to', label: 'Overview', icon: LayoutGrid, run: go('/') },
            { group: 'Go to', label: 'Pull requests', icon: GitPullRequest, run: go('/prs') },
            { group: 'Go to', label: 'Activity', icon: Activity, run: go('/activity') },
            { group: 'Go to', label: 'Repositories', icon: FolderGit2, run: go('/repos') },
            { group: 'Go to', label: 'How it works', icon: Workflow, run: go('/workflow') },
            { group: 'Actions', label: app.scan.running ? 'Scan in progress…' : 'Run a scan now', icon: Radar, run: app.runScan, hint: app.selectedRepo?.fullName || 'all repositories' },
            { group: 'Actions', label: 'Add a repository', icon: Plus, run: go('/repos?add=1') },
            { group: 'Actions', label: `Switch to ${app.theme === 'dark' ? 'light' : 'dark'} theme`, icon: app.theme === 'dark' ? Sun : Moon, run: app.toggleTheme },
            { group: 'Repository', label: 'All repositories', icon: Layers, run: () => app.setRepoId(null) },
            ...app.repos.map((r) => ({ group: 'Repository', label: r.fullName, icon: FolderGit2, run: () => app.setRepoId(r.id), mono: true })),
            ...prs.map((pr) => {
                const st = stateOf(pr);
                return { group: 'Pull requests', label: pr.title, hint: `${pr.repoName} #${pr.number} · ${st.label}`, pr, st, run: go(prPath(pr)), keywords: `${pr.number} ${pr.author} ${pr.repoName}` };
            }),
        ];
        const q = query.trim().toLowerCase();
        if (!q) return base.filter((i) => i.group !== 'Pull requests').concat(base.filter((i) => i.group === 'Pull requests').slice(0, 5));
        return base.filter((i) => `${i.label} ${i.hint || ''} ${i.keywords || ''}`.toLowerCase().includes(q));
    }, [query, prs, app, navigate]);

    const choose = (item) => {
        onClose();
        item?.run();
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); }
        if (e.key === 'Escape') onClose();
    };

    let lastGroup = null;
    return (
        <motion.div className="palette" onMouseDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 480, damping: 36 }}>
            <div className="palette-input">
                <Search size={18} className="muted" />
                <input autoFocus value={query} placeholder="Search pull requests, pages and actions…"
                    onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} />
                <span className="kbd">esc</span>
            </div>
            <div className="palette-list">
                {items.length === 0 && <div className="muted" style={{ padding: 24, textAlign: 'center' }}>No results for “{query}”</div>}
                {items.map((item, i) => {
                    const header = item.group !== lastGroup ? <div className="palette-group">{item.group}</div> : null;
                    lastGroup = item.group;
                    return (
                        <div key={`${item.group}-${item.label}-${i}`}>
                            {header}
                            <button type="button" className="palette-item" data-active={i === active}
                                onMouseMove={() => setActive(i)} onClick={() => choose(item)}>
                                {item.st ? <ToneIcon tone={item.st.tone} icon={item.st.icon} /> : (
                                    <span className="tone-icon" data-tone="neutral"><item.icon size={16} /></span>
                                )}
                                <div className="col" style={{ flex: 1 }}>
                                    <span className={`truncate ${item.mono ? 'mono' : ''}`}>{item.label}</span>
                                    {item.hint && <span className="muted truncate" style={{ fontSize: 12 }}>{item.hint}</span>}
                                </div>
                                {i === active && <CornerDownLeft size={14} className="faint" />}
                            </button>
                        </div>
                    );
                })}
            </div>
            <div className="palette-footer">
                <span className="row" style={{ gap: 6 }}><span className="kbd">↑</span><span className="kbd">↓</span>navigate</span>
                <span className="row" style={{ gap: 6 }}><span className="kbd">↵</span>open</span>
                <span className="spacer" />
                <span className="row" style={{ gap: 6 }}><span className="kbd">⌘</span><span className="kbd">K</span>anywhere</span>
            </div>
        </motion.div>
    );
}

export default function CommandPalette() {
    const { paletteOpen, setPaletteOpen } = useApp();
    const close = useCallback(() => setPaletteOpen(false), [setPaletteOpen]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen((open) => !open);
            } else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
                e.preventDefault();
                setPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setPaletteOpen]);

    return (
        <AnimatePresence>
            {paletteOpen && (
                <motion.div className="backdrop" onMouseDown={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <PaletteBody onClose={close} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
