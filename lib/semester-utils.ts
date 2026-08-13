import { supabase } from '@/lib/supabase/client'

export interface GeneratedSemester {
    name: string
    start_date: string
    end_date: string
    is_active: boolean
}

/**
 * Generates dates for all semesters in a program based on the start date of the current semester.
 * Odd Semesters: Typically Aug 1 - Dec 15
 * Even Semesters: Typically Jan 3 - May 15
 */
export function generateProgramSemesters(
    totalSemesters: number,
    currentSem: number,
    currentSemStartDateStr: string
): GeneratedSemester[] {
    const currentDate = new Date(currentSemStartDateStr)
    if (isNaN(currentDate.getTime())) {
        throw new Error('Invalid start date')
    }

    const Y_c = currentDate.getFullYear()
    const isOdd = currentSem % 2 !== 0
    const Y_1 = isOdd ? Y_c - (currentSem - 1) / 2 : Y_c - currentSem / 2

    const semesters: GeneratedSemester[] = []

    for (let k = 1; k <= totalSemesters; k++) {
        const kIsOdd = k % 2 !== 0
        let startDate: string
        let endDate: string

        if (kIsOdd) {
            const Y_k = Y_1 + (k - 1) / 2
            startDate = `${Y_k}-08-01`
            endDate = `${Y_k}-12-15`
        } else {
            const Y_k = Y_1 + k / 2
            startDate = `${Y_k}-01-03`
            endDate = `${Y_k}-05-15`
        }

        // For the current semester, use the user's exact starting date
        if (k === currentSem) {
            startDate = currentSemStartDateStr
            // Adjust the end date to align with the same year as the start date
            const currentStartYear = new Date(currentSemStartDateStr).getFullYear()
            if (kIsOdd) {
                endDate = `${currentStartYear}-12-15`
            } else {
                endDate = `${currentStartYear}-05-15`
            }
        }

        semesters.push({
            name: `Semester ${k}`,
            start_date: startDate,
            end_date: endDate,
            is_active: k === currentSem
        })
    }

    return semesters
}

/**
 * Ensures a user has a default set of semesters (1-8 + Miscellaneous).
 * Fixed to include valid dates to prevent Supabase NOT NULL constraint errors.
 */
export async function ensureDefaultSemesters(userId: string) {
    // Check existing
    const { data: existing, error: checkError } = await supabase
        .from('semesters')
        .select('*')
        .eq('user_id', userId)

    if (checkError) {
        console.error('Error checking semesters:', checkError)
        return []
    }

    if (existing && existing.length > 0) {
        return existing
    }

    // Default to B.Tech starting today
    const todayStr = new Date().toISOString().split('T')[0]
    const generated = generateProgramSemesters(8, 1, todayStr)

    const semestersToCreate = [
        ...generated.map(sem => ({
            user_id: userId,
            name: sem.name,
            start_date: sem.start_date,
            end_date: sem.end_date,
            is_active: sem.is_active
        })),
        {
            user_id: userId,
            name: 'Miscellaneous',
            start_date: `${new Date().getFullYear()}-01-01`,
            end_date: `${new Date().getFullYear() + 4}-12-31`,
            is_active: false
        }
    ]

    const { data: created, error: insertError } = await supabase
        .from('semesters')
        .insert(semestersToCreate)
        .select()

    if (insertError) {
        console.error('Error seeding semesters:', insertError)
        return []
    }

    return created || []
}
