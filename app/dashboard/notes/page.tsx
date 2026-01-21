import { createClient } from '@/lib/supabase/server'
import { NotesList } from '@/components/notes/NotesList'
import type { Note } from '@/types'

export default async function NotesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: notes } = await supabase
        .from('notes')
        .select('*')
        // We remove the .eq('user_id', user.id) filter because RLS now handles visibility.
        // It will return:
        // 1. Notes I own (policy "Users can view own notes") 
        // 2. Notes shared with me (policy "Users can view shared notes")
        .order('updated_at', { ascending: false })

    return <NotesList initialNotes={(notes || []) as Note[]} />
}
