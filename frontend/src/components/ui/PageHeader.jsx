import { motion } from 'framer-motion';
import { ease } from './motion';

export default function PageHeader({ eyebrow, title, subtitle, actions }) {
    return (
        <motion.header className="page-header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}>
            <div className="col" style={{ flex: 1, minWidth: 240 }}>
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                <h1 className="page-title">{title}</h1>
                {subtitle && <p className="page-sub">{subtitle}</p>}
            </div>
            {actions && <div className="row wrap" style={{ gap: 8 }}>{actions}</div>}
        </motion.header>
    );
}
