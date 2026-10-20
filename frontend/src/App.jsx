import { Suspense, lazy, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import AppProvider from './context/AppProvider';
import { useApp } from './context/app-context';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import CommandPalette from './components/CommandPalette';
import Toasts from './components/ui/Toasts';
import Overview from './pages/Overview';
import PullRequests from './pages/PullRequests';
import PRDetail from './pages/PRDetail';
import ActivityPage from './pages/Activity';
import Repositories from './pages/Repositories';
import NotFound from './pages/NotFound';
import { getPendingActions } from './services/api';
import { useResource } from './lib/useResource';
import Skeleton from './components/ui/Skeleton';

// The diagram library is large; load it only on the page that uses it.
const Workflow = lazy(() => import('./pages/Workflow'));

function Shell() {
    const location = useLocation();
    const { collapsed, mobileNavOpen, setMobileNavOpen, dataVersion } = useApp();
    const fetchPending = useCallback(() => getPendingActions(), []);
    const { data: pending = [] } = useResource(fetchPending, [], dataVersion);

    return (
        <div className="shell" data-collapsed={collapsed} data-mobile-open={mobileNavOpen}>
            <Sidebar pendingCount={pending.length} />
            <AnimatePresence>
                {mobileNavOpen && (
                    <motion.div className="backdrop mobile-only" style={{ zIndex: 65 }} onClick={() => setMobileNavOpen(false)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                )}
            </AnimatePresence>
            <div className="shell-main">
                <Topbar />
                <main className="content">
                    <AnimatePresence mode="wait">
                        <motion.div key={location.pathname} className="page"
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                            <Routes location={location}>
                                <Route path="/" element={<Overview />} />
                                <Route path="/prs" element={<PullRequests />} />
                                <Route path="/prs/:id" element={<PRDetail />} />
                                <Route path="/activity" element={<ActivityPage />} />
                                <Route path="/logs" element={<ActivityPage />} />
                                <Route path="/repos" element={<Repositories />} />
                                <Route path="/settings" element={<Repositories />} />
                                <Route path="/workflow" element={<Suspense fallback={<Skeleton height={640} radius={16} />}><Workflow /></Suspense>} />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
            <CommandPalette />
            <Toasts />
        </div>
    );
}

export default function App() {
    return (
        <MotionConfig reducedMotion="user">
            <AppProvider>
                <Shell />
            </AppProvider>
        </MotionConfig>
    );
}
