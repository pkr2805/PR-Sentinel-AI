import {
    Box, VStack, HStack, Text, Icon, Separator, Flex,
} from '@chakra-ui/react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, GitPullRequest, Database,
    ScrollText, Settings, Zap,
} from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'PR Explorer', path: '/prs', icon: GitPullRequest },
    { label: 'Repositories', path: '/repos', icon: Database },
    { label: 'Logs', path: '/logs', icon: ScrollText },
];

function NavItem({ icon: IconComp, label, path }) {
    const location = useLocation();
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    return (
        <Box
            as={NavLink}
            to={path}
            w="100%"
            display="flex"
            alignItems="center"
            gap={3}
            px={4}
            py={2.5}
            borderRadius="10px"
            color={isActive ? '#2B72E8' : '#64748B'}
            bg={isActive ? '#EBF4FF' : 'transparent'}
            borderLeftWidth="2px"
            borderLeftStyle="solid"
            borderLeftColor={isActive ? '#2B72E8' : 'transparent'}
            _hover={{ bg: '#F8FAFC', color: '#1A202C' }}
            transition="all 0.15s"
            fontWeight={isActive ? '600' : '400'}
            fontSize="sm"
            textDecoration="none"
        >
            <Icon as={IconComp} boxSize={4} />
            <Text>{label}</Text>
        </Box>
    );
}

export default function Sidebar() {
    return (
        <Box
            w="220px"
            minW="220px"
            bg="white"
            borderRightWidth="1px"
            borderRightColor="#E2E8F0"
            display="flex"
            flexDir="column"
            py={4}
            h="100vh"
            position="sticky"
            top={0}
        >
            {/* Logo */}
            <HStack px={4} mb={5} gap={3}>
                <Flex w={9} h={9} borderRadius="10px" bg="#2B72E8"
                    align="center" justify="center"
                    boxShadow="0 4px 12px rgba(43,114,232,0.3)">
                    <Icon as={Zap} boxSize={5} color="white" />
                </Flex>
                <Box>
                    <Text fontWeight="800" fontSize="sm" color="#1A202C" lineHeight="1.2">PR Sentinel</Text>
                    <Text fontSize="10px" color="#94A3B8" fontWeight="500">AI Agent v1.0</Text>
                </Box>
            </HStack>

            <Separator borderColor="#E2E8F0" mb={3} />

            <VStack px={2} gap={0.5} flex={1} align="stretch">
                {NAV_ITEMS.map((item) => <NavItem key={item.path} {...item} />)}
            </VStack>

            <Separator borderColor="#E2E8F0" my={3} />

            <VStack px={2} gap={0.5} align="stretch">
                <NavItem icon={Settings} label="Settings" path="/settings" />
                <HStack px={4} py={2} gap={3}>
                    <Box w={7} h={7} borderRadius="full" bg="#2B72E8"
                        display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                        <Text fontSize="10px" fontWeight="700" color="white">KK</Text>
                    </Box>
                    <Box flex={1} overflow="hidden">
                        <Text fontSize="xs" fontWeight="600" color="#1A202C" truncate>Kris Kumar</Text>
                        <Text fontSize="10px" color="#94A3B8">Admin</Text>
                    </Box>
                    <Box w={2} h={2} borderRadius="full" bg="#48BB78" />
                </HStack>
            </VStack>
        </Box>
    );
}
