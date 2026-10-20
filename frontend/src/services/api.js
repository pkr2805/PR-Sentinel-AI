import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
    (res) => res.data,
    (err) => Promise.reject(new Error(err.response?.data?.detail || err.message))
);

// ─── Repos ────────────────────────────────────────────────────────────────────
export const getRepos = async () => {
    const data = await api.get('/repos');
    return data.map(repo => ({
        ...repo,
        fullName: `${repo.owner}/${repo.name}`,
        jiraProjectKey: repo.jira_project_key,
        slackChannel: repo.slack_channel,
        openPRs: repo.open_prs
    }));
};

export const createRepo = async (data) => {
    const payload = {
        owner: data.owner,
        name: data.name,
        jira_project_key: data.jiraProjectKey,
        slack_channel: data.slackChannel
    };
    const repo = await api.post('/repos', payload);
    return {
        ...repo,
        fullName: `${repo.owner}/${repo.name}`,
        jiraProjectKey: repo.jira_project_key,
        slackChannel: repo.slack_channel,
        openPRs: repo.open_prs
    };
};

const normalizeRepo = (repo) => ({
    ...repo,
    fullName: `${repo.owner}/${repo.name}`,
    jiraProjectKey: repo.jira_project_key,
    slackChannel: repo.slack_channel,
    openPRs: repo.open_prs,
});

export const updateRepo = async (id, data) => {
    return normalizeRepo(await api.put(`/repos/${id}`, data));
};

export const deleteRepo = async (id) => {
    return await api.delete(`/repos/${id}`);
};

export const toggleRepo = async (id, active) => {
    return await api.post(`/repos/${id}/toggle?active=${active}`);
};

// ─── PRs ──────────────────────────────────────────────────────────────────────
const normalizePR = (pr) => ({
    ...pr,
    repoName: pr.repo_id,
    inactivityDays: pr.inactivity_days,
    escalationLevel: pr.escalation_level,
    waitingOn: pr.waiting_on,
    nextStep: pr.next_step,
    people: pr.people || [],
    lastNotifiedAt: pr.last_notified_at,
});

export const getPRs = async (repoId = null) => {
    const data = await api.get('/prs', { params: repoId ? { repo_id: repoId } : {} });
    return data.map(normalizePR);
};

export const getPRById = async (prId) => {
    return normalizePR(await api.get(`/prs/${encodeURIComponent(prId)}`));
};

// ─── Agent ────────────────────────────────────────────────────────────────────
export const triggerAgent = async (repoId = null) => {
    return await api.post(`/agent/run?repo_id=${repoId}`);
};

export const approveDecision = async (prId, action) => {
    return await api.post(`/prs/${encodeURIComponent(prId)}/override`, { decision: action });
};

export const overrideDecision = async (prId, decision) => {
    return await api.post(`/prs/${encodeURIComponent(prId)}/override`, { decision: decision });
};

// ─── Logs & Stats ─────────────────────────────────────────────────────────────
export const getLogs = async (repoId = null, prId = null) => {
    const data = await api.get('/logs', { params: { repo_id: repoId, pr_id: prId } });
    return data.map((log) => ({ ...log, prId: log.pr_id, repoId: log.repo_id, slackSent: log.slack_sent }));
};

export const getStats = async (repoId = null) => {
    return await api.get('/stats', { params: repoId ? { repo_id: repoId } : {} });
};

// ─── Approvals ────────────────────────────────────────────────────────────────
export const getPendingActions = async (repoId = null) => {
    return await api.get('/actions', { params: repoId ? { repo_id: repoId } : {} });
};

export const approvePendingAction = async (id) => {
    return await api.post(`/actions/${id}/approve`);
};

export const rejectPendingAction = async (id) => {
    return await api.post(`/actions/${id}/reject`);
};
