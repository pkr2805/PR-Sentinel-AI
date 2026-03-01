import { useState, useEffect, useCallback } from 'react';
import { getPRs } from '../services/api';

export function usePRs(repoId = null) {
    const [prs, setPRs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getPRs(repoId);
            const normalizedData = data.map(pr => ({
                ...pr,
                inactivityDays: pr.inactivity_days,
                escalationLevel: pr.escalation_level,
                mergeable: pr.mergeable,
                mergeableState: pr.mergeable_state
            }));
            setPRs(normalizedData);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    }, [repoId]);

    useEffect(() => { fetch(); }, [fetch]);

    // Derived slices
    const stale = prs.filter((p) => p.inactivityDays >= 5);
    const escalated = prs.filter((p) => p.decision === 'ESCALATE');
    const mergeReady = prs.filter((p) => p.decision === 'ASK_TO_MERGE');
    const byDecision = (dec) => prs.filter((p) => p.decision === dec);

    return {
        prs,
        loading,
        error,
        refetch: fetch,
        stale,
        escalated,
        mergeReady,
        byDecision,
        total: prs.length,
    };
}
