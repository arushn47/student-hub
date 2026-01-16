import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTasksClient, GoogleTokens } from '@/lib/google'

// POST: Sync local tasks to Google Tasks
export async function POST() {
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
        const errorMessage = error instanceof Error ? error.message : 'Sync failed';
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
