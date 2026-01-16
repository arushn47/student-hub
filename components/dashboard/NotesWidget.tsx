'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ArrowRight, Plus } from 'lucide-react'
import type { Note } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface NotesWidgetProps {
    notes: Note[]
}

export function NotesWidget({ notes }: NotesWidgetProps) {
    const recentNotes = notes.slice(0, 4)

    return (
        <Card className="bg-black/40 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-pink-400" />
                    Recent Notes
                </CardTitle>
                <Link href="/dashboard/notes">
                    <Button variant="ghost" size="sm" className="text-pink-400 hover:text-pink-300 hover:bg-white/10">
                        View All <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                {recentNotes.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400 mb-4">No notes yet</p>
                        <Link href="/dashboard/notes">
                            <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
                                <Plus className="mr-2 h-4 w-4" /> Create Note
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {recentNotes.map((note) => (
                            <Link key={note.id} href={`/dashboard/notes/${note.id}`}>
                                <div className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <p className="text-sm font-medium text-white truncate group-hover:text-pink-300 transition-colors">
                                        {note.title || 'Untitled Note'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                        {note.plain_text?.substring(0, 100) || 'No content'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
