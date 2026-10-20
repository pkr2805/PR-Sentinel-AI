import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StateChip, EscalationChip, ToneIcon } from './ui/Chip';
import { AvatarStack } from './ui/Avatar';
import { rise } from './ui/motion';
import { stateOf } from '../lib/states';
import { prPath } from '../lib/pr';

/** Compact, scannable PR row for lists. */
export default function PRRow({ pr, showRepo = true }) {
    const navigate = useNavigate();
    const state = stateOf(pr);
    return (
        <motion.button type="button" variants={rise} layout onClick={() => navigate(prPath(pr))}
            className="row" whileHover={{ x: 3 }} transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            style={{ width: '100%', gap: 14, padding: '12px 16px', borderRadius: 12, textAlign: 'left' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <ToneIcon tone={state.tone} icon={state.icon} spin={state.spin} />
            <div className="col" style={{ flex: 1, gap: 4 }}>
                <div className="row" style={{ gap: 8 }}>
                    <span className="truncate" style={{ fontWeight: 550 }}>{pr.title}</span>
                    <span className="mono faint" style={{ fontSize: 12 }}>#{pr.number}</span>
                </div>
                <div className="truncate muted" style={{ fontSize: 12.5 }}>
                    {showRepo && <span className="mono">{pr.repoName} · </span>}
                    {pr.nextStep || state.hint}
                </div>
            </div>
            <div className="row hide-sm" style={{ gap: 8 }}>
                <EscalationChip pr={pr} />
                <StateChip pr={pr} size="sm" />
            </div>
            <AvatarStack logins={pr.people.length ? pr.people : [pr.author]} size="sm" />
            <span className="mono muted tabular hide-sm" style={{ fontSize: 12.5, width: 34, textAlign: 'right' }}>{pr.inactivityDays}d</span>
            <ChevronRight size={16} className="faint" />
        </motion.button>
    );
}
