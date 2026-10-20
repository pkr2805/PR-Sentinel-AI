import { motion } from 'framer-motion';

export default function Switch({ on, onChange, label }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" data-on={on}
            onClick={() => onChange(!on)}>
            <motion.span className="switch-knob" animate={{ x: on ? 17 : 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
        </button>
    );
}
