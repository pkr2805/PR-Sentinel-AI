import {
    Box, SimpleGrid, Flex, Text, HStack, VStack,
    Icon, Spinner,
} from '@chakra-ui/react';
import {
    GitPullRequest, Clock, AlertTriangle, GitMerge,
    Zap, Database, Bell, TrendingUp,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useState, useEffect } from 'react';

import MetricCard from '../components/MetricCard';
import PRCard from '../components/PRCard';
import Timeline from '../components/Timeline';
import PendingApprovals from '../components/PendingApprovals';
import { useAgentStatus } from '../hooks/useAgentStatus';
import { usePRs } from '../hooks/usePRs';
import { getStats, getRepos } from '../services/api';
import { mockActivityChart } from '../data/mockData';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [repos, setRepos] = useState([]);
    const [repoId] = useState(null);

    const { prs, loading: prsLoading, stale, refetch } = usePRs(repoId);
    const agent = useAgentStatus(repoId);

    useEffect(() => {
        getStats(repoId).then(setStats);
        getRepos().then(setRepos);
    }, [repoId]);

    const METRICS = stats ? [
        { label: 'Open PRs', value: stats.totalPRs, icon: GitPullRequest, color: '#2B72E8', bg: '#EBF4FF', change: '+3', positive: false },
        { label: 'Stale PRs', value: stats.stalePRs, icon: Clock, color: '#D97706', bg: '#FEF3C7', change: '+1', positive: false },
        { label: 'Escalated', value: stats.escalated, icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2', change: '-1', positive: true },
        { label: 'Merge Ready', value: stats.mergeReady, icon: GitMerge, color: '#059669', bg: '#D1FAE5', change: '+2', positive: true },
        { label: 'Agent Runs', value: stats.agentRunsToday, icon: Zap, color: '#7C3AED', bg: '#EDE9FE', change: null, positive: true },
        { label: 'Needs Approval', value: stats.pendingApprovals ?? 0, icon: Bell, color: '#0891B2', bg: '#CFFAFE', change: null, positive: true },
        { label: 'Repos', value: stats.reposMonitored, icon: Database, color: '#0D9488', bg: '#CCFBF1', change: null, positive: true },
        { label: 'Avg Inactivity', value: `${stats.avgInactivity}d`, icon: TrendingUp, color: '#D97706', bg: '#FEF3C7', change: '-0.8d', positive: true },
    ] : [];

    return (
        <Box>
            <Flex justify="space-between" align="center" mb={6}>
                <Box>
                    <Text fontSize="xl" fontWeight="800" color="#1A202C">Dashboard</Text>
                    <Text fontSize="sm" color="#64748B">
                        Agentic PR Intelligence · {repos.length} repos monitored
                    </Text>
                </Box>
                <Box
                    as="button"
                    px={4} py={2} borderRadius="8px" fontSize="sm" fontWeight="600"
                    bg={agent.isRunning ? '#EBF4FF' : '#2B72E8'}
                    color={agent.isRunning ? '#1E40AF' : 'white'}
                    display="flex" alignItems="center" gap={2}
                    style={{ border: 'none', cursor: agent.isRunning ? 'not-allowed' : 'pointer' }}
                    boxShadow={agent.isRunning ? 'none' : '0 2px 8px rgba(43,114,232,0.3)'}
                    onClick={agent.isRunning ? undefined : agent.trigger}
                >
                    {agent.isRunning ? <Spinner size="xs" /> : <Icon as={Zap} boxSize={4} />}
                    {agent.isRunning ? 'Running...' : 'Run Agent Now'}
                </Box>
            </Flex>

            {/* Agent progress */}
            {agent.isRunning && (
                <Box mb={4} p={3} borderRadius="10px" bg="#EBF4FF"
                    borderWidth="1px" borderColor="#BFDBFE">
                    <Text fontSize="sm" color="#1E40AF" fontWeight="600" mb={2}>
                        Agent running: {agent.steps[agent.step] || 'Completing...'}
                    </Text>
                    <Box bg="#E2E8F0" borderRadius="full" h="4px" overflow="hidden">
                        <Box h="100%" bg="#2B72E8" borderRadius="full"
                            transition="width 0.4s ease"
                            style={{ width: `${agent.progress}%` }} />
                    </Box>
                </Box>
            )}
            {agent.isCompleted && (
                <Box mb={4} p={3} borderRadius="10px" bg="#D1FAE5"
                    borderWidth="1px" borderColor="#6EE7B7">
                    <Text fontSize="sm" color="#065F46">✓ Agent run completed — {prs.length} PRs evaluated</Text>
                </Box>
            )}

            {/* Metrics */}
            <SimpleGrid columns={{ base: 2, md: 4, lg: 8 }} gap={3} mb={6}>
                {METRICS.map((m) => <MetricCard key={m.label} {...m} />)}
            </SimpleGrid>

            {/* Chart + Timeline */}
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={4} mb={6}>
                <Box gridColumn={{ lg: 'span 2' }} bg="white" borderWidth="1px"
                    borderColor="#E2E8F0" borderRadius="12px" p={4}
                    boxShadow="0 1px 4px rgba(0,0,0,0.04)">
                    <Text fontWeight="700" color="#1A202C" fontSize="sm" mb={4}>Weekly Activity</Text>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={mockActivityChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gPings" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gEscalations" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gMerges" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} labelStyle={{ color: '#1A202C' }} />
                            <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                            <Area type="monotone" dataKey="pings" stroke="#D97706" fill="url(#gPings)" strokeWidth={2} name="Pings" />
                            <Area type="monotone" dataKey="escalations" stroke="#DC2626" fill="url(#gEscalations)" strokeWidth={2} name="Escalations" />
                            <Area type="monotone" dataKey="merges" stroke="#059669" fill="url(#gMerges)" strokeWidth={2} name="Merges" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Box>

                <Box bg="white" borderWidth="1px" borderColor="#E2E8F0" borderRadius="12px" p={4}
                    boxShadow="0 1px 4px rgba(0,0,0,0.04)">
                    <Text fontWeight="700" color="#1A202C" fontSize="sm" mb={4}>Execution Log</Text>
                    <Timeline events={agent.logs} />
                </Box>
            </SimpleGrid>

            <PendingApprovals onChange={() => getStats(repoId).then(setStats)} />

            {/* Stale PRs */}
            <Box>
                <Flex justify="space-between" align="center" mb={3}>
                    <Text fontWeight="700" color="#1A202C" fontSize="sm">Stale PRs Requiring Action</Text>
                    <Text fontSize="xs" color="#64748B">{stale.length} PRs</Text>
                </Flex>
                {prsLoading ? (
                    <Flex justify="center" py={8}><Spinner color="#2B72E8" /></Flex>
                ) : (
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={3}>
                        {stale.slice(0, 6).map((pr) => <PRCard key={pr.id} pr={pr} onRefresh={refetch} />)}
                    </SimpleGrid>
                )}
            </Box>
        </Box>
    );
}
