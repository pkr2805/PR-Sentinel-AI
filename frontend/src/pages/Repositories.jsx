import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderGit2, Plus, Pencil, Trash2, Hash, KanbanSquare, GitPullRequest, ArrowUpRight, Github } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import { CardSkeleton } from '../components/ui/Skeleton';
import { ToneIcon } from '../components/ui/Chip';
import { stagger, rise, trackSpotlight } from '../components/ui/motion';
import { useApp } from '../context/app-context';
import { createRepo, updateRepo, deleteRepo, toggleRepo } from '../services/api';

const EMPTY = { owner: '', name: '', jiraProjectKey: '', slackChannel: '' };

function RepoForm({ initial, editing, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        const fullName = form.owner.includes('/') ? form.owner.trim() : `${form.owner.trim()}/${form.name.trim()}`;
        const [owner, name] = fullName.split('/');
        if (!editing && (!owner || !name)) { setError('Enter the repository as owner/name.'); return; }
        setSaving(true);
        setError(null);
        try {
            await onSubmit({ ...form, owner, name });
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
            {!editing && (
                <div className="grid grid-2" style={{ gap: 10 }}>
                    <label className="field"><span className="field-label">Owner</span>
                        <input className="input mono" autoFocus placeholder="octocat or octocat/hello" value={form.owner} onChange={set('owner')} /></label>
                    <label className="field"><span className="field-label">Repository</span>
                        <input className="input mono" placeholder="hello-world" value={form.name} onChange={set('name')} disabled={form.owner.includes('/')} /></label>
                </div>
            )}
            <label className="field"><span className="field-label">Slack channel</span>
                <input className="input" placeholder="#eng-reviews" value={form.slackChannel} onChange={set('slackChannel')} />
                <span className="field-hint">Where the daily digest and escalations go. Optional.</span></label>
            <label className="field"><span className="field-label">Jira project key</span>
                <input className="input mono" placeholder="BACK" value={form.jiraProjectKey} onChange={set('jiraProjectKey')} />
                <span className="field-hint">Lets the AI look up linked tickets. Optional.</span></label>
            {error && <div className="chip" data-tone="danger" style={{ height: 'auto', padding: '8px 12px', borderRadius: 10, whiteSpace: 'normal' }}>{error}</div>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{editing ? 'Save changes' : 'Add repository'}</button>
            </div>
        </form>
    );
}

function RepoCard({ repo, onEdit, onDelete, onToggle, onOpen }) {
    return (
        <motion.article variants={rise} layout exit={{ opacity: 0, scale: 0.96 }} className="card card-interactive spotlight card-pad"
            onMouseMove={trackSpotlight} style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: repo.active ? 1 : 0.72 }}>
            <div className="row" style={{ gap: 12 }}>
                <ToneIcon tone={repo.active ? 'brand' : 'neutral'} icon={FolderGit2} />
                <div className="col" style={{ flex: 1 }}>
                    <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noreferrer" className="mono truncate row" style={{ fontWeight: 600, gap: 6 }}>
                        {repo.fullName}<ArrowUpRight size={13} className="faint" />
                    </a>
                    <span className="muted" style={{ fontSize: 12.5 }}>{repo.active ? 'Scanned every 6 hours' : 'Paused'}</span>
                </div>
                <Switch on={repo.active} onChange={(v) => onToggle(repo, v)} label={`Monitor ${repo.fullName}`} />
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
                <span className="chip chip-sm" data-tone={repo.slackChannel ? 'info' : 'neutral'}><Hash size={11} />{repo.slackChannel || 'No Slack channel'}</span>
                <span className="chip chip-sm" data-tone={repo.jiraProjectKey ? 'review' : 'neutral'}><KanbanSquare size={11} />{repo.jiraProjectKey || 'No Jira'}</span>
            </div>
            <div className="row" style={{ marginTop: 'auto', gap: 4 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(repo)}>
                    <GitPullRequest size={14} />{repo.openPRs ?? 0} open PRs
                </button>
                <div className="spacer" />
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => onEdit(repo)} aria-label="Edit"><Pencil size={15} /></button>
                <button type="button" className="icon-btn icon-btn-sm" data-tone="danger" onClick={() => onDelete(repo)} aria-label="Remove"><Trash2 size={15} /></button>
            </div>
        </motion.article>
    );
}

export default function Repositories() {
    const { repos, reposLoading, refresh, toast, setRepoId } = useApp();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [editing, setEditing] = useState(null);
    const [removing, setRemoving] = useState(null);
    const adding = params.get('add') === '1';

    const closeAdd = () => setParams({}, { replace: true });

    const add = async (form) => {
        await createRepo(form);
        toast('Repository added', { description: `${form.owner}/${form.name} will be scanned on the next run.`, tone: 'ready' });
        closeAdd();
        refresh();
    };
    const save = async (form) => {
        await updateRepo(editing.id, { slack_channel: form.slackChannel || null, jira_project_key: form.jiraProjectKey || null });
        toast('Repository updated', { tone: 'ready' });
        setEditing(null);
        refresh();
    };
    const toggle = async (repo, active) => {
        try {
            await toggleRepo(repo.id, active);
            toast(active ? 'Monitoring resumed' : 'Monitoring paused', { description: repo.fullName, tone: active ? 'ready' : 'neutral' });
            refresh();
        } catch (err) {
            toast('Could not update the repository', { description: err.message, tone: 'danger' });
        }
    };
    const remove = async () => {
        const repo = removing;
        setRemoving(null);
        try {
            await deleteRepo(repo.id);
            toast('Repository removed', { description: repo.fullName, tone: 'neutral' });
            refresh();
        } catch (err) {
            toast('Could not remove the repository', { description: err.message, tone: 'danger' });
        }
    };
    const open = (repo) => { setRepoId(repo.id); navigate('/prs'); };

    return (
        <>
            <PageHeader eyebrow="Setup" title="Repositories" subtitle="Choose which GitHub repositories PR Sentinel watches."
                actions={<button type="button" className="btn btn-primary" onClick={() => setParams({ add: '1' })}><Plus size={16} />Add repository</button>} />

            {reposLoading ? (
                <div className="grid grid-cards">{Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} lines={2} />)}</div>
            ) : repos.length === 0 ? (
                <div className="card">
                    <EmptyState icon={Github} title="No repositories yet" action={<button type="button" className="btn btn-primary" onClick={() => setParams({ add: '1' })}><Plus size={16} />Add repository</button>}>
                        Add a repository and PR Sentinel will start explaining why its pull requests are waiting.
                    </EmptyState>
                </div>
            ) : (
                <motion.div className="grid grid-cards" variants={stagger(0.05)} initial="hidden" animate="show">
                    <AnimatePresence>
                        {repos.map((r) => <RepoCard key={r.id} repo={r} onEdit={setEditing} onDelete={setRemoving} onToggle={toggle} onOpen={open} />)}
                    </AnimatePresence>
                </motion.div>
            )}

            <Modal open={adding} onClose={closeAdd} title="Add a repository" subtitle="Public or private, as long as your GitHub token can read it."
                icon={<ToneIcon tone="brand" icon={FolderGit2} />}>
                <RepoForm initial={EMPTY} onSubmit={add} onCancel={closeAdd} />
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.fullName || ''} subtitle="Notification and Jira settings"
                icon={<ToneIcon tone="brand" icon={Pencil} />}>
                {editing && <RepoForm key={editing.id} editing initial={{ ...EMPTY, slackChannel: editing.slackChannel || '', jiraProjectKey: editing.jiraProjectKey || '' }}
                    onSubmit={save} onCancel={() => setEditing(null)} />}
            </Modal>

            <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove repository?" icon={<ToneIcon tone="danger" icon={Trash2} />}
                footer={<>
                    <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
                    <button type="button" className="btn btn-danger" onClick={remove}>Remove</button>
                </>}>
                <p className="text-2">PR Sentinel will stop watching <span className="mono">{removing?.fullName}</span>. Its history stays in the activity log.</p>
            </Modal>
        </>
    );
}
