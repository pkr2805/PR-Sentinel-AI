import { Box } from '@chakra-ui/react';

const CONFIG = {
    ASK_TO_MERGE: { label: 'Ask to Merge', bg: '#D1FAE5', color: '#065F46' },
    PING_REVIEWER: { label: 'Ping Reviewer', bg: '#FEF3C7', color: '#92400E' },
    ESCALATE: { label: 'Escalate', bg: '#FEE2E2', color: '#991B1B' },
    IGNORE: { label: 'Ignore', bg: '#F1F5F9', color: '#475569' },
    PENDING: { label: 'Pending', bg: '#EDE9FE', color: '#5B21B6' },
    Done: { label: 'Done', bg: '#D1FAE5', color: '#065F46' },
    'In Progress': { label: 'In Progress', bg: '#DBEAFE', color: '#1E40AF' },
    'To Do': { label: 'To Do', bg: '#F1F5F9', color: '#475569' },
    Blocked: { label: 'Blocked', bg: '#FEE2E2', color: '#991B1B' },
};

export default function StatusBadge({ status, size = 'sm' }) {
    const cfg = CONFIG[status] || { label: status || 'Unknown', bg: '#F1F5F9', color: '#475569' };
    return (
        <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            px="8px"
            py="2px"
            borderRadius="6px"
            bg={cfg.bg}
            color={cfg.color}
            fontSize={size === 'sm' ? '11px' : '10px'}
            fontWeight="700"
            letterSpacing="0.2px"
            lineHeight="1.5"
            whiteSpace="nowrap"
        >
            {cfg.label}
        </Box>
    );
}
