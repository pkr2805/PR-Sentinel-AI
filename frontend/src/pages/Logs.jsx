import { Box, Flex, Text, HStack, VStack, Icon, Spinner, SimpleGrid } from '@chakra-ui/react';
import { RefreshCw, CheckCircle, XCircle, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import { getLogs, getRepos } from '../services/api';

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [repos, setRepos] = useState([]);
    const [repoId, setRepoId] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        const [logData, repoData] = await Promise.all([getLogs(repoId || null), getRepos()]);
        setLogs(logData);
        setRepos(repoData);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [repoId]);

    const TH = ({ children }) => (
        <Box as="th" px={4} py={3} textAlign="left" fontSize="10px" fontWeight="700"
            color="#64748B" textTransform="uppercase" letterSpacing="0.5px"
            borderBottomWidth="1px" borderBottomColor="#E2E8F0" bg="#F8FAFC">
            {children}
        </Box>
    );

    const TD = ({ children, ...props }) => (
        <Box as="td" px={4} py={3} fontSize="xs" color="#1A202C"
            borderBottomWidth="1px" borderBottomColor="#F1F5F9" {...props}>
            {children}
        </Box>
    );

    return (
        <Box>
            <Flex justify="space-between" align="center" mb={6}>
                <Box>
                    <Text fontSize="xl" fontWeight="800" color="#1A202C">Execution Logs</Text>
                    <Text fontSize="sm" color="#64748B">{logs.length} log entries</Text>
                </Box>
                <HStack gap={2}>
                    <select value={repoId} onChange={(e) => setRepoId(e.target.value)}
                        style={{
                            background: 'white', border: '1px solid #E2E8F0', color: '#1A202C',
                            borderRadius: '7px', padding: '6px 10px', fontSize: '12px',
                            outline: 'none', fontFamily: 'inherit', minWidth: '180px'
                        }}>
                        <option value="">All Repositories</option>
                        {repos.map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                    </select>
                    <Box as="button" px={3} py={1.5} borderRadius="7px" fontSize="xs" fontWeight="600"
                        bg="white" color="#64748B" borderWidth="1px" borderColor="#E2E8F0"
                        display="flex" alignItems="center" gap={1.5}
                        style={{ cursor: 'pointer' }} onClick={fetchData}>
                        <RefreshCw size={13} /> Refresh
                    </Box>
                </HStack>
            </Flex>

            <Box bg="white" borderWidth="1px" borderColor="#E2E8F0" borderRadius="12px" overflow="hidden"
                boxShadow="0 1px 4px rgba(0,0,0,0.04)">
                {loading ? (
                    <Flex justify="center" py={12}><Spinner color="#2B72E8" /></Flex>
                ) : logs.length === 0 ? (
                    <Flex justify="center" py={12}>
                        <Text color="#64748B" fontSize="sm">No execution logs found</Text>
                    </Flex>
                ) : (
                    <Box as="table" w="100%" style={{ borderCollapse: 'collapse' }}>
                        <Box as="thead">
                            <Box as="tr">
                                <TH>Run ID</TH>
                                <TH>Repo</TH>
                                <TH>PR</TH>
                                <TH>Decision</TH>
                                <TH>Slack</TH>
                                <TH>Status</TH>
                                <TH>Timestamp</TH>
                            </Box>
                        </Box>
                        <Box as="tbody">
                            {logs.map((log) => {
                                const repo = repos.find((r) => r.id === log.repoId);
                                return (
                                    <Box as="tr" key={log.id} _hover={{ bg: '#F8FAFC' }} transition="background 0.1s">
                                        <TD><Text fontFamily="mono" fontSize="10px" color="#94A3B8">{log.id}</Text></TD>
                                        <TD><Text color="#475569">{repo?.fullName || log.repoId}</Text></TD>
                                        <TD><Text fontFamily="mono" color="#2B72E8" fontWeight="600">{log.prId}</Text></TD>
                                        <TD><StatusBadge status={log.decision} /></TD>
                                        <TD>
                                            {log.slackSent ? (
                                                <HStack gap={1} color="#059669">
                                                    <Send size={12} /><Text fontSize="xs">Sent</Text>
                                                </HStack>
                                            ) : (
                                                <HStack gap={1} color="#94A3B8">
                                                    <XCircle size={12} /><Text fontSize="xs">No</Text>
                                                </HStack>
                                            )}
                                        </TD>
                                        <TD>
                                            <HStack gap={1} color={log.status === 'success' ? '#059669' : '#DC2626'}>
                                                {log.status === 'success' ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                                <Text fontWeight="500">{log.status}</Text>
                                            </HStack>
                                        </TD>
                                        <TD>
                                            <Text fontFamily="mono" color="#94A3B8" fontSize="10px">
                                                {new Date(log.timestamp).toLocaleString('en-US', {
                                                    month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                            </Text>
                                        </TD>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
