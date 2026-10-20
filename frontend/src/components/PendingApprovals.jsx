import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Siren, Check, X, MessageSquare, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPendingActions, approvePendingAction, rejectPendingAction } from '../services/api';
import { useResource } from '../lib/useResource';
import { useApp } from '../context/app-context';
import { ToneIcon } from './ui/Chip';

const KIND = {
    pr_comment: { label: 'Escalation comment', icon: MessageSquare },
    slack_digest: { label: 'Slack escalation', icon: Send },
};

function preview(text = '') {
    return text.replace('<!-- pr-sentinel -->', '').replace(/<\/?sub>/g, '').replace(/\*\*/g, '').replace(/^#+.*$/gm, '').replace(/\n{2,}/g, '\n').trim();
}

export default function PendingApprovals() {
    const { dataVersion, refresh, toast } = useApp();
    const fetcher = useCallback(() => getPendingActions(), []);
    const { data: actions = [] } = useResource(fetcher, [], dataVersion);
    const [busy, setBusy] = useState(null);
    const [hidden, setHidden] = useState([]);

    const decide = async (action, approve) => {
        setBusy(action.id);
        try {
            const res = await (approve ? approvePendingAction(action.id) : rejectPendingAction(action.id));
            setHidden((h) => [...h, action.id]);
            toast(approve ? 'Escalation sent' : 'Escalation dismissed', {
                description: approve ? res.result : `${KIND[action.kind]?.label || action.kind} for ${action.pr_id || action.repo_id} won't be sent.`,
                tone: approve ? 'ready' : 'neutral',
            });
            refresh();
        } catch (err) {
            toast('Could not update the action', { description: err.message, tone: 'danger' });
        } finally {
            setBusy(null);
        }
    };

    const visible = actions.filter((a) => !hidden.includes(a.id));

    return (
        <AnimatePresence>
            {visible.length > 0 && (
                <motion.section className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }} style={{ borderColor: 'var(--t-danger-line)', overflow: 'hidden', marginTop: 16 }}>
                    <div className="card-header" data-tone="danger">
                        <ToneIcon tone="danger" icon={Siren} />
                        <div className="col" style={{ flex: 1 }}>
                            <div className="card-title">Waiting for your approval</div>
                            <div className="card-sub">These PRs have waited too long. Nothing is sent until you approve.</div>
                        </div>
                        <span className="chip" data-tone="danger">{visible.length}</span>
                    </div>
                    <div className="col">
                        <AnimatePresence initial={false}>
                            {visible.map((a) => {
                                const kind = KIND[a.kind] || { label: a.kind, icon: MessageSquare };
                                return (
                                    <motion.div key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, x: 30, height: 0, paddingTop: 0, paddingBottom: 0 }}
                                        className="row wrap" style={{ gap: 14, padding: '14px 20px', borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}>
                                        <span className="muted" style={{ marginTop: 2 }}><kind.icon size={16} /></span>
                                        <div className="col" style={{ flex: '1 1 240px', gap: 4 }}>
                                            <div className="row wrap" style={{ gap: 8 }}>
                                                <span style={{ fontWeight: 550 }}>{kind.label}</span>
                                                {a.pr_id ? (
                                                    <Link to={`/prs/${encodeURIComponent(a.pr_id)}`} className="mono" style={{ fontSize: 12.5, color: 'var(--brand-strong)' }}>{a.pr_id}</Link>
                                                ) : <span className="mono muted" style={{ fontSize: 12.5 }}>{a.repo_id}</span>}
                                            </div>
                                            <div className="muted" style={{ fontSize: 13, whiteSpace: 'pre-line', maxHeight: 88, overflow: 'hidden' }}>{preview(a.summary)}</div>
                                        </div>
                                        <div className="row" style={{ gap: 6 }}>
                                            <button type="button" className="btn btn-sm btn-success" disabled={busy === a.id} onClick={() => decide(a, true)}>
                                                <Check size={14} />Approve
                                            </button>
                                            <button type="button" className="btn btn-sm btn-ghost" disabled={busy === a.id} onClick={() => decide(a, false)}>
                                                <X size={14} />Dismiss
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
}
