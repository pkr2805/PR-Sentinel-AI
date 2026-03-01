import { Flex, HStack, Text, Icon, Box } from '@chakra-ui/react';
import { Bell, Zap } from 'lucide-react';

export default function Topbar({ repos = [], selectedRepoId, onRepoChange }) {
    return (
        <Flex
            h="56px" px={6}
            align="center" justify="space-between"
            borderBottomWidth="1px" borderBottomColor="#E2E8F0"
            bg="white"
            position="sticky" top={0} zIndex={10}
            boxShadow="0 1px 4px rgba(0,0,0,0.04)"
        >
            {/* Repo selector */}
            <HStack
                bg="#F8FAFC" borderWidth="1px" borderColor="#E2E8F0"
                borderRadius="8px" px={3} py={1.5} gap={2} minW="200px"
            >
                <Icon as={Zap} boxSize={3.5} color="#2B72E8" />
                <select
                    value={selectedRepoId || ''}
                    onChange={(e) => onRepoChange?.(e.target.value || null)}
                    style={{
                        background: 'transparent', border: 'none', color: '#1A202C',
                        fontSize: '12px', fontWeight: '600', outline: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', minWidth: '150px',
                    }}
                >
                    <option value="" style={{ background: 'white' }}>All Repositories</option>
                    {repos.map((r) => (
                        <option key={r.id} value={r.id} style={{ background: 'white' }}>{r.fullName}</option>
                    ))}
                </select>
            </HStack>

            {/* Center */}
            <Text fontSize="xs" color="#94A3B8" fontFamily="mono" display={{ base: 'none', md: 'block' }}>
                Last run:{' '}
                <Text as="span" color="#2B72E8" fontWeight="600">Mar 1, 2026 · 12:20 AM</Text>
            </Text>

            {/* Right */}
            <HStack gap={3}>
                <Box
                    px={2} py={0.5} borderRadius="full" fontSize="10px"
                    bg="rgba(56,161,105,0.1)" color="#276749" fontWeight="700"
                    borderWidth="1px" borderColor="rgba(56,161,105,0.2)"
                >
                    ● Live
                </Box>
                <Box position="relative" cursor="pointer">
                    <Icon as={Bell} boxSize={5} color="#94A3B8" _hover={{ color: '#1A202C' }} transition="color 0.15s" />
                    <Box position="absolute" top="-2px" right="-2px" w={2} h={2} borderRadius="full" bg="#E53E3E" />
                </Box>
            </HStack>
        </Flex>
    );
}
