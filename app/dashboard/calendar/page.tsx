import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar/CalendarView'
import type { Task, ClassSchedule, SemesterBreak, Semester } from '@/types'

export default async function CalendarPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Handle guest mode
    if (!user) {
        return <CalendarView tasks={[]} classes={[]} breaks={[]} />
    }

    const [tasksResult, classesResult, semestersResult, breaksResult] = await Promise.all([
        supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('due_date', { ascending: true }),
        supabase
            .from('class_schedules')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true),
        supabase
            .from('semesters')
            .select('*')
            .eq('user_id', user.id)
            .order('start_date', { ascending: false }),
        supabase
            .from('semester_breaks')
            .select('*')
            .eq('user_id', user.id)
            .order('start_date', { ascending: true }),
    ])

    // Find active semester and filter breaks
    const semesters = (semestersResult.data || []) as Semester[]
    const allBreaks = (breaksResult.data || []) as SemesterBreak[]
    const activeSemester = semesters.find(s => s.is_active)

    // Filter breaks to only those in the active semester
    const breaks = activeSemester
        ? allBreaks.filter(b => b.semester_id === activeSemester.id)
        : allBreaks

    return (
        <CalendarView
            tasks={(tasksResult.data || []) as Task[]}
            classes={(classesResult.data || []) as ClassSchedule[]}
            breaks={breaks}
        />
    )
}

