import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    test: {
        globals: true,
        include: ['lib/__tests__/*.test.ts'],
        exclude: ['node_modules', '.next', 'dist'],
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './'),
        },
    },
})
