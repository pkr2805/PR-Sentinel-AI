import { Box, Flex, Text, HStack, VStack, Spinner } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { getPendingActions, approvePendingAction, rejectPendingAction } from '../services/api';

const KIND_LABELS = { pr_comment: 'PR comment', slack_digest: 'Slack escalation', label: 'Labels' };

export default function PendingApprovals({ onChange }) {
    const [actions, setActions] = useState([]);
    const [busy, setBusy] = useState(null);

    const load = useCallback(() => getPendingActions().then(setActions).catch(() => setActions([])), []);

    useEffect(() => { load(); }, [load]);

    const decide = async (id, approve) => {
        setBusy(id);
        try {
            await (approve ? approvePendingAction(id) : rejectPendingAction(id));
        } finally {
            setBusy(null);
            await load();
            onChange?.();
        }
    };

    if (actions.length === 0) return null;

    return (
        <Box bg="white" borderWidth="1px" borderColor="#FCA5A5" borderRadius="12px" p={4} mb={6}
            boxShadow="0 1px 4px rgba(0,0,0,0.04)">
            <Flex justify="space-between" align="center" mb={3}>
                <Text fontWeight="700" color="#1A202C" fontSize="sm">Waiting for your approval</Text>
                <Text fontSize="xs" color="#64748B">{actions.length} escalation action(s)</Text>
            </Flex>
            <VStack align="stretch" gap={3}>
                {actions.map((a) => (
                    <Box key={a.id} borderWidth="1px" borderColor="#E2E8F0" borderRadius="8px" p={3}>
                        <Flex justify="space-between" align="center" mb={2} gap={3}>
                            <Text fontSize="xs" color="#64748B" fontFamily="mono">
                                {KIND_LABELS[a.kind] || a.kind} · {a.pr_id || a.repo_id}
                            </Text>
                            <HStack gap={2}>
                                {busy === a.id ? <Spinner size="xs" /> : (
                                    <>
                                        <Box as="button" px={3} py={1} borderRadius="6px" fontSize="xs" fontWeight="600"
                                            bg="#D1FAE5" color="#065F46" style={{ border: 'none', cursor: 'pointer' }}
                                            onClick={() => decide(a.id, true)}>Approve</Box>
                                        <Box as="button" px={3} py={1} borderRadius="6px" fontSize="xs" fontWeight="600"
                                            bg="#F1F5F9" color="#475569" style={{ border: '1px solid #E2E8F0', cursor: 'pointer' }}
                                            onClick={() => decide(a.id, false)}>Reject</Box>
                                    </>
                                )}
                            </HStack>
                        </Flex>
                        <Text fontSize="xs" color="#1A202C" whiteSpace="pre-wrap" fontFamily="mono"
                            maxH="120px" overflowY="auto">
                            {(a.summary || '').replace('<!-- pr-sentinel -->\n', '')}
                        </Text>
                    </Box>
                ))}
            </VStack>
        </Box>
    );
}
