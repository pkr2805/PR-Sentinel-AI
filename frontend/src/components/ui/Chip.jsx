import { stateOf, waitingOf, DECISIONS, isEscalated } from '../../lib/states';
import { Siren } from 'lucide-react';

export function Chip({ tone = 'neutral', icon: Icon, size, plain, children, title, spin }) {
    const cls = ['chip', size && `chip-${size}`, plain && 'chip-plain'].filter(Boolean).join(' ');
    return (
        <span className={cls} data-tone={tone} title={title}>
            {Icon ? <Icon size={size === 'sm' ? 11 : 13} strokeWidth={2.2} className={spin ? 'spin' : undefined} /> : <span className="dot" />}
            {children}
        </span>
    );
}

export function StateChip({ pr, size }) {
    const meta = stateOf(pr);
    return <Chip tone={meta.tone} icon={meta.icon} size={size} spin={meta.spin} title={meta.hint}>{meta.label}</Chip>;
}

export function WaitingChip({ pr, size }) {
    const meta = waitingOf(pr);
    return <Chip tone={meta.tone} icon={meta.icon} size={size}>{meta.long}</Chip>;
}

export function EscalationChip({ pr, size = 'sm' }) {
    if (!isEscalated(pr)) return null;
    return <Chip tone="danger" icon={Siren} size={size}>Escalated</Chip>;
}

export function DecisionChip({ decision, size }) {
    const meta = DECISIONS[decision] || DECISIONS.PENDING;
    return <Chip tone={meta.tone} icon={meta.icon} size={size}>{meta.label}</Chip>;
}

export function ToneIcon({ tone = 'neutral', icon: Icon, size, spin }) {
    return (
        <span className={`tone-icon ${size === 'lg' ? 'tone-icon-lg' : ''}`} data-tone={tone}>
            <Icon size={size === 'lg' ? 22 : 17} strokeWidth={2} className={spin ? 'spin' : undefined} />
        </span>
    );
}
