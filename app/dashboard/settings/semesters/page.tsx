'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    CalendarDays,
    Plus,
    Trash2,
    Loader2,
    GraduationCap,
    ChevronLeft,
    Edit2,
    Calendar,
    Palmtree,
    BookOpen,
    Coffee,
    Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, parseISO, isWithinInterval, differenceInDays } from 'date-fns'
import type { Semester, SemesterBreak } from '@/types'
import Link from 'next/link'
import { SemesterSetupWizard } from '@/components/settings/SemesterSetupWizard'
import { withTimeout } from '@/lib/network-utils'

const breakTypeIcons = {
    holiday: Palmtree,
    exam_period: BookOpen,
    break: Coffee
}

const breakTypeLabels = {
    holiday: 'Holiday',
    exam_period: 'Exam Period',
    break: 'Break'
}

export default function SemesterSettingsPage() {
    const [semesters, setSemesters] = useState<Semester[]>([])
    const [breaks, setBreaks] = useState<SemesterBreak[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)

    // Dialogs
    const [semesterDialog, setSemesterDialog] = useState(false)
    const [breakDialog, setBreakDialog] = useState(false)
    const [wizardOpen, setWizardOpen] = useState(false)
    const [editingSemester, setEditingSemester] = useState<Semester | null>(null)
    const [editingBreak, setEditingBreak] = useState<SemesterBreak | null>(null)
    const [selectedSemesterForBreak, setSelectedSemesterForBreak] = useState<string | null>(null)

    // Form states
    const [semesterForm, setSemesterForm] = useState({
        name: '',
        start_date: '',
        end_date: ''
    })
    const [dialogProgramType, setDialogProgramType] = useState<'btech' | 'int_mtech'>('btech')
    const [breakForm, setBreakForm] = useState({
        name: '',
        start_date: '',
        end_date: '',
        break_type: 'holiday' as SemesterBreak['break_type']
    })


    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await withTimeout(supabase.auth.getUser())
            if (!user) return
            setUserId(user.id)

            const [semestersRes, breaksRes] = await withTimeout(
                Promise.all([
                    supabase.from('semesters').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
                    supabase.from('semester_breaks').select('*').eq('user_id', user.id).order('start_date', { ascending: true })
                ])
            )

            if (semestersRes.data) setSemesters(semestersRes.data)
            if (breaksRes.data) setBreaks(breaksRes.data)
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to load semesters')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (semesterDialog) {
            // If the edited semester name is "Semester 9" or "Semester 10", it must be Integrated M.Tech
            const isEditingIntMtech = editingSemester && (
                editingSemester.name === 'Semester 9' || 
                editingSemester.name === 'Semester 10'
            )
            const hasIntMtechSemesters = semesters.some(s => 
                s.name === 'Semester 9' || 
                s.name === 'Semester 10'
            ) || semesters.length > 8

            setDialogProgramType(isEditingIntMtech || hasIntMtechSemesters ? 'int_mtech' : 'btech')
        }
    }, [semesterDialog, semesters, editingSemester])

    // Save semester state to localStorage (only when open)
    useEffect(() => {
        if (semesterDialog) {
            const state = {
                semesterForm,
                dialogProgramType,
                editingSemester,
                semesterDialog
            }
            localStorage.setItem('student-hub:semester-form-state', JSON.stringify(state))
        }
    }, [semesterForm, dialogProgramType, editingSemester, semesterDialog])

    // Load semester state from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('student-hub:semester-form-state')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (parsed.semesterDialog) {
                    setSemesterForm(parsed.semesterForm || { name: '', start_date: '', end_date: '' })
                    setDialogProgramType(parsed.dialogProgramType || 'btech')
                    setEditingSemester(parsed.editingSemester || null)
                    setSemesterDialog(true)
                }
            } catch (e) {
                console.error('Error loading semester form state:', e)
            }
        }
    }, [])

    // Save break state to localStorage (only when open)
    useEffect(() => {
        if (breakDialog) {
            const state = {
                breakForm,
                selectedSemesterForBreak,
                editingBreak,
                breakDialog
            }
            localStorage.setItem('student-hub:break-form-state', JSON.stringify(state))
        }
    }, [breakForm, selectedSemesterForBreak, editingBreak, breakDialog])

    // Load break state from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('student-hub:break-form-state')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (parsed.breakDialog) {
                    setBreakForm(parsed.breakForm || { name: '', start_date: '', end_date: '', break_type: 'holiday' })
                    setSelectedSemesterForBreak(parsed.selectedSemesterForBreak || null)
                    setEditingBreak(parsed.editingBreak || null)
                    setBreakDialog(true)
                }
            } catch (e) {
                console.error('Error loading break form state:', e)
            }
        }
    }, [])

    // Load wizard open state from localStorage on mount to resume setup
    useEffect(() => {
        const savedWizard = localStorage.getItem('student-hub:semester-setup-wizard-state')
        if (savedWizard) {
            setWizardOpen(true)
        }
    }, [])

    // Semester CRUD
    const saveSemester = async () => {
        if (!userId || !semesterForm.name || !semesterForm.start_date || !semesterForm.end_date) {
            toast.error('Please fill all fields')
            return
        }

        const start = new Date(semesterForm.start_date)
        const end = new Date(semesterForm.end_date)

        if (start >= end) {
            toast.error('Start date must be before end date')
            return
        }

        // Check for overlaps with other semesters (excluding the one being edited)
        const hasOverlap = semesters.some(sem => {
            if (editingSemester && sem.id === editingSemester.id) return false
            
            const existingStart = new Date(sem.start_date)
            const existingEnd = new Date(sem.end_date)
            
            // Checks if [start, end] overlaps with [existingStart, existingEnd]
            return start <= existingEnd && end >= existingStart
        })

        if (hasOverlap) {
            toast.error('This semester date range overlaps with an existing semester')
            return
        }

        setSaving(true)
        try {
            if (editingSemester) {
                const { error } = await withTimeout(
                    supabase
                        .from('semesters')
                        .update({
                            name: semesterForm.name,
                            start_date: semesterForm.start_date,
                            end_date: semesterForm.end_date
                        })
                        .eq('id', editingSemester.id)
                )

                if (error) throw error
                toast.success('Semester updated')
            } else {
                const { error } = await withTimeout(
                    supabase
                        .from('semesters')
                        .insert({
                            user_id: userId,
                            name: semesterForm.name,
                            start_date: semesterForm.start_date,
                            end_date: semesterForm.end_date,
                            is_active: semesters.length === 0
                        })
                )

                if (error) throw error
                toast.success('Semester created')
            }

            fetchData()
            setSemesterDialog(false)
            setEditingSemester(null)
            setSemesterForm({ name: '', start_date: '', end_date: '' })
            localStorage.removeItem('student-hub:semester-form-state')
        } catch (error) {
            console.error('Error saving semester:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to save semester')
        } finally {
            setSaving(false)
        }
    }

    const deleteSemester = async (id: string) => {
        if (!confirm('Delete this semester? This will also delete all associated breaks, timetable schedules, and attendance records.')) return

        try {
            // 1. Fetch associated class schedules to clean up their attendance records
            const { data: schedules, error: fetchError } = await withTimeout(
                supabase
                    .from('class_schedules')
                    .select('id')
                    .eq('semester_id', id)
            )
            
            if (fetchError) throw fetchError
            const scheduleIds = schedules?.map(s => s.id) || []

            // 2. Delete attendance records associated with this semester
            const { error: attError1 } = await withTimeout(
                supabase
                    .from('attendance_records')
                    .delete()
                    .eq('semester_id', id)
            )
            if (attError1) throw attError1

            // 3. Delete attendance records associated with these schedules
            if (scheduleIds.length > 0) {
                const { error: attError2 } = await withTimeout(
                    supabase
                        .from('attendance_records')
                        .delete()
                        .in('class_schedule_id', scheduleIds)
                )
                if (attError2) throw attError2
            }

            // 4. Delete class schedules
            const { error: schedError } = await withTimeout(
                supabase
                    .from('class_schedules')
                    .delete()
                    .eq('semester_id', id)
            )
            if (schedError) throw schedError

            // 5. Delete breaks first
            const { error: breakError } = await withTimeout(
                supabase
                    .from('semester_breaks')
                    .delete()
                    .eq('semester_id', id)
            )
            if (breakError) throw breakError

            // 6. Delete the semester
            const { error: semError } = await withTimeout(
                supabase
                    .from('semesters')
                    .delete()
                    .eq('id', id)
            )
            if (semError) throw semError

            toast.success('Semester deleted')
            fetchData()
        } catch (error) {
            console.error('Error deleting semester:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to delete semester')
        }
    }

    const setActiveSemester = async (id: string) => {
        try {
            // First, deactivate all
            const { error: deactivateError } = await withTimeout(
                supabase.from('semesters').update({ is_active: false }).eq('user_id', userId!)
            )
            if (deactivateError) throw deactivateError

            // Then activate the selected one
            const { error: activateError } = await withTimeout(
                supabase.from('semesters').update({ is_active: true }).eq('id', id)
            )
            if (activateError) throw activateError

            toast.success('Active semester updated')
            fetchData()
        } catch (error) {
            console.error('Error setting active semester:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to update active semester')
        }
    }

    // Break CRUD
    const saveBreak = async () => {
        if (!userId || !selectedSemesterForBreak || !breakForm.name || !breakForm.start_date || !breakForm.end_date) {
            toast.error('Please fill all fields')
            return
        }

        setSaving(true)
        try {
            if (editingBreak) {
                const { error } = await withTimeout(
                    supabase
                        .from('semester_breaks')
                        .update({
                            name: breakForm.name,
                            start_date: breakForm.start_date,
                            end_date: breakForm.end_date,
                            break_type: breakForm.break_type
                        })
                        .eq('id', editingBreak.id)
                )

                if (error) throw error
                toast.success('Break updated')
            } else {
                const { error } = await withTimeout(
                    supabase
                        .from('semester_breaks')
                        .insert({
                            user_id: userId,
                            semester_id: selectedSemesterForBreak,
                            name: breakForm.name,
                            start_date: breakForm.start_date,
                            end_date: breakForm.end_date,
                            break_type: breakForm.break_type
                        })
                )

                if (error) throw error
                toast.success('Break added')
            }

            fetchData()
            setBreakDialog(false)
            setEditingBreak(null)
            setBreakForm({ name: '', start_date: '', end_date: '', break_type: 'holiday' })
            localStorage.removeItem('student-hub:break-form-state')
        } catch (error) {
            console.error('Error saving break:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to save break')
        } finally {
            setSaving(false)
        }
    }

    const deleteBreak = async (id: string) => {
        try {
            const { error } = await withTimeout(
                supabase.from('semester_breaks').delete().eq('id', id)
            )
            if (error) throw error
            toast.success('Break deleted')
            fetchData()
        } catch (error) {
            console.error('Error deleting break:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to delete break')
        }
    }

    const openEditSemester = (semester: Semester) => {
        setEditingSemester(semester)
        setSemesterForm({
            name: semester.name,
            start_date: semester.start_date,
            end_date: semester.end_date
        })
        setSemesterDialog(true)
    }

    const openAddBreak = (semesterId: string) => {
        setSelectedSemesterForBreak(semesterId)
        setEditingBreak(null)
        setBreakForm({ name: '', start_date: '', end_date: '', break_type: 'holiday' })
        setBreakDialog(true)
    }

    const openEditBreak = (brk: SemesterBreak) => {
        setEditingBreak(brk)
        setSelectedSemesterForBreak(brk.semester_id)
        setBreakForm({
            name: brk.name,
            start_date: brk.start_date,
            end_date: brk.end_date,
            break_type: brk.break_type
        })
        setBreakDialog(true)
    }

    // Check if a date is today
    const isCurrentSemester = (semester: Semester) => {
        const today = new Date()
        return isWithinInterval(today, {
            start: parseISO(semester.start_date),
            end: parseISO(semester.end_date)
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <GraduationCap className="h-6 w-6 text-purple-500" />
                            Semester Settings
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Manage your academic semesters and breaks
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {semesters.length === 0 && (
                        <Button
                            onClick={() => setWizardOpen(true)}
                            variant="outline"
                            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-1.5"
                        >
                            <Sparkles className="h-4 w-4" />
                            Setup Wizard
                        </Button>
                    )}
                    <Button
                        onClick={() => {
                            setEditingSemester(null)
                            setSemesterForm({ name: '', start_date: '', end_date: '' })
                            setSemesterDialog(true)
                        }}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Semester
                    </Button>
                </div>
            </div>

            {/* Empty State */}
            {semesters.length === 0 ? (
                <Card className="glass-card">
                    <CardContent className="py-12">
                        <div className="text-center">
                            <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No semesters yet</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Create your first semester to organize your timetable and track attendance
                            </p>
                            <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
                                <Button
                                    onClick={() => setWizardOpen(true)}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold gap-1.5 shadow-lg shadow-purple-900/20 cursor-pointer"
                                >
                                    <Sparkles className="h-4 w-4 animate-pulse" />
                                    Quick Setup Wizard (Recommended)
                                </Button>
                                <Button
                                    onClick={() => {
                                        setEditingSemester(null)
                                        setSemesterForm({ name: '', start_date: '', end_date: '' })
                                        setSemesterDialog(true)
                                    }}
                                    variant="outline"
                                    className="border-white/10 text-gray-300 hover:bg-white/5 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Manual Setup
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {semesters.map((semester) => {
                        const semesterBreaks = breaks.filter(b => b.semester_id === semester.id)
                        const isCurrent = isCurrentSemester(semester)
                        const daysLeft = differenceInDays(parseISO(semester.end_date), new Date())

                        return (
                            <Card
                                key={semester.id}
                                className={cn(
                                    "glass-card transition-all",
                                    semester.is_active && "ring-2 ring-purple-500/50"
                                )}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                semester.is_active ? "bg-purple-500/20" : "bg-muted"
                                            )}>
                                                <Calendar className={cn(
                                                    "h-5 w-5",
                                                    semester.is_active ? "text-purple-400" : "text-muted-foreground"
                                                )} />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    {semester.name}
                                                    {semester.is_active && (
                                                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                                                            Active
                                                        </span>
                                                    )}
                                                    {isCurrent && !semester.is_active && (
                                                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                                                            Current
                                                        </span>
                                                    )}
                                                </CardTitle>
                                                <CardDescription>
                                                    {format(parseISO(semester.start_date), 'MMM d, yyyy')} — {format(parseISO(semester.end_date), 'MMM d, yyyy')}
                                                    {isCurrent && daysLeft > 0 && (
                                                        <span className="ml-2 text-emerald-400">• {daysLeft} days left</span>
                                                    )}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {!semester.is_active && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setActiveSemester(semester.id)}
                                                    className="text-muted-foreground hover:text-purple-400"
                                                >
                                                    Set Active
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditSemester(semester)}
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => deleteSemester(semester.id)}
                                                className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Breaks */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-muted-foreground">
                                                Breaks & Holidays
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openAddBreak(semester.id)}
                                                className="h-7 text-xs"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Break
                                            </Button>
                                        </div>

                                        {semesterBreaks.length === 0 ? (
                                            <p className="text-xs text-muted-foreground/60 py-2">
                                                No breaks added yet
                                            </p>
                                        ) : (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {semesterBreaks.map((brk) => {
                                                    const Icon = breakTypeIcons[brk.break_type]
                                                    return (
                                                        <div
                                                            key={brk.id}
                                                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30 group"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium truncate">{brk.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {format(parseISO(brk.start_date), 'MMM d')} - {format(parseISO(brk.end_date), 'MMM d')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => openEditBreak(brk)}
                                                                    className="h-6 w-6"
                                                                >
                                                                    <Edit2 className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => deleteBreak(brk.id)}
                                                                    className="h-6 w-6 hover:text-red-400"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Semester Dialog */}
            <Dialog open={semesterDialog} onOpenChange={(open) => {
                setSemesterDialog(open)
                if (!open) {
                    localStorage.removeItem('student-hub:semester-form-state')
                }
            }}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>{editingSemester ? 'Edit Semester' : 'Add Semester'}</DialogTitle>
                        <DialogDescription>
                            {editingSemester ? 'Update semester details' : 'Create a new semester to organize your schedule'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Program</Label>
                                <Select
                                    value={dialogProgramType}
                                    onValueChange={(val: 'btech' | 'int_mtech') => {
                                        setDialogProgramType(val)
                                        // Reset selected semester if it falls outside the range
                                        if (val === 'btech' && (semesterForm.name === 'Semester 9' || semesterForm.name === 'Semester 10')) {
                                            setSemesterForm(prev => ({ ...prev, name: '' }))
                                        }
                                    }}
                                >
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select program" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        <SelectItem value="btech">B.Tech (8 Semesters)</SelectItem>
                                        <SelectItem value="int_mtech">Integrated M.Tech (10 Semesters)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Semester Name</Label>
                                <Select
                                    value={semesterForm.name}
                                    onValueChange={(val) => setSemesterForm(prev => ({ ...prev, name: val }))}
                                >
                                    <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Select semester" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {semesterForm.name && !/^Semester \d+$/.test(semesterForm.name) && (
                                            <SelectItem value={semesterForm.name}>
                                                {semesterForm.name} (Custom)
                                            </SelectItem>
                                        )}
                                        {Array.from({ length: dialogProgramType === 'int_mtech' ? 10 : 8 }).map((_, i) => (
                                            <SelectItem key={i + 1} value={`Semester ${i + 1}`}>
                                                Semester {i + 1}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={semesterForm.start_date}
                                    onChange={(e) => setSemesterForm(prev => ({ ...prev, start_date: e.target.value }))}
                                    className="bg-input border-border"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={semesterForm.end_date}
                                    onChange={(e) => setSemesterForm(prev => ({ ...prev, end_date: e.target.value }))}
                                    className="bg-input border-border"
                                />
                            </div>
                        </div>
                        <Button onClick={saveSemester} disabled={saving} className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {editingSemester ? 'Update Semester' : 'Create Semester'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Break Dialog */}
            <Dialog open={breakDialog} onOpenChange={(open) => {
                setBreakDialog(open)
                if (!open) {
                    localStorage.removeItem('student-hub:break-form-state')
                }
            }}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>{editingBreak ? 'Edit Break' : 'Add Break'}</DialogTitle>
                        <DialogDescription>
                            Add holidays, exam periods, or breaks to this semester
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Break Name</Label>
                            <Input
                                value={breakForm.name}
                                onChange={(e) => setBreakForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Spring Break, Diwali Holiday"
                                className="bg-input border-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={breakForm.break_type}
                                onValueChange={(v) => setBreakForm(prev => ({ ...prev, break_type: v as SemesterBreak['break_type'] }))}
                            >
                                <SelectTrigger className="bg-input border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                    <SelectItem value="holiday">🌴 Holiday</SelectItem>
                                    <SelectItem value="exam_period">📚 Exam Period</SelectItem>
                                    <SelectItem value="break">☕ Break</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={breakForm.start_date}
                                    onChange={(e) => setBreakForm(prev => ({ ...prev, start_date: e.target.value }))}
                                    className="bg-input border-border"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={breakForm.end_date}
                                    onChange={(e) => setBreakForm(prev => ({ ...prev, end_date: e.target.value }))}
                                    className="bg-input border-border"
                                />
                            </div>
                        </div>
                        <Button onClick={saveBreak} disabled={saving} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 cursor-pointer">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {editingBreak ? 'Update Break' : 'Add Break'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <SemesterSetupWizard
                isOpen={wizardOpen}
                onOpenChange={setWizardOpen}
                onComplete={fetchData}
                userId={userId || ''}
            />
        </div>
    )
}
