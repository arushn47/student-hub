'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Search, FileText, Trash2, Pin, PinOff, CheckSquare, Image as ImageIcon, GripVertical } from 'lucide-react'
import type { Note } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// DnD Kit imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface NotesListProps {
    initialNotes: Note[]
}

// Sortable Note Card Component
function SortableNoteCard({
    note,
    onDelete,
    onTogglePin,
}: {
    note: Note
    onDelete: (note: Note) => void
    onTogglePin: (note: Note) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: note.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group",
                isDragging && "z-50 opacity-90"
            )}
        >
            <div className={cn(
                "p-4 rounded-lg bg-white/[0.03] border border-white/10 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer h-full",
                isDragging && "shadow-2xl shadow-purple-500/20 border-purple-500",
                note.is_pinned && "border-yellow-500/30 bg-yellow-500/5"
            )}>
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute top-2 left-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-white/10"
                >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                </div>

                <Link href={`/dashboard/notes/${note.id}`} className="block pl-6">
                    {/* Title */}
                    <h3 className="font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                        {note.title || 'Untitled Note'}
                    </h3>

                    {/* Content Preview */}
                    <p className="text-sm text-gray-400 whitespace-pre-wrap line-clamp-4">
                        {note.plain_text || 'Empty note...'}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                        <span className="text-xs text-gray-500">
                            {format(new Date(note.updated_at), 'MMM d')}
                        </span>
                    </div>
                </Link>

                {/* Actions - Show on Hover */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 hover:bg-white/10",
                            note.is_pinned
                                ? "text-yellow-400 hover:text-yellow-300"
                                : "text-gray-400 hover:text-white"
                        )}
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onTogglePin(note)
                        }}
                    >
                        {note.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onDelete(note)
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Pinned indicator */}
                {note.is_pinned && (
                    <div className="absolute -top-1 -right-1">
                        <Pin className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    </div>
                )}
            </div>
        </div>
    )
}

export function NotesList({ initialNotes }: NotesListProps) {
    const [notes, setNotes] = useState<Note[]>(initialNotes)
    const [search, setSearch] = useState('')
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; note: Note | null }>({
        open: false,
        note: null,
    })
    const router = useRouter()
    const supabase = createClient()

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Filter and separate pinned/unpinned
    const filteredNotes = notes.filter(
        (note) =>
            note.title.toLowerCase().includes(search.toLowerCase()) ||
            note.plain_text?.toLowerCase().includes(search.toLowerCase())
    )

    const pinnedNotes = filteredNotes.filter(n => n.is_pinned)
    const unpinnedNotes = filteredNotes.filter(n => !n.is_pinned)

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setNotes((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id)
                const newIndex = items.findIndex((item) => item.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
            toast.success('Notes reordered')
        }
    }

    const togglePin = async (note: Note) => {
        const newPinnedState = !note.is_pinned

        // Optimistic update
        setNotes(prev => prev.map(n =>
            n.id === note.id ? { ...n, is_pinned: newPinnedState } : n
        ))

        // Persist to database
        const { error } = await supabase
            .from('notes')
            .update({ is_pinned: newPinnedState })
            .eq('id', note.id)

        if (error) {
            // Revert on error
            setNotes(prev => prev.map(n =>
                n.id === note.id ? { ...n, is_pinned: !newPinnedState } : n
            ))
            toast.error('Failed to update pin status')
        } else {
            toast.success(newPinnedState ? 'Note pinned' : 'Note unpinned')
        }
    }

    const createNote = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('notes')
            .insert({
                user_id: user.id,
                title: 'Untitled Note',
                content: '',
                plain_text: '',
            })
            .select()
            .single()

        if (error) {
            toast.error('Failed to create note')
            return
        }

        router.push(`/dashboard/notes/${data.id}`)
    }

    const deleteNote = async () => {
        if (!deleteDialog.note) return

        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', deleteDialog.note.id)

        if (error) {
            toast.error('Failed to delete note')
            return
        }

        setNotes((prev) => prev.filter((n) => n.id !== deleteDialog.note?.id))
        setDeleteDialog({ open: false, note: null })
        toast.success('Note deleted')
    }

    // Render note grid section
    const renderNotesGrid = (notesToRender: Note[], sectionTitle?: string) => (
        <div className="space-y-3">
            {sectionTitle && (
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                    {sectionTitle}
                </h2>
            )}
            <SortableContext
                items={notesToRender.map(n => n.id)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {notesToRender.map((note) => (
                        <SortableNoteCard
                            key={note.id}
                            note={note}
                            onDelete={(n) => setDeleteDialog({ open: true, note: n })}
                            onTogglePin={togglePin}
                        />
                    ))}
                </div>
            </SortableContext>
        </div>
    )

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Quick Add Bar - Like Google Keep */}
            <div
                onClick={createNote}
                className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10"
            >
                <span className="text-gray-400 flex-1">Take a note...</span>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10">
                        <CheckSquare className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10">
                        <ImageIcon className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                    placeholder="Search notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500 rounded-lg"
                />
            </div>

            {/* Notes Grid with Drag and Drop */}
            {filteredNotes.length === 0 ? (
                <div className="text-center py-16">
                    <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No notes yet</h3>
                    <p className="text-gray-400 mb-6">Create your first note to get started</p>
                    <Button
                        onClick={createNote}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Create Note
                    </Button>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <div className="space-y-8">
                        {/* Pinned Notes Section */}
                        {pinnedNotes.length > 0 && renderNotesGrid(pinnedNotes, 'Pinned')}

                        {/* Other Notes Section */}
                        {unpinnedNotes.length > 0 && renderNotesGrid(
                            unpinnedNotes,
                            pinnedNotes.length > 0 ? 'Others' : undefined
                        )}
                    </div>
                </DndContext>
            )}

            {/* Delete Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, note: null })}>
                <DialogContent className="bg-gray-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white">Delete Note</DialogTitle>
                    </DialogHeader>
                    <p className="text-gray-400">
                        Are you sure you want to delete &quot;{deleteDialog.note?.title}&quot;? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteDialog({ open: false, note: null })}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={deleteNote}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
