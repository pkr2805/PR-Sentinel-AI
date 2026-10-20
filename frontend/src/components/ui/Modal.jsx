import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, subtitle, icon, children, footer, width = 480 }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div className="backdrop backdrop-center" onMouseDown={onClose}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="modal" role="dialog" aria-modal="true" aria-label={title}
                        style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
                        <div className="modal-header">
                            {icon}
                            <div className="col" style={{ flex: 1 }}>
                                <div className="card-title" style={{ fontSize: 16 }}>{title}</div>
                                {subtitle && <div className="card-sub">{subtitle}</div>}
                            </div>
                            <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
                        </div>
                        <div className="modal-body">{children}</div>
                        {footer && <div className="modal-footer">{footer}</div>}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
