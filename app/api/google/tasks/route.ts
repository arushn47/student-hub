import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTasksClient, GoogleTokens } from '@/lib/google'

// GET: Fetch tasks from Google Tasks (all lists)
export async function GET(req: NextRequest) {
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

        // Get ALL task lists
        const taskListsResponse = await tasksClient.tasklists.list({ maxResults: 10 })
        const taskLists = taskListsResponse.data.items || []

        console.log('Found task lists:', taskLists.map(l => l.title))

        if (taskLists.length === 0) {
            return NextResponse.json({ tasks: [], message: 'No task lists found' })
        }

        // Fetch tasks from ALL lists
        const allTasks: any[] = []

        for (const list of taskLists) {
            if (!list.id) continue

            const tasksResponse = await tasksClient.tasks.list({
                tasklist: list.id,
                maxResults: 100,
                showCompleted: true,
            })

            const tasks = tasksResponse.data.items?.map(task => ({
                id: task.id,
                title: task.title,
                notes: task.notes,
                due: task.due,
                status: task.status,
                completed: task.status === 'completed',
                listName: list.title,
                listId: list.id,
            })) || []

            console.log(`List "${list.title}": ${tasks.length} tasks`)
            allTasks.push(...tasks)
        }

        console.log('Total tasks fetched:', allTasks.length)
        return NextResponse.json({ tasks: allTasks, taskLists: taskLists.map(l => ({ id: l.id, title: l.title })) })

    } catch (error: any) {
        console.error('Tasks fetch error:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch tasks' }, { status: 500 })
    }
}

// POST: Create task in Google Tasks
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
        const tasksClient = getTasksClient(tokens)

        const body = await req.json()
        const { title, notes, due, taskListId } = body

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 })
        }

        // Get default task list if not provided
        let listId = taskListId
        if (!listId) {
            const taskListsResponse = await tasksClient.tasklists.list({ maxResults: 1 })
            listId = taskListsResponse.data.items?.[0]?.id
        }

        if (!listId) {
            return NextResponse.json({ error: 'No task list found' }, { status: 400 })
        }

        const response = await tasksClient.tasks.insert({
            tasklist: listId,
            requestBody: {
                title,
                notes,
                due: due ? new Date(due).toISOString() : undefined,
            },
        })

        return NextResponse.json({
            task: {
                id: response.data.id,
                title: response.data.title,
            }
        })

    } catch (error: any) {
        console.error('Task create error:', error)
        return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 })
    }
}

// PATCH: Update task status (complete/uncomplete)
export async function PATCH(req: NextRequest) {
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

        const body = await req.json()
        const { taskId, taskListId, completed } = body

        if (!taskId || !taskListId) {
            return NextResponse.json({ error: 'taskId and taskListId are required' }, { status: 400 })
        }

        const response = await tasksClient.tasks.patch({
            tasklist: taskListId,
            task: taskId,
            requestBody: {
                status: completed ? 'completed' : 'needsAction',
            },
        })

        return NextResponse.json({
            task: {
                id: response.data.id,
                status: response.data.status,
            }
        })

    } catch (error: any) {
        console.error('Task update error:', error)
        return NextResponse.json({ error: error.message || 'Failed to update task' }, { status: 500 })
    }
}
