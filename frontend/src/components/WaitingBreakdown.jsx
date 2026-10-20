import { motion } from 'framer-motion';
import { WAITING, STATES } from '../lib/states';
import { ease } from './ui/motion';
import AnimatedNumber from './ui/AnimatedNumber';

const ORDER = ['reviewer', 'author', 'maintainer', 'nobody'];

export default function WaitingBreakdown({ prs }) {
    const total = prs.length || 1;
    const counts = ORDER.map((key) => ({ key, ...WAITING[key], count: prs.filter((p) => (p.waitingOn || 'nobody') === key).length }));
    const states = Object.entries(STATES)
        .map(([key, meta]) => ({ key, ...meta, count: prs.filter((p) => p.state === key).length }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count);
    const maxState = Math.max(1, ...states.map((s) => s.count));

    return (
        <div className="card card-pad" style={{ height: '100%' }}>
            <div className="card-title">Where pull requests are waiting</div>
            <div className="card-sub" style={{ marginBottom: 18 }}>Who has to act next, across {prs.length} open PRs</div>

            <div className="stack-bar">
                {counts.filter((c) => c.count > 0).map((c, i) => (
                    <motion.div key={c.key} data-tone={c.tone} title={`${c.long}: ${c.count}`}
                        initial={{ width: 0 }} animate={{ width: `${(c.count / total) * 100}%` }}
                        transition={{ duration: 0.9, ease, delay: 0.1 + i * 0.08 }} />
                ))}
            </div>

            <div className="grid grid-2" style={{ gap: 10, marginTop: 16 }}>
                {counts.map((c) => (
                    <div key={c.key} className="row" data-tone={c.tone} style={{ gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2)' }}>
                        <span style={{ color: 'var(--c)' }}><c.icon size={15} /></span>
                        <span className="text-2 truncate" style={{ flex: 1, fontSize: 13 }} title={c.long}>{c.label}</span>
                        <span style={{ fontWeight: 650 }}><AnimatedNumber value={c.count} /></span>
                    </div>
                ))}
            </div>

            {states.length > 0 && (
                <div className="col" style={{ gap: 10, marginTop: 22 }}>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>By state</div>
                    {states.map((s, i) => (
                        <div key={s.key} className="row" data-tone={s.tone} style={{ gap: 10 }}>
                            <span style={{ color: 'var(--c)' }}><s.icon size={14} /></span>
                            <span className="text-2" style={{ width: 140, fontSize: 13 }}>{s.label}</span>
                            <div className="meter" style={{ flex: 1 }}>
                                <motion.div className="meter-fill" initial={{ width: 0 }} animate={{ width: `${(s.count / maxState) * 100}%` }}
                                    transition={{ duration: 0.8, ease, delay: 0.2 + i * 0.05 }} />
                            </div>
                            <span className="tabular" style={{ width: 24, textAlign: 'right', fontWeight: 600 }}>{s.count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
