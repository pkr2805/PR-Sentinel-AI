import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, FolderGit2, Layers, Pause } from 'lucide-react';
import { useApp } from '../context/app-context';

export default function RepoSwitcher() {
    const { repos, repoId, setRepoId, selectedRepo } = useApp();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const pick = (id) => { setRepoId(id); setOpen(false); };
    const options = [{ id: null, fullName: 'All repositories', all: true }, ...repos];

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
                style={{ maxWidth: 260 }}>
                {selectedRepo ? <FolderGit2 size={15} /> : <Layers size={15} />}
                <span className={`truncate ${selectedRepo ? 'mono' : ''}`} style={{ fontSize: 13 }}>{selectedRepo ? selectedRepo.fullName : 'All repositories'}</span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ display: 'grid' }}><ChevronDown size={14} className="muted" /></motion.span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div role="listbox" className="card" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.16 }}
                        style={{ position: 'absolute', top: 44, left: 0, zIndex: 40, minWidth: 280, padding: 6, boxShadow: 'var(--shadow-pop)', transformOrigin: 'top left' }}>
                        {options.map((r) => {
                            const active = (r.id || null) === (repoId || null);
                            return (
                                <button key={r.id || 'all'} type="button" role="option" aria-selected={active} className="palette-item"
                                    data-active={active} onClick={() => pick(r.id)} style={{ minHeight: 38 }}>
                                    {r.all ? <Layers size={15} className="muted" /> : <FolderGit2 size={15} className="muted" />}
                                    <span className={`truncate ${r.all ? '' : 'mono'}`} style={{ flex: 1, fontSize: 13 }}>{r.fullName}</span>
                                    {!r.all && !r.active && <Pause size={13} className="faint" />}
                                    {active && <Check size={15} style={{ color: 'var(--brand-strong)' }} />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
