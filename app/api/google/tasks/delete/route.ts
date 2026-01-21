import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTasksClient, GoogleTokens } from '@/lib/google'

export async function POST(req: Request) {
    try {
        const { taskId } = await req.json()

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }

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
        const tasksClient = getTasksClient(tokens)

        // Delete from Google Tasks
        // We need the task list ID. For now, we search the default list or try to find it.
        // But Google API requires list ID to delete. 
        // Strategy: Get the default list (assuming tasks are there)
        const taskListsResponse = await tasksClient.tasklists.list({ maxResults: 1 })
        const listId = taskListsResponse.data.items?.[0]?.id

        if (!listId) {
            return NextResponse.json({ error: 'No task list found' }, { status: 404 })
        }

        await tasksClient.tasks.delete({
            tasklist: listId,
            task: taskId
        })

        return NextResponse.json({ success: true, message: 'Deleted from Google Tasks' })

    } catch (error: unknown) {
        console.error('Delete sync error:', error)
        // If 404, it might already be deleted, so we can consider it success or ignore
        const errorMessage = error instanceof Error ? error.message : 'Sync failed'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
