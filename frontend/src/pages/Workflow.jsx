import { Box, Flex, Text, HStack, VStack, Icon, Spinner } from '@chakra-ui/react';
import { Info } from 'lucide-react';
import GraphView from '../components/GraphView';

const LEGEND = [
    { label: 'Trigger', color: '#2b72e8' },
    { label: 'GitHub/Jira', color: '#0ea5e9' },
    { label: 'LLM Decision', color: '#60a5fa' },
    { label: 'Merge', color: '#16a34a' },
    { label: 'Ping', color: '#ca8a04' },
    { label: 'Escalate', color: '#dc2626' },
    { label: 'Ignore', color: '#4b5563' },
    { label: 'Slack + DB', color: '#9333ea' },
];

const NODE_DESCS = [
    { node: 'fetch_prs_node', desc: 'Queries GitHub API for all open PRs. Extracts number, title, author, reviewers, labels, and inactivity since last commit or review.' },
    { node: 'jira_status_node', desc: 'Extracts Jira ticket ID from PR branch name or description, then queries Jira API for current status.' },
    { node: 'llm_decision_node', desc: 'Passes full PR context to LLM. Returns one of: ASK_TO_MERGE, PING_REVIEWER, ESCALATE, or IGNORE.' },
    { node: 'escalation_node', desc: 'Checks reminder count against threshold. If breached, increases escalation_level and routes to manager channel.' },
    { node: 'slack_node', desc: 'Sends structured Slack digest grouped by decision type, using repo-specific channel config.' },
    { node: 'persistence_node', desc: 'Writes execution result, decision, escalation level, and Slack message ID to PostgreSQL for audit and dedup.' },
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
