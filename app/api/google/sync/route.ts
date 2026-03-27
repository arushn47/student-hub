import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTasksClient } from '@/lib/google'
import { getGoogleTokensForService } from '@/lib/google-accounts'
import { googleInsufficientScopeResponse, googleReauthResponse, isGoogleReauthError } from '@/lib/google-reauth'

// POST: Sync local tasks to Google Tasks
export async function POST() {
    try {
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

        // Get local tasks that aren't synced yet
        const { data: localTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .is('google_task_id', null)

        let syncedCount = 0

        if (localTasks && localTasks.length > 0) {
            // Get default task list
            const taskListsResponse = await tasksClient.tasklists.list({ maxResults: 1 })
            const listId = taskListsResponse.data.items?.[0]?.id

            if (listId) {
                for (const task of localTasks) {
                    try {
                        const response = await tasksClient.tasks.insert({
                            tasklist: listId,
                            requestBody: {
                                title: task.title,
                                notes: task.description || undefined,
                                due: task.due_date ? new Date(task.due_date).toISOString() : undefined,
                                status: task.status === 'done' ? 'completed' : 'needsAction',
                            },
                        })

                        // Update local task with Google ID
                        await supabase
                            .from('tasks')
                            .update({ google_task_id: response.data.id })
                            .eq('id', task.id)

                        syncedCount++
                    } catch (e) {
                        if (isGoogleReauthError(e)) throw e
                        console.error('Failed to sync task:', task.id, e)
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            synced: syncedCount,
            message: `Synced ${syncedCount} tasks to Google`
        })

    } catch (error: unknown) {
        console.error('Sync error:', error)

        const errorObj = error as { code?: number; message?: string }
        const msg = errorObj.message || (error instanceof Error ? error.message : '')

        // Token expired / revoked
        if (isGoogleReauthError(error) || msg.includes('invalid_grant') || errorObj.code === 401) {
            return googleReauthResponse()
        }

        // Insufficient scope
        if (errorObj.code === 403 || msg.toLowerCase().includes('scope')) {
            return googleInsufficientScopeResponse()
        }

        const errorMessage = msg || 'Sync failed'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
