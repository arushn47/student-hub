import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { Task, ClassSchedule } from '@/types'

export default async function CalendarPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [tasksResult, classesResult] = await Promise.all([
        supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user!.id)
            .order('due_date', { ascending: true }),
        supabase
            .from('classes')
            .select('*')
            .eq('user_id', user!.id),
    ])

    return (
        <CalendarView
            tasks={(tasksResult.data || []) as Task[]}
            classes={(classesResult.data || []) as ClassSchedule[]}
        />
    )
}
