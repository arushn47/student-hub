'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Palmtree, Clock, CheckCircle, Plus, Loader2 } from 'lucide-react'
import type { Task, ClassSchedule } from '@/types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SemesterBreak {
    id: string
    name: string
    start_date: string
    end_date: string
}

interface CalendarViewProps {
    tasks: Task[]
    classes: ClassSchedule[]
    breaks?: SemesterBreak[]
}

const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
}

const priorityLabels = {
    high: 'High Priority',
    medium: 'Medium Priority',
    low: 'Low Priority',
}

// Check if a date is during any break
function isDateOnBreak(date: Date, breaks: SemesterBreak[]): { onBreak: boolean; breakName?: string } {
    const dateStr = date.toISOString().split('T')[0]

    for (const b of breaks) {
        if (dateStr >= b.start_date && dateStr <= b.end_date) {
            return { onBreak: true, breakName: b.name }
        }
    }
    return { onBreak: false }
}

export function CalendarView({ tasks: initialTasks, classes, breaks = [] }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [tasks, setTasks] = useState<Task[]>(initialTasks)

    // Task creation state
    const [showAddTask, setShowAddTask] = useState(false)
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
    const [savingTask, setSavingTask] = useState(false)

    const supabase = createClient()

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Get the day of week for the first day (0 = Sunday)
    const startDay = getDay(monthStart)

    // Get tasks for a specific date
    const getTasksForDate = (date: Date) => {
        return tasks.filter((task) => {
            if (!task.due_date) return false
            return isSameDay(new Date(task.due_date), date)
        })
    }

    // Get classes for a specific day of week
    const getClassesForDay = (dayOfWeek: number) => {
        return classes.filter((cls) => cls.day_of_week === dayOfWeek)
    }

    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

    // Handle day click
    const handleDayClick = (day: Date) => {
        setSelectedDate(day)
        setShowAddTask(false)
        setNewTaskTitle('')
    }

    // Save new task
    const handleSaveTask = async () => {
        if (!newTaskTitle.trim() || !selectedDate) return

        setSavingTask(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('Please sign in to add tasks')
                return
            }

            // Create date at noon local time to avoid timezone issues
            const dueDate = new Date(selectedDate)
            dueDate.setHours(12, 0, 0, 0)

            const { data, error } = await supabase
                .from('tasks')
                .insert({
                    user_id: user.id,
                    title: newTaskTitle.trim(),
                    priority: newTaskPriority,
                    status: 'todo',
                    due_date: dueDate.toISOString(),
                })
                .select()
                .single()

            if (error) throw error

            // Add to local state
            setTasks(prev => [...prev, data as Task])
            setNewTaskTitle('')
            setShowAddTask(false)
            toast.success('Task added!')

            // Sync to Google Tasks in the background (if connected)
            fetch('/api/google/sync', { method: 'POST' })
                .then(res => res.json())
                .then(result => {
                    if (result.synced > 0) {
                        toast.success('Synced to Google Tasks!')
                    }
                })
                .catch(() => {
                    // Silently fail - Google sync is optional
                })
        } catch (error) {
            console.error('Error saving task:', error)
            toast.error('Failed to save task')
        } finally {
            setSavingTask(false)
        }
    }

    // Selected date details
    const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : []
    const selectedDateClasses = selectedDate ? getClassesForDay(getDay(selectedDate)) : []
    const selectedBreakStatus = selectedDate ? isDateOnBreak(selectedDate, breaks) : { onBreak: false }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CalendarIcon className="h-6 w-6 text-orange-400" />
                        Calendar
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        View your tasks, classes, and breaks at a glance
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <Card className="bg-black/40 backdrop-blur-xl border-white/10 lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={prevMonth}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <CardTitle className="text-lg font-semibold text-white">
                            {format(currentMonth, 'MMMM yyyy')}
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={nextMonth}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                <div
                                    key={day}
                                    className="p-2 text-center text-sm font-medium text-gray-400"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Empty cells for days before month start */}
                            {Array.from({ length: startDay }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square" />
                            ))}

                            {/* Days of the month */}
                            {daysInMonth.map((day) => {
                                const dayTasks = getTasksForDate(day)
                                const dayOfWeek = getDay(day)
                                const dayClasses = getClassesForDay(dayOfWeek)
                                const isToday = isSameDay(day, new Date())
                                const isSelected = selectedDate && isSameDay(day, selectedDate)
                                const breakStatus = isDateOnBreak(day, breaks)

                                return (
                                    <div
                                        key={day.toString()}
                                        onClick={() => handleDayClick(day)}
                                        className={cn(
                                            "aspect-square p-1 rounded-lg border transition-all cursor-pointer hover:border-purple-500/50",
                                            isSameMonth(day, currentMonth)
                                                ? "bg-white/5 border-white/10"
                                                : "bg-white/2 border-transparent",
                                            isToday && "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900",
                                            isSelected && "border-purple-500 bg-purple-500/20",
                                            breakStatus.onBreak && "bg-cyan-500/10 border-cyan-500/30"
                                        )}
                                    >
                                        <div className="text-right">
                                            <span
                                                className={cn(
                                                    "text-sm",
                                                    isToday ? "text-purple-400 font-bold" :
                                                        breakStatus.onBreak ? "text-cyan-400" : "text-gray-400"
                                                )}
                                            >
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        <div className="mt-1 space-y-0.5 overflow-hidden max-h-12">
                                            {breakStatus.onBreak && (
                                                <div className="flex items-center gap-1">
                                                    <Palmtree className="w-2 h-2 text-cyan-400" />
                                                    <span className="text-[10px] text-cyan-400 truncate">Break</span>
                                                </div>
                                            )}
                                            {!breakStatus.onBreak && dayTasks.slice(0, 2).map((task) => (
                                                <div
                                                    key={task.id}
                                                    className="flex items-center gap-1"
                                                >
                                                    <div
                                                        className={cn(
                                                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                                            priorityColors[task.priority]
                                                        )}
                                                    />
                                                    <span className="text-xs text-white truncate">
                                                        {task.title}
                                                    </span>
                                                </div>
                                            ))}
                                            {!breakStatus.onBreak && dayClasses.slice(0, 1).map((cls) => (
                                                <div
                                                    key={cls.id}
                                                    className="flex items-center gap-1"
                                                >
                                                    <div
                                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: cls.color }}
                                                    />
                                                    <span className="text-xs text-gray-300 truncate">
                                                        {cls.short_name || cls.name}
                                                    </span>
                                                </div>
                                            ))}
                                            {!breakStatus.onBreak && (dayTasks.length + dayClasses.length > 3) && (
                                                <span className="text-xs text-gray-500">
                                                    +{dayTasks.length + dayClasses.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Selected Day Panel */}
                <Card className="bg-black/40 backdrop-blur-xl border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-semibold text-white">
                            {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a Day'}
                        </CardTitle>
                        {selectedDate && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedDate(null)}
                                className="h-6 w-6 text-gray-400 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!selectedDate ? (
                            <p className="text-gray-400 text-sm">Click on a date to see details</p>
                        ) : (
                            <>
                                {/* Break Notice */}
                                {selectedBreakStatus.onBreak && (
                                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2">
                                        <Palmtree className="h-5 w-5 text-cyan-400" />
                                        <div>
                                            <p className="text-sm font-medium text-cyan-400">{selectedBreakStatus.breakName}</p>
                                            <p className="text-xs text-cyan-400/70">No classes on this day</p>
                                        </div>
                                    </div>
                                )}

                                {/* Classes */}
                                {!selectedBreakStatus.onBreak && selectedDateClasses.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            Classes
                                        </h3>
                                        <div className="space-y-2">
                                            {selectedDateClasses.map((cls) => (
                                                <div
                                                    key={cls.id}
                                                    className="p-2 rounded-lg bg-white/5 flex items-center gap-3"
                                                >
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: cls.color }}
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-sm text-white">{cls.name}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {cls.start_time} - {cls.end_time}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tasks */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" />
                                        Tasks ({selectedDateTasks.length})
                                    </h3>
                                    {selectedDateTasks.length === 0 ? (
                                        <p className="text-xs text-gray-500">No tasks due on this day</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedDateTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    className={cn(
                                                        "p-2 rounded-lg bg-white/5 flex items-center gap-3",
                                                        task.status === 'done' && "opacity-50"
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            priorityColors[task.priority]
                                                        )}
                                                    />
                                                    <div className="flex-1">
                                                        <p className={cn(
                                                            "text-sm text-white",
                                                            task.status === 'done' && "line-through"
                                                        )}>{task.title}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {priorityLabels[task.priority]}
                                                            {task.status === 'done' && ' • Completed'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Task Section */}
                                <div className="pt-2 border-t border-white/10">
                                    {!showAddTask ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowAddTask(true)}
                                            className="w-full border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Task for This Day
                                        </Button>
                                    ) : (
                                        <div className="space-y-3 p-3 rounded-lg bg-white/5">
                                            <div className="space-y-1.5">
                                                <Label className="text-gray-300 text-xs">Task Title</Label>
                                                <Input
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    placeholder="What needs to be done?"
                                                    className="bg-white/5 border-white/10 text-white text-sm h-8"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTask()}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-gray-300 text-xs">Priority</Label>
                                                <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as 'low' | 'medium' | 'high')}>
                                                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">🟢 Low</SelectItem>
                                                        <SelectItem value="medium">🟡 Medium</SelectItem>
                                                        <SelectItem value="high">🔴 High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }}
                                                    className="flex-1 text-gray-400"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={handleSaveTask}
                                                    disabled={!newTaskTitle.trim() || savingTask}
                                                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                                >
                                                    {savingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Task'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 items-center text-sm">
                <span className="text-gray-400">Legend:</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-gray-300">High Priority</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="text-gray-300">Medium Priority</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-gray-300">Low Priority</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Palmtree className="w-3 h-3 text-cyan-400" />
                    <span className="text-gray-300">Break/Holiday</span>
                </div>
            </div>
        </div>
    )
}

