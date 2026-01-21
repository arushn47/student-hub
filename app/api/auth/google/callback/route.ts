import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOAuth2Client } from '@/lib/google'
import { google } from 'googleapis'

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

        // Get Google account info
        oauth2Client.setCredentials(tokens)
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const { data: googleUser } = await oauth2.userinfo.get()

        const googleEmail = googleUser.email || 'unknown@gmail.com'
        const googleName = googleUser.name || null
        const googlePicture = googleUser.picture || null

        // Check if this Google account already exists for this user
        const { data: existingAccount } = await supabase
            .from('google_accounts')
            .select('id, services')
            .eq('user_id', user.id)
            .eq('email', googleEmail)
            .single()

        if (existingAccount) {
            // Update existing account with new tokens
            await supabase
                .from('google_accounts')
                .update({
                    tokens,
                    name: googleName,
                    picture: googlePicture,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingAccount.id)
        } else {
            // Check how many accounts user already has
            const { count } = await supabase
                .from('google_accounts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)

            const isFirst = (count || 0) === 0

            // Insert new account
            await supabase
                .from('google_accounts')
                .insert({
                    user_id: user.id,
                    email: googleEmail,
                    name: googleName,
                    picture: googlePicture,
                    tokens,
                    // First account gets all services, additional accounts get classroom by default
                    services: isFirst ? ['tasks', 'calendar', 'classroom'] : ['classroom'],
                    is_primary: isFirst,
                })
        }

        // Also update profiles for backwards compatibility
        await supabase
            .from('profiles')
            .update({
                google_connected: true,
            })
            .eq('id', user.id)

        return NextResponse.redirect(new URL('/dashboard/settings?google_connected=true', req.url))

    } catch (error) {
        console.error('Google OAuth callback error:', error)
        return NextResponse.redirect(new URL('/dashboard/settings?google_error=unknown', req.url))
    }
}
