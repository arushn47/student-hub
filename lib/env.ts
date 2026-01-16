// Environment variable validation
// This file is imported early to ensure all required env vars are present

const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const serverOnlyEnvVars = [
    'GEMINI_API_KEY',
] as const

// Validate client-side env vars
export function validateEnv() {
    const missing: string[] = []

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar)
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Please add them to your .env.local file.`
        )
    }
}

// Validate server-side env vars (only call from server code)
export function validateServerEnv() {
    validateEnv()

    const missing: string[] = []

    for (const envVar of serverOnlyEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar)
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required server environment variables: ${missing.join(', ')}\n` +
            `Please add them to your .env.local file.`
        )
    }
}

// Type-safe env access
export const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    geminiApiKey: process.env.GEMINI_API_KEY!,
}
