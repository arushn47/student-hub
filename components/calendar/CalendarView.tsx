'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task, ClassSchedule } from '@/types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
    tasks: Task[]
    classes: ClassSchedule[]
}

const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
}

export function CalendarView({ tasks, classes }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

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
                        View your tasks and classes at a glance
                    </p>
                </div>
            </div>

            {/* Calendar */}
            <Card className="bg-black/40 backdrop-blur-xl border-white/10">
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

                            return (
                                <div
                                    key={day.toString()}
                                    className={cn(
                                        "aspect-square p-1 rounded-lg border transition-colors",
                                        isSameMonth(day, currentMonth)
                                            ? "bg-white/5 border-white/10"
                                            : "bg-white/2 border-transparent",
                                        isToday && "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900"
                                    )}
                                >
                                    <div className="text-right">
                                        <span
                                            className={cn(
                                                "text-sm",
                                                isToday ? "text-purple-400 font-bold" : "text-gray-400"
                                            )}
                                        >
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                    <div className="mt-1 space-y-0.5 overflow-hidden max-h-12">
                                        {dayTasks.slice(0, 2).map((task) => (
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
                                        {dayClasses.slice(0, 1).map((cls) => (
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
                                        {(dayTasks.length + dayClasses.length > 3) && (
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
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-gray-300">Classes</span>
                </div>
            </div>

            {/* Upcoming This Week */}
            <Card className="bg-black/40 backdrop-blur-xl border-white/10">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-white">
                        Upcoming Tasks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {tasks.filter((t) => t.status !== 'done' && t.due_date).length === 0 ? (
                        <p className="text-gray-400 text-sm">No upcoming tasks with due dates</p>
                    ) : (
                        <div className="space-y-2">
                            {tasks
                                .filter((t) => t.status !== 'done' && t.due_date)
                                .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
                                .slice(0, 5)
                                .map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    priorityColors[task.priority]
                                                )}
                                            />
                                            <span className="text-sm text-white">{task.title}</span>
                                        </div>
                                        <Badge variant="outline" className="border-white/20 text-gray-400">
                                            {format(new Date(task.due_date!), 'MMM d')}
                                        </Badge>
                                    </div>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
