import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`${name} is required for server-side admin operations`)
    }
    return value
}

export function createAdminClient() {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    return createClient(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
}
