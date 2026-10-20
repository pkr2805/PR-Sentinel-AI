import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock3 } from 'lucide-react';
import { StateChip, EscalationChip, ToneIcon } from './ui/Chip';
import { AvatarStack, Avatar } from './ui/Avatar';
import { rise, trackSpotlight } from './ui/motion';
import { stateOf, waitingOf } from '../lib/states';
import { prPath, urgency } from '../lib/pr';

export default function PRCard({ pr }) {
    const navigate = useNavigate();
    const state = stateOf(pr);
    const waiting = waitingOf(pr);
    const pct = urgency(pr);
    const meterTone = pct >= 100 ? 'danger' : pct >= 50 ? 'author' : 'ready';

    return (
        <motion.article variants={rise} layout className="card card-interactive spotlight card-pad"
            whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onMouseMove={trackSpotlight} onClick={() => navigate(prPath(pr))}
            role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(prPath(pr)); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <ToneIcon tone={state.tone} icon={state.icon} spin={state.spin} />
                <div className="col" style={{ flex: 1, gap: 3 }}>
                    <div style={{ fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {pr.title}
                    </div>
                    <div className="row muted" style={{ fontSize: 12.5, gap: 6 }}>
                        <span className="mono truncate">{pr.repoName}</span>
                        <span className="faint">·</span>
                        <span className="mono">#{pr.number}</span>
                    </div>
                </div>
                <span className="row muted tabular" style={{ fontSize: 12.5, gap: 4 }} title="Days without activity">
                    <Clock3 size={13} />{pr.inactivityDays}d
                </span>
            </div>

            <div className="row wrap" style={{ gap: 6 }}>
                <StateChip pr={pr} size="sm" />
                <EscalationChip pr={pr} />
                {pr.source === 'llm' && <span className="chip chip-sm chip-plain" data-tone="brand"><Sparkles size={11} />AI judged</span>}
            </div>

            {pr.nextStep && (
                <div className="text-2" style={{ fontSize: 13, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 550 }}>Next: </span>{pr.nextStep}
                </div>
            )}

            <div className="row" style={{ marginTop: 'auto', gap: 10 }}>
                <span className="row" style={{ gap: 6 }} title={waiting.long}>
                    {pr.people.length > 0 ? <AvatarStack logins={pr.people} size="sm" /> : <Avatar login={pr.author} size="sm" />}
                    <span className="muted" style={{ fontSize: 12 }}>{waiting.label}</span>
                </span>
                <div className="spacer" />
                <div className="meter" style={{ width: 84 }} data-tone={meterTone} title={`${pct}% of the way to escalation`}>
                    <motion.div className="meter-fill" initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 4)}%` }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} />
                </div>
            </div>
        </motion.article>
    );
}
