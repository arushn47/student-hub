import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'

const createSessionSchema = z.object({
    session_type: z.enum(['focus', 'shortBreak', 'longBreak']),
    duration_minutes: z.number().int().positive(),
    task_id: z.string().uuid().nullable().optional(),
})

// GET — fetch session history for authenticated user (last 30 sessions)
export async function GET() {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const supabase = await createClient()
        const { data, error } = await supabase
            .from('pomodoro_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('started_at', { ascending: false })
            .limit(30)

        if (error) throw error

        return NextResponse.json({ sessions: data })
    } catch (error) {
        console.error('GET /api/pomodoro error:', error)
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }
}

// POST — save a completed session
export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const body = await request.json()
        const parsed = createSessionSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const now = new Date()
        const startedAt = new Date(now.getTime() - parsed.data.duration_minutes * 60 * 1000)

        const { data, error } = await supabase
            .from('pomodoro_sessions')
            .insert({
                user_id: user.id,
                session_type: parsed.data.session_type,
                duration_minutes: parsed.data.duration_minutes,
                completed: true,
                task_id: parsed.data.task_id ?? null,
                started_at: startedAt.toISOString(),
                ended_at: now.toISOString(),
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ session: data }, { status: 201 })
    } catch (error) {
        console.error('POST /api/pomodoro error:', error)
        return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
    }
}
