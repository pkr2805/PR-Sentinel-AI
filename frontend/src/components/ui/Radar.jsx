/** Animated radar: sweeps slowly at rest and fast while a scan runs. */
const BLIPS = [
    { x: 68, y: 30, delay: 0.4 },
    { x: 30, y: 62, delay: 1.5 },
    { x: 74, y: 70, delay: 2.4 },
];

export default function Radar({ size = 120, active = false }) {
    return (
        <div className="radar" data-active={active} style={{ width: size, height: size }} aria-hidden="true">
            <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                    <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
                    </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="49" fill="url(#radar-bg)" stroke="var(--t-brand-line)" />
                <circle cx="50" cy="50" r="33" fill="none" stroke="var(--border-strong)" strokeDasharray="2 3" />
                <circle cx="50" cy="50" r="17" fill="none" stroke="var(--border-strong)" />
                <line x1="50" y1="2" x2="50" y2="98" stroke="var(--border)" />
                <line x1="2" y1="50" x2="98" y2="50" stroke="var(--border)" />
            </svg>
            <div className="radar-sweep"
                style={{ background: 'conic-gradient(from 0deg, transparent 0deg, transparent 280deg, color-mix(in srgb, var(--brand-2) 55%, transparent) 360deg)' }} />
            {BLIPS.map((b) => (
                <span key={`${b.x}-${b.y}`} className="radar-blip"
                    style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.delay}s` }} />
            ))}
            <span style={{
                position: 'absolute', left: '50%', top: '50%', width: 8, height: 8, margin: -4, borderRadius: '50%',
                background: 'var(--brand-grad)', boxShadow: '0 0 12px var(--brand)',
            }} />
        </div>
    );
}
