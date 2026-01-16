import { createClient } from '@/lib/supabase/server'
import { TasksManager } from '@/components/tasks/TasksManager'
import type { Task } from '@/types'

export default async function TasksPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

    return <TasksManager initialTasks={(tasks || []) as Task[]} userId={user!.id} />
}
