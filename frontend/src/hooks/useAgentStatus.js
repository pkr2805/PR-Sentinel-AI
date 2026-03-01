import { useState, useEffect, useCallback } from 'react';
import { triggerAgent, getLogs } from '../services/api';

const STEPS = [
    'Fetching open PRs',
    'Querying Jira status',
    'Calculating inactivity',
    'LLM decision engine',
    'Sending Slack alerts',
    'Persisting to DB',
];

export function useAgentStatus(repoId = null) {
    const [status, setStatus] = useState('idle');   // idle | running | completed | error
    const [step, setStep] = useState(0);
    const [runId, setRunId] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const data = await getLogs(repoId);
            setLogs(data);
        } catch { /* silently ignore */ }
        setLoadingLogs(false);
    }, [repoId]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const trigger = useCallback(async () => {
        setStatus('running');
        setStep(0);
        try {
            const res = await triggerAgent(repoId);
            setRunId(res.runId);
            // Step-through simulation — replace with real SSE/polling when backend ready
            for (let i = 0; i < STEPS.length; i++) {
                await new Promise((r) => setTimeout(r, 700));
                setStep(i + 1);
            }
            setStatus('completed');
            await fetchLogs();
        } catch {
            setStatus('error');
        }
    }, [repoId, fetchLogs]);

    const reset = useCallback(() => {
        setStatus('idle');
        setStep(0);
        setRunId(null);
    }, []);

    return {
        status, step, runId, steps: STEPS,
        logs, loadingLogs,
        trigger, reset, fetchLogs,
        isRunning: status === 'running',
        isCompleted: status === 'completed',
        isError: status === 'error',
        progress: Math.round((step / STEPS.length) * 100),
    };
}
