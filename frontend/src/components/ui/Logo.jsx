/** PR Sentinel mark: a shield with a radar arc and a signal dot. */
export function LogoMark({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2.5 4.5 5.4v6.1c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10V5.4L12 2.5Z"
                fill="rgba(255,255,255,0.16)" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M8.2 13.6a4.4 4.4 0 0 1 7.6-3.9" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M10.5 13.9a1.9 1.9 0 0 1 3-1.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" opacity="0.75" />
            <circle cx="12" cy="14.6" r="1.35" fill="#fff" />
        </svg>
    );
}

/** Full logo, kept for reuse outside the sidebar. */
export default function Logo({ collapsed }) {
    return (
        <div className="brand">
            <div className="brand-mark"><LogoMark /></div>
            {!collapsed && (
                <div className="brand-text">
                    <div className="brand-name">PR Sentinel</div>
                    <div className="brand-sub">Pull request intelligence</div>
                </div>
            )}
        </div>
    );
}
