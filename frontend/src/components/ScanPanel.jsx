import { AnimatePresence, motion } from 'framer-motion';
import { Radar as RadarIcon, Timer, Sparkles, Database, Layers } from 'lucide-react';
import Radar from './ui/Radar';
import { useApp, SCAN_STEPS } from '../context/app-context';
import { formatDuration, timeAgo, plural } from '../lib/format';
import { ease } from './ui/motion';

function Steps({ step }) {
    return (
        <div className="steps" style={{ marginTop: 18 }}>
            {SCAN_STEPS.map((label, i) => {
                const state = i < step ? 'done' : i === step ? 'active' : 'todo';
                return (
                    <div key={label} className="step" data-state={state}>
                        <div className="step-bar">
                            <motion.div className="step-bar-fill" initial={false}
                                animate={{ scaleX: state === 'todo' ? 0 : 1 }} transition={{ duration: 0.45, ease }} />
                        </div>
                        <span className="step-label">{label}</span>
                    </div>
                );
            })}
        </div>
    );
}

function Metric({ icon: Icon, children }) {
    return <span className="row muted" style={{ gap: 6, fontSize: 12.5 }}><Icon size={13} />{children}</span>;
}

export default function ScanPanel({ lastRun, now, monitored }) {
    const { scan, runScan, selectedRepo } = useApp();
    const scope = selectedRepo ? selectedRepo.fullName : plural(monitored, 'repository', 'repositories');

    return (
        <motion.section className="card card-glow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease }} style={{ padding: 24, overflow: 'hidden' }}>
            <div className="row wrap" style={{ gap: 24, alignItems: 'center' }}>
                <Radar size={116} active={scan.running} />
                <div className="col" style={{ flex: 1, minWidth: 260, gap: 6 }}>
                    <div className="row" style={{ gap: 8 }}>
                        <span className="live-dot" data-tone={scan.running ? 'brand' : undefined} />
                        <span className="muted" style={{ fontSize: 12.5, fontWeight: 550 }}>
                            {scan.running ? 'Scanning now' : 'Sentinel is watching'}
                        </span>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.h2 key={scan.running ? 'run' : 'idle'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                            style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em' }}>
                            {scan.running ? `Reading pull requests in ${scan.target}` : scope}
                        </motion.h2>
                    </AnimatePresence>
                    {scan.running ? <Steps step={scan.step} /> : lastRun ? (
                        <div className="row wrap" style={{ gap: 16, marginTop: 4 }}>
                            <Metric icon={RadarIcon}>Last scan {timeAgo(lastRun.timestamp, now)}</Metric>
                            <Metric icon={Timer}>{formatDuration(lastRun.duration_ms)}</Metric>
                            <Metric icon={Layers}>{plural(lastRun.prs_seen ?? 0, 'PR')} seen</Metric>
                            <Metric icon={Database}>{lastRun.prs_cached ?? 0} unchanged</Metric>
                            <Metric icon={Sparkles}>{plural(lastRun.llm_calls ?? 0, 'AI call')}</Metric>
                        </div>
                    ) : (
                        <p className="muted">No scans yet. Run one to see why each pull request is waiting.</p>
                    )}
                </div>
                <button type="button" className="btn btn-primary btn-lg" onClick={runScan} disabled={scan.running}>
                    <RadarIcon size={17} className={scan.running ? 'spin' : undefined} />
                    {scan.running ? 'Scanning…' : 'Run scan'}
                </button>
            </div>
        </motion.section>
    );
}
