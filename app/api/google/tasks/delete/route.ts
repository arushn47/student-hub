import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTasksClient } from '@/lib/google'
import { getGoogleTokensForService } from '@/lib/google-accounts'
import { googleInsufficientScopeResponse, googleReauthResponse, isGoogleReauthError } from '@/lib/google-reauth'

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

        const { tokens } = await getGoogleTokensForService(user.id, 'tasks')

        if (!tokens) {
            return NextResponse.json({ error: 'No Google account connected for Tasks' }, { status: 400 })
        }

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
        const errorObj = error as { code?: number; message?: string }
        const msg = errorObj.message || (error instanceof Error ? error.message : '')

        // Token expired / revoked
        if (isGoogleReauthError(error) || msg.includes('invalid_grant') || errorObj.code === 401) {
            return googleReauthResponse('Your Google session has expired. Please reconnect your Google account in Settings to delete tasks.')
        }

        // Insufficient scope
        if (errorObj.code === 403 || msg.toLowerCase().includes('scope')) {
            return googleInsufficientScopeResponse('Please reconnect Google in Settings to enable Tasks access.')
        }

        // If 404, it might already be deleted, so we can consider it success or ignore
        const errorMessage = msg || 'Sync failed'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
