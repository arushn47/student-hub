import { createClient } from '@/lib/supabase/server'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import type { ClassSchedule, Semester } from '@/types'

export default async function TimetablePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [classesRes, semestersRes] = await Promise.all([
        supabase
            .from('class_schedules')
            .select('*')
            .eq('user_id', user!.id)
            .order('day_of_week', { ascending: true }),
        supabase
            .from('semesters')
            .select('*')
            .eq('user_id', user!.id)
            .order('start_date', { ascending: false })
    ])

    return (
        <TimetableGrid
            initialClasses={(classesRes.data || []) as ClassSchedule[]}
            initialSemesters={(semestersRes.data || []) as Semester[]}
            userId={user!.id}
        />
    )
}
