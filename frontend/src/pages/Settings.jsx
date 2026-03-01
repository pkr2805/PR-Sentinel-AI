import { Box, Flex, Text, HStack, VStack, Icon, Spinner } from '@chakra-ui/react';
import { XCircle, Plus, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getRepos, createRepo, deleteRepo, toggleRepo } from '../services/api';

function AddRepoModal({ isOpen, onClose, onSave }) {
    const [form, setForm] = useState({ owner: '', name: '', jiraProjectKey: '', slackChannel: '', schedule: '0 */6 * * *' });
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setSaving(true);
        await onSave({ ...form, fullName: `${form.owner}/${form.name}` });
        setSaving(false);
        onClose();
    };

    const Field = ({ label, field, placeholder, type = 'text' }) => (
        <Box>
            <Text fontSize="xs" color="#64748B" mb={1}>{label}</Text>
            <input type={type} placeholder={placeholder} value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                style={{
                    width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0',
                    color: '#1A202C', borderRadius: '7px', padding: '8px 12px',
                    fontSize: '13px', outline: 'none', fontFamily: 'inherit'
                }} />
        </Box>
    );

    return (
        <Box position="fixed" inset={0} zIndex={50} display="flex" alignItems="center" justifyContent="center">
            <Box position="absolute" inset={0} bg="rgba(0,0,0,0.3)" onClick={onClose} />
            <Box position="relative" bg="white" borderWidth="1px" borderColor="#E2E8F0"
                borderRadius="14px" p={6} w="460px" maxW="90vw" zIndex={1}
                boxShadow="0 20px 60px rgba(0,0,0,0.15)">
                <Text fontWeight="700" color="#1A202C" fontSize="md" mb={5}>Add Repository</Text>
                <VStack gap={3} align="stretch" mb={5}>
                    <Field label="GitHub Owner" field="owner" placeholder="acme-corp" />
                    <Field label="Repository Name" field="name" placeholder="backend-api" />
                    <Field label="Jira Project Key" field="jiraProjectKey" placeholder="BACK" />
                    <Field label="Slack Channel" field="slackChannel" placeholder="#eng-prs" />
                    <Box>
                        <Text fontSize="xs" color="#64748B" mb={1}>Check Schedule</Text>
                        <select value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                            style={{
                                width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0',
                                color: '#1A202C', borderRadius: '7px', padding: '8px 12px',
                                fontSize: '13px', outline: 'none', fontFamily: 'inherit'
                            }}>
                            <option value="0 */6 * * *">Every 6 hours</option>
                            <option value="0 */12 * * *">Every 12 hours</option>
                            <option value="0 9 * * *">Daily at 9 AM</option>
                            <option value="0 9 * * 1-5">Weekdays at 9 AM</option>
                        </select>
                    </Box>
                </VStack>
                <HStack justify="flex-end" gap={2}>
                    <Box as="button" px={4} py={2} borderRadius="7px" fontSize="sm" fontWeight="600"
                        bg="white" color="#64748B"
                        style={{ border: '1px solid #E2E8F0', cursor: 'pointer' }}
                        onClick={onClose}>Cancel</Box>
                    <Box as="button" px={4} py={2} borderRadius="7px" fontSize="sm" fontWeight="600"
                        bg="#2B72E8" color="white"
                        style={{
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(43,114,232,0.3)'
                        }}
                        onClick={handleSave}>
                        {saving ? <Spinner size="xs" /> : 'Add Repository'}
                    </Box>
                </HStack>
            </Box>
        </Box>
    );
}

export default function Settings() {
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchRepos = async () => {
        setLoading(true);
        setRepos(await getRepos());
        setLoading(false);
    };

    useEffect(() => { fetchRepos(); }, []);

    return (
        <Box>
            <Flex justify="space-between" align="center" mb={2}>
                <Box>
                    <Text fontSize="xl" fontWeight="800" color="#1A202C">Settings</Text>
                    <Text fontSize="sm" color="#64748B">Manage monitored repositories</Text>
                </Box>
                <Box as="button" px={4} py={2} borderRadius="8px" fontSize="sm" fontWeight="600"
                    bg="#2B72E8" color="white" display="flex" alignItems="center" gap={2}
                    style={{
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(43,114,232,0.3)'
                    }}
                    onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Add Repository
                </Box>
            </Flex>

            <Box mt={6}>
                {loading ? (
                    <Flex justify="center" py={20}><Spinner color="#2B72E8" size="lg" /></Flex>
                ) : repos.length === 0 ? (
                    <Flex justify="center" align="center" direction="column" py={24} gap={3}>
                        <Box w={16} h={16} borderRadius="16px" bg="#F1F5F9"
                            display="flex" alignItems="center" justifyContent="center">
                            <Icon as={Database} boxSize={8} color="#CBD5E0" />
                        </Box>
                        <Text color="#475569" fontSize="lg" fontWeight="600">No repositories yet</Text>
                        <Text color="#94A3B8" fontSize="sm">Click "Add Repository" to start monitoring PRs.</Text>
                    </Flex>
                ) : (
                    <VStack gap={3} align="stretch">
                        {repos.map((repo) => (
                            <Flex key={repo.id}
                                p={5} borderRadius="14px"
                                bg="white" borderWidth="1px" borderColor="#E2E8F0"
                                justify="space-between" align="center"
                                transition="all 0.15s"
                                boxShadow="0 1px 4px rgba(0,0,0,0.04)"
                                _hover={{ borderColor: '#2B72E8', boxShadow: '0 4px 16px rgba(43,114,232,0.1)' }}>

                                <HStack gap={5}>
                                    <Flex w={12} h={12} borderRadius="12px"
                                        bg="#EBF4FF" align="center" justify="center" flexShrink={0}>
                                        <Icon as={Database} boxSize={6} color="#2B72E8" />
                                    </Flex>
                                    <Box>
                                        <Text fontSize="md" fontWeight="700" color="#1A202C" mb={1}>
                                            {repo.fullName}
                                        </Text>
                                        <HStack gap={3}>
                                            <Box px="8px" py="2px" borderRadius="5px"
                                                bg="#EDE9FE" color="#5B21B6"
                                                fontSize="11px" fontWeight="700">
                                                {repo.jiraProjectKey}
                                            </Box>
                                            <Text fontSize="12px" color="#64748B">{repo.slackChannel}</Text>
                                            {repo.openPRs != null && (
                                                <>
                                                    <Text color="#E2E8F0">·</Text>
                                                    <Text fontSize="12px" color="#64748B">{repo.openPRs} open PRs</Text>
                                                </>
                                            )}
                                        </HStack>
                                    </Box>
                                </HStack>

                                <HStack gap={5}>
                                    <Box px={3} py={1} borderRadius="6px" fontSize="12px" fontWeight="600"
                                        bg={repo.active ? '#D1FAE5' : '#F1F5F9'}
                                        color={repo.active ? '#065F46' : '#94A3B8'}>
                                        {repo.active ? '● Active' : '○ Paused'}
                                    </Box>

                                    {/* Toggle */}
                                    <Box as="button" w={12} h={6} borderRadius="full"
                                        bg={repo.active ? '#059669' : '#CBD5E0'}
                                        position="relative" transition="background 0.2s"
                                        style={{ cursor: 'pointer', border: 'none', flexShrink: 0 }}
                                        onClick={() => {
                                            toggleRepo(repo.id, !repo.active);
                                            setRepos((prev) => prev.map((r) =>
                                                r.id === repo.id ? { ...r, active: !r.active } : r));
                                        }}>
                                        <Box position="absolute" top="3px"
                                            left={repo.active ? '24px' : '3px'}
                                            w={4} h={4} borderRadius="full" bg="white"
                                            transition="left 0.2s"
                                            boxShadow="0 1px 3px rgba(0,0,0,0.2)"
                                        />
                                    </Box>

                                    {/* Delete */}
                                    <Box as="button" p={2} borderRadius="8px" color="#DC2626"
                                        style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                                        _hover={{ bg: '#FEE2E2' }}
                                        onClick={async () => {
                                            await deleteRepo(repo.id);
                                            setRepos((prev) => prev.filter((r) => r.id !== repo.id));
                                        }}>
                                        <XCircle size={20} />
                                    </Box>
                                </HStack>
                            </Flex>
                        ))}
                    </VStack>
                )}
            </Box>

            <AddRepoModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSave={async (data) => {
                    const newRepo = await createRepo(data);
                    setRepos((prev) => [...prev, newRepo]);
                }}
            />
        </Box>
    );
}
