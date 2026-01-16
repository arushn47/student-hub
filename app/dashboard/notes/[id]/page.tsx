import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NoteEditor } from '@/components/notes/NoteEditor'
import type { Note } from '@/types'

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: note, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single()

    if (error || !note) {
        notFound()
    }

    return <NoteEditor note={note as Note} />
}
