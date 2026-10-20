import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Sparkles, ListChecks, Database, Clock3, Plus, Minus, BellRing, ArrowRight, SearchX, Undo2 } from 'lucide-react';
import { StateChip, EscalationChip, ToneIcon, Chip } from '../components/ui/Chip';
import { Avatar } from '../components/ui/Avatar';
import RunTimeline from '../components/RunTimeline';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { stagger, rise, ease } from '../components/ui/motion';
import { useApp } from '../context/app-context';
import { getPRById, getLogs, overrideDecision } from '../services/api';
import { useResource, useNow } from '../lib/useResource';
import { stateOf, waitingOf, DECISIONS } from '../lib/states';
import { timeAgo } from '../lib/format';

const SOURCES = {
    llm: { label: 'AI judgement', icon: Sparkles, tone: 'brand' },
    rules: { label: 'Rule engine', icon: ListChecks, tone: 'info' },
    cache: { label: 'Unchanged since last scan', icon: Database, tone: 'neutral' },
};

function ConfidenceRing({ value = 1 }) {
    const r = 22;
    const c = 2 * Math.PI * r;
    const pct = Math.round(value * 100);
    const tone = value >= 0.8 ? 'ready' : value >= 0.6 ? 'author' : 'danger';
    return (
        <div data-tone={tone} style={{ position: 'relative', width: 56, height: 56 }} title={`Confidence ${pct}%`}>
            <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
                <motion.circle cx="28" cy="28" r={r} fill="none" stroke="var(--c)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }}
                    transition={{ duration: 1.1, ease, delay: 0.2 }} transform="rotate(-90 28 28)" />
            </svg>
            <span className="tabular" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 650 }}>{pct}%</span>
        </div>
    );
}

function Metric({ icon: Icon, label, value, tone }) {
    return (
        <motion.div variants={rise} className="card card-pad" data-tone={tone} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--c, var(--muted))' }}><Icon size={18} /></span>
            <div className="col">
                <span style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em' }} className="tabular">{value}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
            </div>
        </motion.div>
    );
}

function OverrideCard({ pr, onSaved }) {
    const { toast } = useApp();
    const [choice, setChoice] = useState(pr.decision);
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try {
            await overrideDecision(pr.id, choice);
            toast('Decision updated', { description: `${pr.repoName} #${pr.number} → ${DECISIONS[choice]?.label}. The next scan re-assesses it.`, tone: 'ready' });
            onSaved();
        } catch (err) {
            toast('Could not update the decision', { description: err.message, tone: 'danger' });
        } finally {
            setSaving(false);
        }
    };
    return (
        <section className="card card-pad">
            <div className="row" style={{ marginBottom: 12 }}>
                <Undo2 size={16} className="muted" />
                <div className="card-title">Override decision</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
                <select className="select" value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Decision">
                    {['ASK_TO_MERGE', 'PING_REVIEWER', 'PING_AUTHOR', 'ESCALATE', 'IGNORE'].map((d) => <option key={d} value={d}>{DECISIONS[d].label}</option>)}
                </select>
                <button type="button" className="btn btn-secondary" disabled={saving || choice === pr.decision} onClick={save}>Apply</button>
            </div>
        </section>
    );
}

export default function PRDetail() {
    const { id } = useParams();
    const { dataVersion } = useApp();
    const now = useNow();
    const fetchPR = useCallback(() => getPRById(id), [id]);
    const fetchLogs = useCallback(() => getLogs(null, id), [id]);
    const { data: pr, loading, error, refetch } = useResource(fetchPR, null, dataVersion);
    const { data: logs = [] } = useResource(fetchLogs, [], dataVersion);

    if (loading && !pr) {
        return (
            <div className="col" style={{ gap: 16 }}>
                <Skeleton width={120} />
                <Skeleton width="55%" height={30} />
                <Skeleton height={220} radius={16} />
            </div>
        );
    }
    if (error || !pr) {
        return (
            <div className="card">
                <EmptyState icon={SearchX} title="Pull request not found" action={<Link to="/prs" className="btn btn-secondary">Back to pull requests</Link>}>
                    It may have been merged or closed since the last scan.
                </EmptyState>
            </div>
        );
    }

    const state = stateOf(pr);
    const waiting = waitingOf(pr);
    const source = SOURCES[pr.source] || SOURCES.rules;
    const people = pr.people?.length ? pr.people : [];

    return (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show">
            <motion.div variants={rise}>
                <Link to="/prs" className="btn btn-ghost btn-sm" style={{ marginLeft: -10, marginBottom: 14 }}><ArrowLeft size={15} />Pull requests</Link>
            </motion.div>

            <motion.header variants={rise} className="row wrap" style={{ gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
                <ToneIcon tone={state.tone} icon={state.icon} size="lg" spin={state.spin} />
                <div className="col" style={{ flex: 1, minWidth: 260, gap: 8 }}>
                    <div className="row muted mono" style={{ fontSize: 13, gap: 6 }}>{pr.repoName}<span className="faint">·</span>#{pr.number}<span className="faint">·</span>by {pr.author}</div>
                    <h1 className="page-title">{pr.title}</h1>
                    <div className="row wrap" style={{ gap: 6 }}>
                        <StateChip pr={pr} />
                        <EscalationChip pr={pr} size={undefined} />
                        {(pr.labels || []).map((l) => <span key={l} className="label-tag">{l}</span>)}
                    </div>
                </div>
                {pr.url && (
                    <a href={pr.url} target="_blank" rel="noreferrer" className="btn btn-secondary">Open on GitHub<ExternalLink size={14} /></a>
                )}
            </motion.header>

            <div className="grid grid-main" style={{ alignItems: 'start' }}>
                <div className="col" style={{ gap: 16 }}>
                    <motion.section variants={rise} className="card card-glow" style={{ padding: 24 }} data-tone={waiting.tone}>
                        <div className="row wrap" style={{ gap: 16, marginBottom: 20 }}>
                            <div className="col" style={{ flex: 1, gap: 6 }}>
                                <span className="muted" style={{ fontSize: 12.5, fontWeight: 550 }}>Who acts next</span>
                                <span style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em', color: 'var(--c)' }}>{waiting.long}</span>
                            </div>
                            <ConfidenceRing value={pr.confidence ?? 1} />
                        </div>

                        {people.length > 0 && (
                            <div className="row wrap" style={{ gap: 10, marginBottom: 20 }}>
                                {people.map((login) => (
                                    <a key={login} href={login.startsWith('team:') ? undefined : `https://github.com/${login}`} target="_blank" rel="noreferrer"
                                        className="row" style={{ gap: 8, padding: '5px 12px 5px 5px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                                        <Avatar login={login} />
                                        <span style={{ fontWeight: 550, fontSize: 13 }}>{login.replace(/^team:/, '')}</span>
                                    </a>
                                ))}
                            </div>
                        )}

                        <div className="col" style={{ gap: 6, marginBottom: 16 }}>
                            <span className="muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Why</span>
                            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{pr.reason || state.hint}</p>
                        </div>

                        {pr.nextStep && (
                            <div className="row" style={{ gap: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--c-soft)', border: '1px solid var(--c-line)' }}>
                                <ArrowRight size={18} style={{ color: 'var(--c)' }} />
                                <span style={{ fontWeight: 550 }}>{pr.nextStep}</span>
                            </div>
                        )}

                        <div className="row" style={{ marginTop: 18, gap: 8 }}>
                            <Chip tone={source.tone} icon={source.icon} size="sm">{source.label}</Chip>
                            {pr.lastNotifiedAt && <span className="muted" style={{ fontSize: 12.5 }}>Last notified {timeAgo(pr.lastNotifiedAt, now)}</span>}
                        </div>
                    </motion.section>

                    <motion.div className="grid grid-4" variants={stagger(0.05)}>
                        <Metric icon={Clock3} label="Days idle" value={pr.inactivityDays} tone={pr.inactivityDays >= 7 ? 'danger' : pr.inactivityDays >= 3 ? 'author' : 'ready'} />
                        <Metric icon={Plus} label="Lines added" value={`+${pr.additions}`} tone="ready" />
                        <Metric icon={Minus} label="Lines removed" value={`−${pr.deletions}`} tone="danger" />
                        <Metric icon={BellRing} label="Escalation" value={pr.escalationLevel > 0 ? 'Yes' : 'No'} tone={pr.escalationLevel > 0 ? 'danger' : 'neutral'} />
                    </motion.div>
                </div>

                <div className="col" style={{ gap: 16 }}>
                    <motion.section variants={rise} className="card card-pad">
                        <div className="card-title" style={{ marginBottom: 16 }}>History</div>
                        <RunTimeline events={logs} now={now} limit={12} showRepo={false} />
                    </motion.section>
                    <motion.div variants={rise}><OverrideCard key={pr.decision} pr={pr} onSaved={refetch} /></motion.div>
                </div>
            </div>
        </motion.div>
    );
}
