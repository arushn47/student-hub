import { createClient } from '@/lib/supabase/server'
import { GoogleTokens, GoogleAccount, GoogleService } from '@/lib/google'

/**
 * Get Google tokens for a specific service.
 * Looks in google_accounts first, falls back to profiles for backwards compatibility.
 */
export async function getGoogleTokensForService(
    userId: string,
    service: GoogleService
): Promise<{ tokens: GoogleTokens | null; accountEmail: string | null }> {
    const supabase = await createClient()

    // Try google_accounts table first
    const { data: googleAccount } = await supabase
        .from('google_accounts')
        .select('*')
        .eq('user_id', userId)
        .contains('services', [service])
        .single()

    if (googleAccount) {
        const account = googleAccount as GoogleAccount
        return { tokens: account.tokens, accountEmail: account.email }
    }

    // Fallback to profiles for backwards compatibility
    const { data: profile } = await supabase
        .from('profiles')
        .select('google_tokens, google_connected')
        .eq('id', userId)
        .single()

    if (profile?.google_connected && profile?.google_tokens) {
        return { tokens: profile.google_tokens as GoogleTokens, accountEmail: null }
    }

    return { tokens: null, accountEmail: null }
}

/**
 * Check if user has any Google accounts connected
 */
export async function hasGoogleConnected(userId: string): Promise<boolean> {
    const supabase = await createClient()

    // Check google_accounts first
    const { count } = await supabase
        .from('google_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

    if (count && count > 0) return true

    // Fallback to profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('google_connected')
        .eq('id', userId)
        .single()

    return profile?.google_connected ?? false
}
