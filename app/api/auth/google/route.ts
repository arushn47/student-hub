import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'

export async function GET() {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const authUrl = getAuthUrl()
        return NextResponse.json({ authUrl })

    } catch (error) {
        console.error('Google auth error:', error)
        return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 })
    }
}
