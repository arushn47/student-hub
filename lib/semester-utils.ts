import { supabase } from '@/lib/supabase/client'

/**
 * Ensures a user has a default set of semesters (1-8 + Miscellaneous).
 * If the user has NO semesters, it seeds them.
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

    // Create 1-8 + Miscellaneous
    const semestersToCreate = [
        ...Array.from({ length: 8 }, (_, i) => ({
            user_id: userId,
            name: `Semester ${i + 1}`,
            is_active: i === 0 // Default Semester 1 as active
        })),
        {
            user_id: userId,
            name: 'Miscellaneous',
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
