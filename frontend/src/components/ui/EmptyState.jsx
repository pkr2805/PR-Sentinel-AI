import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, children, action }) {
    return (
        <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <div className="empty-icon" style={{ animation: 'float 4s ease-in-out infinite' }}><Icon size={24} /></div>
            <h3>{title}</h3>
            {children && <p>{children}</p>}
            {action && <div style={{ marginTop: 8 }}>{action}</div>}
        </motion.div>
    );
}
