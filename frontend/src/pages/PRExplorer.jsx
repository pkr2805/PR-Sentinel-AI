import { Box, Flex, Text, HStack, VStack, Icon, Spinner, SimpleGrid } from '@chakra-ui/react';
import { Search, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import PRCard from '../components/PRCard';
import StatusBadge from '../components/StatusBadge';
import { usePRs } from '../hooks/usePRs';
import { getRepos } from '../services/api';

const DECISIONS = ['ASK_TO_MERGE', 'PING_REVIEWER', 'PING_AUTHOR', 'ESCALATE', 'IGNORE'];

export default function PRExplorer() {
    const [repoId, setRepoId] = useState('');
    const [repos, setRepos] = useState([]);
    const [query, setQuery] = useState('');
    const [decision, setDecision] = useState('');
    const [sort, setSort] = useState('inactivity');

    const { prs, loading, refetch, total } = usePRs(repoId || null);

    useEffect(() => { getRepos().then(setRepos); }, []);

    const filtered = prs
        .filter((p) =>
            (!query || p.title.toLowerCase().includes(query.toLowerCase()) || p.author.toLowerCase().includes(query.toLowerCase())) &&
            (!decision || p.decision === decision)
        )
        .sort((a, b) => sort === 'inactivity' ? b.inactivityDays - a.inactivityDays : b.escalationLevel - a.escalationLevel);

    const counts = DECISIONS.reduce((acc, d) => ({ ...acc, [d]: prs.filter((p) => p.decision === d).length }), {});

    return (
        <Box>
            <Flex justify="space-between" align="center" mb={6}>
                <Box>
                    <Text fontSize="xl" fontWeight="800" color="#1A202C">PR Explorer</Text>
                    <Text fontSize="sm" color="#64748B">{filtered.length} of {total} pull requests</Text>
                </Box>
                <Box as="button" px={3} py={1.5} borderRadius="7px" fontSize="xs" fontWeight="600"
                    bg="white" color="#64748B" borderWidth="1px" borderColor="#E2E8F0"
                    display="flex" alignItems="center" gap={1.5}
                    style={{ cursor: 'pointer' }} onClick={refetch}>
                    <RefreshCw size={13} /> Refresh
                </Box>
            </Flex>

            {/* Decision filter pills */}
            <HStack mb={5} gap={2} flexWrap="wrap">
                {DECISIONS.map((d) => (
                    <HStack key={d} gap={1.5} px={3} py={1.5} borderRadius="8px"
                        borderWidth="1px"
                        borderColor={decision === d ? '#2B72E8' : '#E2E8F0'}
                        bg={decision === d ? '#EBF4FF' : 'white'}
                        cursor="pointer"
                        onClick={() => setDecision(decision === d ? '' : d)}
                        transition="all 0.15s"
                        _hover={{ borderColor: '#2B72E8' }}>
                        <StatusBadge status={d} />
                        <Box px="5px" py="1px" borderRadius="full"
                            bg="#F1F5F9" color="#64748B" fontSize="10px" fontWeight="600">
                            {counts[d]}
                        </Box>
                    </HStack>
                ))}
            </HStack>

            {/* Search + Filters */}
            <HStack gap={3} mb={5} flexWrap="wrap">
                <HStack bg="white" borderWidth="1px" borderColor="#E2E8F0"
                    borderRadius="8px" px={3} py={1.5} gap={2} flex="1" maxW="300px">
                    <Icon as={Search} boxSize={3.5} color="#94A3B8" />
                    <input placeholder="Search PR title or author..."
                        value={query} onChange={(e) => setQuery(e.target.value)}
                        style={{
                            background: 'transparent', border: 'none', outline: 'none',
                            color: '#1A202C', fontSize: '13px', width: '100%', fontFamily: 'inherit'
                        }} />
                </HStack>
                <select value={repoId} onChange={(e) => setRepoId(e.target.value)}
                    style={{
                        background: 'white', border: '1px solid #E2E8F0', color: '#1A202C',
                        borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
                        outline: 'none', fontFamily: 'inherit'
                    }}>
                    <option value="">All Repos</option>
                    {repos.map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)}
                    style={{
                        background: 'white', border: '1px solid #E2E8F0', color: '#1A202C',
                        borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
                        outline: 'none', fontFamily: 'inherit'
                    }}>
                    <option value="inactivity">Sort: Most Inactive</option>
                    <option value="escalation">Sort: Highest Escalation</option>
                </select>
            </HStack>

            {/* Grid */}
            {loading ? (
                <Flex justify="center" py={16}><Spinner size="lg" color="#2B72E8" /></Flex>
            ) : filtered.length === 0 ? (
                <VStack py={16} gap={2}>
                    <Text color="#64748B" fontSize="lg">No PRs found</Text>
                    <Text color="#94A3B8" fontSize="sm">Try adjusting your filters</Text>
                </VStack>
            ) : (
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={4}>
                    {filtered.map((pr) => <PRCard key={pr.id} pr={pr} onRefresh={refetch} />)}
                </SimpleGrid>
            )}
        </Box>
    );
}
