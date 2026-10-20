import { Search, Menu, Radar } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import RepoSwitcher from '../components/RepoSwitcher';
import { useApp } from '../context/app-context';

export default function Topbar() {
    const { setPaletteOpen, setMobileNavOpen, scan } = useApp();
    return (
        <header className="topbar">
            <button type="button" className="icon-btn mobile-only" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
                <Menu size={18} />
            </button>
            <RepoSwitcher />
            <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
                <Search size={15} />
                <span className="truncate" style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>Search or jump to…</span>
                <span className="kbd hide-sm">⌘K</span>
            </button>
            <div className="spacer" />
            <AnimatePresence>
                {scan.running && (
                    <motion.span className="chip" data-tone="brand" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}>
                        <Radar size={13} className="spin" />Scanning {scan.target}
                    </motion.span>
                )}
            </AnimatePresence>
        </header>
    );
}
