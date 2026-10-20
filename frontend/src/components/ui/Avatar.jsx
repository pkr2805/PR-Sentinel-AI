import { useState } from 'react';
import { initials } from '../../lib/format';

/** GitHub avatar with an initials fallback (teams and offline). */
export function Avatar({ login, size }) {
    const [failed, setFailed] = useState(false);
    const isTeam = login?.startsWith('team:');
    const px = size === 'sm' ? 20 : size === 'lg' ? 34 : 26;
    return (
        <span className={`avatar ${size ? `avatar-${size}` : ''}`} title={login}>
            {!failed && !isTeam && login && login !== 'ghost' ? (
                <img src={`https://github.com/${login}.png?size=${px * 2}`} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : initials(login)}
        </span>
    );
}

export function AvatarStack({ logins = [], max = 3, size }) {
    const shown = logins.slice(0, max);
    const extra = logins.length - shown.length;
    return (
        <span className="avatar-stack">
            {shown.map((l) => <Avatar key={l} login={l} size={size} />)}
            {extra > 0 && <span className={`avatar ${size ? `avatar-${size}` : ''}`}>+{extra}</span>}
        </span>
    );
}
