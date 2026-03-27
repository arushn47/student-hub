import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'

const createReminderSchema = z.object({
    title: z.string().min(1).max(500),
    remind_at: z.string().datetime(),
    type: z.enum(['task', 'event', 'custom']).default('custom'),
})

const updateReminderSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    remind_at: z.string().datetime().optional(),
    is_completed: z.boolean().optional(),
    type: z.enum(['task', 'event', 'custom']).optional(),
})

// GET — fetch all reminders for authenticated user, ordered by remind_at ASC
export async function GET() {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const supabase = await createClient()
        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('user_id', user.id)
            .order('remind_at', { ascending: true })

        if (error) throw error

        return NextResponse.json({ reminders: data })
    } catch (error) {
        console.error('GET /api/reminders error:', error)
        return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
    }
}

// POST — create a new reminder
export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const body = await request.json()
        const parsed = createReminderSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const { data, error } = await supabase
            .from('reminders')
            .insert({
                user_id: user.id,
                title: parsed.data.title,
                remind_at: parsed.data.remind_at,
                type: parsed.data.type,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ reminder: data }, { status: 201 })
    } catch (error) {
        console.error('POST /api/reminders error:', error)
        return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
    }
}

// PATCH — update a reminder (mark complete, snooze, edit)
export async function PATCH(request: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const body = await request.json()
        const parsed = updateReminderSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            )
        }

        const { id, ...updates } = parsed.data
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('reminders')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) throw error

        if (!data) {
            return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
        }

        return NextResponse.json({ reminder: data })
    } catch (error) {
        console.error('PATCH /api/reminders error:', error)
        return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
    }
}

// DELETE — delete a reminder by id
export async function DELETE(request: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing reminder id' }, { status: 400 })
        }

        const supabase = await createClient()
        const { error } = await supabase
            .from('reminders')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('DELETE /api/reminders error:', error)
        return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 })
    }
}
