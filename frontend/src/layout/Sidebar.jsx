import { useCallback } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid, GitPullRequest, Activity, FolderGit2, Workflow, PanelLeftClose, PanelLeftOpen, Sun, Moon, Radar, Plus, X } from 'lucide-react';
import { LogoMark } from '../components/ui/Logo';
import { useApp } from '../context/app-context';
import { getLogs } from '../services/api';
import { useResource, useNow } from '../lib/useResource';
import { timeAgo } from '../lib/format';

function NavItem({ item, collapsed, onNavigate }) {
    const { pathname } = useLocation();
    const active = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
    return (
        <NavLink to={item.path} className="nav-item" data-active={active} title={collapsed ? item.label : undefined} onClick={onNavigate}>
            {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <item.icon size={18} strokeWidth={1.9} />
            <span className="nav-text">{item.label}</span>
            {item.count > 0 && <span className="nav-count tabular" data-tone={item.tone}>{item.count}</span>}
        </NavLink>
    );
}

function RepoList({ onNavigate }) {
    const { repos, repoId, setRepoId } = useApp();
    return (
        <div className="sidebar-repos">
            {repos.map((r) => {
                const active = r.id === repoId;
                return (
                    <button key={r.id} type="button" className="repo-item" data-active={active}
                        onClick={() => { setRepoId(active ? null : r.id); onNavigate(); }}
                        title={active ? 'Show all repositories' : `Show only ${r.fullName}`}>
                        <span className="repo-dot" data-on={r.active} />
                        <span className="truncate mono" style={{ flex: 1 }}>{r.fullName}</span>
                        {active ? <X size={13} className="muted" /> : <span className="faint tabular" style={{ fontSize: 11.5 }}>{r.active ? r.openPRs ?? 0 : 'paused'}</span>}
                    </button>
                );
            })}
            <Link to="/repos?add=1" className="repo-item repo-add" onClick={onNavigate}><Plus size={14} />Add repository</Link>
        </div>
    );
}

function StatusCard({ collapsed }) {
    const { scan, runScan, dataVersion, repos } = useApp();
    const now = useNow(30000);
    const fetchLogs = useCallback(() => getLogs(), []);
    const { data: logs = [] } = useResource(fetchLogs, [], dataVersion);
    const last = logs.find((l) => l.decision === 'BATCH_RUN');
    const watching = repos.filter((r) => r.active).length;

    if (collapsed) {
        return (
            <button type="button" className="icon-btn status-mini" onClick={runScan} disabled={scan.running}
                title={scan.running ? 'Scanning…' : `Scan now · last scan ${last ? timeAgo(last.timestamp, now) : 'never'}`}>
                <Radar size={18} className={scan.running ? 'spin' : undefined} />
            </button>
        );
    }
    return (
        <div className="status-card">
            <div className="row" style={{ gap: 8 }}>
                <span className="live-dot" data-tone={scan.running ? 'brand' : undefined} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{scan.running ? 'Scanning…' : `Watching ${watching} ${watching === 1 ? 'repo' : 'repos'}`}</span>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
                {last ? `Last scan ${timeAgo(last.timestamp, now)}${last.status !== 'success' ? ' · with errors' : ''}` : 'No scans yet'}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={runScan} disabled={scan.running}>
                <Radar size={14} className={scan.running ? 'spin' : undefined} />{scan.running ? 'Scanning' : 'Scan now'}
            </button>
        </div>
    );
}

function ThemeSwitch({ collapsed }) {
    const { theme, toggleTheme } = useApp();
    if (collapsed) {
        return (
            <button type="button" className="icon-btn" onClick={toggleTheme} title="Toggle theme" style={{ alignSelf: 'center' }}>
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
        );
    }
    return (
        <div className="theme-switch" role="radiogroup" aria-label="Theme">
            {[['light', Sun, 'Light'], ['dark', Moon, 'Dark']].map(([value, Icon, label]) => (
                <button key={value} type="button" role="radio" aria-checked={theme === value} data-active={theme === value}
                    onClick={() => { if (theme !== value) toggleTheme(); }}>
                    {theme === value && <motion.span layoutId="theme-pill" className="theme-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <Icon size={14} /><span>{label}</span>
                </button>
            ))}
        </div>
    );
}

export default function Sidebar({ pendingCount = 0 }) {
    const { collapsed, toggleCollapsed, setMobileNavOpen, repos } = useApp();
    const close = () => setMobileNavOpen(false);
    const openPRs = repos.reduce((sum, r) => sum + (r.active ? r.openPRs || 0 : 0), 0);

    const monitor = [
        { label: 'Overview', path: '/', icon: LayoutGrid, count: pendingCount, tone: 'danger' },
        { label: 'Pull requests', path: '/prs', icon: GitPullRequest, count: openPRs },
        { label: 'Activity', path: '/activity', icon: Activity },
    ];
    const setup = [
        { label: 'Repositories', path: '/repos', icon: FolderGit2, count: repos.length },
        { label: 'How it works', path: '/workflow', icon: Workflow },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-head">
                <Link to="/" className="brand" onClick={close}>
                    <span className="brand-mark"><LogoMark /></span>
                    <span className="brand-text">
                        <span className="brand-name">PR Sentinel</span>
                        <span className="brand-sub">Pull request intelligence</span>
                    </span>
                </Link>
                <button type="button" className="icon-btn icon-btn-sm desktop-only collapse-btn" onClick={toggleCollapsed}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
                <button type="button" className="icon-btn icon-btn-sm mobile-only" onClick={close} aria-label="Close navigation"><X size={16} /></button>
            </div>

            <nav className="sidebar-scroll">
                <div className="nav-label">Monitor</div>
                {monitor.map((item) => <NavItem key={item.path} item={item} collapsed={collapsed} onNavigate={close} />)}
                <div className="nav-label">Setup</div>
                {setup.map((item) => <NavItem key={item.path} item={item} collapsed={collapsed} onNavigate={close} />)}
                {!collapsed && repos.length > 0 && (
                    <>
                        <div className="nav-label">Watching</div>
                        <RepoList onNavigate={close} />
                    </>
                )}
            </nav>

            <div className="sidebar-footer">
                <StatusCard collapsed={collapsed} />
                <ThemeSwitch collapsed={collapsed} />
            </div>
        </aside>
    );
}
