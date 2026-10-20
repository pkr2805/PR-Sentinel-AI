import { Box, Flex, Text, HStack, VStack, Icon, Spinner } from '@chakra-ui/react';
import { Info } from 'lucide-react';
import GraphView from '../components/GraphView';

const LEGEND = [
    { label: 'Trigger / fetch', color: '#2b72e8' },
    { label: 'Filter + cache', color: '#0ea5e9' },
    { label: 'Rules', color: '#16a34a' },
    { label: 'LLM judge', color: '#60a5fa' },
    { label: 'Plan', color: '#ca8a04' },
    { label: 'Approval', color: '#dc2626' },
    { label: 'Act + save', color: '#9333ea' },
];

const NODE_DESCS = [
    { node: 'trigger', desc: 'Runs every 6 hours, on demand, or when GitHub sends a webhook (review, CI result, push, comment).' },
    { node: 'fetch_prs', desc: 'One GitHub GraphQL query fetches every open PR with its reviews, review threads, CI status, conflicts and requested reviewers.' },
    { node: 'filter_prs', desc: 'Skips bot PRs, ignored labels and authors. PRs unchanged since the last run reuse their previous assessment.' },
    { node: 'assess_pr (parallel)', desc: 'Rules decide the certain states (draft, CI failing, conflict, ready to merge…). Only ambiguous PRs go to the LLM judge (Groq gpt-oss-120b, with MCP tools).' },
    { node: 'plan', desc: 'Compares with the last run: notifies only on a new state or after the reminder interval, respects quiet hours, holds escalations for approval.' },
    { node: 'act', desc: 'The only step that changes anything: edits one PR comment, sets sentinel:* labels and sends one Slack digest grouped by person. Dry-run by default.' },
];

export default function Workflow() {
    return (
        <Box>
            <Flex justify="space-between" align="center" mb={4}>
                <Box>
                    <Text fontSize="xl" fontWeight="800" color="white">Workflow Graph</Text>
                    <Text fontSize="sm" color="gray.400">LangGraph agent execution flow — interactive</Text>
                </Box>
                <HStack gap={2} bg="#161B22" borderWidth="1px" borderColor="#21262D"
                    borderRadius="8px" px={3} py={2}>
                    <Icon as={Info} boxSize={3.5} color="blue.400" />
                    <Text fontSize="xs" color="gray.400">Drag nodes · Scroll to zoom</Text>
                </HStack>
            </Flex>

            {/* Legend */}
            <HStack gap={2} mb={4} flexWrap="wrap">
                {LEGEND.map((l) => (
                    <HStack key={l.label} gap={1.5} px={2.5} py={1} borderRadius="6px"
                        bg="#161B22" borderWidth="1px" borderColor="#21262D">
                        <Box w={2.5} h={2.5} borderRadius="full" bg={l.color} />
                        <Text fontSize="10px" color="gray.300" fontWeight="600">{l.label}</Text>
                    </HStack>
                ))}
            </HStack>

            <GraphView height="580px" />

            {/* Node descriptions */}
            <Box mt={4} bg="#161B22" borderWidth="1px" borderColor="#21262D" borderRadius="12px" p={4}>
                <Text fontWeight="700" color="white" fontSize="sm" mb={3}>Node Descriptions</Text>
                <VStack align="stretch" gap={2}>
                    {NODE_DESCS.map((n) => (
                        <HStack key={n.node} align="flex-start" gap={3} p={3}
                            borderRadius="8px" bg="#1C2128">
                            <Box px={2} py={0.5} borderRadius="5px" bg="rgba(43,114,232,0.2)"
                                color="#90cdf4" fontSize="10px" fontWeight="700" fontFamily="mono"
                                flexShrink={0} mt={0.5} whiteSpace="nowrap">
                                {n.node}
                            </Box>
                            <Text fontSize="xs" color="gray.400" lineHeight="1.6">{n.desc}</Text>
                        </HStack>
                    ))}
                </VStack>
            </Box>
        </Box>
    );
}
