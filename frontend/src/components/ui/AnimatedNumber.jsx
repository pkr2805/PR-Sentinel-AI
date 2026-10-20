import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

/** Counts up to `value` when it changes. */
export default function AnimatedNumber({ value = 0, format = (v) => Math.round(v).toLocaleString(), duration = 0.9 }) {
    const ref = useRef(null);
    const from = useRef(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const controls = animate(from.current, value, {
            duration,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: (v) => { node.textContent = format(v); },
        });
        from.current = value;
        return () => controls.stop();
    }, [value, duration, format]);

    return <span ref={ref} className="tabular">{format(0)}</span>;
}
