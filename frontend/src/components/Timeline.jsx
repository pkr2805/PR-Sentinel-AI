import { Box, VStack, HStack, Text, Icon } from '@chakra-ui/react';
import { CheckCircle, Send, AlertTriangle, GitMerge, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';

const ICONS = { ASK_TO_MERGE: GitMerge, PING_REVIEWER: Send, PING_AUTHOR: Send, ESCALATE: AlertTriangle, IGNORE: Clock };
const COLORS = { ASK_TO_MERGE: '#065F46', PING_REVIEWER: '#92400E', PING_AUTHOR: '#075985', ESCALATE: '#991B1B', IGNORE: '#64748B' };
const BG = { ASK_TO_MERGE: '#D1FAE5', PING_REVIEWER: '#FEF3C7', PING_AUTHOR: '#E0F2FE', ESCALATE: '#FEE2E2', IGNORE: '#F1F5F9' };

export default function Timeline({ events = [] }) {
    if (!events.length) {
        return (
            <Box py={6} textAlign="center">
                <Text fontSize="sm" color="#94A3B8">No events yet</Text>
            </Box>
        );
    }

    return (
        <VStack align="stretch" gap={0}>
            {events.map((event, idx) => {
                const IconComp = ICONS[event.decision] || CheckCircle;
                const color = COLORS[event.decision] || '#64748B';
                const dotBg = BG[event.decision] || '#F1F5F9';
                const isLast = idx === events.length - 1;

                return (
                    <HStack key={event.id} align="flex-start" gap={3} position="relative">
                        <Box position="relative" flexShrink={0}>
                            <Box
                                w={7} h={7} borderRadius="full"
                                bg={dotBg} borderWidth="1.5px" borderColor={color}
                                display="flex" alignItems="center" justifyContent="center"
                                position="relative" zIndex={1}
                            >
                                <Icon as={IconComp} boxSize={3} color={color} />
                            </Box>
                            {!isLast && (
                                <Box position="absolute" left="50%" top="28px"
                                    transform="translateX(-50%)"
                                    w="1px" minH="24px" bg="#E2E8F0" />
                            )}
                        </Box>
                        <Box pb={isLast ? 0 : 5} flex={1}>
                            <HStack justify="space-between" mb={0.5}>
                                <StatusBadge status={event.decision} size="xs" />
                                <Text fontSize="10px" color="#94A3B8" fontFamily="mono">
                                    {new Date(event.timestamp).toLocaleString('en-US', {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                    })}
                                </Text>
                            </HStack>
                            <Text fontSize="xs" color="#64748B">
                                {event.slackSent ? '✓ Slack notification sent' : 'No notification sent'}
                            </Text>
                        </Box>
                    </HStack>
                );
            })}
        </VStack>
    );
}
