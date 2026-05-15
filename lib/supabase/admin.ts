import { createClient } from '@supabase/supabase-js'

if (process.env.NEXT_RUNTIME === 'edge' || typeof window !== 'undefined') {
    throw new Error('admin client must only be used server-side')
}

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`${name} is required for server-side admin operations`)
    }
    return value
}

export function createAdminClient() {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = requireEnv('SUPABASE_SECRET_KEY')

    return createClient(url, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
}
