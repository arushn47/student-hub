import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarClient, GoogleTokens } from '@/lib/google'

// GET: Fetch events from Google Calendar
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get Google tokens from profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('google_tokens, google_connected')
            .eq('id', user.id)
            .single()

        if (!profile?.google_connected || !profile?.google_tokens) {
            return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
        }

        const tokens = profile.google_tokens as GoogleTokens
        const calendar = getCalendarClient(tokens)

        // Get timeMin and timeMax from query params, default to current week
        const searchParams = req.nextUrl.searchParams
        const timeMin = searchParams.get('timeMin') || new Date().toISOString()
        const daysAhead = parseInt(searchParams.get('daysAhead') || '7')
        const timeMax = searchParams.get('timeMax') || new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString()

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 50,
        })

        const events = response.data.items?.map(event => ({
            id: event.id,
            title: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location,
            meetLink: event.hangoutLink,
        })) || []

        return NextResponse.json({ events })

    } catch (error: any) {
        console.error('Calendar fetch error:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch calendar' }, { status: 500 })
    }
}

// POST: Create event in Google Calendar
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('google_tokens, google_connected')
            .eq('id', user.id)
            .single()

        if (!profile?.google_connected || !profile?.google_tokens) {
            return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
        }

        const tokens = profile.google_tokens as GoogleTokens
        const calendar = getCalendarClient(tokens)

        const body = await req.json()
        const { title, description, start, end, location, addMeet } = body

        if (!title || !start || !end) {
            return NextResponse.json({ error: 'Title, start, and end are required' }, { status: 400 })
        }

        const eventData: any = {
            summary: title,
            description,
            location,
            start: { dateTime: start, timeZone: 'Asia/Kolkata' },
            end: { dateTime: end, timeZone: 'Asia/Kolkata' },
        }

        // Add Google Meet link if requested
        if (addMeet) {
            eventData.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            }
        }

        const response = await calendar.events.insert({
            calendarId: 'primary',
            conferenceDataVersion: addMeet ? 1 : 0,
            requestBody: eventData,
        })

        return NextResponse.json({
            event: {
                id: response.data.id,
                title: response.data.summary,
                meetLink: response.data.hangoutLink,
            }
        })

    } catch (error: any) {
        console.error('Calendar create error:', error)
        return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 })
    }
}
