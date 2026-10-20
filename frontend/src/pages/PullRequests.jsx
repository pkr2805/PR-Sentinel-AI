import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, List, Eye, UserRound, GitMerge, Siren, Layers, Moon, RefreshCw, SearchX, GitPullRequest } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import PRCard from '../components/PRCard';
import PRRow from '../components/PRRow';
import Segmented from '../components/ui/Segmented';
import EmptyState from '../components/ui/EmptyState';
import { CardSkeleton } from '../components/ui/Skeleton';
import { stagger } from '../components/ui/motion';
import { useApp } from '../context/app-context';
import { getPRs } from '../services/api';
import { useResource } from '../lib/useResource';
import { load, save } from '../lib/storage';
import { priority, isEscalated } from '../lib/states';

const FILTERS = [
    { value: 'all', label: 'All', icon: Layers, match: () => true },
    { value: 'reviewer', label: 'Review', icon: Eye, tone: 'review', match: (p) => p.waitingOn === 'reviewer' },
    { value: 'author', label: 'Author', icon: UserRound, tone: 'author', match: (p) => p.waitingOn === 'author' && p.state !== 'DRAFT' },
    { value: 'maintainer', label: 'Merge', icon: GitMerge, tone: 'ready', match: (p) => p.waitingOn === 'maintainer' },
    { value: 'escalated', label: 'Escalated', icon: Siren, tone: 'danger', match: isEscalated },
    { value: 'quiet', label: 'Quiet', icon: Moon, tone: 'neutral', match: (p) => p.waitingOn === 'nobody' || p.state === 'DRAFT' },
];

const SORTS = {
    priority: { label: 'Most urgent', fn: (a, b) => priority(b) - priority(a) },
    idle: { label: 'Longest idle', fn: (a, b) => (b.inactivityDays || 0) - (a.inactivityDays || 0) },
    newest: { label: 'Newest first', fn: (a, b) => (b.number || 0) - (a.number || 0) },
    size: { label: 'Largest change', fn: (a, b) => (b.additions + b.deletions) - (a.additions + a.deletions) },
};

export default function PullRequests() {
    const { repoId, dataVersion, selectedRepo } = useApp();
    const [params, setParams] = useSearchParams();
    const filter = FILTERS.some((f) => f.value === params.get('waiting')) ? params.get('waiting') : 'all';
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('priority');
    const [layout, setLayout] = useState(() => load('sentinel.prLayout', 'grid'));

    const fetchPRs = useCallback(() => getPRs(repoId), [repoId]);
    const { data: prs = [], loading, refetch } = useResource(fetchPRs, [], dataVersion);

    const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, prs.filter(f.match).length])), [prs]);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const match = FILTERS.find((f) => f.value === filter).match;
        return prs
            .filter(match)
            .filter((p) => !q || `${p.title} ${p.author} #${p.number} ${p.repoName} ${(p.people || []).join(' ')}`.toLowerCase().includes(q))
            .sort(SORTS[sort].fn);
    }, [prs, filter, query, sort]);

    const setFilter = (value) => setParams(value === 'all' ? {} : { waiting: value }, { replace: true });
    const setLayoutSaved = (value) => { setLayout(value); save('sentinel.prLayout', value); };

    return (
        <>
            <PageHeader eyebrow={selectedRepo ? selectedRepo.fullName : 'All repositories'} title="Pull requests"
                subtitle={`${prs.length} open · ${counts.reviewer} waiting on review · ${counts.author} on authors`}
                actions={(
                    <>
                        <select className="select" style={{ width: 160, height: 34 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                            {Object.entries(SORTS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
                        </select>
                        <Segmented id="layout" size="sm" value={layout} onChange={setLayoutSaved}
                            options={[{ value: 'grid', label: 'Cards', icon: LayoutGrid }, { value: 'list', label: 'List', icon: List }]} />
                        <button type="button" className="icon-btn" onClick={refetch} aria-label="Refresh"><RefreshCw size={16} className={loading ? 'spin' : undefined} /></button>
                    </>
                )} />

            <div className="row wrap" style={{ gap: 12, marginBottom: 20 }}>
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    <Segmented id="waiting" value={filter} onChange={setFilter}
                        options={FILTERS.map((f) => ({ value: f.value, label: f.label, icon: f.icon, tone: f.tone, count: counts[f.value] }))} />
                </div>
                <div className="spacer" />
                <div className="input-icon" style={{ width: 260, maxWidth: '100%' }}>
                    <Search size={15} />
                    <input className="input" placeholder="Filter by title, person or #number" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
            </div>

            {loading && prs.length === 0 ? (
                <div className="grid grid-cards">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</div>
            ) : prs.length === 0 ? (
                <div className="card"><EmptyState icon={GitPullRequest} title="No open pull requests">Run a scan to load pull requests, or add a repository.</EmptyState></div>
            ) : visible.length === 0 ? (
                <div className="card"><EmptyState icon={SearchX} title="Nothing matches">Try another tab or clear the filter.</EmptyState></div>
            ) : (
                <AnimatePresence mode="popLayout">
                    {layout === 'grid' ? (
                        <motion.div key={`grid-${filter}-${sort}`} className="grid grid-cards" variants={stagger(0.04)} initial="hidden" animate="show"
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                            {visible.map((pr) => <PRCard key={pr.id} pr={pr} />)}
                        </motion.div>
                    ) : (
                        <motion.div key={`list-${filter}-${sort}`} className="card" style={{ padding: 6 }} variants={stagger(0.03)} initial="hidden" animate="show"
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                            {visible.map((pr) => <PRRow key={pr.id} pr={pr} showRepo={!repoId} />)}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </>
    );
}
