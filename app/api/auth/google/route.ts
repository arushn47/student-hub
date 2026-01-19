import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const redirectUri = new URL('/api/auth/google/callback', req.url).toString()
        const authUrl = getAuthUrl({ redirectUri })
        return NextResponse.json({ authUrl })

    } catch (error) {
        console.error('Google auth error:', error)
        return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 })
    }
}
