
'use client'

import { useState, useEffect, useId, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Search, FileText, Trash2, Pin, PinOff, CheckSquare, Image as ImageIcon, GripVertical, BookOpen } from 'lucide-react'
import type { Note } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

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

// Deterministic color accent based on note id
const SPINE_COLORS = [
    { spine: 'bg-violet-500', glow: 'hover:shadow-violet-500/10', activeBorder: 'hover:border-violet-500/40', bg: 'bg-violet-500/[0.03]' },
    { spine: 'bg-sky-500', glow: 'hover:shadow-sky-500/10', activeBorder: 'hover:border-sky-500/40', bg: 'bg-sky-500/[0.03]' },
    { spine: 'bg-rose-500', glow: 'hover:shadow-rose-500/10', activeBorder: 'hover:border-rose-500/40', bg: 'bg-rose-500/[0.03]' },
    { spine: 'bg-emerald-500', glow: 'hover:shadow-emerald-500/10', activeBorder: 'hover:border-emerald-500/40', bg: 'bg-emerald-500/[0.03]' },
    { spine: 'bg-amber-500', glow: 'hover:shadow-amber-500/10', activeBorder: 'hover:border-amber-500/40', bg: 'bg-amber-500/[0.03]' },
    { spine: 'bg-pink-500', glow: 'hover:shadow-pink-500/10', activeBorder: 'hover:border-pink-500/40', bg: 'bg-pink-500/[0.03]' },
]

function getSpineColor(id: string) {
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
    return SPINE_COLORS[Math.abs(hash) % SPINE_COLORS.length]
}

function wordCount(text?: string) {
    if (!text?.trim()) return 0
    return text.trim().split(/\s+/).length
}

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

    const style = { transform: CSS.Transform.toString(transform), transition }
    const accent = getSpineColor(note.id)
    const words = wordCount(note.plain_text ?? undefined)

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("relative group", isDragging && "z-50 opacity-90")}
        >
            <div className={cn(
                "flex rounded-xl border border-white/[0.07] transition-all duration-200 cursor-pointer h-full overflow-hidden",
                "hover:border-white/20 hover:shadow-xl",
                accent.glow,
                accent.bg,
                isDragging && "shadow-2xl border-white/20",
                note.is_pinned && "border-amber-500/25 bg-amber-500/4 hover:border-amber-500/40 hover:shadow-amber-500/10"
            )}>
                {/* Colored spine tab */}
                <div className={cn(
                    "w-1 shrink-0 rounded-l-xl transition-all duration-200",
                    note.is_pinned ? "bg-amber-400" : accent.spine,
                    "opacity-60 group-hover:opacity-100"
                )} />

                {/* Card content */}
                <div className="flex-1 p-4 min-w-0">
                    {/* Drag handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="absolute top-3 left-4 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-white/10"
                    >
                        <GripVertical className="h-3.5 w-3.5 text-gray-500" />
                    </div>

                    <Link href={`/dashboard/notes/${note.id}`} className="block pl-5">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3 className="font-semibold text-[0.92rem] text-white/90 group-hover:text-white transition-colors leading-snug line-clamp-1 pr-6">
                                {note.title || 'Untitled Note'}
                            </h3>
                            {note.is_pinned && (
                                <Pin className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0 mt-0.5 group-hover:opacity-0 transition-opacity" />
                            )}
                        </div>

                        {/* Content preview */}
                        <p className="text-[0.8rem] text-gray-500 line-clamp-3 leading-relaxed">
                            {note.plain_text || 'Empty note...'}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-600">
                                    {words > 0 ? `${words}w` : 'empty'}
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-600">
                                {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                            </span>
                        </div>
                    </Link>

                    {/* Hover actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 hover:bg-white/10",
                                note.is_pinned ? "text-amber-400 hover:text-amber-300" : "text-gray-500 hover:text-white"
                            )}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(note) }}
                        >
                            {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(note) }}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div >
    )
}

export function NotesList({ initialNotes }: NotesListProps) {
    const [notes, setNotes] = useState<Note[]>(initialNotes)
    const [search, setSearch] = useState('')
    const searchInputRef = useRef<HTMLInputElement | null>(null)

    const shortcutHint = useMemo(() => {
        if (typeof navigator === 'undefined') return 'Ctrl K'
        const platform = navigator.platform || ''
        const userAgent = navigator.userAgent || ''
        const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(userAgent)
        return isApple ? '⌘K' : 'Ctrl + K'
    }, [])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
    const [activeFilter, setActiveFilter] = useState<'all' | 'pinned'>('all')
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; note: Note | null }>({ open: false, note: null })
    const router = useRouter()
        const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const { data, error } = await supabase.auth.getUser()
            if (cancelled) return
            if (error) {
                console.warn('Failed to get current user:', error)
                return
            }
            setCurrentUserId(data.user?.id ?? null)
        })()

        return () => {
            cancelled = true
        }
    }, [supabase])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const filteredNotes = notes.filter(
        (note) =>
            note.title.toLowerCase().includes(search.toLowerCase()) ||
            note.plain_text?.toLowerCase().includes(search.toLowerCase())
    )

    const pinnedNotes = filteredNotes.filter(n => n.is_pinned)
    const unpinnedNotes = filteredNotes.filter(n => !n.is_pinned)

    const dndId = useId()

    const persistOrder = async (items: Note[]) => {
        if (!currentUserId) return

        // Persist within pinned/unpinned groups (so pinning doesn't break order).
        const pinned = items.filter(n => n.is_pinned && n.user_id === currentUserId)
        const unpinned = items.filter(n => !n.is_pinned && n.user_id === currentUserId)

        const updates = [
            ...pinned.map((n, idx) => ({ id: n.id, sort_order: idx })),
            ...unpinned.map((n, idx) => ({ id: n.id, sort_order: idx })),
        ]

        if (updates.length === 0) return

        const results = await Promise.all(
            updates.map(({ id, sort_order }) =>
                supabase.from('notes').update({ sort_order }).eq('id', id)
            )
        )

        const firstError = results.find(r => r.error)?.error
        if (firstError) {
            console.error('Failed to persist note order:', firstError)
            const msg = (firstError as { message?: string }).message ?? ''
            if (msg.toLowerCase().includes('sort_order')) {
                toast.error('Note ordering is not set up yet (missing sort_order column). Run the Supabase migration.')
            } else {
                toast.error('Failed to save note order')
            }
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            setNotes((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id)
                const newIndex = items.findIndex((item) => item.id === over.id)
                const next = arrayMove(items, oldIndex, newIndex)
                // Fire-and-forget persistence; UI stays snappy.
                void persistOrder(next)
                return next
            })
            toast.success('Notes reordered')
        }
    }

    const togglePin = async (note: Note) => {
        const newPinnedState = !note.is_pinned
        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: newPinnedState } : n))
        const { error } = await supabase.from('notes').update({ is_pinned: newPinnedState }).eq('id', note.id)
        if (error) {
            setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: !newPinnedState } : n))
            toast.error('Failed to update pin status')
        } else {
            toast.success(newPinnedState ? 'Note pinned' : 'Note unpinned')
        }
    }

    const createNote = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Put the new note at the top of the unpinned section.
        const unpinnedOrders = notes
            .filter(n => !n.is_pinned)
            .map(n => (typeof n.sort_order === 'number' ? n.sort_order : 0))
        const nextSortOrder = (unpinnedOrders.length ? Math.min(...unpinnedOrders) : 0) - 1

        const { data, error } = await supabase.from('notes').insert({
            user_id: user.id, title: 'Untitled Note', content: '', plain_text: '', sort_order: nextSortOrder,
        }).select().single()
        if (error) { toast.error(`Failed to create note: ${error.message}`); console.error('Note creation error:', error); return }
        router.push(`/dashboard/notes/${data.id}`)
    }

    const deleteNote = async () => {
        if (!deleteDialog.note) return
        const { error } = await supabase.from('notes').delete().eq('id', deleteDialog.note.id)
        if (error) { toast.error('Failed to delete note'); return }
        setNotes((prev) => prev.filter((n) => n.id !== deleteDialog.note?.id))
        setDeleteDialog({ open: false, note: null })
        toast.success('Note deleted')
    }

    const renderNotesGrid = (notesToRender: Note[], sectionTitle?: string, count?: number) => (
        <div className="space-y-3">
            {sectionTitle && (
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{sectionTitle}</span>
                    {count !== undefined && (
                        <span className="text-[10px] text-gray-700 bg-white/5 px-1.5 py-0.5 rounded-full">{count}</span>
                    )}
                    <div className="flex-1 h-px bg-white/4" />
                </div>
            )}
            <SortableContext items={notesToRender.map(n => n.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

    const totalNotes = filteredNotes.length
    const filterTabs = [
        { id: 'all' as const, label: 'All', count: totalNotes },
        { id: 'pinned' as const, label: 'Pinned', count: pinnedNotes.length },
    ]

    const visiblePinned = pinnedNotes
    const visibleUnpinned = activeFilter === 'pinned' ? [] : unpinnedNotes

    return (
        <div className="space-y-5 max-w-6xl mx-auto">

            {/* Top bar: search + create */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                    <Input
                        placeholder="Search notes..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        ref={searchInputRef}
                        className="pl-9 pr-14 h-9 bg-white/4 border-white/[0.07] text-white placeholder:text-gray-600 focus:border-white/20 focus:bg-white/6 rounded-lg text-sm transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-700 font-mono hidden sm:block">{shortcutHint}</span>
                </div>
                <Button
                    onClick={createNote}
                    size="sm"
                    className="h-9 px-4 bg-white text-gray-900 hover:bg-gray-100 font-medium text-sm rounded-lg shrink-0"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Note
                </Button>
            </div>

            {/* Quick capture row */}
            <div
                onClick={createNote}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/[0.07] hover:border-white/15 hover:bg-white/5 transition-all cursor-text group"
            >
                <BookOpen className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
                <span className="text-sm text-gray-600 group-hover:text-gray-400 transition-colors flex-1">Capture a thought...</span>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
                        <CheckSquare className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10">
                        <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1">
                {filterTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveFilter(tab.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            activeFilter === tab.id
                                ? "bg-white/10 text-white"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        )}
                    >
                        {tab.label}
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full",
                            activeFilter === tab.id ? "bg-white/10 text-gray-300" : "bg-white/5 text-gray-600"
                        )}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Notes content */}
            {filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-2xl scale-150" />
                        <div className="relative h-16 w-16 rounded-2xl bg-white/4 border border-white/10 flex items-center justify-center">
                            <FileText className="h-7 w-7 text-gray-500" />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white/80 mb-1">
                        {search ? 'No notes found' : 'Your notebook is empty'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-6 max-w-xs">
                        {search ? `No results for "${search}"` : 'Start capturing ideas, summaries, and notes for your classes'}
                    </p>
                    {!search && (
                        <Button
                            onClick={createNote}
                            className="bg-white text-gray-900 hover:bg-gray-100 font-medium"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create your first note
                        </Button>
                    )}
                </div>
            ) : (
                <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="space-y-7">
                        {visiblePinned.length > 0 && renderNotesGrid(visiblePinned, 'Pinned', visiblePinned.length)}
                        {visibleUnpinned.length > 0 && renderNotesGrid(
                            visibleUnpinned,
                            visiblePinned.length > 0 ? 'Others' : undefined,
                            visiblePinned.length > 0 ? visibleUnpinned.length : undefined
                        )}
                    </div>
                </DndContext>
            )}

            {/* Delete Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, note: null })}>
                <DialogContent className="bg-[#111] border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white text-base">Delete note?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-400">
                        &quot;{deleteDialog.note?.title}&quot; will be permanently deleted.
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setDeleteDialog({ open: false, note: null })}
                            className="text-gray-400 hover:text-white hover:bg-white/10 text-sm">
                            Cancel
                        </Button>
                        <Button onClick={deleteNote} className="bg-red-500/90 hover:bg-red-500 text-white text-sm">
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mobile FAB */}
            <Button
                onClick={createNote}
                className="md:hidden fixed bottom-24 right-5 h-12 w-12 rounded-2xl shadow-xl bg-white text-gray-900 hover:bg-gray-100 z-50 flex items-center justify-center"
            >
                <Plus className="h-5 w-5" />
            </Button>
        </div>
    )
}