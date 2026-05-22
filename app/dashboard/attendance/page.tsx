'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
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
    CalendarDays,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Loader2,
    TrendingUp,
    AlertTriangle,
    Calculator,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    RotateCcw,
    GraduationCap,
    Palmtree,
    Settings,
    Plus,
    Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, startOfWeek, addDays, isSameDay, parseISO, isWithinInterval } from 'date-fns'
import type { Semester, SemesterBreak } from '@/types'
import Link from 'next/link'
import { ImageUploadExtractor } from '@/components/ai/ImageUploadExtractor'

const getCourseCode = (name: string): string => {
    const match = name.match(/([A-Z]{3,4}\d{4})/i)
    return match ? match[1].toUpperCase() : name.split(/[\s-]+/)[0].trim().toUpperCase()
}

const overrideDayNames: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    0: "Sunday",
    [-1]: "No Classes (Holiday)"
}


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
    const [simulatedSemesterAbsents, setSimulatedSemesterAbsents] = useState<number | null>(null)
    const [preferences, setPreferences] = useState<any>(null)

    const savePreferences = async (updatedPrefs: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('profiles')
                .update({ preferences: updatedPrefs })
                .eq('id', user.id)

            if (error) throw error

            setPreferences(updatedPrefs)
            toast.success('Preferences updated successfully!')
            fetchData()
        } catch (error) {
            console.error('Error saving preferences:', error)
            const msg = formatSupabaseError(error)
            toast.error(`Failed to save preferences: ${msg}`)
        }
    }


    const handleClassSelect = (value: string) => {
        setSelectedClass(value)
    }

    useEffect(() => {
        setSimulatedSemesterAbsents(null)
    }, [selectedClass])
    
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
            const [classRes, attendanceRes, semesterRes, breaksRes, profileRes] = await Promise.all([
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
                    .eq('user_id', user.id),
                supabase
                    .from('profiles')
                    .select('preferences')
                    .eq('id', user.id)
                    .single()
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
            setPreferences(profileRes.data?.preferences || {})

            // Auto-select active semester if it hasn't ended yet
            const activeSem = (semesterRes.data || []).find(s => s.is_active)
            if (activeSem) {
                const isCompleted = parseISO(activeSem.end_date) < new Date()
                if (!isCompleted) {
                    setSelectedSemester(activeSem.id)
                } else {
                    setSelectedSemester('all')
                }
            } else {
                setSelectedSemester('all')
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

    const selectedClassData = useMemo(() => {
        if (selectedClass === 'all') return null
        return filteredClasses.find(c => c.id === selectedClass) || null
    }, [selectedClass, filteredClasses])

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

        // Check if base attendance applies to determine if we filter out past records
        let baseAttendanceDate: string | null = null
        if (preferences?.base_attendance && preferences.base_attendance_date) {
            if (classId && classId !== 'all') {
                const cls = filteredClasses.find(c => c.id === classId)
                if (cls) {
                    const code = getCourseCode(cls.name)
                    if (preferences.base_attendance[code]) {
                        baseAttendanceDate = preferences.base_attendance_date
                    }
                }
            } else {
                baseAttendanceDate = preferences.base_attendance_date
            }
        }

        const activeRecords = baseAttendanceDate
            ? relevantRecords.filter(r => r.date > baseAttendanceDate)
            : relevantRecords

        let total = activeRecords.filter(r => r.status !== 'cancelled').length
        let present = activeRecords.filter(r => r.status === 'present').length
        let absent = activeRecords.filter(r => r.status === 'absent').length
        let cancelled = activeRecords.filter(r => r.status === 'cancelled').length

        if (preferences?.base_attendance) {
            if (classId && classId !== 'all') {
                const cls = filteredClasses.find(c => c.id === classId)
                if (cls) {
                    const code = getCourseCode(cls.name)
                    const base = preferences.base_attendance[code]
                    if (base) {
                        present += base.present
                        total += base.total
                        absent += (base.total - base.present)
                    }
                }
            } else {
                const semCourses = Array.from(new Map(filteredClasses.map(c => [getCourseCode(c.name), c])).keys())
                semCourses.forEach(code => {
                    const base = preferences.base_attendance[code]
                    if (base) {
                        present += base.present
                        total += base.total
                        absent += (base.total - base.present)
                    }
                })
            }
        }

        const percentage = total > 0 ? Math.ceil((present / total) * 100) : 0

        return { total, present, absent, cancelled, percentage }
    }

    // Calculate stats by subject NAME (aggregates all class slots with same name)
    const calculateStatsBySubjectName = (subjectName: string) => {
        // Get all class IDs that share this subject name
        const classIdsForSubject = filteredClasses
            .filter(c => c.name.toLowerCase().trim() === subjectName.toLowerCase().trim())
            .map(c => c.id)

        // Get all records for these class IDs
        const relevantRecords = filteredRecords.filter(r =>
            r.class_schedule_id && classIdsForSubject.includes(r.class_schedule_id)
        )

        const code = getCourseCode(subjectName)
        const base = preferences?.base_attendance?.[code]
        const baseAttendanceDate = base ? (preferences?.base_attendance_date || format(new Date(), 'yyyy-MM-dd')) : null

        const activeRecords = baseAttendanceDate
            ? relevantRecords.filter(r => r.date > baseAttendanceDate)
            : relevantRecords

        let total = activeRecords.filter(r => r.status !== 'cancelled').length
        let present = activeRecords.filter(r => r.status === 'present').length
        let absent = activeRecords.filter(r => r.status === 'absent').length
        let cancelled = activeRecords.filter(r => r.status === 'cancelled').length

        if (preferences?.base_attendance?.[code]) {
            present += base.present
            total += base.total
            absent += (base.total - base.present)
        }

        const percentage = total > 0 ? Math.ceil((present / total) * 100) : 0

        return { total, present, absent, cancelled, percentage }
    }

    const calculateSafeAbsences = (classId: string) => {
        const stats = calculateStats(classId)
        if (stats.percentage <= targetPercentage) return 0

        const maxSafeAbsences = Math.floor(
            (stats.present - (targetPercentage * stats.total) / 100) / (1 + targetPercentage / 100)
        )

        return Math.max(0, maxSafeAbsences)
    }

    // Calculate safe absences by subject name
    const calculateSafeAbsencesBySubjectName = (subjectName: string) => {
        const stats = calculateStatsBySubjectName(subjectName)
        if (stats.percentage <= targetPercentage) return 0

        const maxSafeAbsences = Math.floor(
            (stats.present - (targetPercentage * stats.total) / 100) / (1 + targetPercentage / 100)
        )

        return Math.max(0, maxSafeAbsences)
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

        // Find all days of the week that have a class with the same name
        const targetDays = filteredClasses
            .filter(c => c.name.toLowerCase().trim() === cls.name.toLowerCase().trim())
            .map(c => c.day_of_week)

        return weekDays.filter(d => targetDays.includes(d.getDay()))
    }, [filteredClasses, selectedClass, weekDays])

    const currentSemesterObj = useMemo(() => {
        if (selectedSemester !== 'all') {
            return semesters.find(s => s.id === selectedSemester)
        }
        return semesters.find(s => s.is_active)
    }, [semesters, selectedSemester])

    const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({})

    const toggleSemesterExpand = (semId: string) => {
        setExpandedSemesters(prev => ({
            ...prev,
            [semId]: !prev[semId]
        }))
    }

    const getSemesterStats = (semesterId: string) => {
        // Find all classes belonging to this semester
        const semClasses = classes.filter(c => c.semester_id === semesterId)
        const semClassIds = semClasses.map(c => c.id)

        // Find all records belonging to these classes or having this semester_id
        const semRecords = records.filter(r => 
            (r.semester_id === semesterId) || 
            (r.class_schedule_id && semClassIds.includes(r.class_schedule_id))
        )

        // Filter out past records on or before base_attendance_date to avoid double-counting
        const activeRecords = preferences?.base_attendance_date
            ? semRecords.filter(r => r.date > preferences.base_attendance_date)
            : semRecords

        let total = activeRecords.filter(r => r.status !== 'cancelled').length
        let present = activeRecords.filter(r => r.status === 'present').length
        let absent = activeRecords.filter(r => r.status === 'absent').length
        let cancelled = activeRecords.filter(r => r.status === 'cancelled').length

        const uniqueCodes = Array.from(new Map(semClasses.map(c => [getCourseCode(c.name), c])).keys())
        if (preferences?.base_attendance) {
            uniqueCodes.forEach(code => {
                const base = preferences.base_attendance[code]
                if (base) {
                    present += base.present
                    total += base.total
                    absent += (base.total - base.present)
                }
            })
        }

        const percentage = total > 0 ? Math.ceil((present / total) * 100) : 0

        // Get unique subjects in this semester to show their status
        const uniqueSubjects = Array.from(new Map(semClasses.map(c => [c.name.toLowerCase().trim(), c])).values()).map(cls => {
            // Stats for this subject in this semester
            const subjRecords = activeRecords.filter(r => {
                const c = semClasses.find(sc => sc.id === r.class_schedule_id)
                return c ? c.name.toLowerCase().trim() === cls.name.toLowerCase().trim() : false
            })
            let sTotal = subjRecords.filter(r => r.status !== 'cancelled').length
            let sPresent = subjRecords.filter(r => r.status === 'present').length
            let sAbsent = subjRecords.filter(r => r.status === 'absent').length
            let sCancelled = subjRecords.filter(r => r.status === 'cancelled').length

            const code = getCourseCode(cls.name)
            if (preferences?.base_attendance?.[code]) {
                const base = preferences.base_attendance[code]
                sPresent += base.present
                sTotal += base.total
                sAbsent += (base.total - base.present)
            }

            const sPercentage = sTotal > 0 ? Math.ceil((sPresent / sTotal) * 100) : 0
            return {
                name: cls.name,
                shortName: cls.short_name,
                color: cls.color,
                total: sTotal,
                present: sPresent,
                absent: sAbsent,
                cancelled: sCancelled,
                percentage: sPercentage
            }
        })

        return { total, present, absent, cancelled, percentage, subjects: uniqueSubjects }
    }

    const globalCumulativeStats = useMemo(() => {
        // Filter out past records on or before base_attendance_date to avoid double-counting
        const activeRecords = preferences?.base_attendance_date
            ? records.filter(r => r.date > preferences.base_attendance_date)
            : records

        let total = activeRecords.filter(r => r.status !== 'cancelled').length
        let present = activeRecords.filter(r => r.status === 'present').length
        let absent = activeRecords.filter(r => r.status === 'absent').length
        let cancelled = activeRecords.filter(r => r.status === 'cancelled').length

        // Only count base attendance for course codes that exist in class schedules
        const activeCourseCodes = new Set(classes.map(c => getCourseCode(c.name)))

        if (preferences?.base_attendance) {
            Object.entries(preferences.base_attendance).forEach(([code, base]: [string, any]) => {
                if (activeCourseCodes.has(code.toUpperCase())) {
                    present += base.present
                    total += base.total
                    absent += (base.total - base.present)
                }
            })
        }

        const percentage = total > 0 ? Math.ceil((present / total) * 100) : 0

        return { total, present, absent, cancelled, percentage }
    }, [records, preferences, classes])

    const semesterClassesCalc = useMemo(() => {
        if (!currentSemesterObj || selectedClass === 'all') return null

        // Find the selected subject
        const selectedCls = filteredClasses.find(c => c.id === selectedClass)
        if (!selectedCls) return null

        // Find all class slots for this subject (same name)
        const classSlots = filteredClasses.filter(c => c.name.toLowerCase().trim() === selectedCls.name.toLowerCase().trim())
        if (classSlots.length === 0) return null

        const code = getCourseCode(selectedCls.name)
        const base = preferences?.base_attendance?.[code]
        const baseTotal = base ? base.total : 0
        const baseAttendanceDate = base ? (preferences?.base_attendance_date || format(new Date(), 'yyyy-MM-dd')) : null

        const semStart = parseISO(currentSemesterObj.start_date)
        const semEnd = parseISO(currentSemesterObj.end_date)
        
        let totalScheduled = 0
        let breakClassesCount = 0
        let examClassesCount = 0
        const breakDetails: { [key: string]: number } = {}

        // Get all breaks for this semester
        const semBreaks = breaks.filter(b => b.semester_id === currentSemesterObj.id)

        // Iterate through every day of the semester
        let currentDay = new Date(semStart)
        while (currentDay <= semEnd) {
            const dayNum = currentDay.getDay()
            
            // Check if there is a timetable override for this date
            const dateStr = format(currentDay, 'yyyy-MM-dd')
            
            // Skip calendar counting on or before base_attendance_date
            if (baseAttendanceDate && dateStr <= baseAttendanceDate) {
                currentDay.setDate(currentDay.getDate() + 1)
                continue
            }

            const overrideDay = preferences?.timetable_overrides?.[dateStr]
            const effectiveDay = overrideDay !== undefined ? overrideDay : dayNum

            if (effectiveDay !== -1) {
                const slotsOnThisDay = classSlots.filter(s => s.day_of_week === effectiveDay)
                
                if (slotsOnThisDay.length > 0) {
                    // Check if this day falls within a break/holiday/exam
                    const activeBreak = semBreaks.find(brk => {
                        return isWithinInterval(currentDay, {
                            start: parseISO(brk.start_date),
                            end: parseISO(brk.end_date)
                        })
                    })

                    if (activeBreak) {
                        if (activeBreak.break_type === 'exam_period') {
                            examClassesCount += slotsOnThisDay.length
                        } else {
                            breakClassesCount += slotsOnThisDay.length
                        }
                        breakDetails[activeBreak.name] = (breakDetails[activeBreak.name] || 0) + slotsOnThisDay.length
                    } else {
                        totalScheduled += slotsOnThisDay.length
                    }
                }
            } else {
                // If effectiveDay is -1 (explicit No Classes), it counts as break/holiday if it had standard classes
                const standardSlotsOnThisDay = classSlots.filter(s => s.day_of_week === dayNum)
                if (standardSlotsOnThisDay.length > 0) {
                    breakClassesCount += standardSlotsOnThisDay.length
                    breakDetails['Explicit Swapped Holiday'] = (breakDetails['Explicit Swapped Holiday'] || 0) + standardSlotsOnThisDay.length
                }
            }

            // Move to next day safely
            currentDay.setDate(currentDay.getDate() + 1)
        }

        // Calculate cancelled classes already logged in database
        const classIdsForSubject = filteredClasses
            .filter(c => c.name.toLowerCase().trim() === selectedCls.name.toLowerCase().trim())
            .map(c => c.id)

        const cancelledCount = filteredRecords.filter(r =>
            r.class_schedule_id && 
            classIdsForSubject.includes(r.class_schedule_id) &&
            r.status === 'cancelled' &&
            (!baseAttendanceDate || r.date > baseAttendanceDate)
        ).length

        const stats = calculateStatsBySubjectName(selectedCls.name)
        const netTotalScheduled = Math.max(stats.total, baseTotal + totalScheduled - cancelledCount)
        const minClassesToAttend = Math.ceil((targetPercentage / 100) * netTotalScheduled)
        const maxMissesAllowed = Math.max(0, netTotalScheduled - minClassesToAttend)

        return {
            semesterName: currentSemesterObj.name,
            totalScheduled: netTotalScheduled,        // net classes actually held (excluding breaks, exams, and cancellations) + manual starting balances total
            breakClassesCount,                         // classes cancelled due to breaks/holidays
            examClassesCount,                          // classes cancelled due to exam periods
            cancelledCount,                            // classes marked cancelled individually
            totalGross: netTotalScheduled + breakClassesCount + examClassesCount + cancelledCount,
            minClassesToAttend,
            maxMissesAllowed,
            breakDetails
        }
    }, [currentSemesterObj, selectedClass, filteredClasses, breaks, targetPercentage, filteredRecords, preferences])

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
                                {semesters.map((sem) => {
                                    return (
                                        <SelectItem key={sem.id} value={sem.id}>
                                            {sem.name}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <Link href="/dashboard/settings/semesters">
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>

                    {/* Class Selector */}
                    {selectedSemester !== 'all' && (
                        <Select value={selectedClass} onValueChange={handleClassSelect}>
                            <SelectTrigger className="w-50">
                                <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Classes</SelectItem>
                                {Array.from(new Map(filteredClasses.map(c => [c.name, c])).values()).map((cls) => (
                                    <SelectItem key={cls.id} value={cls.id}>
                                        {cls.short_name || cls.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Semester indicator */}
            {selectedSemester !== 'all' && selectedSemesterName && (() => {
                const sem = semesters.find(s => s.id === selectedSemester);
                const isCompleted = sem ? parseISO(sem.end_date) < today : false;
                const isCurrent = sem ? isWithinInterval(today, { start: parseISO(sem.start_date), end: parseISO(sem.end_date) }) : false;
                
                return (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-purple-500/10 px-3 py-2 rounded-lg w-fit">
                        <GraduationCap className="h-4 w-4 text-purple-400" />
                        <span>Viewing: <span className="text-purple-400 font-medium">{selectedSemesterName}</span></span>
                        
                        {sem?.is_active && !isCompleted && (
                            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium">
                                Active
                            </span>
                        )}
                        {isCompleted && (
                            <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                                Completed
                            </span>
                        )}
                        {isCurrent && !sem?.is_active && !isCompleted && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                                Current
                            </span>
                        )}

                        {semesterBreaks.length > 0 && (
                            <span className="text-muted-foreground">• {semesterBreaks.length} break{semesterBreaks.length > 1 && 's'} configured</span>
                        )}
                    </div>
                );
            })()}

            {/* Starting Balances & Portal Sync Section */}
            {selectedSemester !== 'all' && filteredClasses.length > 0 && (
                <Card className="glass-card border-purple-500/20 bg-gradient-to-br from-purple-500/[0.02] via-background to-indigo-500/[0.02] relative overflow-hidden shadow-xl animate-in fade-in duration-300">
                    <CardContent className="p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-purple-400" />
                                    Starting Balances & Portal Sync
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Import your current attendance from a university portal screenshot or manually enter past completed class balances.
                                </p>
                            </div>
                            
                            <ImageUploadExtractor
                                type="attendance_portal"
                                onExtract={(data) => {
                                    if (data && data.courses) {
                                        const updatedBase = { ...(preferences?.base_attendance || {}) }
                                        data.courses.forEach((item: any) => {
                                            const parsedCode = item.code?.toUpperCase().trim()
                                            if (parsedCode) {
                                                updatedBase[parsedCode] = {
                                                    present: parseInt(item.attended) || 0,
                                                    total: parseInt(item.total) || 0
                                                }
                                            }
                                        })
                                        const todayStr = format(new Date(), 'yyyy-MM-dd')
                                        const updated = {
                                            ...(preferences || {}),
                                            base_attendance: updatedBase,
                                            base_attendance_date: todayStr
                                        }
                                        savePreferences(updated)
                                        toast.success("Successfully imported portal attendance!")
                                    } else {
                                        toast.error("Failed to extract attendance courses from image.")
                                    }
                                }}
                                trigger={
                                    <Button size="sm" className="gradient-primary text-white gap-2 shrink-0">
                                        <Sparkles className="h-4 w-4" />
                                        Sync Portal Attendance
                                    </Button>
                                }
                                title="Sync Attendance Portal"
                                description="Upload a screenshot of your attendance table page (e.g. VTOP) to sync your course balances instantly!"
                            />
                        </div>

                        {/* Manual Adjustments Grid */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual Class Offsets</h4>
                                <div className="flex items-center gap-2 bg-background/50 border border-border/40 px-3 py-1.5 rounded-xl text-xs">
                                    <span className="text-muted-foreground">Offsets As-Of Date:</span>
                                    <input
                                        type="date"
                                        value={preferences?.base_attendance_date || format(new Date(), 'yyyy-MM-dd')}
                                        onChange={(e) => {
                                            const updated = {
                                                ...(preferences || {}),
                                                base_attendance_date: e.target.value
                                            }
                                            setPreferences(updated)
                                        }}
                                        className="bg-transparent border-none text-foreground focus:outline-none font-medium cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {Array.from(new Map(filteredClasses.map(c => [c.name.toLowerCase().trim(), c])).values()).map((cls) => {
                                    const code = getCourseCode(cls.name)
                                    const base = preferences?.base_attendance?.[code] || { present: 0, total: 0 }
                                    
                                    return (
                                        <div key={cls.id} className="bg-background/30 p-3 rounded-xl border border-border/40 space-y-2">
                                            <div className="flex items-center gap-1.5 min-w-0 justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                                                    <span className="font-bold text-xs truncate" title={cls.name}>
                                                        {cls.short_name || cls.name} ({code})
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-muted-foreground">Attended So Far</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={base.present}
                                                        onChange={(e) => {
                                                            const val = Math.max(0, parseInt(e.target.value) || 0)
                                                            const updatedBase = { ...(preferences?.base_attendance || {}) }
                                                            updatedBase[code] = {
                                                                present: val,
                                                                total: Math.max(val, base.total)
                                                            }
                                                            const updated = {
                                                                ...(preferences || {}),
                                                                base_attendance: updatedBase
                                                            }
                                                            setPreferences(updated)
                                                        }}
                                                        className="w-full bg-background/50 border border-border/40 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-purple-400"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-muted-foreground">Total Held So Far</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={base.total}
                                                        onChange={(e) => {
                                                            const val = Math.max(0, parseInt(e.target.value) || 0)
                                                            const updatedBase = { ...(preferences?.base_attendance || {}) }
                                                            updatedBase[code] = {
                                                                present: Math.min(base.present, val),
                                                                total: val
                                                            }
                                                            const updated = {
                                                                ...(preferences || {}),
                                                                base_attendance: updatedBase
                                                            }
                                                            setPreferences(updated)
                                                        }}
                                                        className="w-full bg-background/50 border border-border/40 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-purple-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button
                                    size="sm"
                                    className="gradient-primary text-white"
                                    onClick={() => {
                                        const todayStr = format(new Date(), 'yyyy-MM-dd')
                                        const updated = {
                                            ...(preferences || {}),
                                            base_attendance_date: preferences?.base_attendance_date || todayStr
                                        }
                                        savePreferences(updated)
                                    }}
                                >
                                    Save Class Offsets
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Subject-wise Attendance Breakdown */}
            {selectedSemester === 'all' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Global Cumulative Hero Card */}
                    <Card className="glass-card border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-background to-indigo-500/5 relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
                        
                        <CardContent className="p-6 sm:p-8 relative z-10 space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-purple-500/20 p-2 rounded-xl text-purple-400">
                                            <Sparkles className="h-6 w-6 animate-pulse" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
                                            Global Academic Ledger
                                        </h2>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Your cumulative attendance tracking across all recorded semesters
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                {/* Global Percentage Gauge */}
                                <div className="md:col-span-4 flex flex-col items-center justify-center p-6 bg-background/30 rounded-2xl border border-border/40 text-center space-y-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Attendance</span>
                                    <span className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.25)]">
                                        {globalCumulativeStats.percentage}%
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/10 text-purple-400 border-purple-500/20">
                                        Cumulative Average
                                    </span>
                                </div>

                                {/* Global Stats Breakdowns */}
                                <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-background/25 p-4 rounded-xl border border-border/30 space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Held</span>
                                        <p className="text-2xl font-extrabold text-foreground">{globalCumulativeStats.total}</p>
                                        <p className="text-[10px] text-muted-foreground">net classes</p>
                                    </div>
                                    <div className="bg-background/25 p-4 rounded-xl border border-border/30 space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider text-emerald-400">Present</span>
                                        <p className="text-2xl font-extrabold text-emerald-400">{globalCumulativeStats.present}</p>
                                        <p className="text-[10px] text-muted-foreground">classes attended</p>
                                    </div>
                                    <div className="bg-background/25 p-4 rounded-xl border border-border/30 space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider text-rose-400">Absent</span>
                                        <p className="text-2xl font-extrabold text-rose-400">{globalCumulativeStats.absent}</p>
                                        <p className="text-[10px] text-muted-foreground">classes missed</p>
                                    </div>
                                    <div className="bg-background/25 p-4 rounded-xl border border-border/30 space-y-1">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider text-gray-400">Cancelled</span>
                                        <p className="text-2xl font-extrabold text-gray-400">{globalCumulativeStats.cancelled}</p>
                                        <p className="text-[10px] text-muted-foreground">classes cancelled</p>
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Cumulative Attendance Progress</span>
                                    <span>{globalCumulativeStats.percentage}%</span>
                                </div>
                                <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden border border-border/30 relative">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                                        style={{ width: `${globalCumulativeStats.percentage}%` }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Semesters Table (Ledger) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Semester-wise Ledger</h3>
                            <span className="text-xs text-muted-foreground">{semesters.length} semester{semesters.length === 1 ? '' : 's'} recorded</span>
                        </div>

                        {semesters.length === 0 ? (
                            <Card className="glass-card">
                                <CardContent className="py-10 text-center text-muted-foreground">
                                    <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                                    <p>No semesters found.</p>
                                    <p className="text-sm">Configure semesters in settings to begin tracking!</p>
                                    <Link href="/dashboard/settings/semesters" className="inline-block mt-4">
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Settings className="h-4 w-4" /> Go to Semester Settings
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {semesters.map((sem) => {
                                    const semStats = getSemesterStats(sem.id);
                                    const isExpanded = !!expandedSemesters[sem.id];
                                    const isCompleted = parseISO(sem.end_date) < today;
                                    const isCurrent = isWithinInterval(today, { start: parseISO(sem.start_date), end: parseISO(sem.end_date) });

                                    return (
                                        <Card 
                                            key={sem.id} 
                                            className={cn(
                                                "glass-card overflow-hidden transition-all duration-200 border-border/40",
                                                sem.is_active && !isCompleted && "border-purple-500/30 bg-purple-500/5",
                                                isExpanded && "ring-1 ring-primary/20"
                                            )}
                                        >
                                            {/* Table Row Header */}
                                            <div 
                                                onClick={() => toggleSemesterExpand(sem.id)}
                                                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={cn(
                                                        "p-2 rounded-xl shrink-0 mt-0.5",
                                                        sem.is_active && !isCompleted ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        <GraduationCap className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-bold text-base truncate">{sem.name}</h4>
                                                            {sem.is_active && !isCompleted && (
                                                                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold">
                                                                    Active
                                                                </span>
                                                            )}
                                                            {isCompleted && (
                                                                <span className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                                                                    Completed
                                                                </span>
                                                            )}
                                                            {isCurrent && !sem.is_active && !isCompleted && (
                                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(parseISO(sem.start_date), 'MMM d, yyyy')} - {format(parseISO(sem.end_date), 'MMM d, yyyy')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-row sm:items-center gap-6 justify-between sm:justify-end shrink-0">
                                                    <div className="text-left sm:text-right space-y-0.5">
                                                        <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Attendance</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "text-lg font-black",
                                                                semStats.total === 0 ? "text-muted-foreground" :
                                                                    semStats.percentage >= targetPercentage ? "text-emerald-400" : "text-rose-400"
                                                            )}>
                                                                {semStats.total === 0 ? '—' : `${semStats.percentage}%`}
                                                            </span>
                                                            {semStats.total > 0 && (
                                                                <div className="w-16 h-1.5 bg-muted/60 rounded-full overflow-hidden shrink-0 hidden xs:block">
                                                                    <div 
                                                                        className={cn(
                                                                            "h-full rounded-full",
                                                                            semStats.percentage >= targetPercentage ? "bg-emerald-500" : "bg-rose-500"
                                                                        )}
                                                                        style={{ width: `${semStats.percentage}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-left sm:text-right space-y-0.5">
                                                        <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Details</span>
                                                        <p className="text-xs font-semibold text-foreground/80">
                                                            {semStats.present}P • {semStats.absent}A • {semStats.cancelled}C
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {semStats.total} net classes
                                                        </p>
                                                    </div>

                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground self-center">
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Expandable Semester Subjects Grid */}
                                            {isExpanded && (
                                                <div className="border-t border-border/40 bg-background/35 p-4 sm:p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                                        <span>Subject Breakdown</span>
                                                        <span>Target: {`>=`} {targetPercentage}%</span>
                                                    </div>

                                                    {semStats.subjects.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground text-center py-4">No subjects/classes recorded for this semester.</p>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {semStats.subjects.map((subj) => {
                                                                const sSafeAbsences = Math.max(0, Math.floor((subj.present - (targetPercentage * subj.total) / 100) / (1 + targetPercentage / 100)));
                                                                const sIsAtRisk = subj.percentage < targetPercentage && subj.total > 0;
                                                                
                                                                return (
                                                                    <div 
                                                                        key={subj.name}
                                                                        className={cn(
                                                                            "bg-background/45 p-4 rounded-xl border border-border/30 space-y-3 relative overflow-hidden transition-all duration-200 hover:bg-background/60",
                                                                            sIsAtRisk && "border-rose-500/20"
                                                                        )}
                                                                    >
                                                                        {/* Color accent left bar */}
                                                                        <div 
                                                                            className="absolute left-0 top-0 bottom-0 w-1" 
                                                                            style={{ backgroundColor: subj.color }}
                                                                        />
                                                                        
                                                                        <div className="flex justify-between items-start gap-2 pl-1.5">
                                                                            <span className="font-bold text-sm truncate pr-2" title={subj.name}>
                                                                                {subj.shortName || subj.name}
                                                                            </span>
                                                                            <span className={cn(
                                                                                "font-extrabold text-sm shrink-0",
                                                                                subj.total === 0 ? "text-muted-foreground" :
                                                                                    subj.percentage >= targetPercentage ? "text-emerald-400" : "text-rose-400"
                                                                            )}>
                                                                                {subj.total === 0 ? '—' : `${subj.percentage}%`}
                                                                            </span>
                                                                        </div>

                                                                        {/* Progress bar */}
                                                                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden pl-1.5">
                                                                            <div 
                                                                                className={cn(
                                                                                    "h-full rounded-full transition-all",
                                                                                    subj.percentage >= targetPercentage ? "bg-emerald-500" : "bg-rose-500"
                                                                                )}
                                                                                style={{ width: `${subj.percentage}%` }}
                                                                            />
                                                                        </div>

                                                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-1.5">
                                                                            <span>
                                                                                {subj.present}P • {subj.absent}A • {subj.cancelled}C
                                                                            </span>
                                                                            {sSafeAbsences > 0 ? (
                                                                                <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                                                                    🛡️ {sSafeAbsences} safe bunk{sSafeAbsences === 1 ? '' : 's'}
                                                                                </span>
                                                                            ) : sIsAtRisk ? (
                                                                                <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                                                                                    ⚠️ At risk
                                                                                </span>
                                                                            ) : (
                                                                                <span>{subj.total} net classes</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Subject-wise Attendance Breakdown Cards */}
                    {filteredClasses.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Subject-wise Attendance</h2>
                                <p className="text-sm text-muted-foreground">
                                    Click a subject to view its simulator & weekly log
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Array.from(new Map(filteredClasses.map(c => [c.name.toLowerCase().trim(), c])).values()).map((cls) => {
                                    const stats = calculateStatsBySubjectName(cls.name)
                                    const safeAbsences = calculateSafeAbsencesBySubjectName(cls.name)
                                    const isSelected = selectedClass !== 'all' && filteredClasses.find(c => c.id === selectedClass)?.name.toLowerCase().trim() === cls.name.toLowerCase().trim()
                                    const isAtRisk = stats.percentage < targetPercentage && stats.total > 0

                                    return (
                                        <Card
                                            key={cls.id}
                                            onClick={() => setSelectedClass(isSelected ? 'all' : cls.id)}
                                            className={cn(
                                                "glass-card cursor-pointer transition-all hover:scale-[1.02] border-border/40",
                                                isSelected && "ring-2 ring-primary border-primary/50",
                                                isAtRisk && "border-rose-500/30 bg-rose-500/[0.02]"
                                            )}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-2 mb-3">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div
                                                            className="h-3 w-3 rounded-full shrink-0"
                                                            style={{ backgroundColor: cls.color }}
                                                        />
                                                        <span className="font-bold text-sm truncate" title={cls.name}>
                                                            {cls.short_name || cls.name}
                                                        </span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-lg font-black shrink-0",
                                                        stats.total === 0 ? "text-muted-foreground" :
                                                            stats.percentage >= targetPercentage ? "text-emerald-400" : "text-rose-400"
                                                    )}>
                                                        {stats.total === 0 ? '—' : `${stats.percentage}%`}
                                                    </span>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-2">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all rounded-full",
                                                            stats.percentage >= targetPercentage ? "bg-emerald-500" : "bg-rose-500"
                                                        )}
                                                        style={{ width: `${stats.percentage}%` }}
                                                    />
                                                </div>

                                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                    <span>
                                                        <span className="text-emerald-400 font-semibold">{stats.present}</span> present,{' '}
                                                        <span className="text-rose-400 font-semibold">{stats.absent}</span> absent,{' '}
                                                        <span className="text-gray-400 font-semibold">{stats.cancelled}</span> cancelled
                                                    </span>
                                                    {safeAbsences > 0 ? (
                                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                            🛡️ {safeAbsences} safe bunk{safeAbsences === 1 ? '' : 's'}
                                                        </span>
                                                    ) : isAtRisk ? (
                                                        <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
                                                            <AlertTriangle className="h-3 w-3" /> At risk
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">{stats.total} classes</span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Attendance Simulator Card */}
                    {selectedClass !== 'all' && selectedClassData && (() => {
                        const subjectName = selectedClassData.name;
                        const stats = calculateStatsBySubjectName(subjectName);
                        
                        const activeSemesterCalc = semesterClassesCalc || {
                            semesterName: "Estimated Semester",
                            totalScheduled: Math.max(30, stats.total),
                            breakClassesCount: 0,
                            examClassesCount: 0,
                            cancelledCount: stats.cancelled,
                            totalGross: Math.max(30, stats.total) + stats.cancelled,
                            minClassesToAttend: Math.ceil((targetPercentage / 100) * Math.max(30, stats.total)),
                            maxMissesAllowed: Math.max(0, Math.max(30, stats.total) - Math.ceil((targetPercentage / 100) * Math.max(30, stats.total))),
                            breakDetails: {}
                        };

                        const activeSimSemesterAbsents = simulatedSemesterAbsents !== null
                            ? simulatedSemesterAbsents
                            : stats.absent;

                        const projectedPresent = Math.max(0, activeSemesterCalc.totalScheduled - activeSimSemesterAbsents);
                        const projectedAbsent = activeSimSemesterAbsents;
                        const projectedTotal = activeSemesterCalc.totalScheduled;

                        const projectedPercentage = projectedTotal > 0
                            ? Math.ceil((projectedPresent / projectedTotal) * 100)
                            : 0;

                        const isProjectedSafe = projectedPercentage >= targetPercentage;

                        // Absences remaining
                        const projectedSafeAbsences = Math.max(0, activeSemesterCalc.maxMissesAllowed - activeSimSemesterAbsents);

                        return (
                            <Card className="glass-card border-purple-500/25 bg-purple-500/[0.03] shadow-xl relative overflow-hidden transition-all duration-300">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                                
                                <CardContent className="p-6 space-y-6 relative z-10">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-purple-500/20 p-1.5 rounded-lg text-purple-400">
                                                    <Sparkles className="h-5 w-5 animate-pulse" />
                                                </div>
                                                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
                                                    Attendance Simulator ({selectedClassData.short_name || subjectName})
                                                </h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Project your semester attendance by simulating safe bunks and analyzing cancellation impacts.
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 shrink-0 bg-background/40 px-3 py-1.5 rounded-xl border border-border/50 self-start sm:self-auto">
                                            <span className="text-xs font-semibold text-muted-foreground">Target:</span>
                                            <input 
                                                type="number" 
                                                min="50" 
                                                max="100" 
                                                value={targetPercentage} 
                                                onChange={(e) => {
                                                    const val = Math.max(50, Math.min(100, parseInt(e.target.value) || 75));
                                                    setTargetPercentage(val);
                                                }}
                                                className="w-12 bg-transparent text-sm font-bold text-center border-b border-muted-foreground focus:outline-none focus:border-purple-400 text-purple-400"
                                            />
                                            <span className="text-sm font-bold text-purple-400">%</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4 bg-background/25 p-4 rounded-xl border border-border/30">
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Simulate Semester Absences</h4>
                                                
                                                <div className="flex flex-col gap-2 p-3 bg-background/40 rounded-lg border border-border/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-semibold text-muted-foreground">Total Absences</span>
                                                        <span className={cn(
                                                            "text-sm font-bold",
                                                            activeSimSemesterAbsents > activeSemesterCalc.maxMissesAllowed ? "text-rose-400 animate-pulse" : "text-purple-400"
                                                        )}>
                                                            {activeSimSemesterAbsents} / {activeSemesterCalc.totalScheduled} classes
                                                        </span>
                                                    </div>
                                                    
                                                    <input
                                                        type="range"
                                                        min={stats.absent}
                                                        max={activeSemesterCalc.totalScheduled}
                                                        value={activeSimSemesterAbsents}
                                                        onChange={(e) => setSimulatedSemesterAbsents(parseInt(e.target.value) || 0)}
                                                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                    />
                                                    
                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                                                        <span>Logged: {stats.absent}</span>
                                                        <span className="font-semibold text-amber-400">Max Bunks: {activeSemesterCalc.maxMissesAllowed}</span>
                                                        <span>Total Net: {activeSemesterCalc.totalScheduled}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-4 p-3 bg-background/40 rounded-lg border border-border/50">
                                                    <div>
                                                        <p className="text-sm font-semibold text-purple-400 flex items-center gap-1.5">
                                                            <CalendarDays className="h-4 w-4" /> Fine-tune Absences
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Simulate higher absentee rate</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-full border-border/60 hover:bg-purple-500/10"
                                                            disabled={activeSimSemesterAbsents <= stats.absent}
                                                            onClick={() => setSimulatedSemesterAbsents(a => Math.max(stats.absent, (a ?? stats.absent) - 1))}
                                                        >
                                                            <ChevronLeft className="h-4 w-4" />
                                                        </Button>
                                                        <span className="w-8 text-center font-bold text-lg text-purple-400">{activeSimSemesterAbsents}</span>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-full border-border/60 hover:bg-purple-500/10"
                                                            disabled={activeSimSemesterAbsents >= activeSemesterCalc.totalScheduled}
                                                            onClick={() => setSimulatedSemesterAbsents(a => Math.min(activeSemesterCalc.totalScheduled, (a ?? stats.absent) + 1))}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {simulatedSemesterAbsents !== null && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSimulatedSemesterAbsents(null)}
                                                        className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                                                    >
                                                        <RotateCcw className="h-3 w-3" /> Reset Semester Simulation
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-between p-4 bg-background/25 rounded-xl border border-border/30 space-y-4">
                                            <div>
                                                <h4 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase mb-3">Projected Attendance</h4>
                                                <div className="flex items-baseline justify-between">
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "text-4xl font-extrabold tracking-tight",
                                                            isProjectedSafe ? "text-emerald-400" : "text-rose-400"
                                                        )}>
                                                            {projectedPercentage}%
                                                        </span>
                                                        <span className="text-xs text-muted-foreground mt-0.5">
                                                            Current: <span className="font-semibold text-foreground">{stats.percentage}%</span>
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className={cn(
                                                            "px-2.5 py-1 rounded-full text-xs font-semibold border",
                                                            isProjectedSafe 
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                                                : "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                                                        )}>
                                                            {isProjectedSafe ? "Above Target" : "Below Target"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="relative h-4 w-full bg-muted/40 rounded-full overflow-hidden mt-4 border border-border/30">
                                                    <div
                                                        className={cn(
                                                            "absolute h-full rounded-full transition-all duration-500 bg-gradient-to-r",
                                                            isProjectedSafe 
                                                                ? "from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]" 
                                                                : "from-rose-500 to-red-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                                                        )}
                                                        style={{ width: `${projectedPercentage}%` }}
                                                    />
                                                    
                                                    {stats.total > 0 && (
                                                        <div 
                                                            className="absolute top-0 bottom-0 w-0.5 bg-foreground shadow-lg z-10"
                                                            style={{ left: `${stats.percentage}%` }}
                                                            title={`Current: ${stats.percentage}%`}
                                                        >
                                                            <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-foreground rounded-full" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-sm leading-relaxed p-3 bg-background/40 rounded-lg border border-border/40">
                                                {isProjectedSafe ? (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-400 font-semibold flex items-center gap-1.5 text-xs">
                                                            ✨ Safe Absence Range
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            With {projectedAbsent} simulated absences out of {activeSemesterCalc.totalScheduled} total classes, your attendance is <span className="text-emerald-400 font-bold">{projectedPercentage}%</span>. You can still miss up to <span className="text-emerald-400 font-bold">{projectedSafeAbsences}</span> more class{projectedSafeAbsences === 1 ? '' : 'es'} this semester.
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                                                            ⚠️ Note: A maximum of <span className="font-semibold text-foreground">{activeSemesterCalc.maxMissesAllowed} absences (bunks)</span> is allowed to maintain your {targetPercentage}% target.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <p className="text-rose-400 font-semibold flex items-center gap-1.5 text-xs animate-pulse">
                                                            ⚠️ Exceeded Absence Limit!
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Simulating {projectedAbsent} absences drops your attendance to <span className="text-rose-400 font-bold">{projectedPercentage}%</span>, falling below the {targetPercentage}% requirement.
                                                        </p>
                                                        <p className="text-[10px] text-rose-400/80 mt-1">
                                                            ⚠️ Note: You must limit absences to a maximum of <span className="font-semibold text-rose-300">{activeSemesterCalc.maxMissesAllowed} classes</span> to stay at or above {targetPercentage}%.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Semester-Long Absence Allowance & Details */}
                                    <div className="border-t border-purple-500/20 pt-6 mt-4 space-y-4">
                                        <div className="flex items-center gap-2 text-purple-400">
                                            <CalendarDays className="h-4 w-4 animate-pulse" />
                                            <h4 className="font-bold text-xs tracking-wide uppercase">Semester Impact & Bunk Limit ({activeSemesterCalc.semesterName})</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {/* Card 1: Total Classes (Net) */}
                                            <div className="bg-background/25 p-4 rounded-xl border border-border/40 space-y-1.5">
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Classes (Net)</span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-xl font-extrabold text-foreground">{activeSemesterCalc.totalScheduled}</span>
                                                    <span className="text-xs text-muted-foreground">net classes</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground leading-normal">
                                                    Gross of {activeSemesterCalc.totalGross} slots minus {activeSemesterCalc.breakClassesCount} holiday classes, {activeSemesterCalc.examClassesCount} exam cancellations, and {activeSemesterCalc.cancelledCount} individually cancelled classes.
                                                </p>
                                            </div>

                                            {/* Card 2: Cancelled Classes */}
                                            <div className="bg-background/25 p-4 rounded-xl border border-border/40 space-y-1.5">
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-gray-400">Cancelled Classes</span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-xl font-extrabold text-gray-300">{activeSemesterCalc.cancelledCount}</span>
                                                    <span className="text-xs text-muted-foreground">cancelled</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground leading-normal">
                                                    Cancellations reduce the net semester class count. This decreases the overall classes held, which in turn reduces your allowed absence buffer (bunk limit) to remain above target.
                                                </p>
                                            </div>

                                            {/* Card 3: Bunk Allowance */}
                                            <div className="bg-background/25 p-4 rounded-xl border border-border/40 space-y-1.5 relative overflow-hidden">
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-amber-400">Bunk Allowance</span>
                                                {(() => {
                                                    const remaining = activeSemesterCalc.maxMissesAllowed - stats.absent;
                                                    const isExceeded = remaining < 0;
                                                    return (
                                                        <>
                                                            <div className="flex items-baseline gap-1.5">
                                                                <span className={cn(
                                                                    "text-xl font-extrabold",
                                                                    isExceeded ? "text-rose-400 animate-pulse" : remaining === 0 ? "text-amber-400" : "text-emerald-400"
                                                                )}>
                                                                    {isExceeded ? 0 : remaining}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">/ {activeSemesterCalc.maxMissesAllowed} max</span>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground leading-normal">
                                                                {isExceeded ? (
                                                                    <span className="text-rose-400 font-medium">⚠️ Exceeded allowed absences by {Math.abs(remaining)} class{Math.abs(remaining) === 1 ? "" : "es"}!</span>
                                                                ) : (
                                                                    <span>Logged {stats.absent} absences. You can safely bunk {remaining} more class{remaining === 1 ? "" : "es"} this semester.</span>
                                                                )}
                                                            </p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Tip / Reminder to add exams and breaks */}
                                        <div className="flex items-start gap-2 bg-purple-500/10 p-3 rounded-lg border border-purple-500/10 text-xs">
                                            <AlertTriangle className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                                            <p className="text-muted-foreground leading-relaxed text-xs">
                                                {!semesterClassesCalc ? (
                                                    <span>
                                                        <span className="text-purple-400 font-semibold">📅 Semester Context Missing:</span> Currently using a default estimate of 30 total classes. Configure or select an active semester in <Link href="/dashboard/settings/semesters" className="text-purple-400 underline hover:text-purple-300 font-semibold">Semester Settings</Link> to unlock precise schedule tracking and automatic break exclusions!
                                                    </span>
                                                ) : (
                                                    <span>
                                                        <span className="text-purple-400 font-semibold">⚠️ Pro-Tip for Accuracy:</span> Keep these calculations 100% correct by ensuring all your <strong className="text-foreground">Exams</strong> (as Exam Periods) and <strong className="text-foreground">Holidays/Breaks</strong> are configured in <Link href="/dashboard/settings/semesters" className="text-purple-400 underline hover:text-purple-300">Semester Settings</Link>. Otherwise, the calculator assumes class is held on those days.
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()}

                    {/* Overall Summary (smaller) */}
                    <div className="grid grid-cols-4 gap-3">
                        <Card className="glass-card border-border/40">
                            <CardContent className="p-3 flex items-center gap-2">
                                <TrendingUp className={cn(
                                    "h-4 w-4 shrink-0",
                                    overallStats.percentage >= targetPercentage ? "text-emerald-400" : "text-rose-400"
                                )} />
                                <div className="min-w-0">
                                    <p className={cn(
                                        "text-base sm:text-lg font-extrabold truncate",
                                        overallStats.percentage >= targetPercentage ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {overallStats.percentage}%
                                    </p>
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Overall</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card border-border/40">
                            <CardContent className="p-3 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-base sm:text-lg font-extrabold text-foreground truncate">{overallStats.present}</p>
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Present</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card border-border/40">
                            <CardContent className="p-3 flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-base sm:text-lg font-extrabold text-foreground truncate">{overallStats.absent}</p>
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Absent</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card border-border/40">
                            <CardContent className="p-3 flex items-center gap-2">
                                <MinusCircle className="h-4 w-4 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-base sm:text-lg font-extrabold text-foreground truncate">{overallStats.cancelled}</p>
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Cancelled</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Week Navigation */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setWeekOffset((w) => w - 1)}
                                className="justify-start border-border/50"
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setWeekOffset(0)}
                                disabled={weekOffset === 0}
                                className="border-border/50"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" /> This Week
                            </Button>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/80">
                            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                        </h2>

                        <Button variant="outline" onClick={() => setWeekOffset((w) => w + 1)} className="justify-end border-border/50">
                            Next <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                    {/* Week View */}
                    {filteredClasses.length === 0 ? (
                        <Card className="glass-card border-border/40">
                            <CardContent className="py-10">
                                <div className="text-center">
                                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                                    <p className="text-muted-foreground">No classes in your timetable</p>
                                    <p className="text-sm text-muted-foreground mt-1">Add classes in Timetable to track attendance</p>
                                    {loadError && (
                                        <p className="mt-3 text-xs text-rose-400 wrap-break-word">{loadError}</p>
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

                                const currentSem = selectedSemester !== 'all' 
                                    ? semesters.find(s => s.id === selectedSemester)
                                    : semesters.find(s => s.is_active && parseISO(s.end_date) >= today);

                                const isBeforeSem = currentSem ? day < parseISO(currentSem.start_date) : false;
                                const isAfterSem = currentSem ? day > parseISO(currentSem.end_date) : false;

                                const overrideDay = preferences?.timetable_overrides?.[format(day, 'yyyy-MM-dd')]
                                const effectiveDay = overrideDay !== undefined ? overrideDay : dayNum

                                const dayClasses = effectiveDay === -1 ? [] : filteredClasses
                                    .filter((cls) => {
                                        if (selectedClass === 'all') return true;
                                        const selectedObj = filteredClasses.find(c => c.id === selectedClass);
                                        return selectedObj ? cls.name.toLowerCase().trim() === selectedObj.name.toLowerCase().trim() : false;
                                    })
                                    .filter((cls) => cls.day_of_week === effectiveDay)
                                    .filter((cls) => {
                                        if (!cls.semester_id) return true;
                                        const sem = semesters.find(s => s.id === cls.semester_id);
                                        if (!sem) return true;
                                        return isWithinInterval(day, {
                                            start: parseISO(sem.start_date),
                                            end: parseISO(sem.end_date)
                                        });
                                    })
                                    .slice()
                                    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

                                return (
                                    <Card
                                        key={day.toISOString()}
                                        className={cn(
                                            'glass-card border-border/40 transition-all duration-200',
                                            isSameDay(day, today) && 'ring-1 ring-primary/40 border-primary/30',
                                            breakForDay && 'border-amber-500/30 bg-amber-500/[0.02]'
                                        )}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{format(day, 'EEEE')}</p>
                                                    <p className="text-xs text-muted-foreground">{format(day, 'MMM d')}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    {breakForDay && (
                                                        <span className="text-xs font-medium text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                                            <Palmtree className="h-3 w-3" />
                                                            {breakForDay.name}
                                                        </span>
                                                    )}
                                                    {isSameDay(day, today) && (
                                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Today</span>
                                                    )}
                                                    {/* Swap schedule dropdown */}
                                                    {dayNum === 6 && (
                                                        <Select
                                                            value={overrideDay !== undefined ? String(overrideDay) : "standard"}
                                                            onValueChange={(val) => {
                                                                const newOverrides = { ...(preferences?.timetable_overrides || {}) }
                                                                if (val === "standard") {
                                                                    delete newOverrides[format(day, 'yyyy-MM-dd')]
                                                                } else {
                                                                    newOverrides[format(day, 'yyyy-MM-dd')] = parseInt(val)
                                                                }
                                                                const updated = {
                                                                    ...(preferences || {}),
                                                                    timetable_overrides: newOverrides
                                                                }
                                                                savePreferences(updated)
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-6 text-[10px] w-28 bg-background/40 border-border/40 hover:bg-background/60 py-0 px-2 flex items-center gap-1">
                                                                <SelectValue placeholder="🗓️ Swap" />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-gray-900 border-white/10">
                                                                <SelectItem value="standard">🗓️ Standard</SelectItem>
                                                                <SelectItem value="1">Monday's</SelectItem>
                                                                <SelectItem value="2">Tuesday's</SelectItem>
                                                                <SelectItem value="3">Wednesday's</SelectItem>
                                                                <SelectItem value="4">Thursday's</SelectItem>
                                                                <SelectItem value="5">Friday's</SelectItem>
                                                                <SelectItem value="6">Saturday's</SelectItem>
                                                                <SelectItem value="-1">No Classes</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Swapped Timetable Badge */}
                                            {overrideDay !== undefined && (
                                                <div className="mb-3">
                                                    <span className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 w-fit",
                                                        overrideDay === -1
                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                            : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    )}>
                                                        👉 {overrideDay === -1 ? "Holiday" : `Following ${overrideDayNames[overrideDay]}'s Timetable`}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                {breakForDay ? (
                                                    <div className="flex items-center justify-center py-4 text-amber-400/70">
                                                        <Palmtree className="h-5 w-5 mr-2" />
                                                        <span className="text-sm">No classes - {breakForDay.name}</span>
                                                    </div>
                                                ) : isAfterSem ? (
                                                    <div className="flex items-center justify-center py-4 text-muted-foreground/50 bg-muted/5 rounded-lg border border-dashed border-border/40">
                                                        <Calendar className="h-5 w-5 mr-2 text-muted-foreground/30" />
                                                        <span className="text-sm font-medium">Semester ended</span>
                                                    </div>
                                                ) : isBeforeSem ? (
                                                    <div className="flex items-center justify-center py-4 text-muted-foreground/50 bg-muted/5 rounded-lg border border-dashed border-border/40">
                                                        <Calendar className="h-5 w-5 mr-2 text-muted-foreground/30" />
                                                        <span className="text-sm font-medium">Semester not started</span>
                                                    </div>
                                                ) : dayClasses.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground py-2 text-center">No classes scheduled</p>
                                                ) : (
                                                    dayClasses.map((cls) => {
                                                        const record = getAttendanceForDay(cls.id, day)

                                                        return (
                                                            <div
                                                                key={cls.id}
                                                                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/20 p-3 hover:bg-background/30 transition-colors"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <div
                                                                            className="h-2.5 w-2.5 rounded-full shrink-0"
                                                                            style={{ backgroundColor: cls.color }}
                                                                        />
                                                                        <p className="truncate text-sm font-bold">
                                                                            {cls.short_name || cls.name}
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {cls.start_time} - {cls.end_time}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={cn(
                                                                            'h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg',
                                                                            record?.status === 'present' &&
                                                                            'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
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
                                                                            'h-8 w-8 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg',
                                                                            record?.status === 'absent' &&
                                                                            'bg-rose-500/20 text-rose-400 hover:bg-rose-500/20'
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
                                                                            'h-8 w-8 hover:bg-gray-500/10 hover:text-gray-400 rounded-lg',
                                                                            record?.status === 'cancelled' &&
                                                                            'bg-gray-500/20 text-gray-400 hover:bg-gray-500/20'
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
                                                    <p className="pt-2 text-xs text-rose-400 wrap-break-word">{loadError}</p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4 border-t border-border/20">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span>Present</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-rose-400" />
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
            )}
        </div>
    )
}
