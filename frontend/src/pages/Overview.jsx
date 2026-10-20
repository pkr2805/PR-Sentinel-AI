import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { GitPullRequest, Eye, UserRound, GitMerge, ArrowUpRight, FolderGit2, Plus, PartyPopper, Activity } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ScanPanel from '../components/ScanPanel';
import PendingApprovals from '../components/PendingApprovals';
import WaitingBreakdown from '../components/WaitingBreakdown';
import RunTimeline from '../components/RunTimeline';
import PRRow from '../components/PRRow';
import EmptyState from '../components/ui/EmptyState';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import Skeleton from '../components/ui/Skeleton';
import { ToneIcon } from '../components/ui/Chip';
import { stagger, rise, trackSpotlight } from '../components/ui/motion';
import { useApp } from '../context/app-context';
import { getPRs, getLogs } from '../services/api';
import { useResource, useNow } from '../lib/useResource';
import { priority, isEscalated } from '../lib/states';

function greeting(now) {
    const hour = new Date(now).getHours();
    return hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function StatCard({ icon, tone, label, value, sub, to }) {
    const navigate = useNavigate();
    return (
        <motion.button type="button" variants={rise} className="card card-interactive spotlight card-pad" data-tone={tone}
            onMouseMove={trackSpotlight} onClick={() => navigate(to)} whileHover={{ y: -3 }}
            style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
                <ToneIcon tone={tone} icon={icon} />
                <ArrowUpRight size={16} className="faint" />
            </div>
            <div className="col" style={{ gap: 4 }}>
                <span className="stat-value"><AnimatedNumber value={value} /></span>
                <span className="stat-label">{label}</span>
            </div>
            {sub && <span className="muted" style={{ fontSize: 12.5, color: 'var(--c)' }}>{sub}</span>}
        </motion.button>
    );
}

export default function Overview() {
    const { repoId, dataVersion, repos, reposLoading } = useApp();
    const now = useNow();
    const fetchPRs = useCallback(() => getPRs(repoId), [repoId]);
    const fetchLogs = useCallback(() => getLogs(repoId), [repoId]);
    const { data: prs = [], loading } = useResource(fetchPRs, [], dataVersion);
    const { data: logs = [] } = useResource(fetchLogs, [], dataVersion);

    const view = useMemo(() => {
        const by = (key) => prs.filter((p) => p.waitingOn === key);
        const avg = (list) => (list.length ? (list.reduce((s, p) => s + (p.inactivityDays || 0), 0) / list.length).toFixed(1) : '0');
        const review = by('reviewer');
        const author = by('author');
        return {
            review,
            author,
            ready: prs.filter((p) => p.state === 'READY_TO_MERGE'),
            escalated: prs.filter(isEscalated),
            avgReview: avg(review),
            avgAuthor: avg(author),
            attention: [...prs].filter((p) => p.waitingOn !== 'nobody' && p.state !== 'DRAFT').sort((a, b) => priority(b) - priority(a)).slice(0, 6),
            lastRun: logs.find((l) => l.decision === 'BATCH_RUN'),
        };
    }, [prs, logs]);

    const monitored = repos.filter((r) => r.active).length;
    const noRepos = !reposLoading && repos.length === 0;

    return (
        <>
            <PageHeader eyebrow={greeting(now)} title="Overview"
                subtitle="Why each pull request is waiting, and who needs to act next." />

            {noRepos ? (
                <div className="card">
                    <EmptyState icon={FolderGit2} title="Add your first repository"
                        action={<Link to="/repos?add=1" className="btn btn-primary"><Plus size={16} />Add repository</Link>}>
                        PR Sentinel watches a GitHub repository's open pull requests and tells the right person what to do next.
                    </EmptyState>
                </div>
            ) : (
                <>
                    <ScanPanel lastRun={view.lastRun} now={now} monitored={monitored} />
                    <PendingApprovals />

                    <motion.div className="grid grid-4" style={{ marginTop: 16 }} variants={stagger(0.06, 0.1)} initial="hidden" animate="show">
                        <StatCard icon={GitPullRequest} tone="brand" label="Open pull requests" value={prs.length} to="/prs"
                            sub={view.escalated.length ? `${view.escalated.length} escalated` : 'None escalated'} />
                        <StatCard icon={Eye} tone="review" label="Waiting on review" value={view.review.length} to="/prs?waiting=reviewer"
                            sub={`Avg ${view.avgReview} days idle`} />
                        <StatCard icon={UserRound} tone="author" label="Waiting on authors" value={view.author.length} to="/prs?waiting=author"
                            sub={`Avg ${view.avgAuthor} days idle`} />
                        <StatCard icon={GitMerge} tone="ready" label="Ready to merge" value={view.ready.length} to="/prs?waiting=maintainer"
                            sub={view.ready.length ? 'Approved and green' : 'Nothing waiting'} />
                    </motion.div>

                    <div className="grid grid-main" style={{ marginTop: 16, alignItems: 'start' }}>
                        <section className="card">
                            <div className="card-header">
                                <div className="col" style={{ flex: 1 }}>
                                    <div className="card-title">Needs attention</div>
                                    <div className="card-sub">Sorted by urgency: escalations, merge-ready, then longest idle</div>
                                </div>
                                <Link to="/prs" className="btn btn-ghost btn-sm">View all<ArrowUpRight size={14} /></Link>
                            </div>
                            <div style={{ padding: 6 }}>
                                {loading ? (
                                    Array.from({ length: 4 }, (_, i) => (
                                        <div key={i} className="row" style={{ gap: 14, padding: '14px 16px' }}>
                                            <Skeleton width={34} height={34} radius={10} />
                                            <div className="col" style={{ flex: 1, gap: 8 }}><Skeleton width="60%" /><Skeleton width="35%" height={10} /></div>
                                        </div>
                                    ))
                                ) : view.attention.length === 0 ? (
                                    <EmptyState icon={PartyPopper} title="All clear">Nobody is blocked right now. Run a scan to check again.</EmptyState>
                                ) : (
                                    <motion.div variants={stagger(0.05, 0.15)} initial="hidden" animate="show">
                                        {view.attention.map((pr) => <PRRow key={pr.id} pr={pr} showRepo={!repoId} />)}
                                    </motion.div>
                                )}
                            </div>
                        </section>

                        <div className="col" style={{ gap: 16 }}>
                            <WaitingBreakdown prs={prs} />
                            <section className="card card-pad">
                                <div className="row" style={{ marginBottom: 16 }}>
                                    <div className="col" style={{ flex: 1 }}>
                                        <div className="card-title">Recent activity</div>
                                        <div className="card-sub">Scans and decisions</div>
                                    </div>
                                    <Link to="/activity" className="icon-btn icon-btn-sm" aria-label="All activity"><Activity size={15} /></Link>
                                </div>
                                <RunTimeline events={logs} now={now} limit={6} showRepo={!repoId} />
                            </section>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
