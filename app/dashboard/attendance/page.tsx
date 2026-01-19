'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Calendar,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Loader2,
    TrendingUp,
    AlertTriangle,
    Calculator,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    GraduationCap,
    Palmtree,
    Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, startOfWeek, addDays, isSameDay, parseISO, isWithinInterval } from 'date-fns'
import type { Semester, SemesterBreak } from '@/types'
import Link from 'next/link'

interface ClassSchedule {
    id: string
    name: string
    short_name: string | null
    day_of_week: number
    start_time: string
    end_time: string
    color: string
    semester_id: string | null
}

interface AttendanceRecord {
    id: string
    class_schedule_id: string | null
    date: string
    status: 'present' | 'absent' | 'cancelled'
    semester_id: string | null
}

export default function AttendancePage() {
    const [classes, setClasses] = useState<ClassSchedule[]>([])
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [semesters, setSemesters] = useState<Semester[]>([])
    const [breaks, setBreaks] = useState<SemesterBreak[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [selectedClass, setSelectedClass] = useState<string>('all')
    const [selectedSemester, setSelectedSemester] = useState<string>('all')
    const [targetPercentage, setTargetPercentage] = useState<number>(75)
    const [weekOffset, setWeekOffset] = useState(0)
    const supabase = useMemo(() => createClient(), [])

    const today = useMemo(() => new Date(), [])

    const weekStart = useMemo(() => {
        const today = new Date()
        return addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7)
    }, [weekOffset])

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    }, [weekStart])

    const formatSupabaseError = (error: unknown) => {
        if (!error || typeof error !== 'object') return 'Unknown error'

        const anyErr = error as { message?: string; details?: string; hint?: string; code?: string }
        const parts = [anyErr.message, anyErr.details, anyErr.hint].filter(Boolean)

        const msg = parts.join(' · ')
        if (msg) return msg

        return anyErr.code ? `Error code: ${anyErr.code}` : 'Unknown error'
    }

    const fetchData = useCallback(async () => {
        try {
            setLoadError(null)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoadError('Not signed in')
                return
            }

            // Fetch all data in parallel
            const [classRes, attendanceRes, semesterRes, breaksRes] = await Promise.all([
                supabase
                    .from('class_schedules')
                    .select('id, name, short_name, day_of_week, start_time, end_time, color, semester_id')
                    .eq('user_id', user.id),
                supabase
                    .from('attendance_records')
                    .select('id, class_schedule_id, date, status, semester_id')
                    .eq('user_id', user.id),
                supabase
                    .from('semesters')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('start_date', { ascending: false }),
                supabase
                    .from('semester_breaks')
                    .select('*')
                    .eq('user_id', user.id)
            ])

            if (classRes.error) throw classRes.error
            if (attendanceRes.error) throw attendanceRes.error

            const sortedClasses = (classRes.data || []).slice().sort((a, b) => {
                if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
                return String(a.start_time).localeCompare(String(b.start_time))
            })

            setClasses(sortedClasses)
            setRecords(attendanceRes.data || [])
            setSemesters(semesterRes.data || [])
            setBreaks(breaksRes.data || [])

            // Auto-select active semester
            const activeSem = (semesterRes.data || []).find(s => s.is_active)
            if (activeSem) {
                setSelectedSemester(activeSem.id)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            const msg = formatSupabaseError(error)
            setLoadError(msg)
            toast.error(`Failed to load attendance: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Filter classes by selected semester
    const filteredClasses = useMemo(() => {
        if (selectedSemester === 'all') return classes
        return classes.filter(c => c.semester_id === selectedSemester || c.semester_id === null)
    }, [classes, selectedSemester])

    // Filter records by selected semester
    const filteredRecords = useMemo(() => {
        if (selectedSemester === 'all') return records
        return records.filter(r => r.semester_id === selectedSemester || r.semester_id === null)
    }, [records, selectedSemester])

    // Get breaks for selected semester
    const semesterBreaks = useMemo(() => {
        if (selectedSemester === 'all') return breaks
        return breaks.filter(b => b.semester_id === selectedSemester)
    }, [breaks, selectedSemester])

    // Check if a date falls within a break
    const getBreakForDate = (date: Date): SemesterBreak | null => {
        return semesterBreaks.find(brk => {
            return isWithinInterval(date, {
                start: parseISO(brk.start_date),
                end: parseISO(brk.end_date)
            })
        }) || null
    }

    const markAttendance = async (classId: string, date: Date, status: 'present' | 'absent' | 'cancelled') => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const dateStr = format(date, 'yyyy-MM-dd')

            // Check if record exists
            const existing = records.find((r) => r.class_schedule_id === classId && r.date === dateStr)

            if (existing) {
                // Update existing record
                const { error } = await supabase
                    .from('attendance_records')
                    .update({ status })
                    .eq('id', existing.id)

                if (error) throw error

                setRecords((prev) =>
                    prev.map((r) => (r.id === existing.id ? { ...r, status } : r))
                )
            } else {
                // Create new record with semester_id
                const { data: inserted, error } = await supabase
                    .from('attendance_records')
                    .insert({
                        user_id: user.id,
                        class_schedule_id: classId,
                        date: dateStr,
                        status,
                        semester_id: selectedSemester !== 'all' ? selectedSemester : null
                    })
                    .select('id, class_schedule_id, date, status, semester_id')
                    .single()

                if (error) throw error

                if (inserted) {
                    setRecords((prev) => [inserted as AttendanceRecord, ...prev])
                }
            }

            fetchData()
        } catch (error) {
            console.error('Error marking attendance:', error)
            const msg = formatSupabaseError(error)
            toast.error(`Failed to update attendance: ${msg}`)
        }
    }

    const getAttendanceForDay = (classId: string, date: Date): AttendanceRecord | undefined => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return records.find(
            r => r.class_schedule_id === classId && r.date === dateStr
        )
    }

    const calculateStats = (classId?: string) => {
        const relevantRecords = classId && classId !== 'all'
            ? filteredRecords.filter(r => r.class_schedule_id === classId)
            : filteredRecords

        const total = relevantRecords.filter(r => r.status !== 'cancelled').length
        const present = relevantRecords.filter(r => r.status === 'present').length
        const absent = relevantRecords.filter(r => r.status === 'absent').length
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0

        return { total, present, absent, percentage }
    }

    // Calculate stats by subject NAME (aggregates all class slots with same name)
    const calculateStatsBySubjectName = (subjectName: string) => {
        // Get all class IDs that share this subject name
        const classIdsForSubject = filteredClasses
            .filter(c => c.name === subjectName)
            .map(c => c.id)

        // Get all records for these class IDs
        const relevantRecords = filteredRecords.filter(r =>
            r.class_schedule_id && classIdsForSubject.includes(r.class_schedule_id)
        )

        const total = relevantRecords.filter(r => r.status !== 'cancelled').length
        const present = relevantRecords.filter(r => r.status === 'present').length
        const absent = relevantRecords.filter(r => r.status === 'absent').length
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0

        return { total, present, absent, percentage }
    }

    const calculateBunkable = (classId: string) => {
        const stats = calculateStats(classId)
        if (stats.percentage <= targetPercentage) return 0

        const maxBunkable = Math.floor(
            (stats.present - (targetPercentage * stats.total) / 100) / (1 + targetPercentage / 100)
        )

        return Math.max(0, maxBunkable)
    }

    // Calculate bunkable by subject name
    const calculateBunkableBySubjectName = (subjectName: string) => {
        const stats = calculateStatsBySubjectName(subjectName)
        if (stats.percentage <= targetPercentage) return 0

        const maxBunkable = Math.floor(
            (stats.present - (targetPercentage * stats.total) / 100) / (1 + targetPercentage / 100)
        )

        return Math.max(0, maxBunkable)
    }

    // Calculate overall stats - use name-based aggregation when a class is selected
    const overallStats = useMemo(() => {
        if (selectedClass === 'all') {
            return calculateStats('all')
        }
        // Find the subject name for the selected class
        const selectedCls = filteredClasses.find(c => c.id === selectedClass)
        if (selectedCls) {
            return calculateStatsBySubjectName(selectedCls.name)
        }
        return calculateStats(selectedClass)
    }, [selectedClass, filteredClasses, filteredRecords])

    const visibleWeekDays = useMemo(() => {
        if (selectedClass === 'all') return weekDays

        const cls = filteredClasses.find((c) => c.id === selectedClass)
        if (!cls) return weekDays

        const match = weekDays.find((d) => d.getDay() === cls.day_of_week)
        return match ? [match] : weekDays
    }, [filteredClasses, selectedClass, weekDays])

    const selectedSemesterName = semesters.find(s => s.id === selectedSemester)?.name

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Attendance Tracker</h1>
                    <p className="text-muted-foreground mt-1">Track and analyze your class attendance</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Semester Selector */}
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedSemester} onValueChange={(v) => {
                            setSelectedSemester(v)
                            setSelectedClass('all') // Reset class filter when semester changes
                        }}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="All Semesters" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Semesters</SelectItem>
                                {semesters.map((sem) => (
                                    <SelectItem key={sem.id} value={sem.id}>
                                        {sem.name} {sem.is_active && '✓'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Link href="/dashboard/settings/semesters">
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>

                    {/* Class Selector */}
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="w-50">
                            <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {filteredClasses.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>
                                    {cls.short_name || cls.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Target Percentage Selector */}
                    <Select value={targetPercentage.toString()} onValueChange={(v) => setTargetPercentage(parseInt(v))}>
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="75">75% target</SelectItem>
                            <SelectItem value="80">80% target</SelectItem>
                            <SelectItem value="85">85% target</SelectItem>
                            <SelectItem value="90">90% target</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Semester indicator */}
            {selectedSemester !== 'all' && selectedSemesterName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-purple-500/10 px-3 py-2 rounded-lg w-fit">
                    <GraduationCap className="h-4 w-4 text-purple-400" />
                    <span>Viewing: <span className="text-purple-400 font-medium">{selectedSemesterName}</span></span>
                    {semesterBreaks.length > 0 && (
                        <span className="text-muted-foreground">• {semesterBreaks.length} break{semesterBreaks.length > 1 && 's'} configured</span>
                    )}
                </div>
            )}

            {/* Subject-wise Attendance Breakdown */}
            {filteredClasses.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Subject-wise Attendance</h2>
                        <p className="text-sm text-muted-foreground">
                            Click a subject to view its weekly log
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Get unique classes (by name) to avoid duplicates for different days */}
                        {Array.from(new Map(filteredClasses.map(c => [c.name, c])).values()).map((cls) => {
                            // Use name-based stats to aggregate across all class slots
                            const stats = calculateStatsBySubjectName(cls.name)
                            const bunkable = calculateBunkableBySubjectName(cls.name)
                            const isSelected = selectedClass === cls.id
                            const isAtRisk = stats.percentage < targetPercentage && stats.total > 0

                            return (
                                <Card
                                    key={cls.id}
                                    onClick={() => setSelectedClass(isSelected ? 'all' : cls.id)}
                                    className={cn(
                                        "glass-card cursor-pointer transition-all hover:scale-[1.02]",
                                        isSelected && "ring-2 ring-primary",
                                        isAtRisk && "border-red-500/30"
                                    )}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                    className="h-3 w-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: cls.color }}
                                                />
                                                <span className="font-medium truncate">
                                                    {cls.short_name || cls.name}
                                                </span>
                                            </div>
                                            <span className={cn(
                                                "text-xl font-bold shrink-0",
                                                stats.total === 0 ? "text-muted-foreground" :
                                                    stats.percentage >= targetPercentage ? "text-emerald-400" : "text-red-400"
                                            )}>
                                                {stats.total === 0 ? '—' : `${stats.percentage}%`}
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-2">
                                            <div
                                                className={cn(
                                                    "h-full transition-all rounded-full",
                                                    stats.percentage >= targetPercentage ? "bg-emerald-500" : "bg-red-500"
                                                )}
                                                style={{ width: `${stats.percentage}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>
                                                <span className="text-emerald-400">{stats.present}</span> present,{' '}
                                                <span className="text-red-400">{stats.absent}</span> absent
                                            </span>
                                            {bunkable > 0 && (
                                                <span className="text-amber-400">
                                                    🏖️ {bunkable} leaves left
                                                </span>
                                            )}
                                            {stats.percentage < targetPercentage && stats.total > 0 && (
                                                <span className="text-red-400 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> At risk
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Overall Summary (smaller) */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="glass-card">
                    <CardContent className="p-3 flex items-center gap-2">
                        <TrendingUp className={cn(
                            "h-4 w-4",
                            overallStats.percentage >= targetPercentage ? "text-emerald-400" : "text-red-400"
                        )} />
                        <div>
                            <p className={cn(
                                "text-lg font-bold",
                                overallStats.percentage >= targetPercentage ? "text-emerald-400" : "text-red-400"
                            )}>
                                {overallStats.percentage}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">Overall</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="p-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <div>
                            <p className="text-lg font-bold">{overallStats.present}</p>
                            <p className="text-[10px] text-muted-foreground">Present</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="p-3 flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <div>
                            <p className="text-lg font-bold">{overallStats.absent}</p>
                            <p className="text-[10px] text-muted-foreground">Absent</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="p-3 flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-amber-400" />
                        <div>
                            <p className="text-lg font-bold">{overallStats.total}</p>
                            <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Week Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setWeekOffset((w) => w - 1)}
                        className="justify-start"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setWeekOffset(0)}
                        disabled={weekOffset === 0}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" /> This Week
                    </Button>
                </div>

                <h2 className="text-base sm:text-lg font-medium text-center">
                    {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                </h2>

                <Button variant="outline" onClick={() => setWeekOffset((w) => w + 1)} className="justify-end">
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </div>

            {/* Week View */}
            {filteredClasses.length === 0 ? (
                <Card className="glass-card">
                    <CardContent className="py-10">
                        <div className="text-center">
                            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No classes in your timetable</p>
                            <p className="text-sm text-muted-foreground">Add classes in Timetable to track attendance</p>
                            {loadError && (
                                <p className="mt-3 text-xs text-red-400 wrap-break-word">{loadError}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div
                    className={cn(
                        'grid gap-4',
                        selectedClass === 'all'
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                            : 'grid-cols-1'
                    )}
                >
                    {visibleWeekDays.map((day) => {
                        const dayNum = day.getDay()
                        const breakForDay = getBreakForDate(day)

                        const dayClasses = filteredClasses
                            .filter((cls) => (selectedClass === 'all' ? true : cls.id === selectedClass))
                            .filter((cls) => cls.day_of_week === dayNum)
                            .slice()
                            .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

                        return (
                            <Card
                                key={day.toISOString()}
                                className={cn(
                                    'glass-card',
                                    isSameDay(day, today) && 'ring-1 ring-primary/30',
                                    breakForDay && 'border-amber-500/30 bg-amber-500/5'
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="text-sm font-semibold">{format(day, 'EEEE')}</p>
                                            <p className="text-xs text-muted-foreground">{format(day, 'MMM d')}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {breakForDay && (
                                                <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                                                    <Palmtree className="h-3 w-3" />
                                                    {breakForDay.name}
                                                </span>
                                            )}
                                            {isSameDay(day, today) && (
                                                <span className="text-xs font-medium text-primary">Today</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {breakForDay ? (
                                            <div className="flex items-center justify-center py-4 text-amber-400/70">
                                                <Palmtree className="h-5 w-5 mr-2" />
                                                <span className="text-sm">No classes - {breakForDay.name}</span>
                                            </div>
                                        ) : dayClasses.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No classes</p>
                                        ) : (
                                            dayClasses.map((cls) => {
                                                const record = getAttendanceForDay(cls.id, day)

                                                return (
                                                    <div
                                                        key={cls.id}
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/20 p-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                                                    style={{ backgroundColor: cls.color }}
                                                                />
                                                                <p className="truncate text-sm font-medium">
                                                                    {cls.short_name || cls.name}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                {cls.start_time} - {cls.end_time}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    'h-8 w-8',
                                                                    record?.status === 'present' &&
                                                                    'bg-emerald-500/20 text-emerald-400'
                                                                )}
                                                                onClick={() => markAttendance(cls.id, day, 'present')}
                                                                title="Mark present"
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    'h-8 w-8',
                                                                    record?.status === 'absent' &&
                                                                    'bg-red-500/20 text-red-400'
                                                                )}
                                                                onClick={() => markAttendance(cls.id, day, 'absent')}
                                                                title="Mark absent"
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    'h-8 w-8',
                                                                    record?.status === 'cancelled' &&
                                                                    'bg-gray-500/20 text-gray-400'
                                                                )}
                                                                onClick={() => markAttendance(cls.id, day, 'cancelled')}
                                                                title="Mark cancelled"
                                                            >
                                                                <MinusCircle className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}

                                        {loadError && (
                                            <p className="pt-2 text-xs text-red-400 wrap-break-word">{loadError}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Present</span>
                </div>
                <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span>Absent</span>
                </div>
                <div className="flex items-center gap-2">
                    <MinusCircle className="h-4 w-4 text-gray-400" />
                    <span>Cancelled</span>
                </div>
                <div className="flex items-center gap-2">
                    <Palmtree className="h-4 w-4 text-amber-400" />
                    <span>Holiday/Break</span>
                </div>
            </div>
        </div>
    )
}
