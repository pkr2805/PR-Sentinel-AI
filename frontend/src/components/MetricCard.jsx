import { Box, Flex, Icon, Text } from '@chakra-ui/react';

export default function MetricCard({ label, value, icon: IconComp, color = '#2B72E8', bg = 'rgba(43,114,232,0.08)', change, positive }) {
    return (
        <Box
            bg="white"
            borderWidth="1px"
            borderColor="#E2E8F0"
            borderRadius="12px"
            p={4}
            className="fade-in"
            transition="all 0.2s"
            boxShadow="0 1px 4px rgba(0,0,0,0.04)"
            _hover={{ borderColor: color, transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
        >
            <Flex justify="space-between" align="flex-start" mb={2}>
                <Text fontSize="11px" color="#64748B" fontWeight="600"
                    textTransform="uppercase" letterSpacing="0.5px"
                    overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                    {label}
                </Text>
                {IconComp && (
                    <Flex w={8} h={8} borderRadius="8px" bg={bg}
                        align="center" justify="center" flexShrink={0} ml={1}>
                        <Icon as={IconComp} boxSize={3.5} color={color} />
                    </Flex>
                )}
            </Flex>
            <Text fontSize="2xl" fontWeight="800" color="#1A202C">{value}</Text>
            {change != null && (
                <Text fontSize="10px" color={positive ? '#065F46' : '#991B1B'} mt={0.5}>
                    {positive ? '▴' : '▾'} {change} vs yesterday
                </Text>
            )}
        </Box>
    );
}
