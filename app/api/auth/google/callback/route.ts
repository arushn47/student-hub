import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuth2Client } from '@/lib/google'

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error) {
            console.error('Google OAuth error:', error)
            return NextResponse.redirect(new URL('/dashboard/settings?google_error=denied', req.url))
        }

        if (!code) {
            return NextResponse.redirect(new URL('/dashboard/settings?google_error=no_code', req.url))
        }

        // Exchange code for tokens
        const redirectUri = new URL('/api/auth/google/callback', req.url).toString()
        const oauth2Client = getOAuth2Client({ redirectUri })
        const { tokens } = await oauth2Client.getToken(code)

        // Get authenticated user
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.redirect(new URL('/login', req.url))
        }

        // Store tokens in profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                google_tokens: tokens,
                google_connected: true,
            })
            .eq('id', user.id)

        if (updateError) {
            console.error('Failed to store Google tokens:', updateError)
            return NextResponse.redirect(new URL('/dashboard/settings?google_error=storage_failed', req.url))
        }

        return NextResponse.redirect(new URL('/dashboard/settings?google_connected=true', req.url))

    } catch (error) {
        console.error('Google OAuth callback error:', error)
        return NextResponse.redirect(new URL('/dashboard/settings?google_error=unknown', req.url))
    }
}
