'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    GraduationCap,
    Sparkles,
    ChevronRight,
    ChevronLeft,
    Check,
    Loader2,
    CalendarDays,
    Rocket
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { generateProgramSemesters, GeneratedSemester } from '@/lib/semester-utils'
import { withTimeout } from '@/lib/network-utils'

interface SemesterSetupWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onComplete: () => void
    userId: string
}

type ProgramType = 'btech' | 'int_mtech'

interface ProgramPreset {
    id: ProgramType
    name: string
    semesters: number
    duration: string
    icon: React.ComponentType<{ className?: string }>
    description: string
    gradient: string
    borderActive: string
}

const presets: ProgramPreset[] = [
    {
        id: 'btech',
        name: 'B.Tech / B.E.',
        semesters: 8,
        duration: '4 Years',
        icon: GraduationCap,
        description: '8 Semesters across 4 years',
        gradient: 'from-blue-500/20 to-indigo-600/20',
        borderActive: 'border-indigo-500/40 ring-2 ring-indigo-500/30',
    },
    {
        id: 'int_mtech',
        name: 'Integrated M.Tech',
        semesters: 10,
        duration: '5 Years',
        icon: Rocket,
        description: '10 Semesters across 5 years',
        gradient: 'from-purple-500/20 to-pink-600/20',
        borderActive: 'border-pink-500/40 ring-2 ring-pink-500/30',
    },
]

export function SemesterSetupWizard({
    isOpen,
    onOpenChange,
    onComplete,
    userId,
}: SemesterSetupWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [programType, setProgramType] = useState<ProgramType>('btech')
    const [currentSem, setCurrentSem] = useState<number>(1)
    const [startDate, setStartDate] = useState<string>('')
    const [generatedSemesters, setGeneratedSemesters] = useState<GeneratedSemester[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [hasSavedState, setHasSavedState] = useState<boolean>(false)

    // Load from localStorage or initialize on mount/open
    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('student-hub:semester-setup-wizard-state')
            if (saved) {
                try {
                    const parsed = JSON.parse(saved)
                    setProgramType(parsed.programType || 'btech')
                    setCurrentSem(parsed.currentSem || 1)
                    setStartDate(parsed.startDate || '')
                    setGeneratedSemesters(parsed.generatedSemesters || [])
                    setStep(parsed.step || 1)
                    setHasSavedState(true)
                    return // Skip default initialization
                } catch (e) {
                    console.error('Error loading wizard state:', e)
                }
            }

            // Default initialization if no saved state
            setStep(1)
            setProgramType('btech')
            setCurrentSem(1)
            setStartDate(new Date().toISOString().split('T')[0])
            setGeneratedSemesters([])
            setHasSavedState(false)
        }
    }, [isOpen])

    // Save wizard state to localStorage in real-time
    useEffect(() => {
        if (isOpen) {
            const state = {
                programType,
                currentSem,
                startDate,
                generatedSemesters,
                step,
            }
            localStorage.setItem('student-hub:semester-setup-wizard-state', JSON.stringify(state))
            setHasSavedState(true)
        }
    }, [programType, currentSem, startDate, generatedSemesters, step, isOpen])

    const totalSemesters = useMemo(() => {
        const preset = presets.find(p => p.id === programType)
        return preset ? preset.semesters : 8
    }, [programType])

    // Keep currentSem in bounds
    useEffect(() => {
        if (currentSem > totalSemesters) {
            setCurrentSem(1)
        }
    }, [totalSemesters, currentSem])

    const validationError = useMemo(() => {
        if (step !== 3 || generatedSemesters.length === 0) return null

        for (let i = 0; i < generatedSemesters.length; i++) {
            const current = generatedSemesters[i]
            if (!current.start_date || !current.end_date) {
                return `Dates cannot be empty for ${current.name}`
            }
            const start = new Date(current.start_date)
            const end = new Date(current.end_date)

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return `Invalid date format in ${current.name}`
            }

            if (start >= end) {
                return `${current.name} start date must be before its end date.`
            }

            if (i > 0) {
                const prev = generatedSemesters[i - 1]
                const prevEnd = new Date(prev.end_date)
                if (start <= prevEnd) {
                    return `${current.name} starts before or during ${prev.name}. Please ensure semesters do not overlap.`
                }
            }
        }
        return null
    }, [generatedSemesters, step])

    const getSemesterError = (index: number) => {
        const current = generatedSemesters[index]
        if (!current.start_date || !current.end_date) return true
        const start = new Date(current.start_date)
        const end = new Date(current.end_date)
        if (start >= end) return true
        if (index > 0) {
            const prev = generatedSemesters[index - 1]
            const prevEnd = new Date(prev.end_date)
            if (start <= prevEnd) return true
        }
        return false
    }

    const handleNextToStep2 = () => {
        setStep(2)
    }

    const handleNextToStep3 = () => {
        if (!startDate) {
            toast.error('Please select a start date')
            return
        }

        try {
            const semesters = generateProgramSemesters(totalSemesters, currentSem, startDate)
            setGeneratedSemesters(semesters)
            setStep(3)
        } catch {
            toast.error('Invalid date format')
        }
    }

    const updateSemesterDate = (index: number, field: 'start_date' | 'end_date', value: string) => {
        setGeneratedSemesters(prev => prev.map((sem, i) => {
            if (i === index) {
                return { ...sem, [field]: value }
            }
            return sem
        }))
    }

    const handleSubmit = async () => {
        if (validationError) {
            toast.error(validationError)
            return
        }
        setLoading(true)
        try {
            // 1. Fetch all existing semester IDs for this user to clear them and prevent constraints / duplicates / hanging
            const { data: existingSems, error: fetchSemsError } = await withTimeout(
                supabase
                    .from('semesters')
                    .select('id')
                    .eq('user_id', userId)
            )
            
            if (fetchSemsError) throw fetchSemsError
            const existingSemIds = existingSems?.map((s: { id: string }) => s.id) || []

            if (existingSemIds.length > 0) {
                // Fetch associated class schedules to clean up their attendance records
                const { data: schedules, error: fetchSchedulesError } = await withTimeout(
                    supabase
                        .from('class_schedules')
                        .select('id')
                        .in('semester_id', existingSemIds)
                )
                
                if (fetchSchedulesError) throw fetchSchedulesError
                const scheduleIds = schedules?.map((s: { id: string }) => s.id) || []

                // Delete attendance records associated with these semesters
                const { error: delAttendance1 } = await withTimeout(
                    supabase
                        .from('attendance_records')
                        .delete()
                        .in('semester_id', existingSemIds)
                )
                if (delAttendance1) throw delAttendance1

                // Delete attendance records associated with these schedules
                if (scheduleIds.length > 0) {
                    const { error: delAttendance2 } = await withTimeout(
                        supabase
                            .from('attendance_records')
                            .delete()
                            .in('class_schedule_id', scheduleIds)
                    )
                    if (delAttendance2) throw delAttendance2
                }

                // Delete class schedules
                const { error: delSchedules } = await withTimeout(
                    supabase
                        .from('class_schedules')
                        .delete()
                        .in('semester_id', existingSemIds)
                )
                if (delSchedules) throw delSchedules

                // Delete breaks
                const { error: delBreaks } = await withTimeout(
                    supabase
                        .from('semester_breaks')
                        .delete()
                        .in('semester_id', existingSemIds)
                )
                if (delBreaks) throw delBreaks

                // Delete the semesters themselves
                const { error: delSemesters } = await withTimeout(
                    supabase
                        .from('semesters')
                        .delete()
                        .in('id', existingSemIds)
                )
                if (delSemesters) throw delSemesters
            }

            // 2. Insert the new generated semesters
            const semestersToInsert = generatedSemesters.map(sem => ({
                user_id: userId,
                name: sem.name,
                start_date: sem.start_date,
                end_date: sem.end_date,
                is_active: sem.is_active,
            }))

            const { error: insertError } = await withTimeout(
                supabase
                    .from('semesters')
                    .insert(semestersToInsert)
            )

            if (insertError) throw insertError

            // Clear the localStorage saved state on successful submission
            localStorage.removeItem('student-hub:semester-setup-wizard-state')
            setHasSavedState(false)

            toast.success(`Successfully configured ${generatedSemesters.length} semesters!`)
            onComplete()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Error saving semesters:', error)
            toast.error(error?.message || 'Failed to configure semesters. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const selectedPreset = presets.find(p => p.id === programType)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg overflow-hidden flex flex-col max-h-[85vh] p-0 shadow-2xl gap-0">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5 shrink-0">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        Semester Setup Wizard
                    </DialogTitle>
                    <DialogDescription className="text-gray-400 text-sm">
                        Configure your entire academic program in seconds.
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Steps */}
                <div className="flex items-center gap-1 px-6 py-3 bg-white/[0.02] border-b border-white/5 shrink-0">
                    {[
                        { num: 1, label: 'Program' },
                        { num: 2, label: 'Date' },
                        { num: 3, label: 'Review' },
                    ].map((s, i) => (
                        <div key={s.num} className="flex items-center flex-1">
                            <div className={cn(
                                "flex items-center gap-1.5 flex-1 justify-center py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
                                step === s.num
                                    ? "text-purple-300 bg-purple-500/15"
                                    : step > s.num
                                        ? "text-emerald-400"
                                        : "text-gray-500"
                            )}>
                                <span className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border transition-all",
                                    step === s.num
                                        ? "border-purple-400 bg-purple-500/20 text-purple-300"
                                        : step > s.num
                                            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                                            : "border-gray-600 text-gray-500"
                                )}>
                                    {step > s.num ? <Check className="h-3 w-3" /> : s.num}
                                </span>
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                            {i < 2 && <ChevronRight className="h-3 w-3 text-gray-600 shrink-0 mx-1" />}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0 space-y-4">

                    {/* STEP 1: Program Preset + Current Semester */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-300">Select your degree program:</Label>
                                <div className="grid grid-cols-1 gap-3">
                                    {presets.map((preset) => {
                                        const Icon = preset.icon
                                        const isSelected = programType === preset.id
                                        return (
                                            <button
                                                key={preset.id}
                                                onClick={() => setProgramType(preset.id)}
                                                className={cn(
                                                    "flex items-center gap-4 p-4 rounded-2xl text-left border transition-all cursor-pointer",
                                                    isSelected
                                                        ? `bg-gradient-to-br ${preset.gradient} ${preset.borderActive}`
                                                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] text-gray-300"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-2.5 rounded-xl shrink-0",
                                                    isSelected ? "bg-white/10" : "bg-white/5"
                                                )}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-[15px] text-white">{preset.name}</h4>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {preset.description}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full bg-purple-500/30 border border-purple-400/50 flex items-center justify-center shrink-0">
                                                        <Check className="h-3 w-3 text-purple-300" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Current Semester Selector */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-300">Which semester are you currently in?</Label>
                                <Select
                                    value={currentSem.toString()}
                                    onValueChange={(val) => setCurrentSem(parseInt(val))}
                                >
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white rounded-xl h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                                        {Array.from({ length: totalSemesters }, (_, i) => i + 1).map((sem) => (
                                            <SelectItem key={sem} value={sem.toString()}>
                                                Semester {sem}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Current Semester Start Date */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex gap-3">
                                <CalendarDays className="h-5 w-5 shrink-0 text-purple-400 mt-0.5" />
                                <div className="text-xs space-y-1">
                                    <p className="font-semibold text-white text-sm">Date Projection</p>
                                    <p className="text-purple-300/80 leading-relaxed">
                                        Enter the start date for your <span className="font-semibold text-white">Semester {currentSem}</span>.
                                        We&apos;ll auto-calculate dates for all {totalSemesters} semesters of your {selectedPreset?.name} program.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-300">
                                    When does Semester {currentSem} start?
                                </Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white rounded-xl h-11 px-4 text-sm font-medium tracking-wide focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Review Generated Semesters */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-gray-300">Review semester dates:</Label>
                                <div className="flex items-center gap-2">
                                    {hasSavedState && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm('Discard your saved progress and start fresh?')) {
                                                    localStorage.removeItem('student-hub:semester-setup-wizard-state')
                                                    setStep(1)
                                                    setProgramType('btech')
                                                    setCurrentSem(1)
                                                    setStartDate(new Date().toISOString().split('T')[0])
                                                    setGeneratedSemesters([])
                                                    setHasSavedState(false)
                                                }
                                            }}
                                            className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 transition-all cursor-pointer hover:bg-red-500/20"
                                        >
                                            Discard & Reset
                                        </button>
                                    )}
                                    <span className="text-[10px] text-purple-400 font-medium px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                                        {totalSemesters} semesters
                                    </span>
                                </div>
                            </div>

                            {validationError && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                                    {validationError}
                                </div>
                            )}

                            <div className="space-y-2.5">
                                {generatedSemesters.map((sem, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "p-3 rounded-xl border transition-all",
                                            sem.is_active
                                                ? "border-purple-500/40 bg-purple-500/[0.06] shadow-sm shadow-purple-900/20"
                                                : "border-white/5 bg-white/[0.02]",
                                            getSemesterError(index) && "border-red-500/30 bg-red-500/[0.03]"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    sem.is_active ? "bg-purple-400" : "bg-gray-600"
                                                )} />
                                                <h5 className="font-semibold text-sm text-white">
                                                    {sem.name}
                                                </h5>
                                                {sem.is_active && (
                                                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-500">
                                                {(index + 1) % 2 !== 0 ? 'Aug–Dec' : 'Jan–May'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <Input
                                                type="date"
                                                value={sem.start_date}
                                                onChange={(e) => updateSemesterDate(index, 'start_date', e.target.value)}
                                                className="bg-white/5 border-white/5 text-white h-8 text-[11px] rounded-lg flex-1"
                                            />
                                            <span className="text-gray-600 shrink-0">→</span>
                                            <Input
                                                type="date"
                                                value={sem.end_date}
                                                onChange={(e) => updateSemesterDate(index, 'end_date', e.target.value)}
                                                className="bg-white/5 border-white/5 text-white h-8 text-[11px] rounded-lg flex-1"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between shrink-0 bg-gray-900/80">
                    <div className="flex items-center gap-2">
                        {step > 1 && (
                            <Button
                                variant="ghost"
                                onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
                                className="text-gray-400 hover:text-white rounded-xl px-4 cursor-pointer"
                                disabled={loading}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="text-gray-400 hover:text-white rounded-xl px-4 cursor-pointer"
                            disabled={loading}
                        >
                            Cancel
                        </Button>

                        {step < 3 ? (
                            <Button
                                onClick={step === 1 ? handleNextToStep2 : handleNextToStep3}
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl px-5 flex items-center cursor-pointer shadow-lg shadow-purple-900/20"
                            >
                                Continue
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                disabled={loading || !!validationError}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl px-6 flex items-center cursor-pointer shadow-lg shadow-pink-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Generate Semesters
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
