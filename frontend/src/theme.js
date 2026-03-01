import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
    theme: {
        tokens: {
            colors: {
                brand: {
                    50: { value: '#EBF4FF' },
                    100: { value: '#C3DAFF' },
                    200: { value: '#9AC3FF' },
                    300: { value: '#6FA8FF' },
                    400: { value: '#4A90F5' },
                    500: { value: '#2B72E8' },
                    600: { value: '#1A5ACF' },
                    700: { value: '#1044AA' },
                    800: { value: '#0A3080' },
                    900: { value: '#051D55' },
                },
            },
            fonts: {
                heading: { value: "'Inter', sans-serif" },
                body: { value: "'Inter', sans-serif" },
                mono: { value: "'JetBrains Mono', monospace" },
            },
        },
        semanticTokens: {
            colors: {
                'bg.DEFAULT': { value: '#F4F6FA' },
                'bg.card': { value: '#FFFFFF' },
                'border.DEFAULT': { value: '#E2E8F0' },
                'text.DEFAULT': { value: '#1A202C' },
                'text.muted': { value: '#64748B' },
            },
        },
    },
    globalCss: {
        body: {
            bg: '#F4F6FA',
            color: '#1A202C',
            fontFamily: "'Inter', sans-serif",
        },
        '*': { boxSizing: 'border-box' },
        '::-webkit-scrollbar': { width: '6px' },
        '::-webkit-scrollbar-track': { background: '#F4F6FA' },
        '::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '4px' },
    },
});

const system = createSystem(defaultConfig, config);
export default system;
