'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Clock, Trash2 } from 'lucide-react'
import type { ClassSchedule } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ImageUploadExtractor } from '@/components/ai/ImageUploadExtractor'

interface TimetableGridProps {
    initialClasses: ClassSchedule[]
    userId: string
}

const days = [
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' },
    { id: 0, label: 'Sun' },
]

// Extended hours to cover 8 AM to 8 PM (university typical)
const startHour = 8
const endHour = 20
const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour)

const colors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
]

export function TimetableGrid({ initialClasses, userId }: TimetableGridProps) {
    const [classes, setClasses] = useState<ClassSchedule[]>(initialClasses)
    const [createDialog, setCreateDialog] = useState(false)
    const [newClass, setNewClass] = useState({
        name: '',
        short_name: '',
        instructor: '',
        location: '',
        color: colors[0],
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
    })
    const supabase = createClient()

    const createClass = async () => {
        if (!newClass.name.trim()) {
            toast.error('Class name is required')
            return
        }

        const { data, error } = await supabase
            .from('class_schedules')
            .insert({
                user_id: userId,
                ...newClass,
            })
            .select()
            .single()

        if (error) {
            toast.error('Failed to create class')
            return
        }

        setClasses((prev) => [...prev, data as ClassSchedule])
        setCreateDialog(false)
        setNewClass({
            name: '',
            short_name: '',
            instructor: '',
            location: '',
            color: colors[0],
            day_of_week: 1,
            start_time: '08:00',
            end_time: '09:00',
        })
        toast.success('Class added to timetable')
    }

    const deleteClass = async (classId: string) => {
        const { error } = await supabase.from('class_schedules').delete().eq('id', classId)

        if (error) {
            toast.error('Failed to delete class')
            return
        }

        setClasses((prev) => prev.filter((c) => c.id !== classId))
        toast.success('Class deleted')
    }

    // Horizontal Layout Helper
    const getClassStyleHorizontal = (cls: ClassSchedule) => {
        const [startH, startM] = cls.start_time.split(':').map(Number)
        const [endH, endM] = cls.end_time.split(':').map(Number)

        // Calculate offset from startHour (8 AM)
        const totalStartMinutes = (startH * 60 + startM) - (startHour * 60)
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)

        return {
            left: `${(totalStartMinutes / ((endHour - startHour + 1) * 60)) * 100}%`,
            width: `${(durationMinutes / ((endHour - startHour + 1) * 60)) * 100}%`,
            backgroundColor: cls.color + '40',
            borderLeft: `3px solid ${cls.color}`,
            zIndex: 10
        }
    }

    return (
        <div className="space-y-7">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Clock className="h-6 w-6 text-cyan-400" />
                        Class Timetable
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Visualize your weekly schedule
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            if (!confirm('Are you sure you want to clear your entire schedule?')) return
                            const { error } = await supabase.from('class_schedules').delete().eq('user_id', userId)
                            if (error) toast.error('Failed to clear schedule')
                            else {
                                setClasses([])
                                toast.success('Schedule cleared')
                            }
                        }}
                        className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Clear All
                    </Button>
                    <ImageUploadExtractor
                        type="timetable"
                        title="Extract Schedule"
                        description="Upload a picture of your class timetable."
                        onExtract={async (data) => {
                            if (data.classes && Array.isArray(data.classes)) {
                                try {
                                    const dayMap: Record<string, number> = {
                                        'Monday': 1, 'Mon': 1,
                                        'Tuesday': 2, 'Tue': 2,
                                        'Wednesday': 3, 'Wed': 3,
                                        'Thursday': 4, 'Thu': 4,
                                        'Friday': 5, 'Fri': 5,
                                        'Saturday': 6, 'Sat': 6,
                                        'Sunday': 0, 'Sun': 0
                                    }

                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const classesToInsert = data.classes.map((cls: any) => {
                                        let start = '09:00'
                                        let end = '10:00'

                                        if (cls.time) {
                                            const parts = cls.time.replace('to', '-').split('-').map((s: string) => s.trim())
                                            if (parts.length === 2) {
                                                try {
                                                    const clean = (t: string) => {
                                                        const [time] = t.split(' ')
                                                        return time.includes(':') ? time : `${time}:00`
                                                    }

                                                    start = clean(parts[0])
                                                    end = clean(parts[1])
                                                } catch { }
                                            }
                                        }

                                        return {
                                            user_id: userId,
                                            name: cls.subject || cls.name || 'Unknown Class',
                                            day_of_week: dayMap[cls.day] ?? 1,
                                            start_time: start,
                                            end_time: end,
                                            location: cls.location || '',
                                            color: colors[Math.floor(Math.random() * colors.length)]
                                        }
                                    })

                                    const { data: inserted, error } = await supabase
                                        .from('class_schedules')
                                        .insert(classesToInsert)
                                        .select()

                                    if (error) throw error

                                    if (inserted) {
                                        setClasses(prev => [...prev, ...inserted as ClassSchedule[]])
                                        toast.success(`Added ${inserted.length} classes from timetable`)
                                    }
                                } catch (e: unknown) {
                                    console.error('Timetable extract error:', e)
                                    toast.error('Failed to import timetable')
                                }
                            }
                        }}
                    />
                    <Button
                        onClick={() => setCreateDialog(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Class
                    </Button>
                </div>
            </div>

            {/* Timetable Grid (Horizontal: Days as Rows) */}
            <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[1000px]"> {/* Wide container for time axis */}

                    {/* Time Header (X-Axis) */}
                    <div className="flex border-b border-white/10 mb-2">
                        <div className="w-20 shrink-0 bg-white/5 backdrop-blur sticky left-0 z-20 border-r border-white/10" /> {/* Corner */}
                        <div className="flex-1 flex relative h-10">
                            {hours.map((hour) => (
                                <div key={hour} className="flex-1 border-l border-white/5 text-xs text-gray-400 pl-2 pt-2">
                                    {hour.toString().padStart(2, '0')}:00
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Day Rows */}
                    <div className="space-y-2">
                        {days.map((day) => {
                            const dayClasses = classes.filter(c => c.day_of_week === day.id)

                            return (
                                <div key={day.id} className="flex h-20 relative group"> {/* Fixed height rows (h-20 = 80px) to prevent scroll */}
                                    {/* Day Label (Sticky Left) */}
                                    <div className="w-20 shrink-0 flex items-center justify-center font-bold text-white bg-white/5 backdrop-blur sticky left-0 z-20 border-r border-white/10 rounded-l-lg group-hover:bg-white/10 transition-colors">
                                        {day.label}
                                    </div>

                                    {/* Timeline Track */}
                                    <div className="flex-1 bg-white/[0.02] relative rounded-r-lg border border-white/[0.05]">
                                        {/* Hour Guides */}
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {hours.map(h => (
                                                <div key={h} className="flex-1 border-l border-white/5" />
                                            ))}
                                        </div>

                                        {/* Class Blocks */}
                                        <div className="absolute inset-0 top-1 bottom-1">
                                            {dayClasses.map((cls) => (
                                                <div
                                                    key={cls.id}
                                                    className="absolute top-0 bottom-0 rounded-md p-2 cursor-pointer overflow-hidden hover:z-30 transition-all hover:scale-[1.02] hover:shadow-lg group/card"
                                                    style={getClassStyleHorizontal(cls)}
                                                >
                                                    <div className="flex flex-col h-full justify-between">
                                                        <div>
                                                            <p className="text-[11px] font-bold text-white leading-tight truncate">
                                                                {cls.short_name || cls.name}
                                                            </p>
                                                            <p className="text-[10px] text-white/70 truncate">
                                                                {cls.location}
                                                            </p>
                                                        </div>
                                                        <p className="text-[9px] text-white/50 truncate">
                                                            {cls.start_time} - {cls.end_time}
                                                        </p>
                                                    </div>

                                                    {/* Delete Button (Hover) */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover/card:opacity-100 transition-opacity text-white/50 hover:text-red-400 hover:bg-transparent"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            deleteClass(cls.id)
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Create Class Dialog */}
            <Dialog open={createDialog} onOpenChange={setCreateDialog}>
                <DialogContent className="bg-gray-900 border-white/10 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-white">Add Class</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-300">Class Name</Label>
                                <Input
                                    value={newClass.name}
                                    onChange={(e) => setNewClass((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Mathematics"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-300">Short Name</Label>
                                <Input
                                    value={newClass.short_name}
                                    onChange={(e) => setNewClass((prev) => ({ ...prev, short_name: e.target.value }))}
                                    placeholder="MATH101"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-300">Instructor</Label>
                                <Input
                                    value={newClass.instructor}
                                    onChange={(e) => setNewClass((prev) => ({ ...prev, instructor: e.target.value }))}
                                    placeholder="Dr. Smith"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-300">Location</Label>
                                <Input
                                    value={newClass.location}
                                    onChange={(e) => setNewClass((prev) => ({ ...prev, location: e.target.value }))}
                                    placeholder="Room 302"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-300">Day</Label>
                            <Select
                                value={newClass.day_of_week.toString()}
                                onValueChange={(value) =>
                                    setNewClass((prev) => ({ ...prev, day_of_week: parseInt(value) }))
                                }
                            >
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-white/10">
                                    {days.map((day) => (
                                        <SelectItem key={day.id} value={day.id.toString()}>
                                            {day.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-300">Start Time</Label>
                                <Input
                                    type="time"
                                    value={newClass.start_time}
                                    onChange={(e) => setNewClass((prev) => ({ ...prev, start_time: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-300">End Time</Label>
                                <Input
                                    type="time"
                                    value={newClass.end_time}
                                    onChange={(e) => setNewClass((prev) => ({ ...prev, end_time: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-300">Color</Label>
                            <div className="flex gap-2 flex-wrap">
                                {colors.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setNewClass((prev) => ({ ...prev, color }))}
                                        className={cn(
                                            "w-8 h-8 rounded-full transition-all",
                                            newClass.color === color ? "ring-2 ring-offset-2 ring-offset-gray-900 ring-white" : ""
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                        <Button
                            onClick={createClass}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            Add Class
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
