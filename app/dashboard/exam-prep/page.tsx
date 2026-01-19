'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Target,
    Plus,
    BookOpen,
    FileQuestion,
    Layers,
    FileText,
    Loader2,
    Trash2,
    ArrowRight,
    Upload
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Subject {
    id: string
    name: string
    total_modules: number
    questions_per_module: number
    marks_per_question: number
    exam_type: string
    created_at: string
    modules_ready: number
}

export default function ExamPrepPage() {
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [newSubject, setNewSubject] = useState({
        name: '',
        total_modules: 5,
        questions_per_module: 1,
        marks_per_question: 10,
        exam_type: 'endterm'
    })
    const [syllabusFile, setSyllabusFile] = useState<File | null>(null)
    const supabase = createClient()

    useEffect(() => {
        fetchSubjects()
    }, [])

    const fetchSubjects = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('exam_subjects')
                .select(`
                    *,
                    exam_modules!inner(id, status)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Process to get modules_ready count
            const processedData = data?.map(subject => ({
                ...subject,
                modules_ready: subject.exam_modules?.filter((m: { status: string }) => m.status === 'ready').length || 0
            })) || []

            setSubjects(processedData)
        } catch (error) {
            console.error('Error fetching subjects:', error)
            // Try simpler query without join
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data, error } = await supabase
                    .from('exam_subjects')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })

                if (error) throw error
                setSubjects(data?.map(s => ({ ...s, modules_ready: 0 })) || [])
            } catch (e) {
                console.error('Error:', e)
            }
        } finally {
            setLoading(false)
        }
    }

    const createSubject = async () => {
        if (!newSubject.name.trim()) {
            toast.error('Please enter a subject name')
            return
        }

        setCreating(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Create subject
            const { data: subject, error: subjectError } = await supabase
                .from('exam_subjects')
                .insert({
                    user_id: user.id,
                    name: newSubject.name.trim(),
                    total_modules: newSubject.total_modules,
                    questions_per_module: newSubject.questions_per_module,
                    marks_per_question: newSubject.marks_per_question,
                    exam_type: newSubject.exam_type
                })
                .select()
                .single()

            if (subjectError) throw subjectError

            // Upload syllabus if provided
            let syllabusPath = null
            if (syllabusFile) {
                const syllabusFileName = `${user.id}/${subject.id}/syllabus_${syllabusFile.name}`
                const { error: uploadError } = await supabase.storage
                    .from('exam-pdfs')
                    .upload(syllabusFileName, syllabusFile)

                if (!uploadError) {
                    syllabusPath = syllabusFileName
                    // Update subject with syllabus path
                    await supabase
                        .from('exam_subjects')
                        .update({ syllabus_path: syllabusPath })
                        .eq('id', subject.id)
                }
            }

            // Create empty modules
            const modules = Array.from({ length: newSubject.total_modules }, (_, i) => ({
                subject_id: subject.id,
                user_id: user.id,
                name: `Module ${i + 1}`,
                module_number: i + 1,
                status: 'pending'
            }))

            const { error: modulesError } = await supabase
                .from('exam_modules')
                .insert(modules)

            if (modulesError) throw modulesError

            toast.success('Subject created! Now upload PDFs for each module.')
            setDialogOpen(false)
            setNewSubject({ name: '', total_modules: 5, questions_per_module: 1, marks_per_question: 10, exam_type: 'endterm' })
            setSyllabusFile(null)
            fetchSubjects()
        } catch (error) {
            console.error('Error creating subject details:', error)
            // Extract error message safely
            const errorMessage = error instanceof Error
                ? error.message
                : (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
                    ? (error as { message: string }).message
                    : JSON.stringify(error)

            toast.error(`Failed to create subject: ${errorMessage}`)
        } finally {
            setCreating(false)
        }
    }

    const deleteSubject = async (id: string) => {
        try {
            const { error } = await supabase
                .from('exam_subjects')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Subject deleted')
            fetchSubjects()
        } catch (error) {
            console.error('Error deleting subject:', error)
            toast.error('Failed to delete subject')
        }
    }

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
                    <h1 className="text-3xl font-bold gradient-text">Exam Prep</h1>
                    <p className="text-muted-foreground mt-1">
                        Upload course materials and get AI-predicted exam questions
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gradient-primary text-white gap-2">
                            <Plus className="h-4 w-4" />
                            New Subject
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create New Subject</DialogTitle>
                            <DialogDescription>
                                Set up your exam structure to get personalized predictions
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Subject Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Data Structures"
                                    value={newSubject.name}
                                    onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="modules">Modules</Label>
                                    <Input
                                        id="modules"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={newSubject.total_modules}
                                        onChange={(e) => setNewSubject({ ...newSubject, total_modules: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="questions">Q/Module</Label>
                                    <Input
                                        id="questions"
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={newSubject.questions_per_module}
                                        onChange={(e) => setNewSubject({ ...newSubject, questions_per_module: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="marks">Marks/Q</Label>
                                    <Input
                                        id="marks"
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={newSubject.marks_per_question}
                                        onChange={(e) => setNewSubject({ ...newSubject, marks_per_question: parseInt(e.target.value) || 10 })}
                                    />
                                </div>
                            </div>

                            {/* Exam Type */}
                            <div className="space-y-2">
                                <Label>Exam Type</Label>
                                <Select
                                    value={newSubject.exam_type}
                                    onValueChange={(value) => setNewSubject({ ...newSubject, exam_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select exam type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="midterm">Midterm / CAT</SelectItem>
                                        <SelectItem value="endterm">End Term / FAT</SelectItem>
                                        <SelectItem value="quiz">Quiz</SelectItem>
                                        <SelectItem value="assignment">Assignment</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">Your exam pattern:</p>
                                <p>{newSubject.total_modules} modules × {newSubject.questions_per_module} question(s) × {newSubject.marks_per_question} marks = <span className="text-primary font-semibold">{newSubject.total_modules * newSubject.questions_per_module * newSubject.marks_per_question} total marks</span></p>
                            </div>

                            {/* Syllabus Upload */}
                            <div className="space-y-2">
                                <Label>Syllabus PDF (Optional - Improves AI predictions)</Label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                        id="syllabus-upload"
                                    />
                                    <label
                                        htmlFor="syllabus-upload"
                                        className="flex items-center gap-2 p-3 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                        <Upload className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            {syllabusFile ? syllabusFile.name : 'Upload syllabus PDF'}
                                        </span>
                                    </label>
                                </div>
                                <p className="text-xs text-muted-foreground">Upload your course syllabus (like the one from VIT) for better question predictions</p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={createSubject} disabled={creating} className="gradient-primary text-white">
                                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Create Subject
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-amber-500/10">
                                <BookOpen className="h-6 w-6 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{subjects.length}</p>
                                <p className="text-sm text-muted-foreground">Subjects</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-500/10">
                                <FileQuestion className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {subjects.reduce((acc, s) => acc + s.modules_ready, 0)}
                                </p>
                                <p className="text-sm text-muted-foreground">Modules Ready</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-violet-500/10">
                                <Target className="h-6 w-6 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">AI</p>
                                <p className="text-sm text-muted-foreground">Powered Predictions</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Subjects Grid */}
            {subjects.length === 0 ? (
                <Card className="glass-card">
                    <CardContent className="py-16 text-center">
                        <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-xl font-semibold mb-2">No subjects yet</h3>
                        <p className="text-muted-foreground mb-6">
                            Create your first subject to start preparing for exams
                        </p>
                        <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-white gap-2">
                            <Plus className="h-4 w-4" />
                            Create Subject
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjects.map((subject) => (
                        <SubjectCard
                            key={subject.id}
                            subject={subject}
                            onDelete={() => deleteSubject(subject.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function SubjectCard({ subject, onDelete }: { subject: Subject; onDelete: () => void }) {
    const progress = subject.total_modules > 0
        ? Math.round((subject.modules_ready / subject.total_modules) * 100)
        : 0

    return (
        <Card className="glass-card group hover:border-amber-500/30 transition-all duration-300">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10">
                            <Target className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{subject.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {subject.total_modules} modules • {subject.questions_per_module}Q × {subject.marks_per_question}M
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.preventDefault(); onDelete(); }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Modules uploaded</span>
                        <span className="font-medium">{subject.modules_ready}/{subject.total_modules}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-linear-to-r from-amber-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                        <FileQuestion className="h-4 w-4 mx-auto mb-1 text-amber-400" />
                        <p className="text-xs text-muted-foreground">Questions</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                        <Layers className="h-4 w-4 mx-auto mb-1 text-violet-400" />
                        <p className="text-xs text-muted-foreground">Flashcards</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                        <FileText className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                        <p className="text-xs text-muted-foreground">Notes</p>
                    </div>
                </div>

                {/* Action */}
                <Link href={`/dashboard/exam-prep/${subject.id}`}>
                    <Button className="w-full gap-2 group/btn" variant="outline">
                        {subject.modules_ready < subject.total_modules ? 'Upload Materials' : 'Study Now'}
                        <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </CardContent>
        </Card>
    )
}
