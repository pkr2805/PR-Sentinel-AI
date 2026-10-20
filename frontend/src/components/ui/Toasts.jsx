import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, TriangleAlert, Info, X } from 'lucide-react';
import { useApp } from '../../context/app-context';

const ICONS = { ready: CircleCheck, danger: TriangleAlert, author: TriangleAlert };

export default function Toasts() {
    const { toasts, dismissToast } = useApp();
    return (
        <div className="toasts" aria-live="polite">
            <AnimatePresence initial={false}>
                {toasts.map((t) => {
                    const Icon = ICONS[t.tone] || Info;
                    return (
                        <motion.div key={t.id} layout className="toast" data-tone={t.tone}
                            initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
                            <span style={{ color: 'var(--c)', marginTop: 1 }}><Icon size={18} /></span>
                            <div className="col" style={{ flex: 1, gap: 2 }}>
                                <div style={{ fontWeight: 600 }}>{t.title}</div>
                                {t.description && <div className="muted" style={{ fontSize: 13 }}>{t.description}</div>}
                            </div>
                            <button type="button" className="icon-btn icon-btn-sm" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
                                <X size={14} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
