import {
    Box, Flex, Text, SimpleGrid, HStack, VStack,
    Icon, Spinner, Separator,
} from '@chakra-ui/react';
import { ArrowLeft, GitPullRequest, GitMerge, Send, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';
import { getPRById, approveDecision, overrideDecision, getLogs } from '../services/api';

const STATE_LABELS = {
    DRAFT: 'Draft',
    CI_FAILING: 'CI failing',
    CI_PENDING: 'CI running',
    MERGE_CONFLICT: 'Merge conflict',
    NEEDS_FIRST_REVIEW: 'Needs a first review',
    CHANGES_REQUESTED: 'Changes requested',
    FEEDBACK_ADDRESSED: 'Feedback addressed',
    READY_TO_MERGE: 'Ready to merge',
    DISCUSSION_STALLED: 'Discussion stalled',
    ABANDONED: 'Inactive',
};

export default function PRDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [pr, setPR] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showOverride, setShowOverride] = useState(false);
    const [override, setOverride] = useState('');
    const [actioning, setActioning] = useState(false);

    useEffect(() => {
        Promise.all([getPRById(id), getLogs()]).then(([prData, logData]) => {
            setPR(prData);
            setOverride(prData?.decision || '');
            setLogs((logData || []).filter((l) => l.prId === id));
            setLoading(false);
        });
    }, [id]);

    const handleApprove = async () => {
        setActioning(true);
        await approveDecision(id, pr.decision);
        setActioning(false);
    };

    const handleOverride = async () => {
        setActioning(true);
        await overrideDecision(id, override);
        setPR((prev) => ({ ...prev, decision: override }));
        setActioning(false);
        setShowOverride(false);
    };

    if (loading) return <Flex justify="center" align="center" h="60vh"><Spinner color="#2B72E8" /></Flex>;
    if (!pr) return <Flex justify="center" align="center" h="60vh"><Text color="#64748B">PR not found</Text></Flex>;

    const inactColor = pr.inactivityDays >= 10 ? '#DC2626' : pr.inactivityDays >= 5 ? '#D97706' : '#1A202C';

    const Card = ({ children, ...props }) => (
        <Box bg="white" borderWidth="1px" borderColor="#E2E8F0" borderRadius="12px" p={4}
            boxShadow="0 1px 4px rgba(0,0,0,0.04)" {...props}>
            {children}
        </Box>
    );

    return (
        <Box>
            <Box as="button" px={0} py={1} bg="transparent" border="none"
                color="#64748B" display="flex" alignItems="center" gap={1.5}
                style={{ cursor: 'pointer', fontSize: '13px' }}
                onClick={() => navigate(-1)}>
                <Icon as={ArrowLeft} boxSize={4} /> Back
            </Box>

            {/* Header */}
            <Flex justify="space-between" align="flex-start" my={5} gap={4}>
                <Box flex={1}>
                    <HStack gap={2} mb={1}>
                        <Icon as={GitPullRequest} color="#2B72E8" boxSize={5} />
                        <Text fontSize="xs" color="#94A3B8" fontFamily="mono">#{pr.number} · {pr.repoName}</Text>
                    </HStack>
                    <Text fontSize="xl" fontWeight="800" color="#1A202C" lineHeight="1.3">{pr.title}</Text>
                    <HStack gap={2} mt={2} flexWrap="wrap">
                        <StatusBadge status={pr.decision} />
                        <StatusBadge status={pr.jiraStatus} />
                        {pr.labels?.map((l) => (
                            <Box key={l} px="6px" py="1px" borderRadius="4px"
                                borderWidth="1px" borderColor="#E2E8F0" color="#64748B" fontSize="10px">{l}</Box>
                        ))}
                    </HStack>
                </Box>
                <VStack gap={2} align="flex-end">
                    {pr.decision !== 'IGNORE' && (
                        <Box as="button" px={3} py={1.5} borderRadius="7px" fontSize="xs" fontWeight="600"
                            bg="#D1FAE5" color="#065F46" display="flex" alignItems="center" gap={1.5}
                            style={{ border: 'none', cursor: 'pointer' }} onClick={handleApprove}>
                            {actioning ? <Spinner size="xs" /> : <Icon as={CheckCircle} boxSize={3.5} />}
                            Approve
                        </Box>
                    )}
                    <Box as="button" px={3} py={1.5} borderRadius="7px" fontSize="xs" fontWeight="600"
                        bg="#F1F5F9" color="#475569" display="flex" alignItems="center" gap={1.5}
                        style={{ border: '1px solid #E2E8F0', cursor: 'pointer' }}
                        onClick={() => setShowOverride(!showOverride)}>
                        <Icon as={Send} boxSize={3.5} /> Override
                    </Box>
                </VStack>
            </Flex>

            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={4}>
                {/* Left */}
                <Box gridColumn={{ lg: 'span 2' }}>
                    {/* Assessment */}
                    {pr.state && (
                        <Box bg="white" borderWidth="1px" borderColor="#E2E8F0" borderRadius="12px" p={4}
                            boxShadow="0 1px 4px rgba(0,0,0,0.04)" mb={4}>
                            <Flex justify="space-between" align="center" mb={2}>
                                <Text fontSize="sm" fontWeight="700" color="#1A202C">
                                    {STATE_LABELS[pr.state] || pr.state}
                                    <Text as="span" fontWeight="500" color="#64748B"> · waiting on {pr.waitingOn}</Text>
                                </Text>
                                {pr.url && (
                                    <Box as="a" href={pr.url} target="_blank" rel="noreferrer" fontSize="xs"
                                        color="#2B72E8" display="flex" alignItems="center" gap={1}>
                                        GitHub <Icon as={ExternalLink} boxSize={3} />
                                    </Box>
                                )}
                            </Flex>
                            <Text fontSize="sm" color="#1A202C" mb={2}>{pr.reason}</Text>
                            <Text fontSize="sm" color="#1A202C" mb={2}>
                                <b>Next step:</b> {pr.people.length > 0 && `${pr.people.map((p) => `@${p}`).join(' ')} `}{pr.nextStep}
                            </Text>
                            <Text fontSize="xs" color="#94A3B8">
                                {pr.source === 'llm' ? 'AI judgement' : pr.source === 'cache' ? 'Unchanged since last run' : 'Rule engine'}
                                {pr.confidence != null && ` · confidence ${Math.round(pr.confidence * 100)}%`}
                            </Text>
                        </Box>
                    )}

                    {/* Stats */}
                    <Card mb={4}>
                        <SimpleGrid columns={4} gap={4}>
                            {[
                                { label: 'Inactive', value: `${pr.inactivityDays}d`, color: inactColor },
                                { label: 'Additions', value: `+${pr.additions}`, color: '#059669' },
                                { label: 'Deletions', value: `-${pr.deletions}`, color: '#DC2626' },
                                { label: 'Escalation', value: `L${pr.escalationLevel}`, color: pr.escalationLevel > 0 ? '#D97706' : '#94A3B8' },
                            ].map((s) => (
                                <Box key={s.label}>
                                    <Text fontSize="10px" color="#64748B" textTransform="uppercase" letterSpacing="0.5px" mb={1}>{s.label}</Text>
                                    <Text fontSize="2xl" fontWeight="800" color={s.color}>{s.value}</Text>
                                </Box>
                            ))}
                        </SimpleGrid>
                    </Card>

                    {/* People */}
                    <Card mb={4}>
                        <Text fontSize="sm" fontWeight="700" color="#1A202C" mb={3}>People</Text>
                        <HStack gap={6}>
                            <Box>
                                <Text fontSize="xs" color="#64748B" mb={1}>Author</Text>
                                <HStack gap={2}>
                                    <Box w={7} h={7} borderRadius="full" bg="#DBEAFE"
                                        display="flex" alignItems="center" justifyContent="center">
                                        <Text fontSize="9px" color="#1E40AF" fontWeight="700">
                                            {pr.author.slice(0, 2).toUpperCase()}
                                        </Text>
                                    </Box>
                                    <Text fontSize="sm" color="#1A202C">{pr.author}</Text>
                                </HStack>
                            </Box>
                            {pr.reviewers?.length > 0 && (
                                <Box>
                                    <Text fontSize="xs" color="#64748B" mb={1}>Reviewers</Text>
                                    <HStack gap={1}>
                                        {pr.reviewers.map((r) => (
                                            <Box key={r} w={7} h={7} borderRadius="full" bg="#F1F5F9"
                                                display="flex" alignItems="center" justifyContent="center" title={r}>
                                                <Text fontSize="9px" color="#475569" fontWeight="700">
                                                    {r.slice(0, 2).toUpperCase()}
                                                </Text>
                                            </Box>
                                        ))}
                                    </HStack>
                                </Box>
                            )}
                        </HStack>
                    </Card>

                    {/* Jira */}
                    <Card mb={showOverride ? 4 : 0}>
                        <Flex justify="space-between" align="center" mb={1}>
                            <Text fontSize="sm" fontWeight="700" color="#1A202C">Jira: {pr.jiraId}</Text>
                            <Box as="a" href="#" fontSize="xs" color="#2B72E8" display="flex" alignItems="center" gap={1}>
                                Open <Icon as={ExternalLink} boxSize={3} />
                            </Box>
                        </Flex>
                        <StatusBadge status={pr.jiraStatus} />
                    </Card>

                    {/* Inline override */}
                    {showOverride && (
                        <Card>
                            <Text fontSize="sm" fontWeight="700" color="#1A202C" mb={3}>Override Decision</Text>
                            <Text fontSize="xs" color="#64748B" mb={2}>
                                Current: <StatusBadge status={pr.decision} />
                            </Text>
                            <HStack gap={2}>
                                <select value={override} onChange={(e) => setOverride(e.target.value)}
                                    style={{
                                        flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0',
                                        color: '#1A202C', borderRadius: '6px', padding: '6px 10px',
                                        fontSize: '13px', outline: 'none', fontFamily: 'inherit'
                                    }}>
                                    <option value="ASK_TO_MERGE">Ask to Merge</option>
                                    <option value="PING_REVIEWER">Ping Reviewer</option>
                                    <option value="PING_AUTHOR">Ping Author</option>
                                    <option value="ESCALATE">Escalate</option>
                                    <option value="IGNORE">Ignore</option>
                                </select>
                                <Box as="button" px={3} py={2} borderRadius="7px" fontSize="xs"
                                    fontWeight="600" bg="#F8FAFC" color="#64748B"
                                    style={{ border: '1px solid #E2E8F0', cursor: 'pointer' }}
                                    onClick={() => setShowOverride(false)}>Cancel</Box>
                                <Box as="button" px={3} py={2} borderRadius="7px" fontSize="xs"
                                    fontWeight="600" bg="#DBEAFE" color="#1E40AF"
                                    style={{ border: 'none', cursor: 'pointer' }}
                                    onClick={handleOverride}>
                                    {actioning ? <Spinner size="xs" /> : 'Apply'}
                                </Box>
                            </HStack>
                        </Card>
                    )}
                </Box>

                {/* Right — timeline */}
                <Card>
                    <Text fontSize="sm" fontWeight="700" color="#1A202C" mb={4}>Execution History</Text>
                    <Timeline events={logs} />
                </Card>
            </SimpleGrid>
        </Box>
    );
}
