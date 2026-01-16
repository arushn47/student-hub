import { createClient } from '@/lib/supabase/server'
import { NotesList } from '@/components/notes/NotesList'
import type { Note } from '@/types'

export default async function NotesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })

    return <NotesList initialNotes={(notes || []) as Note[]} />
}
