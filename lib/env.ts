import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema: validate all env vars at startup with Zod.
// ---------------------------------------------------------------------------

const clientEnvSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
})

const serverEnvSchema = clientEnvSchema.extend({
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
})

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/** Validate client-side env vars. Safe to call anywhere. */
export function validateEnv() {
    const result = clientEnvSchema.safeParse(process.env)
    if (!result.success) {
        const formatted = result.error.issues
            .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
            .join('\n')
        throw new Error(`Missing or invalid environment variables:\n${formatted}`)
    }
}

/** Validate server-side env vars. Only call from server code (API routes, middleware). */
export function validateServerEnv() {
    const result = serverEnvSchema.safeParse(process.env)
    if (!result.success) {
        const formatted = result.error.issues
            .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
            .join('\n')
        throw new Error(`Missing or invalid server environment variables:\n${formatted}`)
    }
}

// ---------------------------------------------------------------------------
// Type-safe env access
// ---------------------------------------------------------------------------
export const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    geminiApiKey: process.env.GEMINI_API_KEY!,
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
}
