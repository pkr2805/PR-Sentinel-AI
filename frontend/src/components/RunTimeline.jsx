import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { DECISIONS } from '../lib/states';
import { formatDuration, timeAgo } from '../lib/format';
import { stagger, rise } from './ui/motion';

export default function RunTimeline({ events, now, limit = 8, showRepo = true }) {
    const items = events.slice(0, limit);
    if (items.length === 0) return <p className="muted" style={{ fontSize: 13 }}>No activity yet.</p>;

    return (
        <motion.div className="timeline" variants={stagger(0.05)} initial="hidden" animate="show">
            {items.map((e) => {
                const isRun = e.decision === 'BATCH_RUN';
                const meta = DECISIONS[e.decision] || DECISIONS.PENDING;
                const tone = e.status !== 'success' ? (isRun ? 'author' : meta.tone) : meta.tone;
                return (
                    <motion.div key={e.id} variants={rise} className="timeline-item" data-tone={tone}>
                        <span className="timeline-dot"><meta.icon size={13} strokeWidth={2.2} /></span>
                        <div className="col" style={{ flex: 1, gap: 2 }}>
                            <div className="row" style={{ gap: 8 }}>
                                <span style={{ fontWeight: 550, fontSize: 13.5 }} className="truncate">
                                    {isRun ? 'Scan finished' : meta.label}
                                </span>
                                <span className="spacer" />
                                <span className="faint tabular" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{timeAgo(e.timestamp, now)}</span>
                            </div>
                            <div className="muted truncate" style={{ fontSize: 12.5 }}>
                                {isRun ? (
                                    <>
                                        {showRepo && <span className="mono">{e.repo_id} · </span>}
                                        {e.prs_seen ?? 0} PRs · {e.prs_cached ?? 0} unchanged · {e.llm_calls ?? 0} AI calls · {formatDuration(e.duration_ms)}
                                        {e.status !== 'success' && <span style={{ color: 'var(--t-author)' }}> · with errors</span>}
                                    </>
                                ) : (
                                    <>
                                        <Link to={`/prs/${encodeURIComponent(e.pr_id)}`} className="mono" style={{ color: 'var(--text-2)' }}>{e.pr_id}</Link>
                                        {e.slackSent ? ' · notified' : ''}
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}
