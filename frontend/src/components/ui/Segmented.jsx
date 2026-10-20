import { motion } from 'framer-motion';

/** Tabs with a sliding pill. `options`: [{ value, label, icon, count, tone }] */
export default function Segmented({ options, value, onChange, id = 'seg', size }) {
    return (
        <div className="segmented" role="tablist">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button key={o.value} type="button" role="tab" aria-selected={active} className="segment"
                        data-active={active} data-tone={o.tone} onClick={() => onChange(o.value)}
                        style={size === 'sm' ? { height: 26, padding: '0 10px', fontSize: 12.5 } : undefined}>
                        {active && <motion.span layoutId={`${id}-pill`} className="segment-pill"
                            transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                        {o.icon && <o.icon size={14} />}
                        <span>{o.label}</span>
                        {o.count != null && <span className="count tabular">{o.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
