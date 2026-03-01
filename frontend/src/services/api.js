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

export const updateRepo = async (id, data) => {
    return await api.put(`/repos/${id}`, data);
};

export const deleteRepo = async (id) => {
    return await api.delete(`/repos/${id}`);
};

export const toggleRepo = async (id, active) => {
    return await api.post(`/repos/${id}/toggle?active=${active}`);
};

// ─── PRs ──────────────────────────────────────────────────────────────────────
export const getPRs = async (repoId = null) => {
    return await api.get('/prs', { params: repoId ? { repo_id: repoId } : {} });
};

export const getPRById = async (prId) => {
    return await api.get(`/prs/${prId}`);
};

// ─── Agent ────────────────────────────────────────────────────────────────────
export const triggerAgent = async (repoId = null) => {
    return await api.post(`/agent/run?repo_id=${repoId}`);
};

export const approveDecision = async (prId, action) => {
    return await api.post(`/prs/${prId}/override`, { decision: action });
};

export const overrideDecision = async (prId, decision) => {
    return await api.post(`/prs/${prId}/override`, { decision: decision });
};

// ─── Logs & Stats ─────────────────────────────────────────────────────────────
export const getLogs = async (repoId = null, prId = null) => {
    return await api.get('/logs', { params: { repo_id: repoId, pr_id: prId } });
};

export const getStats = async (repoId = null) => {
    return await api.get('/stats', { params: repoId ? { repo_id: repoId } : {} });
};
