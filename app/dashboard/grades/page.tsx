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
    Trash2,
    Loader2,
    ChevronDown,
    ChevronUp,
    BookOpen,
    Pencil,
    Sparkles
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

interface Course {
    id: string
    name: string
    credits: number
    grade: string
    semester: string
    category?: string // Curriculum category for auto-calculation
}

interface CurriculumCategory {
    id: string
    name: string
    required: number
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
    const supabase = createClient()
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)
    const [newCourse, setNewCourse] = useState({ name: '', credits: 3, grade: 'S', semester: 'Semester 1', category: 'none' })
    const [showAddForm, setShowAddForm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [targetCGPA, setTargetCGPA] = useState<string>('9.0')
    const [programCredits, setProgramCredits] = useState<number>(169) // Total program credits

    // State for collapsible semesters
    const [openSemesters, setOpenSemesters] = useState<Record<string, boolean>>({})

    // State for editing a course
    const [editingCourse, setEditingCourse] = useState<Course | null>(null)
    const [editForm, setEditForm] = useState({ name: '', credits: 3, grade: 'S', semester: 'Semester 1', category: 'none' })

    // Curriculum distribution tracking
    const defaultCurriculum: CurriculumCategory[] = [
        { id: '1', name: 'Programme Core', required: 55 },
        { id: '2', name: 'Programme Elective', required: 15 },
        { id: '3', name: 'University Core - Natural Science', required: 23 },
        { id: '4', name: 'University Core - Engineering Sciences', required: 12 },
        { id: '5', name: 'University Core - Skill Development', required: 14 },
        { id: '6', name: 'University Core - Humanities & Social Science', required: 6 },
        { id: '7', name: 'University Core - Project & Internships', required: 17 },
        { id: '8', name: 'University Elective - Natural Science', required: 6 },
        { id: '9', name: 'University Elective - Multidisciplinary', required: 3 },
        { id: '10', name: 'University Elective - Humanities & Social', required: 3 },
        { id: '11', name: 'University Elective - Open Electives', required: 6 },
        { id: '12', name: 'Non-Graded Mandatory Courses', required: 9 },
    ]
    const [curriculum, setCurriculum] = useState<CurriculumCategory[]>(defaultCurriculum)
    const [showCurriculum, setShowCurriculum] = useState(false)

    // Grade Improvement Advisor state
    // 'improvementLimit' is removed as usage is manual now.
    const [selectedImprovementIds, setSelectedImprovementIds] = useState<string[]>([])
    const [courseTargetGrades, setCourseTargetGrades] = useState<Record<string, string>>({})
    const [showImprovementAdvisor, setShowImprovementAdvisor] = useState(false)
    const [courseDifficulties, setCourseDifficulties] = useState<Record<string, string>>({})
    const [loadingDifficulties, setLoadingDifficulties] = useState(false)

    // Helper to get target for a course (default S)
    const getTarget = (courseId: string) => courseTargetGrades[courseId] || 'S'

    // Load curriculum from DB
    useEffect(() => {
        const fetchCurriculum = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data, error } = await supabase
                    .from('degree_requirements')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: true })

                if (!error && data && data.length > 0) {
                    setCurriculum(data.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        required: item.required_credits
                    })))
                } else if (data && data.length === 0) {
                    // Initialize with defaults if empty
                    const initialData = defaultCurriculum.map(c => ({
                        user_id: user.id,
                        name: c.name,
                        required_credits: c.required
                    }))

                    const { data: inserted, error: insertError } = await supabase
                        .from('degree_requirements')
                        .insert(initialData)
                        .select()

                    if (!insertError && inserted) {
                        setCurriculum(inserted.map((item: any) => ({
                            id: item.id,
                            name: item.name,
                            required: item.required_credits
                        })))
                    }
                }
            } catch (error) {
                console.error('Error loading curriculum:', error)
            }
        }
        fetchCurriculum()
    }, [])

    // Sync curriculum to DB when changed (Debounced)
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Skip initial render or if empty
            if (curriculum.length === 0) return

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const updates = curriculum.map(c => ({
                user_id: user.id,
                name: c.name,
                required_credits: c.required
            }))

            await supabase
                .from('degree_requirements')
                .upsert(updates, { onConflict: 'user_id, name' })
        }, 1000)

        return () => clearTimeout(timer)
    }, [curriculum])



    useEffect(() => {
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
        fetchCourses()
    }, [supabase])

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

    const cgpa = calculateGPA(courses)
    const totalCredits = courses.reduce((sum, course) =>
        course.grade === 'F' ? sum : sum + course.credits, 0
    )

    // Grade Improvement Advisor calculation
    const improvementCandidates = useMemo(() => {
        const currentCGPA = parseFloat(cgpa) || 0
        const totalGPACredits = courses.reduce((sum, c) => c.grade === 'P' ? sum : sum + c.credits, 0)
        const currentTotalPoints = currentCGPA * totalGPACredits

        // Improvable grades (must be less than target)
        // Valid grades for calculation
        const validGrades = ['S', 'A', 'B', 'C', 'D', 'E']

        const candidates = courses
            .filter(c => {
                if (!validGrades.includes(c.grade)) return false
                const currentP = gradePoints[c.grade] ?? 0
                const targetP = gradePoints[getTarget(c.id)] ?? 0
                return currentP < targetP
            })
            .map(course => {
                const currentPoints = gradePoints[course.grade] ?? 0

                // Calculate boost for the specific target
                const targetPoints = gradePoints[getTarget(course.id)] ?? 0
                const pointDiff = (targetPoints - currentPoints) * course.credits
                const newTotalPoints = currentTotalPoints + pointDiff
                const newCGPA = totalGPACredits > 0 ? newTotalPoints / totalGPACredits : 0
                const targetBoost = newCGPA - currentCGPA

                // Calculate all possible upgrades for display
                const upgradeTargets: Record<string, string[]> = {
                    'A': ['S'],
                    'B': ['S', 'A'],
                    'C': ['S', 'A', 'B'],
                    'D': ['S', 'A', 'B', 'C'],
                    'E': ['S', 'A', 'B', 'C', 'D']
                }

                const targets = upgradeTargets[course.grade] || []

                const upgrades = targets.map(targetGrade => {
                    const newPoints = gradePoints[targetGrade] ?? 0
                    const pDiff = (newPoints - currentPoints) * course.credits
                    const nTotalPoints = currentTotalPoints + pDiff
                    const nCGPA = totalGPACredits > 0 ? nTotalPoints / totalGPACredits : 0
                    const boost = nCGPA - currentCGPA

                    return {
                        targetGrade,
                        newCGPA: nCGPA.toFixed(2),
                        cgpaBoost: boost.toFixed(3)
                    }
                })

                return {
                    course,
                    upgrades,
                    maxBoost: targetBoost, // Use the target boost for sorting/logic
                    difficulty: courseDifficulties[course.id] || 'Unknown'
                }
            })
            .sort((a, b) => {
                const aSelected = selectedImprovementIds.includes(a.course.id)
                const bSelected = selectedImprovementIds.includes(b.course.id)

                if (aSelected && !bSelected) return -1
                if (!aSelected && bSelected) return 1
                return b.maxBoost - a.maxBoost
            })

        return candidates
    }, [courses, cgpa, courseDifficulties, courseTargetGrades, selectedImprovementIds])

    // Fetch AI difficulty ratings
    // Fetch AI difficulty ratings
    const fetchDifficulties = async () => {
        if (improvementCandidates.length === 0) {
            toast.error("No improvement candidates found")
            return
        }

        setLoadingDifficulties(true)
        const toastId = toast.loading("Analyzing course difficulties...")

        try {
            const courseNames = improvementCandidates.map(c => c.course.name).join(', ')
            const response = await fetch('/api/ai/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'difficulty',
                    text: courseNames
                })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.data?.difficulties) {
                    setCourseDifficulties(prev => {
                        const newDiffs = { ...prev }
                        improvementCandidates.forEach((candidate, i) => {
                            if (data.data.difficulties[i]) {
                                newDiffs[candidate.course.id] = data.data.difficulties[i]
                            }
                        })
                        return newDiffs
                    })
                    toast.success("Difficulty analysis complete!", { id: toastId })
                } else {
                    console.error("Invalid response format:", data)
                    toast.error("AI returned invalid data", { id: toastId })
                }
            } else {
                toast.error("Failed to fetch difficulty ratings", { id: toastId })
            }
        } catch (error) {
            console.error('Failed to fetch difficulties:', error)
            toast.error("An error occurred during analysis", { id: toastId })
        } finally {
            setLoadingDifficulties(false)
        }
    }

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
                    semester: newCourse.semester,
                    category: newCourse.category || null
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
        } catch {
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
            toast.success('Semester updated')
        } catch {
            toast.error('Failed to update semester')
        }
    }

    const openEditDialog = (course: Course) => {
        setEditingCourse(course)
        setEditForm({
            name: course.name,
            credits: course.credits,
            grade: course.grade,
            semester: course.semester,
            category: course.category || 'none'
        })
    }

    const updateCourse = async () => {
        if (!editingCourse || !editForm.name) return

        try {
            setIsSubmitting(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('You must be logged in')
                return
            }

            const { error } = await supabase
                .from('courses')
                .update({
                    name: editForm.name,
                    credits: editForm.credits,
                    grade: editForm.grade,
                    semester: editForm.semester,
                    category: editForm.category || null
                })
                .eq('id', editingCourse.id)
                .eq('user_id', user.id)

            if (error) {
                console.error('Supabase update error:', error)
                throw error
            }

            setCourses(courses.map(c =>
                c.id === editingCourse.id
                    ? { ...c, ...editForm }
                    : c
            ))
            setEditingCourse(null)
            toast.success('Course updated')
        } catch {
            toast.error('Failed to update course')
        } finally {
            setIsSubmitting(false)
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
        } catch {
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
        } catch {
            toast.error('Failed to clear courses')
        }
    }

    // CGPA Future Calculator
    const CREDITS_PER_SEMESTER = 24 // Approximate

    // Calculate future CGPA scenarios
    const cgpaAnalysis = useMemo(() => {
        // Calculate true Quality Points and Graded Credits (for GPA)
        let currentGradedCredits = 0
        let currentPoints = 0

        courses.forEach(c => {
            if (c.grade !== 'P') {
                // F grades count strictly as 0 points but contribute to graded credits
                currentGradedCredits += c.credits
                currentPoints += (gradePoints[c.grade] ?? 0) * c.credits
            }
        })

        // Credits that count towards graduation (usually P counts, F does not)
        // 'totalCredits' (from line 271) already handles "Earned" (excludes F)
        // We use this to determine how many credits are *left* to take.
        const earnedCredits = totalCredits
        const remainingCredits = Math.max(0, programCredits - earnedCredits)
        const remainingSemesters = Math.ceil(remainingCredits / CREDITS_PER_SEMESTER)

        // What if scenarios - if you get all X grade from now
        // Formula: (CurrentQP + FutureQP) / (CurrentGradedCredits + FutureGradedCredits)
        // We assume remaining credits will all be graded (optimistic but standard for projection)
        const whatIf = (gradeGPA: number) => {
            if (remainingCredits <= 0) return (currentGradedCredits > 0 ? currentPoints / currentGradedCredits : 0).toFixed(2)

            const futurePoints = currentPoints + (gradeGPA * remainingCredits)
            const projectedTotalGradedCredits = currentGradedCredits + remainingCredits

            return (futurePoints / projectedTotalGradedCredits).toFixed(2)
        }

        // Calculate required GPA to reach target
        const requiredForTarget = (targetCGPA: number) => {
            if (remainingCredits <= 0) {
                // Check if already achieved
                const current = currentGradedCredits > 0 ? (currentPoints / currentGradedCredits) : 0
                return { achievable: current >= targetCGPA, gpa: 0, alreadyDone: current >= targetCGPA }
            }

            const projectedTotalGradedCredits = currentGradedCredits + remainingCredits
            const targetTotalPoints = targetCGPA * projectedTotalGradedCredits
            const neededPoints = targetTotalPoints - currentPoints
            const neededGPA = neededPoints / remainingCredits

            if (neededGPA > 10.001) return { achievable: false, gpa: neededGPA }
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
    }, [cgpa, totalCredits, programCredits, courses])

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
            <div className="flex items-center justify-center min-h-100">
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
                <div className="flex flex-wrap gap-2">
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
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                                } catch (e: unknown) {
                                    const err = e instanceof Error ? e.message : String(e);
                                    toast.error(`Import failed: ${err}`)
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
                <Card className="glass-card border-white/6 md:col-span-2">
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
                            <div className="p-4 rounded-2xl bg-linear-to-br from-violet-500/20 to-fuchsia-500/20">
                                <GraduationCap className="h-10 w-10 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Cumulative GPA (CGPA)</p>
                                <p className={cn("text-5xl font-bold", getGPAColor(parseFloat(cgpa)))}>
                                    {cgpa}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">out of 10.0</p>
                            </div>
                            <div className="mt-4 sm:mt-0 sm:ml-auto text-center sm:text-right">
                                <p className="text-2xl font-bold text-white">{totalCredits}</p>
                                <p className="text-sm text-gray-400">Total Credits</p>
                            </div>
                        </div>
                        <div className="mt-6">
                            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-linear-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(parseFloat(cgpa) / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/6">
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
                <Card className="glass-card border-purple-500/20 bg-linear-to-r from-purple-500/5 to-pink-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-foreground flex items-center gap-2 flex-wrap">
                            <TrendingUp className="h-5 w-5 text-purple-400" />
                            Your CGPA Future
                            <span className="text-xs font-normal text-muted-foreground">
                                ({cgpaAnalysis.remainingCredits} of
                                <Input
                                    type="number"
                                    defaultValue={programCredits}
                                    onBlur={(e) => {
                                        const val = parseInt(e.target.value) || totalCredits
                                        setProgramCredits(Math.max(totalCredits, val))
                                        e.target.value = Math.max(totalCredits, val).toString()
                                    }}
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
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={targetCGPA}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= 10)) {
                                            setTargetCGPA(val)
                                        }
                                    }}
                                    className="w-20 h-8 text-sm text-center px-2 bg-background border-border"
                                />
                                <span className="text-muted-foreground">→</span>
                                {(() => {
                                    const req = cgpaAnalysis.requiredForTarget(parseFloat(targetCGPA) || 0)
                                    const breakdown = cgpaAnalysis.gradeBreakdown(parseFloat(targetCGPA) || 0)

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

            {/* Curriculum Distribution */}
            <Card className="glass-card border-cyan-500/20">
                <Collapsible open={showCurriculum} onOpenChange={setShowCurriculum}>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="pb-3 cursor-pointer hover:bg-white/2 transition-colors">
                            <CardTitle className="text-lg text-foreground flex items-center gap-2">
                                {showCurriculum ? <ChevronDown className="h-5 w-5 text-cyan-400" /> : <ChevronUp className="h-5 w-5 text-cyan-400" />}
                                <BookOpen className="h-5 w-5 text-cyan-400" />
                                Curriculum Distribution
                                <span className="text-xs font-normal text-muted-foreground ml-2">
                                    ({totalCredits} / {curriculum.reduce((s, c) => s + c.required, 0)} credits)
                                </span>
                            </CardTitle>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="pt-0">
                            <p className="text-xs text-muted-foreground mb-4">
                                Track your progress across curriculum categories. Earned credits are auto-calculated from your courses.
                                To categorize a course, edit it and select a category.
                            </p>
                            <div className="space-y-2">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-500 uppercase bg-white/2 rounded-lg">
                                    <div className="col-span-6">Category</div>
                                    <div className="col-span-2 text-center">Required</div>
                                    <div className="col-span-2 text-center">Earned</div>
                                    <div className="col-span-2 text-center">Progress</div>
                                </div>

                                {curriculum.map((cat) => {
                                    // Calculate earned credits from courses with this category (excluding F grades)
                                    const earnedCredits = courses
                                        .filter(course => course.category === cat.name && course.grade !== 'F')
                                        .reduce((sum, course) => sum + course.credits, 0)
                                    const progress = cat.required > 0 ? Math.min(100, (earnedCredits / cat.required) * 100) : 0
                                    const isComplete = earnedCredits >= cat.required

                                    return (
                                        <div key={cat.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-white/2 transition-colors items-center">
                                            <div className="col-span-6 text-sm text-foreground truncate" title={cat.name}>
                                                {cat.name}
                                            </div>
                                            <div className="col-span-2 text-center">
                                                <Input
                                                    type="number"
                                                    value={cat.required}
                                                    onChange={(e) => {
                                                        const val = Math.max(0, parseInt(e.target.value) || 0)
                                                        setCurriculum(prev => prev.map(c =>
                                                            c.id === cat.id ? { ...c, required: val } : c
                                                        ))
                                                    }}
                                                    className="w-14 h-7 text-sm text-center px-1 bg-background border-border text-muted-foreground"
                                                    min={0}
                                                />
                                            </div>
                                            <div className={cn(
                                                "col-span-2 text-center text-sm font-medium",
                                                isComplete ? "text-emerald-400" : "text-foreground"
                                            )}>
                                                {earnedCredits}
                                            </div>
                                            <div className="col-span-2">
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all",
                                                            isComplete ? "bg-emerald-500" : "bg-cyan-500"
                                                        )}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Totals Row */}
                                <div className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 items-center mt-2">
                                    <div className="col-span-6 text-sm font-semibold text-foreground">
                                        Total Credits
                                    </div>
                                    <div className="col-span-2 text-center text-sm font-semibold text-cyan-400">
                                        {curriculum.reduce((s, c) => s + c.required, 0)}
                                    </div>
                                    <div className="col-span-2 text-center text-sm font-semibold text-emerald-400">
                                        {totalCredits}
                                    </div>
                                    <div className="col-span-2 text-center text-xs text-muted-foreground">
                                        {curriculum.reduce((s, c) => s + c.required, 0) > 0
                                            ? ((totalCredits / curriculum.reduce((s, c) => s + c.required, 0)) * 100).toFixed(0)
                                            : 0}%
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            </Card>

            {/* Grade Improvement Advisor */}
            {improvementCandidates.length > 0 && (
                <Card className="glass-card border-amber-500/20">
                    <Collapsible open={showImprovementAdvisor} onOpenChange={setShowImprovementAdvisor}>
                        <CollapsibleTrigger asChild>
                            <CardHeader className="pb-3 cursor-pointer hover:bg-white/2 transition-colors">
                                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                                    {showImprovementAdvisor ? <ChevronDown className="h-5 w-5 text-amber-400" /> : <ChevronUp className="h-5 w-5 text-amber-400" />}
                                    <TrendingUp className="h-5 w-5 text-amber-400" />
                                    Grade Improvement Advisor
                                    <span className="text-xs font-normal text-muted-foreground ml-2">
                                        ({improvementCandidates.length} courses)
                                    </span>
                                </CardTitle>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="pt-0 space-y-6">
                                {/* Controls */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-white/2 border border-white/5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchDifficulties}
                                        disabled={loadingDifficulties}
                                        className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                    >
                                        {loadingDifficulties ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        AI Difficulty Analysis
                                    </Button>
                                    <div className="text-xs text-muted-foreground ml-auto">
                                        Select courses below to add them to your plan.
                                    </div>
                                </div>

                                {/* Your Improvement Plan (Selected Courses) */}
                                <div className="p-4 rounded-xl bg-linear-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                        <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                                            🎯 Your Improvement Plan
                                            <span className="text-xs text-amber-400/70 font-normal">({selectedImprovementIds.length})</span>
                                        </h4>
                                        {selectedImprovementIds.length > 0 && (
                                            <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                                                <span>Potential:</span>
                                                <span className="font-bold text-amber-400 text-sm">
                                                    {(parseFloat(cgpa) + improvementCandidates
                                                        .filter(c => selectedImprovementIds.includes(c.course.id))
                                                        .reduce((sum, c) => sum + c.maxBoost, 0)
                                                    ).toFixed(2)} CGPA
                                                </span>
                                                <span className="text-[10px] text-green-400 font-medium">
                                                    (+{improvementCandidates
                                                        .filter(c => selectedImprovementIds.includes(c.course.id))
                                                        .reduce((sum, c) => sum + c.maxBoost, 0)
                                                        .toFixed(3)})
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedImprovementIds.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed border-amber-500/20 rounded-lg">
                                            <p className="text-sm text-muted-foreground">No courses selected.</p>
                                            <p className="text-xs text-muted-foreground mt-1">Add courses from the list below to build your plan.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {improvementCandidates
                                                .filter(c => selectedImprovementIds.includes(c.course.id))
                                                .map((candidate, i) => (
                                                    <div
                                                        key={candidate.course.id}
                                                        className="relative flex flex-col gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium text-foreground truncate">{candidate.course.name}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={cn("text-xs font-semibold", gradeColors[candidate.course.grade])}>
                                                                        Currently: {candidate.course.grade}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">•</span>
                                                                    <span className="text-xs text-amber-300">+{candidate.maxBoost.toFixed(3)} Boost</span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-muted-foreground hover:text-red-400 -mr-1 -mt-1"
                                                                onClick={() => setSelectedImprovementIds(prev => prev.filter(id => id !== candidate.course.id))}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Goal</span>
                                                            <Select
                                                                value={getTarget(candidate.course.id)}
                                                                onValueChange={(val) => setCourseTargetGrades(prev => ({ ...prev, [candidate.course.id]: val }))}
                                                            >
                                                                <SelectTrigger className="h-7 text-xs bg-black/20 border-white/10 w-full">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {['S', 'A', 'B', 'C', 'D'].map(g => (
                                                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {/* Available Courses */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground px-1">Available for Improvement</h4>
                                    <div className="space-y-3 max-h-100 overflow-y-auto pr-1">
                                        {improvementCandidates
                                            .filter(c => !selectedImprovementIds.includes(c.course.id))
                                            .map((candidate) => (
                                                <div
                                                    key={candidate.course.id}
                                                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                                                            onClick={() => setSelectedImprovementIds(prev => [...prev, candidate.course.id])}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                        <div>
                                                            <h5 className="font-medium text-foreground">{candidate.course.name}</h5>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs text-muted-foreground">{candidate.course.credits} credits</span>
                                                                <span className="text-xs text-muted-foreground">•</span>
                                                                <span className={cn("text-xs font-semibold", gradeColors[candidate.course.grade])}>
                                                                    Current: {candidate.course.grade}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 pl-11 sm:pl-0">
                                                        <span className="text-xs text-muted-foreground">
                                                            Max potential: <span className="text-amber-400">+{candidate.maxBoost.toFixed(3)}</span> (to {getTarget(candidate.course.id)})
                                                        </span>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-full text-[10px] font-medium ml-2",
                                                            candidate.difficulty === 'Easy' && "bg-green-500/20 text-green-400",
                                                            candidate.difficulty === 'Medium' && "bg-blue-500/20 text-blue-400",
                                                            candidate.difficulty === 'Hard' && "bg-orange-500/20 text-orange-400",
                                                            candidate.difficulty === 'Very Hard' && "bg-red-500/20 text-red-400",
                                                            candidate.difficulty === 'Unknown' && "bg-gray-500/20 text-gray-400"
                                                        )}>
                                                            {candidate.difficulty}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        {improvementCandidates.filter(c => !selectedImprovementIds.includes(c.course.id)).length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-4">All improvable courses selected.</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </CollapsibleContent>
                    </Collapsible>
                </Card >
            )
            }

            {/* Add Course Dialog is at the bottom */}

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
                                    {/* Header - Hidden on Mobile */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-500 uppercase rounded-t-lg bg-white/1">
                                        <div className="col-span-6">Course</div>
                                        <div className="col-span-2 text-center">Credits</div>
                                        <div className="col-span-2 text-center">Grade</div>
                                        <div className="col-span-2 text-right"></div>
                                    </div>

                                    {semCourses.map((course) => (
                                        <div
                                            key={course.id}
                                            className="px-4 py-3 rounded-lg hover:bg-white/4 transition-colors group"
                                        >
                                            {/* Mobile Row */}
                                            <div className="flex md:hidden items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-white/90 truncate">{course.name}</div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                        <span>{course.credits} Cr</span>
                                                        <span className={cn("font-bold ml-1", gradeColors[course.grade])}>
                                                            {course.grade}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"
                                                        onClick={() => openEditDialog(course)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10" onClick={() => removeCourse(course.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Desktop Row */}
                                            <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                                                <div className="col-span-6 font-medium text-white/90 truncate">{course.name}</div>
                                                <div className="col-span-2 text-center text-gray-400">{course.credits}</div>
                                                <div className={cn("col-span-2 text-center font-bold", gradeColors[course.grade])}>
                                                    {course.grade}
                                                </div>
                                                <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                        onClick={() => openEditDialog(course)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
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
                                                                    Are you sure you want to delete &quot;{course.name}&quot;? This action cannot be undone.
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
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )
                })}
            </div>

            {/* GPA Scale Reference */}
            <Card className="glass-card border-white/6">
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

            {/* Add Course Dialog */}
            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogContent className="bg-card border-border sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Add New Course</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label className="text-muted-foreground">Course Name</Label>
                            <Input
                                placeholder="e.g., Data Structures"
                                value={newCourse.name}
                                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                                className="bg-muted/50 border-border text-foreground mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-muted-foreground">Credits</Label>
                                <Select
                                    value={newCourse.credits.toString()}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, credits: parseInt(value) })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Credits" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {[0, 1, 2, 3, 4].map((n) => (
                                            <SelectItem key={n} value={n.toString()}>
                                                {`${n}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Grade</Label>
                                <Select
                                    value={newCourse.grade}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, grade: value })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Grade" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {Object.keys(gradePoints).map((g) => (
                                            <SelectItem key={g} value={g}>
                                                {g}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Semester</Label>
                                <Select
                                    value={newCourse.semester}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, semester: value })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Semester" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <SelectItem key={n} value={`Semester ${n}`}>
                                                Sem {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Category</Label>
                                <Select
                                    value={newCourse.category}
                                    onValueChange={(value) => setNewCourse({ ...newCourse, category: value })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border max-h-60">
                                        <SelectItem value="none">None</SelectItem>
                                        {curriculum.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowAddForm(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button onClick={addCourse} className="gradient-primary text-white" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Course
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Course Dialog */}
            <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
                <DialogContent className="bg-card border-border sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Edit Course</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label className="text-muted-foreground">Course Name</Label>
                            <Input
                                placeholder="e.g., Data Structures"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="bg-muted/50 border-border text-foreground mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-muted-foreground">Credits</Label>
                                <Select
                                    value={editForm.credits.toString()}
                                    onValueChange={(value) => setEditForm({ ...editForm, credits: parseInt(value) })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Credits" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {[0, 1, 2, 3, 4].map((n) => (
                                            <SelectItem key={n} value={n.toString()}>
                                                {`${n}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Grade</Label>
                                <Select
                                    value={editForm.grade}
                                    onValueChange={(value) => setEditForm({ ...editForm, grade: value })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Grade" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {Object.keys(gradePoints).map((g) => (
                                            <SelectItem key={g} value={g}>
                                                {g}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Semester</Label>
                                <Select
                                    value={editForm.semester}
                                    onValueChange={(value) => setEditForm({ ...editForm, semester: value })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Semester" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <SelectItem key={n} value={`Semester ${n}`}>
                                                Sem {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Category</Label>
                                <Select
                                    value={editForm.category}
                                    onValueChange={(value) => setEditForm({ ...editForm, category: value })}
                                >
                                    <SelectTrigger className="w-full bg-muted/50 border-border text-foreground mt-1">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border max-h-60">
                                        <SelectItem value="none">None</SelectItem>
                                        {curriculum.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEditingCourse(null)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button onClick={updateCourse} className="gradient-primary text-white" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
