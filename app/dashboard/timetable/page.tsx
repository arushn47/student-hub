import { createClient } from '@/lib/supabase/server'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import type { ClassSchedule } from '@/types'

export default async function TimetablePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: classes } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('user_id', user!.id)
        .order('day_of_week', { ascending: true })

    return <TimetableGrid initialClasses={(classes || []) as ClassSchedule[]} userId={user!.id} />
}
