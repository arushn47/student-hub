'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
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
import { Plus, Clock, Trash2, GraduationCap, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ImageUploadExtractor } from '@/components/ai/ImageUploadExtractor'
import Link from 'next/link'
import { ensureDefaultSemesters } from '@/lib/semester-utils'
import type { ClassSchedule, Semester } from '@/types'

interface TimetableGridProps {
    initialClasses: ClassSchedule[]
    initialSemesters: Semester[]
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

export function TimetableGrid({ initialClasses, initialSemesters, userId }: TimetableGridProps) {
    const [classes, setClasses] = useState<ClassSchedule[]>(initialClasses)
    const [semesters, setSemesters] = useState<Semester[]>(initialSemesters)
    const [selectedSemester, setSelectedSemester] = useState<string>(
        initialSemesters.find(s => s.is_active)?.id || initialSemesters[0]?.id || ''
    )
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
    
    // Auto-select active semester on mount
    useEffect(() => {
        const activeSemester = semesters.find(s => s.is_active)
        if (activeSemester) {
            setSelectedSemester(activeSemester.id)
        }
    }, [semesters])

    // Build a color map for all unique subjects - ensures no two subjects share a color
    const subjectColorMap = useMemo(() => {
        const map = new Map<string, string>()
        const uniqueSubjects = new Set<string>()

        // Extract base course codes from all classes
        for (const cls of classes) {
            const baseCourse = cls.name.split('-')[0].trim().toUpperCase()
            uniqueSubjects.add(baseCourse)
        }

        // Assign colors sequentially to each unique subject
        const sortedSubjects = Array.from(uniqueSubjects).sort()
        sortedSubjects.forEach((subject, index) => {
            map.set(subject, colors[index % colors.length])
        })

        return map
    }, [classes])

    // Get color for a subject from the map
    const getColorForSubject = (subjectName: string): string => {
        const baseCourse = subjectName.split('-')[0].trim().toUpperCase()
        return subjectColorMap.get(baseCourse) || colors[0]
    }

    // Filter classes by selected semester
    const filteredClasses = useMemo(() => {
        if (!selectedSemester) return []
        return classes.filter(c => c.semester_id === selectedSemester)
    }, [classes, selectedSemester])

    // Sync colors for all classes - ensures same subject has same color
    const syncColors = async () => {
        const classesToUpdate: { id: string; color: string }[] = []

        for (const cls of classes) {
            const correctColor = getColorForSubject(cls.name)
            if (cls.color !== correctColor) {
                classesToUpdate.push({ id: cls.id, color: correctColor })
            }
        }

        if (classesToUpdate.length === 0) return

        // Update in database
        for (const update of classesToUpdate) {
            await supabase
                .from('class_schedules')
                .update({ color: update.color })
                .eq('id', update.id)
        }

        // Update local state
        setClasses(prev => prev.map(cls => {
            const update = classesToUpdate.find(u => u.id === cls.id)
            return update ? { ...cls, color: update.color } : cls
        }))

        toast.success(`Synced colors for ${classesToUpdate.length} classes`)
    }

    // Auto-sync colors on initial load
    useEffect(() => {
        const autoSyncColors = async () => {
            const colorMap = new Map<string, string>()
            const uniqueSubjects = new Set<string>()

            for (const cls of classes) {
                const baseCourse = cls.name.split('-')[0].trim().toUpperCase()
                uniqueSubjects.add(baseCourse)
            }

            const sortedSubjects = Array.from(uniqueSubjects).sort()
            sortedSubjects.forEach((subject, index) => {
                colorMap.set(subject, colors[index % colors.length])
            })

            const classesToUpdate: { id: string; color: string }[] = []

            for (const cls of classes) {
                const baseCourse = cls.name.split('-')[0].trim().toUpperCase()
                const correctColor = colorMap.get(baseCourse) || colors[0]
                if (cls.color !== correctColor) {
                    classesToUpdate.push({ id: cls.id, color: correctColor })
                }
            }

            if (classesToUpdate.length === 0) return

            // Update in database silently
            for (const update of classesToUpdate) {
                await supabase
                    .from('class_schedules')
                    .update({ color: update.color })
                    .eq('id', update.id)
            }

            // Update local state
            setClasses(prev => prev.map(cls => {
                const update = classesToUpdate.find(u => u.id === cls.id)
                return update ? { ...cls, color: update.color } : cls
            }))
        }

        if (classes.length > 0) {
            autoSyncColors()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run only on mount

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
                semester_id: selectedSemester,
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

    const clearSchedule = async () => {
        if (!confirm('Are you sure you want to clear your entire schedule?')) return

        let query = supabase.from('class_schedules').delete().eq('user_id', userId)

        if (selectedSemester) {
            query = query.eq('semester_id', selectedSemester)
        }

        const { error } = await query
        if (error) {
            toast.error('Failed to clear schedule')
        } else {
            if (selectedSemester !== 'all') {
                setClasses(prev => prev.filter(c => c.semester_id !== selectedSemester))
            } else {
                setClasses([])
            }
            toast.success('Schedule cleared')
        }
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

    const selectedSemesterName = semesters.find(s => s.id === selectedSemester)?.name

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
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Semester Selector */}
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                            <SelectTrigger className="w-40 bg-white/5 border-white/10">
                                <SelectValue placeholder="Select Semester" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10">
                                {semesters.map((sem) => (
                                    <SelectItem key={sem.id} value={sem.id}>
                                        {sem.name} {sem.is_active && '✓'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Link href="/dashboard/settings/semesters">
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-white">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>

                    <Button
                        variant="outline"
                        onClick={clearSchedule}
                        className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Semester
                    </Button>
                    <ImageUploadExtractor
                        type="timetable"
                        title="Extract Schedule"
                        description="Upload a picture of your class timetable."
                        onExtract={async (data) => {
                            if (semesters.length === 0) {
                                toast.error('Please create a semester first to organize your timetable.')
                                return
                            }

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

                                    // Create a local color map for the new classes combined with existing classes
                                    const allUniqueSubjects = new Set<string>()
                                    for (const existingCls of classes) {
                                        allUniqueSubjects.add(existingCls.name.split('-')[0].trim().toUpperCase())
                                    }
                                    for (const newCls of data.classes) {
                                        const subjectName = newCls.subject || newCls.name || 'Unknown'
                                        allUniqueSubjects.add(subjectName.split('-')[0].trim().toUpperCase())
                                    }

                                    const localColorMap = new Map<string, string>()
                                    Array.from(allUniqueSubjects).sort().forEach((subject, index) => {
                                        localColorMap.set(subject, colors[index % colors.length])
                                    })

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
                                                        const parts = time.split(':')
                                                        const h = parts[0].padStart(2, '0')
                                                        const m = (parts[1] || '00').padStart(2, '0')
                                                        return `${h}:${m}`
                                                    }

                                                    start = clean(parts[0])
                                                    end = clean(parts[1])
                                                } catch { }
                                            }
                                        }

                                        const courseName = cls.subject || cls.name || 'Unknown Class'
                                        const baseCourse = courseName.split('-')[0].trim().toUpperCase()

                                        return {
                                            user_id: userId,
                                            name: courseName,
                                            day_of_week: dayMap[cls.day] ?? 1,
                                            start_time: start,
                                            end_time: end,
                                            location: cls.location || '',
                                            color: localColorMap.get(baseCourse) || colors[0],
                                            semester_id: selectedSemester
                                        }
                                    })

                                    const { data: inserted, error } = await supabase
                                        .from('class_schedules')
                                        .insert(classesToInsert)
                                        .select()

                                    if (error) throw error

                                    if (inserted) {
                                        setClasses(prev => [...prev, ...inserted as ClassSchedule[]])
                                        toast.success(`Added ${inserted.length} classes to your timetable`)
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
                        className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Class
                    </Button>
                </div>
            </div>

            {/* Semester indicator */}
            {selectedSemester !== 'all' && selectedSemesterName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-purple-500/10 px-3 py-2 rounded-lg w-fit">
                    <GraduationCap className="h-4 w-4 text-purple-400" />
                    <span>Viewing: <span className="text-purple-400 font-medium">{selectedSemesterName}</span></span>
                </div>
            )}

            {/* Timetable Grid (Horizontal: Days as Rows) */}
            <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-250"> {/* Wide container for time axis */}

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
                            const dayClasses = filteredClasses.filter(c => c.day_of_week === day.id)

                            return (
                                <div key={day.id} className="flex h-20 relative group"> {/* Fixed height rows (h-20 = 80px) to prevent scroll */}
                                    {/* Day Label (Sticky Left) */}
                                    <div className="w-20 shrink-0 flex items-center justify-center font-bold text-white bg-white/5 backdrop-blur sticky left-0 z-20 border-r border-white/10 rounded-l-lg group-hover:bg-white/10 transition-colors">
                                        {day.label}
                                    </div>

                                    {/* Timeline Track */}
                                    <div className="flex-1 bg-white/2 relative rounded-r-lg border border-white/5">
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
                <DialogContent aria-describedby={undefined} className="bg-gray-900 border-white/10 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-white">Add Class</DialogTitle>
                        {selectedSemester !== 'all' && selectedSemesterName && (
                            <p className="text-xs text-muted-foreground">
                                Adding to: {selectedSemesterName}
                            </p>
                        )}
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
                            className="w-full bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                            Add Class
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
