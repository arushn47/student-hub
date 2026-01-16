'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Plus,
    GraduationCap,
    TrendingUp,
    Calculator,
    BarChart3,
    Trash2,
    Loader2,
    ChevronDown,
    ChevronUp,
    BookOpen,
    Pencil
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ImageUploadExtractor } from '@/components/ai/ImageUploadExtractor'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Course {
    id: string
    name: string
    credits: number
    grade: string
    semester: string
}

const gradePoints: Record<string, number> = {
    'S': 10.0,
    'A': 9.0,
    'B': 8.0,
    'C': 7.0,
    'D': 6.0,
    'E': 5.0,
    'F': 0.0,
    'P': 0.0, // Pass (Non-graded), excluded
}

const gradeColors: Record<string, string> = {
    'S': 'text-purple-400',
    'A': 'text-emerald-400',
    'B': 'text-emerald-500',
    'C': 'text-blue-400',
    'D': 'text-amber-400',
    'E': 'text-orange-400',
    'F': 'text-rose-400',
    'P': 'text-gray-400',
}

export default function GradesPage() {
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)
    const [newCourse, setNewCourse] = useState({ name: '', credits: 3, grade: 'S', semester: 'Semester 1' })
    const [showAddForm, setShowAddForm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingCourse, setEditingCourse] = useState<string | null>(null)
    const [targetCGPA, setTargetCGPA] = useState<number>(9.0)
    const [programCredits, setProgramCredits] = useState<number>(239) // User can adjust

    // State for collapsible semesters
    const [openSemesters, setOpenSemesters] = useState<Record<string, boolean>>({})

    const supabase = createClient()

    useEffect(() => {
        fetchCourses()
    }, [])

    const fetchCourses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCourses(data || [])

            // Auto-open the most recent semester
            if (data && data.length > 0) {
                const recentSem = data[0].semester || 'Semester 1'
                setOpenSemesters({ [recentSem]: true })
            }
        } catch (error) {
            console.error('Error fetching courses:', error)
            toast.error('Failed to load courses')
        } finally {
            setLoading(false)
        }
    }

    const calculateGPA = (courseList: Course[]): string => {
        if (courseList.length === 0) return '0.00'

        let totalPoints = 0
        let totalCredits = 0

        courseList.forEach(course => {
            if (course.grade === 'P') return

            const points = gradePoints[course.grade] ?? 0
            totalPoints += points * course.credits
            totalCredits += course.credits
        })

        return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00'
    }

    // Group courses by semester
    const coursesBySemester = useMemo(() => {
        const groups: Record<string, Course[]> = {}
        courses.forEach(c => {
            const sem = c.semester || 'Unknown Semester'
            if (!groups[sem]) groups[sem] = []
            groups[sem].push(c)
        })
        return groups
    }, [courses])

    const sortedSemesters = Object.keys(coursesBySemester).sort()
    // Ideally sort by time/number? String sort for now. "Semester 1", "Semester 2"... works ok.

    const cgpa = calculateGPA(courses)
    const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0)

    const addCourse = async () => {
        if (!newCourse.name) return

        try {
            setIsSubmitting(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('You must be logged in')
                return
            }

            const { data, error } = await supabase
                .from('courses')
                .insert({
                    user_id: user.id,
                    name: newCourse.name,
                    credits: newCourse.credits,
                    grade: newCourse.grade,
                    semester: newCourse.semester
                })
                .select()
                .single()

            if (error) throw error

            setCourses([data, ...courses])
            setNewCourse(prev => ({ ...prev, name: '' })) // Keep credits/grade/semester for speed
            // Don't close form, allow rapid entry
            toast.success('Course added')
        } catch (error) {
            console.error('Error adding course:', error)
            toast.error('Failed to add course')
        } finally {
            setIsSubmitting(false)
        }
    }

    const removeCourse = async (id: string) => {
        try {
            const { error } = await supabase.from('courses').delete().eq('id', id)
            if (error) throw error
            setCourses(courses.filter((c) => c.id !== id))
            toast.success('Course removed')
        } catch (error) {
            toast.error('Failed to remove course')
        }
    }

    const updateCourseSemester = async (id: string, newSemester: string) => {
        try {
            const { error } = await supabase
                .from('courses')
                .update({ semester: newSemester })
                .eq('id', id)

            if (error) throw error

            setCourses(courses.map(c =>
                c.id === id ? { ...c, semester: newSemester } : c
            ))
            setEditingCourse(null)
            toast.success('Semester updated')
        } catch (error) {
            toast.error('Failed to update semester')
        }
    }

    // Bulk rename all courses in a semester
    const renameSemester = async (oldSemester: string, newSemester: string) => {
        if (oldSemester === newSemester) return

        try {
            const coursesToUpdate = courses.filter(c => c.semester === oldSemester)
            const courseIds = coursesToUpdate.map(c => c.id)

            const { error } = await supabase
                .from('courses')
                .update({ semester: newSemester })
                .in('id', courseIds)

            if (error) throw error

            setCourses(courses.map(c =>
                c.semester === oldSemester ? { ...c, semester: newSemester } : c
            ))

            // Update open semesters state
            setOpenSemesters(prev => {
                const newState = { ...prev }
                if (oldSemester in newState) {
                    newState[newSemester] = newState[oldSemester]
                    delete newState[oldSemester]
                }
                return newState
            })

            toast.success(`Renamed "${oldSemester}" to "${newSemester}"`)
        } catch (error) {
            toast.error('Failed to rename semester')
        }
    }

    // Clear all courses
    const clearAllCourses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('courses')
                .delete()
                .eq('user_id', user.id)

            if (error) throw error

            setCourses([])
            setOpenSemesters({})
            toast.success('All courses cleared')
        } catch (error) {
            toast.error('Failed to clear courses')
        }
    }

    // CGPA Future Calculator
    const CREDITS_PER_SEMESTER = 24 // Approximate

    // Calculate future CGPA scenarios
    const cgpaAnalysis = useMemo(() => {
        const currentCredits = totalCredits
        const currentCGPA = parseFloat(cgpa) || 0
        const remainingCredits = Math.max(0, programCredits - currentCredits)
        const remainingSemesters = Math.ceil(remainingCredits / CREDITS_PER_SEMESTER)
        const currentPoints = currentCGPA * currentCredits

        // What if scenarios - if you get all X grade from now
        const whatIf = (gradeGPA: number) => {
            if (remainingCredits <= 0) return currentCGPA.toFixed(2)
            const futurePoints = currentPoints + (gradeGPA * remainingCredits)
            return (futurePoints / programCredits).toFixed(2)
        }

        // Calculate required GPA to reach target
        const requiredForTarget = (targetCGPA: number) => {
            if (remainingCredits <= 0) return { achievable: true, gpa: 0, alreadyDone: true }
            const targetPoints = targetCGPA * programCredits
            const neededPoints = targetPoints - currentPoints
            const neededGPA = neededPoints / remainingCredits

            if (neededGPA > 10) return { achievable: false, gpa: neededGPA }
            if (neededGPA <= 0) return { achievable: true, gpa: 0, alreadyDone: true }
            return { achievable: true, gpa: neededGPA }
        }

        // What grade combination to reach target
        const gradeBreakdown = (targetCGPA: number) => {
            const req = requiredForTarget(targetCGPA)
            if (!req.achievable) return null
            if (req.alreadyDone) return { message: "Already on track! Just pass." }

            const gpa = req.gpa
            // Calculate mix of grades needed
            if (gpa >= 9.5) return { allS: true, message: "Need mostly S grades" }
            if (gpa >= 8.5) return { mix: "S/A", message: "Mix of S and A grades" }
            if (gpa >= 7.5) return { mix: "A/B", message: "Mix of A and B grades" }
            if (gpa >= 6.5) return { mix: "B/C", message: "Mix of B and C grades" }
            return { mix: "C/D", message: "C grades or better will do it" }
        }

        return {
            remainingCredits,
            remainingSemesters,
            maxPossible: whatIf(10),    // All S
            ifAllA: whatIf(9),          // All A
            ifAllB: whatIf(8),          // All B
            requiredForTarget,
            gradeBreakdown,
        }
    }, [cgpa, totalCredits, programCredits])

    const getGPAColor = (gpa: number) => {
        if (gpa >= 9.0) return 'text-purple-400'
        if (gpa >= 8.0) return 'text-emerald-400'
        if (gpa >= 7.0) return 'text-blue-400'
        if (gpa >= 6.0) return 'text-amber-400'
        if (gpa >= 5.0) return 'text-orange-400'
        return 'text-rose-400'
    }

    const toggleSemester = (sem: string) => {
        setOpenSemesters(prev => ({ ...prev, [sem]: !prev[sem] }))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">CGPA Calculator</h1>
                    <p className="text-gray-400 mt-1">Track your academic performance across semesters</p>
                </div>
                <div className="flex gap-2">
                    <ImageUploadExtractor
                        type="grades"
                        title="Extract Grades (PDF Support)"
                        description="Upload your result slip or transcript."
                        onExtract={async (data) => {
                            if (data.courses && Array.isArray(data.courses)) {
                                try {
                                    const { data: { user } } = await supabase.auth.getUser()
                                    if (!user) return

                                    // Get existing course names for duplicate detection
                                    const existingNames = new Set(courses.map(c => c.name.toLowerCase().trim()))

                                    // Pre-process courses with default semester if missing
                                    const allCourses = data.courses.map((c: any) => {
                                        let grade = c.grade?.toUpperCase() || 'A'
                                        if (grade === 'O') grade = 'S' // Normalize
                                        if (grade === 'A+') grade = 'A' // Normalize

                                        const validGrades = Object.keys(gradePoints)
                                        if (!validGrades.includes(grade)) {
                                            if (grade.includes('A')) grade = 'A'
                                            else if (grade.includes('B')) grade = 'B'
                                            else grade = 'A' // Default
                                        }

                                        return {
                                            user_id: user.id,
                                            name: c.name || 'Unknown Course',
                                            credits: c.credits || 3,
                                            grade: grade,
                                            semester: c.semester || 'Imported'
                                        }
                                    })

                                    // Filter out duplicates (silently skip)
                                    const coursesToInsert = allCourses.filter(
                                        (c: any) => !existingNames.has(c.name.toLowerCase().trim())
                                    )
                                    const duplicatesSkipped = allCourses.length - coursesToInsert.length

                                    if (coursesToInsert.length === 0) {
                                        toast.info('All courses already exist, nothing to import')
                                        return
                                    }

                                    const { data: inserted, error } = await supabase
                                        .from('courses')
                                        .insert(coursesToInsert)
                                        .select()

                                    if (error) throw error

                                    if (inserted) {
                                        setCourses(prev => [...inserted, ...prev])
                                        const msg = duplicatesSkipped > 0
                                            ? `Imported ${inserted.length} courses (${duplicatesSkipped} duplicates skipped)`
                                            : `Imported ${inserted.length} courses`
                                        toast.success(msg)
                                    }
                                } catch (e: any) {
                                    toast.error(`Import failed: ${e.message}`)
                                }
                            }
                        }}
                    />
                    <Button
                        onClick={() => setShowAddForm(true)}
                        className="gradient-primary text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Course
                    </Button>
                    {courses.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="gap-2 text-red-400 border-red-400/30 hover:bg-red-500/10">
                                    <Trash2 className="h-4 w-4" />
                                    Clear All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear All Courses</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete ALL {courses.length} courses? This will reset your CGPA calculator completely.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={clearAllCourses}
                                        className="bg-red-500 hover:bg-red-600 text-white"
                                    >
                                        Delete All
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {/* Help Note */}
            <div className="text-sm text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
                <span className="text-blue-400">💡</span>
                <span>
                    <strong>Tip:</strong> When importing from grade history PDF, duplicates are auto-skipped. No need to clear existing courses!
                </span>
            </div>

            {/* CGPA Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card border-white/[0.06] md:col-span-2">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                                <GraduationCap className="h-10 w-10 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Cumulative GPA (CGPA)</p>
                                <p className={cn("text-5xl font-bold", getGPAColor(parseFloat(cgpa)))}>
                                    {cgpa}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">out of 10.0</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-2xl font-bold text-white">{totalCredits}</p>
                                <p className="text-sm text-gray-400">Total Credits</p>
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(parseFloat(cgpa) / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/[0.06]">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <div className="text-center">
                            <BookOpen className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
                            <p className="text-xl font-bold text-foreground">{sortedSemesters.length}</p>
                            <p className="text-sm text-muted-foreground">Semesters</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* CGPA Future Planner */}
            {totalCredits > 0 && cgpaAnalysis.remainingCredits > 0 && (
                <Card className="glass-card border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-foreground flex items-center gap-2 flex-wrap">
                            <TrendingUp className="h-5 w-5 text-purple-400" />
                            Your CGPA Future
                            <span className="text-xs font-normal text-muted-foreground">
                                ({cgpaAnalysis.remainingCredits} of
                                <Input
                                    type="number"
                                    value={programCredits}
                                    onChange={(e) => setProgramCredits(Math.max(totalCredits, parseInt(e.target.value) || 0))}
                                    className="w-16 h-6 text-xs mx-1 px-2 bg-background border-border inline-block"
                                    min={totalCredits}
                                />
                                total credits left • ~{cgpaAnalysis.remainingSemesters} sems)
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* What-if Scenarios */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">If you get all S grades</p>
                                <p className="text-2xl font-bold text-purple-400">{cgpaAnalysis.maxPossible}</p>
                                <p className="text-xs text-muted-foreground">Max possible</p>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">If you get all A grades</p>
                                <p className="text-2xl font-bold text-green-400">{cgpaAnalysis.ifAllA}</p>
                                <p className="text-xs text-muted-foreground">Realistic target</p>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">If you get all B grades</p>
                                <p className="text-2xl font-bold text-blue-400">{cgpaAnalysis.ifAllB}</p>
                                <p className="text-xs text-muted-foreground">Safe estimate</p>
                            </div>
                        </div>

                        {/* Target Input */}
                        <div className="border-t border-border pt-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-muted-foreground">I want to finish with</span>
                                <Select
                                    value={targetCGPA.toString()}
                                    onValueChange={(v) => setTargetCGPA(parseFloat(v))}
                                >
                                    <SelectTrigger className="w-24 bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {[7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map((v) => (
                                            <SelectItem key={v} value={v.toString()}>{v.toFixed(1)} CGPA</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-muted-foreground">→</span>
                                {(() => {
                                    const req = cgpaAnalysis.requiredForTarget(targetCGPA)
                                    const breakdown = cgpaAnalysis.gradeBreakdown(targetCGPA)

                                    if (!req.achievable) {
                                        return (
                                            <span className="text-red-400 font-medium">
                                                ❌ Not possible (would need {req.gpa.toFixed(1)}/10)
                                            </span>
                                        )
                                    }
                                    if (req.alreadyDone) {
                                        return (
                                            <span className="text-green-400 font-medium">
                                                ✅ Already on track! Just pass your remaining courses.
                                            </span>
                                        )
                                    }
                                    return (
                                        <span className="text-foreground">
                                            Need <strong className="text-purple-400">{req.gpa.toFixed(1)}</strong> avg in remaining credits
                                            {breakdown && <span className="text-muted-foreground ml-2">({breakdown.message})</span>}
                                        </span>
                                    )
                                })()}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Add Course Form */}
            {showAddForm && (
                <Card className="glass-card border-violet-500/30 bg-violet-500/5">
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Add New Course</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <Label className="text-gray-400">Course Name</Label>
                                <Input
                                    placeholder="e.g., Data Structures"
                                    value={newCourse.name}
                                    onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                                    className="bg-white/5 border-white/10 text-white mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-gray-400">Semester</Label>
                                <Select
                                    value={newCourse.semester}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, semester: value })}
                                >
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white mt-1">
                                        <SelectValue placeholder="Select semester" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/10">
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <SelectItem key={n} value={`Semester ${n}`} className="text-white hover:bg-white/10">
                                                Semester {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-gray-400">Credits</Label>
                                <Select
                                    value={newCourse.credits.toString()}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, credits: parseInt(value) })}
                                >
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white mt-1">
                                        <SelectValue placeholder="Credits" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/10">
                                        {[1, 2, 3, 4, 5, 6].map((n) => (
                                            <SelectItem key={n} value={n.toString()} className="text-white hover:bg-white/10">
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                            <div>
                                <Label className="text-gray-400">Grade</Label>
                                <Select
                                    value={newCourse.grade}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, grade: value })}
                                >
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white mt-1">
                                        <SelectValue placeholder="Grade" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/10">
                                        {Object.keys(gradePoints).map((g) => (
                                            <SelectItem key={g} value={g} className="text-white hover:bg-white/10">
                                                {g}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-3 flex items-end justify-end gap-2">
                                <Button variant="ghost" onClick={() => setShowAddForm(false)} className="text-gray-400">
                                    Done
                                </Button>
                                <Button onClick={addCourse} className="gradient-primary text-white space-x-2" disabled={isSubmitting}>
                                    <Plus className="h-4 w-4" />
                                    <span>Add</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Semester Lists (SGPA) */}
            <div className="space-y-6">
                {sortedSemesters.length === 0 && !showAddForm && (
                    <div className="text-center py-12 text-gray-500">
                        <p>No grade history found. Add a course or upload a transcript!</p>
                    </div>
                )}

                {sortedSemesters.map(sem => {
                    const semCourses = coursesBySemester[sem]
                    const sgpa = calculateGPA(semCourses)
                    const isOpen = openSemesters[sem]

                    return (
                        <Collapsible
                            key={sem}
                            open={isOpen}
                            onOpenChange={() => toggleSemester(sem)}
                            className="bg-card/50 border border-border rounded-xl overflow-hidden"
                        >
                            <div className="p-4 flex items-center justify-between bg-muted/30">
                                <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    <h3 className="text-lg font-semibold text-foreground">{sem}</h3>
                                </CollapsibleTrigger>
                                <div className="flex items-center gap-4">
                                    {/* Rename semester dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-popover border-border">
                                            <div className="px-2 py-1.5 text-xs text-muted-foreground">Rename to:</div>
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                                <DropdownMenuItem
                                                    key={n}
                                                    onClick={() => renameSemester(sem, `Semester ${n}`)}
                                                    className={cn(
                                                        "cursor-pointer",
                                                        sem === `Semester ${n}` && "bg-violet-500/20 text-violet-400"
                                                    )}
                                                >
                                                    Semester {n}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <div className="text-right">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">SGPA</span>
                                        <p className={cn("text-xl font-bold", getGPAColor(parseFloat(sgpa)))}>
                                            {sgpa}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <CollapsibleContent>
                                <div className="space-y-1 p-2">
                                    {/* Header */}
                                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-500 uppercase rounded-t-lg bg-white/[0.01]">
                                        <div className="col-span-6">Course</div>
                                        <div className="col-span-2 text-center">Credits</div>
                                        <div className="col-span-2 text-center">Grade</div>
                                        <div className="col-span-2 text-right"></div>
                                    </div>

                                    {semCourses.map((course) => (
                                        <div
                                            key={course.id}
                                            className="grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-lg hover:bg-white/[0.04] transition-colors group"
                                        >
                                            <div className="col-span-6 font-medium text-white/90 truncate">{course.name}</div>
                                            <div className="col-span-2 text-center text-gray-400">{course.credits}</div>
                                            <div className={cn("col-span-2 text-center font-bold", gradeColors[course.grade])}>
                                                {course.grade}
                                            </div>
                                            <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="bg-popover border-border">
                                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                                            <DropdownMenuItem
                                                                key={n}
                                                                onClick={() => updateCourseSemester(course.id, `Semester ${n}`)}
                                                                className={cn(
                                                                    "cursor-pointer",
                                                                    course.semester === `Semester ${n}` && "bg-violet-500/20 text-violet-400"
                                                                )}
                                                            >
                                                                Semester {n}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-card border-border">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Course</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete "{course.name}"? This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => removeCourse(course.id)}
                                                                className="bg-red-500 hover:bg-red-600 text-white"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )
                })}
            </div>

            {/* GPA Scale Reference */}
            <Card className="glass-card border-white/[0.06]">
                <CardHeader>
                    <CardTitle className="text-sm text-gray-400">GPA Scale Reference</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(gradePoints).map(([grade, points]) => (
                            <div
                                key={grade}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm border",
                                    gradeColors[grade] || "text-gray-400 border-gray-500/30",
                                    grade === 'S' && "bg-purple-500/10 border-purple-500/30",
                                    grade === 'A' && "bg-emerald-500/10 border-emerald-500/30",
                                    grade === 'B' && "bg-emerald-500/10 border-emerald-500/30",
                                    grade === 'C' && "bg-blue-500/10 border-blue-500/30",
                                    grade === 'D' && "bg-amber-500/10 border-amber-500/30",
                                    grade === 'E' && "bg-orange-500/10 border-orange-500/30",
                                    grade === 'F' && "bg-rose-500/10 border-rose-500/30",
                                    grade === 'P' && "bg-gray-500/10 border-gray-500/30",
                                )}
                            >
                                <span className="font-semibold">{grade}</span>
                                <span className="ml-1 text-gray-400">
                                    {grade === 'P' ? '(Pass)' : `= ${points.toFixed(1)}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
