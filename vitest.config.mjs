import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./vitest.setup.ts'],
        include: [
            'lib/__tests__/**/*.test.ts',
            'app/**/*.test.ts',
            'app/**/*.test.tsx',
            'components/**/*.test.tsx',
        ],
        exclude: ['node_modules', '.next', 'dist', 'e2e'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'html'],
            reportsDirectory: './coverage',
            include: [
                'lib/**/*.ts',
                'app/api/**/*.ts',
                'components/**/*.tsx',
            ],
            exclude: [
                'node_modules',
                '.next',
                'e2e',
                '**/*.test.*',
                '**/__tests__/**',
                'lib/supabase/**',
                'vitest.config.mjs',
                'vitest.setup.ts',
            ],
            thresholds: {
                // Per-glob thresholds: enforce 80% on pure-logic lib files,
                // leave API routes and components to grow organically.
                'lib/utils.ts': {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
                'lib/errors.ts': {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
                'lib/schemas.ts': {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
                'lib/api-utils.ts': {
                    statements: 50,
                    branches: 50,
                    functions: 50,
                    lines: 50,
                },
                'lib/api-handler.ts': {
                    statements: 70,
                    branches: 60,
                    functions: 70,
                    lines: 70,
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './'),
        },
    },
})
