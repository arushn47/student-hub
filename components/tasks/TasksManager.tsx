'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, CheckSquare, Sparkles, Loader2, GripVertical, Trash2, Cloud, CloudDownload, CloudUpload, Calendar, LayoutList, KanbanSquare, Check, Circle } from 'lucide-react'
import type { Task } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, isToday, isPast, isThisWeek } from 'date-fns'
import { SpeechToTextButton } from '@/components/ui/speech'

interface TasksManagerProps {
    initialTasks: Task[]
    userId: string
}

const PRIORITY_CONFIG = {
    high:   { label: 'High',   bar: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',    dot: 'bg-red-400'    },
    medium: { label: 'Medium', bar: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
    low:    { label: 'Low',    bar: 'bg-emerald-500',badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
}

const COLUMNS = [
    { id: 'todo' as const,        label: 'To Do',       accent: 'bg-gray-500',  headerBg: 'bg-gray-500/10',  border: 'border-gray-500/20'  },
    { id: 'in-progress' as const, label: 'In Progress', accent: 'bg-blue-500',  headerBg: 'bg-blue-500/10',  border: 'border-blue-500/20'  },
    { id: 'done' as const,        label: 'Done',        accent: 'bg-emerald-500', headerBg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
]

// Custom animated checkbox
function TaskCheckbox({ checked, onChange, size = 'md' }: { checked: boolean; onChange: () => void; size?: 'sm' | 'md' }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onChange() }}
            className={cn(
                "rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0",
                size === 'sm' ? "h-4 w-4" : "h-5 w-5",
                checked
                    ? "bg-violet-500 border-violet-500 scale-95"
                    : "border-gray-600 hover:border-violet-400 hover:bg-violet-500/10"
            )}
        >
            {checked && <Check className={cn("text-white", size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3")} strokeWidth={3} />}
        </button>
    )
}

export function TasksManager({ initialTasks, userId }: TasksManagerProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks)
    const [createDialog, setCreateDialog] = useState(false)
    const [editDialog, setEditDialog] = useState(false)
    const [breakdownDialog, setBreakdownDialog] = useState(false)
    const [breakdownInput, setBreakdownInput] = useState('')
    const [breakdownLoading, setBreakdownLoading] = useState(false)
    const [newTask, setNewTask] = useState<{ title: string; description: string; priority: Task['priority']; due_date: string; due_time: string }>({
        title: '', description: '', priority: 'medium', due_date: '', due_time: '',
    })
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [editTask, setEditTask] = useState<{ title: string; description: string; priority: Task['priority']; due_date: string; due_time: string; status: Task['status'] }>({
        title: '', description: '', priority: 'medium', due_date: '', due_time: '', status: 'todo',
    })
    const [editSaving, setEditSaving] = useState(false)
    const [draggedTask, setDraggedTask] = useState<Task | null>(null)
    const [googleSyncing, setGoogleSyncing] = useState(false)
    const [googleConnected, setGoogleConnected] = useState(false)
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
    const [listFilter, setListFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all')
    
    const readJsonSafely = async <T,>(res: Response): Promise<T | null> => {
        try {
            return (await res.json()) as T
        } catch {
            return null
        }
    }

    useEffect(() => {
        const checkGoogleConnection = async () => {
            const { data: profile } = await supabase.from('profiles').select('google_connected').eq('id', userId).single()
            setGoogleConnected(profile?.google_connected || false)
        }
        checkGoogleConnection()
    }, [userId, supabase])

    const importFromGoogle = async () => {
        setGoogleSyncing(true)
        try {
            const res = await fetch('/api/google/tasks')
            const data = (await readJsonSafely<{
                tasks?: Array<{ id?: string; title?: string; notes?: string; due?: string; completed?: boolean }>
                taskLists?: Array<{ id?: string; title?: string }>
                needsReconnect?: boolean
                error?: string
            }>(res)) ?? {}
            if (!res.ok) {
                if ((res.status === 401 || res.status === 403) && data?.needsReconnect) {
                    toast.error(data.error || 'Please reconnect your Google account in Settings.')
                    return
                }
                throw new Error(data?.error || 'Failed to import from Google')
            }
            const googleTasks = data.tasks ?? []
            let imported = 0
            for (const gTask of googleTasks) {
                const exists = tasks.some(t => t.title === gTask.title)
                if (!exists && gTask.title) {
                    const { data: newTask, error } = await supabase.from('tasks').insert({
                        user_id: userId, title: gTask.title, description: gTask.notes || null,
                        status: gTask.completed ? 'done' : 'todo', priority: 'medium',
                        due_date: gTask.due || null, google_task_id: gTask.id,
                    }).select().single()
                    if (!error && newTask) { setTasks(prev => [...prev, newTask as Task]); imported++ }
                }
            }
            toast.success(`Imported ${imported} tasks from Google`)
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to import from Google')
        } finally {
            setGoogleSyncing(false)
        }
    }

    const pushToGoogle = async () => {
        setGoogleSyncing(true)
        try {
            const res = await fetch('/api/google/sync', { method: 'POST' })
            const data = (await readJsonSafely<{
                message?: string
                synced?: number
                needsReconnect?: boolean
                error?: string
            }>(res)) ?? {}
            if (!res.ok) {
                if ((res.status === 401 || res.status === 403) && data?.needsReconnect) {
                    toast.error(data.error || 'Please reconnect your Google account in Settings.')
                    return
                }
                throw new Error(data?.error || 'Failed to sync to Google')
            }
            toast.success(data.message || 'Tasks synced to Google!')
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to sync to Google')
        } finally {
            setGoogleSyncing(false)
        }
    }

    const createTask = async () => {
        if (!newTask.title.trim()) { toast.error('Title is required'); return }
        
        let combinedDueDate = null
        if (newTask.due_date) {
            combinedDueDate = newTask.due_time 
                ? new Date(`${newTask.due_date}T${newTask.due_time}`).toISOString()
                : new Date(newTask.due_date).toISOString()
        }

        const { data, error } = await supabase.from('tasks').insert({
            user_id: userId, title: newTask.title, description: newTask.description || null,
            priority: newTask.priority, due_date: combinedDueDate, status: 'todo',
        }).select().single()
        if (error) { toast.error('Failed to create task'); return }
        setTasks((prev) => [...prev, data as Task])
        setCreateDialog(false)
        setNewTask({ title: '', description: '', priority: 'medium', due_date: '', due_time: '' })
        toast.success('Task created')
        if (googleConnected && data) {
            try {
                const res = await fetch('/api/google/tasks', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: data.title,
                        notes: data.description || undefined,
                        due: data.due_date ? new Date(data.due_date).toISOString() : undefined,
                    })
                })
                const result = await res.json()
                if (res.ok && result.task?.id) {
                    await supabase.from('tasks').update({ google_task_id: result.task.id }).eq('id', data.id)
                    setTasks(prev => prev.map(t => t.id === data.id ? { ...t, google_task_id: result.task.id } : t))
                }
            } catch (e) { console.error('Auto-sync to Google failed:', e) }
        }
    }

    const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
        const taskToUpdate = tasks.find(t => t.id === taskId)
        const { error } = await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId)
        if (error) { toast.error('Failed to update task'); return }
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
        if (googleConnected && taskToUpdate?.google_task_id) {
            try {
                const listsRes = await fetch('/api/google/tasks')
                const listsData = await listsRes.json()
                const defaultListId = listsData.taskLists?.[0]?.id
                if (defaultListId) {
                    await fetch('/api/google/tasks', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: taskToUpdate.google_task_id, taskListId: defaultListId, completed: newStatus === 'done' })
                    })
                }
            } catch (e) { console.error('Auto-sync status to Google failed:', e) }
        }
    }

    const deleteTask = async (taskId: string) => {
        const taskToDelete = tasks.find(t => t.id === taskId)
        const { error } = await supabase.from('tasks').delete().eq('id', taskId)
        if (error) { toast.error('Failed to delete task'); return }
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
        toast.success('Task deleted')
        if (taskToDelete?.google_task_id) {
            fetch('/api/google/tasks/delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: taskToDelete.google_task_id })
            }).catch(console.error)
        }
    }

    const handleBreakdown = async () => {
        if (!breakdownInput.trim()) { toast.error('Please enter a task to break down'); return }
        setBreakdownLoading(true)
        try {
            const response = await fetch('/api/ai/breakdown', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: breakdownInput }),
            })
            if (!response.ok) throw new Error('Failed to break down task')
            const data = await response.json()
            const subtasks = data.subtasks as { title: string }[]
            for (const subtask of subtasks) {
                const { data: newTask, error } = await supabase.from('tasks').insert({
                    user_id: userId, title: subtask.title, status: 'todo', priority: 'medium',
                }).select().single()
                if (!error && newTask) setTasks((prev) => [...prev, newTask as Task])
            }
            toast.success(`Created ${subtasks.length} subtasks!`)
            setBreakdownDialog(false)
            setBreakdownInput('')
        } catch { toast.error('Failed to break down task') }
        finally { setBreakdownLoading(false) }
    }

    const handleDragStart = (task: Task) => setDraggedTask(task)
    const handleDragOver = (e: React.DragEvent) => e.preventDefault()
    const handleDrop = (status: Task['status']) => {
        if (draggedTask && draggedTask.status !== status) updateTaskStatus(draggedTask.id, status)
        setDraggedTask(null)
    }

    // List view filtering
    const filteredListTasks = tasks.filter(task => {
        if (listFilter === 'today') return task.due_date && isToday(new Date(task.due_date))
        if (listFilter === 'week') return task.due_date && isThisWeek(new Date(task.due_date), { weekStartsOn: 1 })
        if (listFilter === 'overdue') return task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done'
        return true
    }).sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        return 0
    })

    const todoCount = tasks.filter(t => t.status === 'todo').length
    const inProgressCount = tasks.filter(t => t.status === 'in-progress').length
    const doneCount = tasks.filter(t => t.status === 'done').length

    const openEdit = (task: Task) => {
        setEditingTask(task)
        
        let datePart = ''
        let timePart = ''
        if (task.due_date) {
            const date = new Date(task.due_date)
            // Get local ISO string parts
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const mins = String(date.getMinutes()).padStart(2, '0')
            
            datePart = `${year}-${month}-${day}`
            timePart = `${hours}:${mins}`
        }

        setEditTask({
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            due_date: datePart,
            due_time: timePart,
            status: task.status,
        })
        setEditDialog(true)
    }

    const saveEdits = async () => {
        if (!editingTask) return
        if (!editTask.title.trim()) {
            toast.error('Title is required')
            return
        }

        setEditSaving(true)
        try {
            let combinedDueDate = null
            if (editTask.due_date) {
                combinedDueDate = editTask.due_time 
                    ? new Date(`${editTask.due_date}T${editTask.due_time}`).toISOString()
                    : new Date(editTask.due_date).toISOString()
            }

            const updates = {
                title: editTask.title.trim(),
                description: editTask.description?.trim() ? editTask.description.trim() : null,
                priority: editTask.priority,
                due_date: combinedDueDate,
                status: editTask.status,
                updated_at: new Date().toISOString(),
            }

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', editingTask.id)

            if (error) {
                toast.error('Failed to update task')
                return
            }

            setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? ({ ...t, ...updates } as Task) : t)))
            toast.success('Task updated')

            // Best-effort patch to Google (only if already linked)
            if (googleConnected && editingTask.google_task_id) {
                try {
                    const listsRes = await fetch('/api/google/tasks')
                    const listsData = await readJsonSafely<{
                        taskLists?: Array<{ id?: string; title?: string }>
                        needsReconnect?: boolean
                        error?: string
                    }>(listsRes)
                    const defaultListId = listsData?.taskLists?.[0]?.id

                    if (listsRes.ok && defaultListId) {
                        await fetch('/api/google/tasks', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                taskId: editingTask.google_task_id,
                                taskListId: defaultListId,
                                completed: editTask.status === 'done',
                                title: editTask.title.trim(),
                                notes: editTask.description?.trim() || undefined,
                                due: editTask.due_date ? new Date(editTask.due_date).toISOString() : undefined,
                            })
                        })
                    }
                } catch (e) {
                    console.error('Auto-sync edits to Google failed:', e)
                }
            }

            setEditDialog(false)
            setEditingTask(null)
        } finally {
            setEditSaving(false)
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-violet-400" />
                        Tasks
                    </h1>
                    <p className="text-xs text-gray-600 mt-0.5">
                        {todoCount} to do · {inProgressCount} in progress · {doneCount} done
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View toggle */}
                    <div className="flex items-center p-0.5 bg-white/4 rounded-lg border border-white/[0.07]">
                        <button onClick={() => setViewMode('list')} className={cn("h-7 w-7 flex items-center justify-center rounded-md transition-all", viewMode === 'list' ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400")}>
                            <LayoutList className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setViewMode('board')} className={cn("h-7 w-7 flex items-center justify-center rounded-md transition-all", viewMode === 'board' ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400")}>
                            <KanbanSquare className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    {googleConnected && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={googleSyncing} size="sm"
                                    className="border-white/[0.07] text-gray-400 hover:text-white hover:bg-white/10 text-xs h-8">
                                    {googleSyncing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Cloud className="mr-1.5 h-3 w-3" />}
                                    Google Sync
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-[#111] border-white/10">
                                <DropdownMenuItem onClick={importFromGoogle} className="text-white hover:bg-white/10 cursor-pointer text-sm">
                                    <CloudDownload className="mr-2 h-3.5 w-3.5" /> Import from Google
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={pushToGoogle} className="text-white hover:bg-white/10 cursor-pointer text-sm">
                                    <CloudUpload className="mr-2 h-3.5 w-3.5" /> Push to Google
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setBreakdownDialog(true)}
                        className="border-white/[0.07] text-gray-400 hover:text-white hover:bg-white/10 text-xs h-8">
                        <Sparkles className="mr-1.5 h-3 w-3" /> AI Breakdown
                    </Button>
                    <Button size="sm" onClick={() => setCreateDialog(true)}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-8 px-3">
                        <Plus className="mr-1 h-3.5 w-3.5" /> New Task
                    </Button>
                </div>
            </div>

            {/* Board view */}
            {viewMode === 'board' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {COLUMNS.map((column) => {
                        const colTasks = tasks.filter((t) => t.status === column.id)
                        return (
                            <div
                                key={column.id}
                                className="rounded-xl bg-white/2 border border-white/6 overflow-hidden min-h-90"
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(column.id)}
                            >
                                {/* Column header */}
                                <div className={cn("flex items-center justify-between px-3 py-2.5 border-b border-white/5", column.headerBg)}>
                                    <div className="flex items-center gap-2">
                                        <div className={cn("h-2 w-2 rounded-full", column.accent)} />
                                        <span className="text-xs font-semibold text-white/70">{column.label}</span>
                                    </div>
                                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", column.border, "text-white/50")}>
                                        {colTasks.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-2 space-y-2">
                                    {colTasks.length === 0 && (
                                        <div className="flex items-center justify-center h-20 text-gray-700 text-xs">
                                            Drop tasks here
                                        </div>
                                    )}
                                    {colTasks.map((task) => {
                                        const p = PRIORITY_CONFIG[task.priority]
                                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done'
                                        return (
                                            <div
                                                key={task.id}
                                                draggable
                                                onDragStart={() => handleDragStart(task)}
                                                onClick={() => openEdit(task)}
                                                className={cn(
                                                    "group relative rounded-lg bg-white/4 border border-white/[0.07]",
                                                    "hover:border-white/15 hover:bg-white/6 transition-all cursor-grab active:cursor-grabbing",
                                                    "overflow-hidden"
                                                )}
                                            >
                                                {/* Priority bar */}
                                                <div className={cn("absolute left-0 top-0 bottom-0 w-0.5", p.bar)} />

                                                <div className="p-3 pl-4">
                                                    <div className="flex items-start gap-2">
                                                        <GripVertical className="h-3.5 w-3.5 text-gray-700 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className={cn("text-sm font-medium text-white/85 leading-snug", task.status === 'done' && "line-through text-gray-600")}>
                                                                    {task.title}
                                                                </p>
                                                                <button
                                                                    className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                                                                    onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                            {task.description && (
                                                                <p className="text-[11px] text-gray-600 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                                                            )}
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", p.badge)}>
                                                                    {p.label}
                                                                </span>
                                                                 {task.due_date && (
                                                                    <span className={cn("text-[10px] flex items-center gap-0.5", isOverdue ? "text-red-400" : "text-gray-600")}>
                                                                        <Calendar className="h-2.5 w-2.5" />
                                                                        {format(new Date(task.due_date), 'MMM d, p')}
                                                                    </span>
                                                                )}
                                                                {task.google_task_id && (
                                                                    <span className="text-[10px] text-blue-500/70 font-medium">G</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* List view */
                <div className="max-w-2xl mx-auto space-y-3">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 border-b border-white/6 pb-3">
                        {(['all', 'today', 'week', 'overdue'] as const).map(f => (
                            <button key={f} onClick={() => setListFilter(f)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                                    listFilter === f ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400 hover:bg-white/5"
                                )}>
                                {f === 'week' ? 'This Week' : f}
                            </button>
                        ))}
                    </div>

                    {filteredListTasks.length === 0 ? (
                        <div className="text-center py-16 text-gray-600">
                            <Circle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No tasks {listFilter !== 'all' ? `for ${listFilter}` : ''}</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredListTasks.map((task) => {
                                const p = PRIORITY_CONFIG[task.priority]
                                const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done'
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => openEdit(task)}
                                        className={cn(
                                        "group flex items-center gap-3 px-3 py-3 rounded-xl border transition-all",
                                        "bg-white/2 border-white/6 hover:bg-white/4 hover:border-white/10",
                                        task.status === 'done' && "opacity-50"
                                    )}
                                    >
                                        {/* Priority dot */}
                                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", p.dot, task.status === 'done' && "opacity-30")} />

                                        {/* Custom checkbox */}
                                        <TaskCheckbox
                                            checked={task.status === 'done'}
                                            onChange={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                                        />

                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-medium text-white/85", task.status === 'done' && "line-through text-gray-500")}>
                                                {task.title}
                                            </p>
                                            {task.description && (
                                                <p className="text-xs text-gray-600 mt-0.5 truncate">{task.description}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {task.due_date && (
                                                <span className={cn("text-[10px] flex items-center gap-1 sm:flex", isOverdue ? "text-red-400" : "text-gray-600")}>
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    {format(new Date(task.due_date), 'MMM d, p')}
                                                </span>
                                            )}
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border hidden sm:block", p.badge)}>
                                                {p.label}
                                            </span>
                                            {task.google_task_id && <span className="text-[10px] text-blue-500/60">G</span>}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                                className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Edit Task Dialog */}
            <Dialog
                open={editDialog}
                onOpenChange={(open) => {
                    setEditDialog(open)
                    if (!open) setEditingTask(null)
                }}
            >
                <DialogContent className="bg-[#111] border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white text-base">Edit Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-gray-400 text-xs">Title</Label>
                            <Input
                                value={editTask.title}
                                onChange={(e) => setEditTask((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="Task title"
                                onKeyDown={(e) => e.key === 'Enter' && saveEdits()}
                                className="bg-white/4 border-white/10 text-white text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-400 text-xs">Description <span className="text-gray-700">(optional)</span></Label>
                            <div className="relative">
                                <Textarea
                                    value={editTask.description}
                                    onChange={(e) => setEditTask((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Add details..."
                                    className="bg-white/4 border-white/10 text-white resize-none text-sm pr-10"
                                    rows={2}
                                />
                                <div className="absolute right-2 top-2">
                                    <SpeechToTextButton onTranscript={(text) => setEditTask((prev) => ({ ...prev, description: (prev.description || '') + text }))} />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-gray-400 text-xs">Priority</Label>
                                <Select
                                    value={editTask.priority}
                                    onValueChange={(value) => setEditTask((prev) => ({ ...prev, priority: value as Task['priority'] }))}
                                >
                                    <SelectTrigger className="bg-white/4 border-white/10 text-white text-sm h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/10">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-gray-400 text-xs">Deadline</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={editTask.due_date}
                                        onChange={(e) => setEditTask((prev) => ({ ...prev, due_date: e.target.value }))}
                                        className="bg-white/4 border-white/10 text-white text-sm h-9 flex-1"
                                    />
                                    <Input
                                        type="time"
                                        value={editTask.due_time}
                                        onChange={(e) => setEditTask((prev) => ({ ...prev, due_time: e.target.value }))}
                                        className="bg-white/4 border-white/10 text-white text-sm h-9 w-[120px]"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-400 text-xs">Status</Label>
                            <Select
                                value={editTask.status}
                                onValueChange={(value) => setEditTask((prev) => ({ ...prev, status: value as Task['status'] }))}
                            >
                                <SelectTrigger className="bg-white/4 border-white/10 text-white text-sm h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#111] border-white/10">
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={saveEdits}
                            disabled={editSaving}
                            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm"
                        >
                            {editSaving ? (
                                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving...</>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Task Dialog */}
            <Dialog open={createDialog} onOpenChange={setCreateDialog}>
                <DialogContent className="bg-[#111] border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white text-base">New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-gray-400 text-xs">Title</Label>
                            <Input value={newTask.title} onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="What needs to be done?" onKeyDown={(e) => e.key === 'Enter' && createTask()}
                                className="bg-white/4 border-white/10 text-white text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-400 text-xs">Description <span className="text-gray-700">(optional)</span></Label>
                            <div className="relative">
                                <Textarea value={newTask.description} onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Add details..." className="bg-white/4 border-white/10 text-white resize-none text-sm pr-10" rows={2} />
                                <div className="absolute right-2 top-2">
                                    <SpeechToTextButton onTranscript={(text) => setNewTask((prev) => ({ ...prev, description: (prev.description || '') + text }))} />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-gray-400 text-xs">Priority</Label>
                                <Select value={newTask.priority} onValueChange={(value) => setNewTask((prev) => ({ ...prev, priority: value as Task['priority'] }))}>
                                    <SelectTrigger className="bg-white/4 border-white/10 text-white text-sm h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/10">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-gray-400 text-xs">Deadline</Label>
                                <div className="flex gap-2">
                                    <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask((prev) => ({ ...prev, due_date: e.target.value }))}
                                        className="bg-white/4 border-white/10 text-white text-sm h-9 flex-1" />
                                    <Input type="time" value={newTask.due_time} onChange={(e) => setNewTask((prev) => ({ ...prev, due_time: e.target.value }))}
                                        className="bg-white/4 border-white/10 text-white text-sm h-9 w-[120px]" />
                                </div>
                            </div>
                        </div>
                        <Button onClick={createTask} className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm">
                            Create Task
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Breakdown Dialog */}
            <Dialog open={breakdownDialog} onOpenChange={setBreakdownDialog}>
                <DialogContent className="bg-[#111] border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white text-base flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-pink-400" /> AI Task Breakdown
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Enter a big goal and AI will break it into smaller, actionable steps.
                        </p>
                        <div className="relative">
                            <Textarea value={breakdownInput} onChange={(e) => setBreakdownInput(e.target.value)}
                                placeholder="e.g., Study for Operating Systems final exam..."
                                className="bg-white/4 border-white/10 text-white resize-none pr-10 text-sm" rows={3} />
                            <div className="absolute right-2 top-2">
                                <SpeechToTextButton onTranscript={(text) => setBreakdownInput((prev) => prev + text)} />
                            </div>
                        </div>
                        <Button onClick={handleBreakdown} disabled={breakdownLoading || !breakdownInput.trim()}
                            className="w-full bg-linear-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-sm">
                            {breakdownLoading ? (
                                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Breaking down...</>
                            ) : (
                                <><Sparkles className="mr-2 h-3.5 w-3.5" /> Break It Down</>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}