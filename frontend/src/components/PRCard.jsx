import { Box, Flex, HStack, VStack, Text, Icon, Separator, Spinner } from '@chakra-ui/react';
import { GitPullRequest, Clock, AlertTriangle, GitMerge, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { approveDecision, overrideDecision } from '../services/api';

export default function PRCard({ pr, onRefresh }) {
    const navigate = useNavigate();
    const [showOverride, setShowOverride] = useState(false);
    const [override, setOverride] = useState(pr.decision);
    const [loading, setLoading] = useState(false);

    const inactColor = pr.inactivityDays >= 10 ? '#991B1B' : pr.inactivityDays >= 5 ? '#92400E' : '#64748B';

    const handleApprove = async (e) => {
        e.stopPropagation();
        setLoading(true);
        await approveDecision(pr.id, pr.decision);
        setLoading(false);
        onRefresh?.();
    };

    const handleOverride = async () => {
        setLoading(true);
        await overrideDecision(pr.id, override);
        setLoading(false);
        setShowOverride(false);
        onRefresh?.();
    };

    return (
        <Box
            bg="white"
            borderWidth="1px"
            borderColor="#E2E8F0"
            borderRadius="12px"
            p={4}
            cursor="pointer"
            onClick={() => navigate(`/prs/${pr.id}`)}
            transition="all 0.2s"
            boxShadow="0 1px 4px rgba(0,0,0,0.04)"
            _hover={{ borderColor: '#2B72E8', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
            className="fade-in"
        >
            {/* Title */}
            <Flex justify="space-between" align="flex-start" mb={3}>
                <HStack align="flex-start" flex={1} mr={3} gap={2}>
                    <Icon as={GitPullRequest} boxSize={4} color="#2B72E8" flexShrink={0} mt={0.5} />
                    <Box>
                        <Text fontWeight="600" fontSize="sm" color="#1A202C" lineHeight="1.4"
                            overflow="hidden" display="-webkit-box"
                            style={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {pr.title}
                        </Text>
                        <HStack gap={2} mt={0.5}>
                            <Text fontSize="xs" color="#94A3B8">#{pr.number}</Text>
                            <Text fontSize="xs" color="#CBD5E0">·</Text>
                            <Text fontSize="xs" color="#94A3B8" fontFamily="mono">{pr.repoName}</Text>
                        </HStack>
                    </Box>
                </HStack>
                <StatusBadge status={pr.decision} />
            </Flex>

            {/* Labels */}
            {pr.labels?.length > 0 && (
                <HStack gap={1} mb={3} flexWrap="wrap">
                    {pr.labels.map((l) => (
                        <Box key={l} px="6px" py="2px" borderRadius="4px"
                            borderWidth="1px" borderColor="#E2E8F0"
                            color="#64748B" fontSize="10px" fontWeight="500">
                            {l}
                        </Box>
                    ))}
                </HStack>
            )}

            <Separator borderColor="#E2E8F0" mb={3} />

            {/* Stats */}
            <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                <HStack gap={3} flexWrap="wrap">
                    <HStack gap={1} color={inactColor}>
                        <Icon as={Clock} boxSize={3.5} />
                        <Text fontSize="xs" fontWeight="500">{pr.inactivityDays}d inactive</Text>
                    </HStack>
                    <Text color="#E2E8F0">|</Text>
                    <HStack gap={1}>
                        <Text fontSize="xs" color="#065F46" fontWeight="600">+{pr.additions}</Text>
                        <Text fontSize="xs" color="#991B1B" fontWeight="600">-{pr.deletions}</Text>
                    </HStack>

                    {pr.mergeableState && (
                        <>
                            <Text color="#E2E8F0">|</Text>
                            <HStack gap={1}
                                color={pr.mergeableState === 'clean' ? '#059669' : pr.mergeableState === 'dirty' ? '#DC2626' : '#64748B'}
                                bg={pr.mergeableState === 'clean' ? '#D1FAE5' : pr.mergeableState === 'dirty' ? '#FEE2E2' : '#F1F5F9'}
                                px="6px" py="2px" borderRadius="4px">
                                {pr.mergeableState === 'clean' ? <CheckCircle size={10} /> : pr.mergeableState === 'dirty' ? <XCircle size={10} /> : <div />}
                                <Text fontSize="10px" fontWeight="700" textTransform="uppercase">{pr.mergeableState}</Text>
                            </HStack>
                        </>
                    )}
                    {pr.escalationLevel > 0 && (
                        <HStack gap={1} color="#92400E">
                            <Icon as={AlertTriangle} boxSize={3.5} />
                            <Text fontSize="xs" fontWeight="500">L{pr.escalationLevel}</Text>
                        </HStack>
                    )}
                </HStack>
                <HStack gap={2}>
                    <Box w={6} h={6} borderRadius="full" bg="#DBEAFE"
                        display="flex" alignItems="center" justifyContent="center">
                        <Text fontSize="8px" color="#1E40AF" fontWeight="700">
                            {pr.author.slice(0, 2).toUpperCase()}
                        </Text>
                    </Box>
                    <StatusBadge status={pr.jiraStatus} />
                </HStack>
            </Flex>

            {/* Actions */}
            {pr.decision !== 'IGNORE' && !showOverride && (
                <Flex mt={3} pt={3} borderTopWidth="1px" borderTopColor="#E2E8F0" justify="flex-end" gap={2}>
                    <Box as="button" px={3} py={1.5} borderRadius="6px" fontSize="xs" fontWeight="600"
                        bg="transparent" color="#64748B" borderWidth="1px" borderColor="#E2E8F0"
                        _hover={{ bg: '#F8FAFC', color: '#1A202C' }}
                        display="flex" alignItems="center" gap={1}
                        onClick={(e) => { e.stopPropagation(); setShowOverride(true); }}>
                        <MessageSquare size={11} /> Override
                    </Box>
                    <Box as="button" px={3} py={1.5} borderRadius="6px" fontSize="xs" fontWeight="600"
                        bg={pr.decision === 'ASK_TO_MERGE' ? '#D1FAE5' : pr.decision === 'ESCALATE' ? '#FEE2E2' : '#FEF3C7'}
                        color={pr.decision === 'ASK_TO_MERGE' ? '#065F46' : pr.decision === 'ESCALATE' ? '#991B1B' : '#92400E'}
                        _hover={{ opacity: 0.85 }}
                        display="flex" alignItems="center" gap={1}
                        onClick={handleApprove}>
                        {loading ? <Spinner size="xs" /> : pr.decision === 'ASK_TO_MERGE' ? <GitMerge size={11} /> : <CheckCircle size={11} />}
                        Approve
                    </Box>
                </Flex>
            )}

            {/* Inline override */}
            {showOverride && (
                <Box mt={3} pt={3} borderTopWidth="1px" borderTopColor="#E2E8F0"
                    onClick={(e) => e.stopPropagation()}>
                    <Text fontSize="xs" color="#64748B" mb={2}>Override decision:</Text>
                    <HStack gap={2}>
                        <select value={override} onChange={(e) => setOverride(e.target.value)}
                            style={{
                                flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0',
                                color: '#1A202C', borderRadius: '6px', padding: '4px 8px',
                                fontSize: '12px', outline: 'none', fontFamily: 'inherit'
                            }}>
                            <option value="ASK_TO_MERGE">Ask to Merge</option>
                            <option value="PING_REVIEWER">Ping Reviewer</option>
                            <option value="ESCALATE">Escalate</option>
                            <option value="IGNORE">Ignore</option>
                        </select>
                        <Box as="button" px={3} py={1.5} borderRadius="6px" fontSize="xs"
                            fontWeight="600" bg="#F8FAFC" color="#64748B"
                            borderWidth="1px" borderColor="#E2E8F0"
                            onClick={() => setShowOverride(false)}>Cancel</Box>
                        <Box as="button" px={3} py={1.5} borderRadius="6px" fontSize="xs"
                            fontWeight="600" bg="#DBEAFE" color="#1E40AF"
                            onClick={handleOverride}>
                            {loading ? <Spinner size="xs" /> : 'Apply'}
                        </Box>
                    </HStack>
                </Box>
            )}
        </Box>
    );
}
