import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Radar, Timer, Sparkles, Database, Layers, Activity as ActivityIcon, RefreshCw, CircleCheck, TriangleAlert, BellRing } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Segmented from '../components/ui/Segmented';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { Chip, DecisionChip, ToneIcon } from '../components/ui/Chip';
import { stagger, rise } from '../components/ui/motion';
import { useApp } from '../context/app-context';
import { getLogs } from '../services/api';
import { useResource, useNow } from '../lib/useResource';
import { formatDuration, formatDateTime, timeAgo, shortRunId } from '../lib/format';

function Kpi({ icon, tone, label, value, format }) {
    return (
        <motion.div variants={rise} className="card card-pad row" style={{ gap: 14 }}>
            <ToneIcon tone={tone} icon={icon} />
            <div className="col">
                <span style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em' }}><AnimatedNumber value={value} format={format} /></span>
                <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
            </div>
        </motion.div>
    );
}

const pct = (v) => `${Math.round(v)}%`;
const ms = (v) => formatDuration(Math.round(v));

export default function ActivityPage() {
    const { repoId, dataVersion, selectedRepo } = useApp();
    const now = useNow();
    const [kind, setKind] = useState('all');
    const fetchLogs = useCallback(() => getLogs(repoId), [repoId]);
    const { data: logs = [], loading, refetch } = useResource(fetchLogs, [], dataVersion);

    const runs = useMemo(() => logs.filter((l) => l.decision === 'BATCH_RUN'), [logs]);
    const events = useMemo(() => logs.filter((l) => l.decision !== 'BATCH_RUN'), [logs]);
    const shown = kind === 'runs' ? runs : kind === 'events' ? events : logs;

    const totals = useMemo(() => {
        const seen = runs.reduce((s, r) => s + (r.prs_seen || 0), 0);
        const cached = runs.reduce((s, r) => s + (r.prs_cached || 0), 0);
        const timed = runs.filter((r) => r.duration_ms != null);
        return {
            runs: runs.length,
            avgMs: timed.length ? timed.reduce((s, r) => s + r.duration_ms, 0) / timed.length : 0,
            llm: runs.reduce((s, r) => s + (r.llm_calls || 0), 0),
            cacheRate: seen ? (cached / seen) * 100 : 0,
        };
    }, [runs]);

    return (
        <>
            <PageHeader eyebrow={selectedRepo ? selectedRepo.fullName : 'All repositories'} title="Activity"
                subtitle="Every scan and every decision PR Sentinel made."
                actions={<button type="button" className="icon-btn" onClick={refetch} aria-label="Refresh"><RefreshCw size={16} className={loading ? 'spin' : undefined} /></button>} />

            <motion.div className="grid grid-4" variants={stagger(0.06)} initial="hidden" animate="show" style={{ marginBottom: 20 }}>
                <Kpi icon={Radar} tone="brand" label="Scans" value={totals.runs} />
                <Kpi icon={Timer} tone="info" label="Average scan time" value={totals.avgMs} format={ms} />
                <Kpi icon={Sparkles} tone="review" label="AI calls" value={totals.llm} />
                <Kpi icon={Database} tone="ready" label="Unchanged PRs reused" value={totals.cacheRate} format={pct} />
            </motion.div>

            <section className="card" style={{ overflow: 'hidden' }}>
                <div className="card-header">
                    <Segmented id="activity" size="sm" value={kind} onChange={setKind} options={[
                        { value: 'all', label: 'All', count: logs.length },
                        { value: 'runs', label: 'Scans', icon: Radar, count: runs.length },
                        { value: 'events', label: 'Decisions', icon: BellRing, count: events.length },
                    ]} />
                </div>
                {loading && logs.length === 0 ? (
                    <div className="col" style={{ padding: 20, gap: 14 }}>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={18} />)}</div>
                ) : shown.length === 0 ? (
                    <EmptyState icon={ActivityIcon} title="No activity yet">Run a scan from the overview to see it here.</EmptyState>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr><th>Event</th><th>Details</th><th className="hide-sm">Repository</th><th>Result</th><th>When</th></tr>
                            </thead>
                            <motion.tbody key={kind} variants={stagger(0.02)} initial="hidden" animate="show">
                                {shown.map((l) => {
                                    const isRun = l.decision === 'BATCH_RUN';
                                    const ok = l.status === 'success';
                                    return (
                                        <motion.tr key={l.id} variants={rise}>
                                            <td>{isRun ? <Chip tone="brand" icon={Radar} size="sm">Scan</Chip> : <DecisionChip decision={l.decision} size="sm" />}</td>
                                            <td>
                                                {isRun ? (
                                                    <span className="row muted" style={{ gap: 12, fontSize: 13 }}>
                                                        <span className="row" style={{ gap: 4 }}><Layers size={13} />{l.prs_seen ?? 0} PRs</span>
                                                        <span className="row hide-sm" style={{ gap: 4 }}><Database size={13} />{l.prs_cached ?? 0} reused</span>
                                                        <span className="row" style={{ gap: 4 }}><Sparkles size={13} />{l.llm_calls ?? 0} AI</span>
                                                        <span className="row hide-sm" style={{ gap: 4 }}><Timer size={13} />{formatDuration(l.duration_ms)}</span>
                                                        <span className="mono faint hide-sm">{shortRunId(l.id)}</span>
                                                    </span>
                                                ) : (
                                                    <span className="row" style={{ gap: 8 }}>
                                                        <Link to={`/prs/${encodeURIComponent(l.pr_id)}`} className="mono" style={{ color: 'var(--brand-strong)', fontSize: 13 }}>{l.pr_id}</Link>
                                                        {l.slackSent && <Chip tone="info" size="sm" plain icon={BellRing}>notified</Chip>}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="mono muted hide-sm" style={{ fontSize: 12.5 }}>{l.repo_id}</td>
                                            <td>
                                                <span className="row" style={{ gap: 6, fontSize: 13, color: ok ? 'var(--t-ready)' : 'var(--t-author)' }} title={l.error_msg || undefined}>
                                                    {ok ? <CircleCheck size={14} /> : <TriangleAlert size={14} />}{ok ? 'Success' : 'With errors'}
                                                </span>
                                            </td>
                                            <td className="muted tabular" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }} title={formatDateTime(l.timestamp)}>{timeAgo(l.timestamp, now)}</td>
                                        </motion.tr>
                                    );
                                })}
                            </motion.tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
