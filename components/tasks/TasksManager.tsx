'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Plus, CheckSquare, Sparkles, Loader2, GripVertical, Trash2, Cloud, CloudDownload, CloudUpload, Calendar, LayoutList, KanbanSquare } from 'lucide-react'
import type { Task } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { SpeechToTextButton } from '@/components/ui/speech'

interface TasksManagerProps {
    initialTasks: Task[]
    userId: string
}

const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const columns = [
    { id: 'todo' as const, label: 'To Do', color: 'border-gray-500' },
    { id: 'in-progress' as const, label: 'In Progress', color: 'border-blue-500' },
    { id: 'done' as const, label: 'Done', color: 'border-green-500' },
]

export function TasksManager({ initialTasks, userId }: TasksManagerProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks)
    const [createDialog, setCreateDialog] = useState(false)
    const [breakdownDialog, setBreakdownDialog] = useState(false)
    const [breakdownInput, setBreakdownInput] = useState('')
    const [breakdownLoading, setBreakdownLoading] = useState(false)
    const [newTask, setNewTask] = useState<{
        title: string
        description: string
        priority: Task['priority']
        due_date: string
    }>({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
    })
    const [draggedTask, setDraggedTask] = useState<Task | null>(null)
    const [googleSyncing, setGoogleSyncing] = useState(false)
    const [googleConnected, setGoogleConnected] = useState(false)
    const supabase = createClient()

    // Check if Google is connected
    useEffect(() => {
        const checkGoogleConnection = async () => {
            const { data: profile } = await supabase
                .from('profiles')
                .select('google_connected')
                .eq('id', userId)
                .single()
            setGoogleConnected(profile?.google_connected || false)
        }
        checkGoogleConnection()
    }, [userId, supabase])

    // Import tasks from Google
    const importFromGoogle = async () => {
        setGoogleSyncing(true)
        try {
            const res = await fetch('/api/google/tasks')
            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            const googleTasks = data.tasks || []
            let imported = 0

            for (const gTask of googleTasks) {
                // Check if task already exists (by title match)
                const exists = tasks.some(t => t.title === gTask.title)
                if (!exists && gTask.title) {
                    const { data: newTask, error } = await supabase
                        .from('tasks')
                        .insert({
                            user_id: userId,
                            title: gTask.title,
                            description: gTask.notes || null,
                            status: gTask.completed ? 'done' : 'todo',
                            priority: 'medium',
                            due_date: gTask.due || null,
                            google_task_id: gTask.id,
                        })
                        .select()
                        .single()

                    if (!error && newTask) {
                        setTasks(prev => [...prev, newTask as Task])
                        imported++
                    }
                }
            }

            toast.success(`Imported ${imported} tasks from Google`)
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to import from Google';
            toast.error(errorMessage)
        } finally {
            setGoogleSyncing(false)
        }
    }

    // Push local tasks to Google
    const pushToGoogle = async () => {
        setGoogleSyncing(true)
        try {
            const res = await fetch('/api/google/sync', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            toast.success(data.message || 'Tasks synced to Google!')
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to sync to Google';
            toast.error(errorMessage)
        } finally {
            setGoogleSyncing(false)
        }
    }

    const createTask = async () => {
        if (!newTask.title.trim()) {
            toast.error('Title is required')
            return
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert({
                user_id: userId,
                title: newTask.title,
                description: newTask.description || null,
                priority: newTask.priority,
                due_date: newTask.due_date || null,
                status: 'todo',
            })
            .select()
            .single()

        if (error) {
            toast.error('Failed to create task')
            return
        }

        setTasks((prev) => [...prev, data as Task])
        setCreateDialog(false)
        setNewTask({ title: '', description: '', priority: 'medium', due_date: '' })
        toast.success('Task created')

        // Auto-sync to Google if connected
        if (googleConnected && data) {
            try {
                const res = await fetch('/api/google/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: data.title,
                        notes: data.description || undefined,
                        due: data.due_date || undefined,
                    })
                })
                const result = await res.json()
                if (res.ok && result.task?.id) {
                    // Update local task with Google ID
                    await supabase
                        .from('tasks')
                        .update({ google_task_id: result.task.id })
                        .eq('id', data.id)
                    setTasks(prev => prev.map(t => t.id === data.id ? { ...t, google_task_id: result.task.id } : t))
                }
            } catch (e) {
                console.error('Auto-sync to Google failed:', e)
            }
        }
    }

    const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
        const taskToUpdate = tasks.find(t => t.id === taskId)

        const { error } = await supabase
            .from('tasks')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', taskId)

        if (error) {
            toast.error('Failed to update task')
            return
        }

        setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        )

        // Auto-sync status to Google if task is linked
        if (googleConnected && taskToUpdate?.google_task_id) {
            try {
                // We need the listId - for now use default list approach
                const listsRes = await fetch('/api/google/tasks')
                const listsData = await listsRes.json()
                const defaultListId = listsData.taskLists?.[0]?.id

                if (defaultListId) {
                    await fetch('/api/google/tasks', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            taskId: taskToUpdate.google_task_id,
                            taskListId: defaultListId,
                            completed: newStatus === 'done'
                        })
                    })
                }
            } catch (e) {
                console.error('Auto-sync status to Google failed:', e)
            }
        }
    }

    const deleteTask = async (taskId: string) => {
        const taskToDelete = tasks.find(t => t.id === taskId)
        const { error } = await supabase.from('tasks').delete().eq('id', taskId)

        if (error) {
            toast.error('Failed to delete task')
            return
        }

        setTasks((prev) => prev.filter((t) => t.id !== taskId))
        toast.success('Task deleted')

        // Sync deletion to Google Tasks if connected
        if (taskToDelete?.google_task_id) {
            toast.loading('Deleting from Google Tasks...', { duration: 1000 })
            fetch('/api/google/tasks/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: taskToDelete.google_task_id })
            }).catch(console.error)
        }
    }

    const handleBreakdown = async () => {
        if (!breakdownInput.trim()) {
            toast.error('Please enter a task to break down')
            return
        }

        setBreakdownLoading(true)

        try {
            const response = await fetch('/api/ai/breakdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: breakdownInput }),
            })

            if (!response.ok) throw new Error('Failed to break down task')

            const data = await response.json()

            // Create all subtasks
            const subtasks = data.subtasks as { title: string }[]
            for (const subtask of subtasks) {
                const { data: newTask, error } = await supabase
                    .from('tasks')
                    .insert({
                        user_id: userId,
                        title: subtask.title,
                        status: 'todo',
                        priority: 'medium',
                    })
                    .select()
                    .single()

                if (!error && newTask) {
                    setTasks((prev) => [...prev, newTask as Task])
                }
            }

            toast.success(`Created ${subtasks.length} subtasks!`)
            setBreakdownDialog(false)
            setBreakdownInput('')
        } catch {
            toast.error('Failed to break down task')
        } finally {
            setBreakdownLoading(false)
        }
    }

    const handleDragStart = (task: Task) => {
        setDraggedTask(task)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (status: Task['status']) => {
        if (draggedTask && draggedTask.status !== status) {
            updateTaskStatus(draggedTask.id, status)
        }
        setDraggedTask(null)
    }

    const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CheckSquare className="h-6 w-6 text-purple-400" />
                        Tasks
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Manage your assignments and to-dos
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <div className="flex items-center p-1 bg-white/5 rounded-lg border border-white/10 mr-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className={cn("h-7 px-2", viewMode === 'list' && "bg-white/10 text-white")}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('board')}
                            className={cn("h-7 px-2", viewMode === 'board' && "bg-white/10 text-white")}
                        >
                            <KanbanSquare className="h-4 w-4" />
                        </Button>
                    </div>
                    {googleConnected && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={googleSyncing}
                                    className="border-white/10 text-white hover:bg-white/10"
                                >
                                    {googleSyncing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Cloud className="mr-2 h-4 w-4" />
                                    )}
                                    Google Sync
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-gray-900 border-white/10">
                                <DropdownMenuItem
                                    onClick={importFromGoogle}
                                    className="text-white hover:bg-white/10 cursor-pointer"
                                >
                                    <CloudDownload className="mr-2 h-4 w-4" />
                                    Import from Google
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={pushToGoogle}
                                    className="text-white hover:bg-white/10 cursor-pointer"
                                >
                                    <CloudUpload className="mr-2 h-4 w-4" />
                                    Push to Google
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => setBreakdownDialog(true)}
                        className="border-white/10 text-white hover:bg-white/10"
                    >
                        <Sparkles className="mr-2 h-4 w-4" /> AI Breakdown
                    </Button>
                    <Button
                        onClick={() => setCreateDialog(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Task
                    </Button>
                </div>
            </div>

            {/* Task Content */}
            {viewMode === 'board' ? (
                /* Kanban Board */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {columns.map((column) => (
                        <div
                            key={column.id}
                            className={cn(
                                "p-4 rounded-xl bg-black/40 backdrop-blur-xl border-t-2",
                                column.color,
                                "min-h-[400px]"
                            )}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(column.id)}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-white">{column.label}</h3>
                                <Badge variant="outline" className="border-white/20 text-gray-400">
                                    {tasks.filter((t) => t.status === column.id).length}
                                </Badge>
                            </div>
                            <div className="space-y-3">
                                {tasks
                                    .filter((task) => task.status === column.id)
                                    .map((task) => (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={() => handleDragStart(task)}
                                            className={cn(
                                                "p-3 rounded-lg bg-white/5 border border-white/10 cursor-grab active:cursor-grabbing",
                                                "hover:border-purple-500/50 transition-all group"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <GripVertical className="h-4 w-4 text-gray-500 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-sm font-medium text-white">{task.title}</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                                            onClick={() => deleteTask(task.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    {task.description && (
                                                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge className={priorityColors[task.priority]} variant="outline">
                                                            {task.priority}
                                                        </Badge>
                                                        {task.due_date && (
                                                            <span className="text-xs text-gray-500">
                                                                {format(new Date(task.due_date), 'MMM d')}
                                                            </span>
                                                        )}
                                                        {task.google_task_id && (
                                                            <div className="flex items-center gap-1 text-[10px] text-blue-400" title="Synced with Google Tasks">
                                                                <span className="text-xs">G</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="space-y-2 max-w-3xl mx-auto">
                    {tasks.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No tasks found. Create one to get started!</p>
                        </div>
                    ) : (
                        tasks
                            // Simple sort: Pending first, then by priority/date
                            .sort((a, b) => {
                                if (a.status === 'done' && b.status !== 'done') return 1
                                if (a.status !== 'done' && b.status === 'done') return -1
                                return 0
                            })
                            .map((task) => (
                                <div
                                    key={task.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all",
                                        task.status === 'done' && "opacity-60 bg-white/[0.02]"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "h-5 w-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-colors",
                                            task.status === 'done'
                                                ? "bg-purple-500 border-purple-500"
                                                : "border-gray-500 hover:border-purple-400"
                                        )}
                                        onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                                    >
                                        {task.status === 'done' && <CheckSquare className="h-3 w-3 text-white" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className={cn("text-sm font-medium text-white truncate", task.status === 'done' && "line-through text-gray-500")}>
                                            {task.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={cn("text-[10px] h-4 px-1", priorityColors[task.priority])}>
                                                {task.priority}
                                            </Badge>
                                            {task.due_date && (
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(task.due_date), 'MMM d')}
                                                </span>
                                            )}
                                            {task.google_task_id && (
                                                <span className="text-[10px] text-blue-400">G</span>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                        onClick={() => deleteTask(task.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                    )}
                </div>
            )}

            {/* Create Task Dialog */}
            <Dialog open={createDialog} onOpenChange={setCreateDialog}>
                <DialogContent className="bg-gray-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white">Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-gray-300">Title</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={newTask.title}
                                    onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder="Task title..."
                                    className="bg-white/5 border-white/10 text-white flex-1"
                                />
                                <SpeechToTextButton
                                    onTranscript={(text) => setNewTask((prev) => ({ ...prev, title: prev.title + text }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-300">Description (optional)</Label>
                            <Textarea
                                value={newTask.description}
                                onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Add details..."
                                className="bg-white/5 border-white/10 text-white resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-300">Priority</Label>
                                <Select
                                    value={newTask.priority}
                                    onValueChange={(value) =>
                                        setNewTask((prev) => ({ ...prev, priority: value as Task['priority'] }))
                                    }
                                >
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/10">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-300">Due Date</Label>
                                <Input
                                    type="date"
                                    value={newTask.due_date}
                                    onChange={(e) => setNewTask((prev) => ({ ...prev, due_date: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={createTask}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            Create Task
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Breakdown Dialog */}
            <Dialog open={breakdownDialog} onOpenChange={setBreakdownDialog}>
                <DialogContent className="bg-gray-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-pink-400" />
                            AI Task Breakdown
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-gray-400 text-sm">
                            Enter a big task or goal, and AI will break it down into smaller, actionable subtasks.
                        </p>
                        <div className="relative">
                            <Textarea
                                value={breakdownInput}
                                onChange={(e) => setBreakdownInput(e.target.value)}
                                placeholder="e.g., Study for History Final Exam..."
                                className="bg-white/5 border-white/10 text-white resize-none pr-10"
                                rows={3}
                            />
                            <div className="absolute right-2 top-2">
                                <SpeechToTextButton
                                    onTranscript={(text) => setBreakdownInput((prev) => prev + text)}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleBreakdown}
                            disabled={breakdownLoading || !breakdownInput.trim()}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            {breakdownLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Breaking down...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Break It Down
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
