import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTasksClient } from '@/lib/google'
import { getGoogleTokensForService } from '@/lib/google-accounts'
import { createTaskSchema, updateTaskSchema } from '@/lib/schemas'
import { unauthorizedResponse } from '@/lib/api-utils'
import { validationErrorResponse, createApiErrorResponse } from '@/lib/errors'

// GET: Fetch tasks from Google Tasks (all lists)
export async function GET() {
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

        // Get ALL task lists
        const taskListsResponse = await tasksClient.tasklists.list({ maxResults: 10 })
        const taskLists = taskListsResponse.data.items || []

        console.log('Found task lists:', taskLists.map(l => l.title))

        if (taskLists.length === 0) {
            return NextResponse.json({ tasks: [], message: 'No task lists found' })
        }

        // Fetch tasks from ALL lists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    } catch (error: unknown) {
        console.error('Tasks fetch error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tasks';
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

// POST: Create task in Google Tasks
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return unauthorizedResponse()

        const { tokens } = await getGoogleTokensForService(user.id, 'tasks')
        if (!tokens) {
            return NextResponse.json({ error: 'No Google account connected for Tasks' }, { status: 400 })
        }

        const tasksClient = getTasksClient(tokens)

        const body = await req.json()

        // Zod Validation
        const validation = createTaskSchema.safeParse(body)
        if (!validation.success) {
            return validationErrorResponse("Invalid task data",
                Object.fromEntries(validation.error.issues.map(e => [e.path[0], e.message])) as Record<string, string>
            )
        }

        const { title, notes, due, taskListId } = validation.data

        // Get default task list if not provided
        let listId = taskListId || undefined
        if (!listId) {
            const taskListsResponse = await tasksClient.tasklists.list({ maxResults: 1 })
            listId = taskListsResponse.data.items?.[0]?.id || undefined
        }

        if (!listId) {
            return NextResponse.json({ error: 'No task list found' }, { status: 400 })
        }

        const response = await tasksClient.tasks.insert({
            tasklist: listId,
            requestBody: {
                title,
                notes: notes || undefined,
                due: due || undefined,
            },
        })

        return NextResponse.json({
            task: {
                id: response.data.id,
                title: response.data.title,
            }
        })

    } catch (error: unknown) {
        return createApiErrorResponse(error, 'Failed to create task')
    }
}

// PATCH: Update task status (complete/uncomplete)
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return unauthorizedResponse()

        const { tokens } = await getGoogleTokensForService(user.id, 'tasks')
        if (!tokens) {
            return NextResponse.json({ error: 'No Google account connected for Tasks' }, { status: 400 })
        }

        const tasksClient = getTasksClient(tokens)

        const body = await req.json()

        // Zod Validation
        const validation = updateTaskSchema.safeParse(body)
        if (!validation.success) {
            return validationErrorResponse("Invalid update data",
                Object.fromEntries(validation.error.issues.map(e => [e.path[0], e.message])) as Record<string, string>
            )
        }

        const { taskId, taskListId, completed } = validation.data

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

    } catch (error: unknown) {
        return createApiErrorResponse(error, 'Failed to update task')
    }
}
