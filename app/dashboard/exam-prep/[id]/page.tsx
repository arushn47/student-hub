'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Target,
    ArrowLeft,
    Upload,
    FileQuestion,
    Layers,
    FileText,
    Loader2,
    Check,
    AlertCircle,
    Clock,
    Star,
    ChevronDown,
    ChevronUp,
    Sparkles,
    File,
    Trash2,
    ExternalLink,
    Download
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Document as DocxDocument,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    BorderStyle,
    WidthType,
    AlignmentType,
    INumberingOptions,
    LevelFormat,
    SectionType
} from 'docx'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Subject {
    id: string
    name: string
    total_modules: number
    questions_per_module: number
    marks_per_question: number
    important_questions?: string // Global important questions/syllabus
}

interface Module {
    id: string
    name: string
    module_number: number
    file_path: string | null
    file_name: string | null
    summary: string | null
    status: 'pending' | 'processing' | 'ready' | 'error'
}

interface Question {
    id: string
    module_id: string
    question: string
    answer: string
    is_most_likely: boolean
    visual_search_query?: string | null
}

interface Flashcard {
    id: string
    module_id: string
    front: string
    back: string
}

// Helper to parse Markdown text into docx Paragraphs/Tables
function parseMarkdownToDocx(text: string): (Paragraph | Table)[] {
    const lines = text.split('\n')
    const nodes: (Paragraph | Table)[] = []
    let tableRows: TableRow[] = []
    let inTable = false

    const parseText = (lineText: string): TextRun[] => {
        // Split by ** for bold
        const parts = lineText.split(/(\*\*.*?\*\*)/g)
        return parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return new TextRun({
                    text: part.slice(2, -2),
                    bold: true
                })
            }
            return new TextRun({ text: part })
        })
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Table handling (basic support)
        if (line.startsWith('|')) {
            inTable = true
            // Remove outer pipes if they exist, simple split
            const rowContent = line.replace(/^\||\|$/g, '')
            if (line.includes('---')) continue // Skip separator lines like |---|---|

            const cells = rowContent.split('|').map(c => new TableCell({
                children: [new Paragraph({ children: parseText(c.trim()) })],
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
                },
                margins: { top: 100, bottom: 100, left: 100, right: 100 }
            }))
            tableRows.push(new TableRow({ children: cells }))
            continue
        } else if (inTable) {
            if (tableRows.length > 0) {
                nodes.push(new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE }
                }))
                nodes.push(new Paragraph({ text: "" })) // Spacer
            }
            tableRows = []
            inTable = false
        }

        // List handling
        if (line.startsWith('- ') || line.startsWith('* ')) {
            nodes.push(new Paragraph({
                children: parseText(line.slice(2)),
                bullet: { level: 0 }
            }))
        } else if (line.startsWith('### ')) {
            nodes.push(new Paragraph({
                children: parseText(line.slice(4)),
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 }
            }))
        } else if (line.length > 0) {
            nodes.push(new Paragraph({
                children: parseText(line),
                spacing: { after: 120 }
            }))
        }
    }

    if (inTable && tableRows.length > 0) {
        nodes.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
        }))
    }

    return nodes
}

// Export Q&A as professional Word Document
async function exportToWord(subjectName: string, modules: Module[], questions: Question[]) {
    const children: (Paragraph | Table)[] = []

    // Title Page / Header
    children.push(
        new Paragraph({
            text: `${subjectName} - Exam Preparation`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
        }),
        new Paragraph({
            text: `Generated by StudentHub on ${new Date().toLocaleDateString()}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 }
        })
    )

    modules.filter(m => m.status === 'ready').forEach(module => {
        const moduleQuestions = questions.filter(q => q.module_id === module.id)
        if (moduleQuestions.length === 0) return

        // Module Header
        children.push(
            new Paragraph({
                text: module.name,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
                border: {
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: "888888" }
                }
            })
        )

        moduleQuestions.forEach((q, index) => {
            // Question Heading
            const qRuns = [
                new TextRun({ text: `Q${index + 1}: `, bold: true, size: 24 }),
                new TextRun({ text: q.question, bold: true, size: 24 })
            ]

            if (q.is_most_likely) {
                qRuns.push(new TextRun({
                    text: " [MOST LIKELY]",
                    color: "FF0000",
                    bold: true,
                    size: 20
                }))
            }

            children.push(
                new Paragraph({
                    children: qRuns,
                    spacing: { before: 300, after: 100 },
                    keepNext: true
                })
            )

            // Answer Content (Parsed Markdown)
            const answerNodes = parseMarkdownToDocx(q.answer)
            children.push(...answerNodes)

            // Separator
            children.push(new Paragraph({
                border: { bottom: { style: BorderStyle.DOTTED, size: 1, space: 1, color: "cccccc" } },
                spacing: { before: 100, after: 100 }
            }))
        })
    })

    const doc = new DocxDocument({
        sections: [{
            properties: { type: SectionType.CONTINUOUS },
            children: children
        }]
    })

    // Generate and Download
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${subjectName.replace(/[^a-zA-Z0-9]/g, '_')}_ExamPrep.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

interface ModuleFile {
    id: string
    module_id: string
    file_name: string
    file_path: string
    file_size: number | null
    created_at: string
}

export default function SubjectDetailPage() {
    const params = useParams()
    const router = useRouter()
    const subjectId = params.id as string

    const [subject, setSubject] = useState<Subject | null>(null)
    const [modules, setModules] = useState<Module[]>([])
    const [moduleFiles, setModuleFiles] = useState<ModuleFile[]>([])
    const [questions, setQuestions] = useState<Question[]>([])
    const [flashcards, setFlashcards] = useState<Flashcard[]>([])
    const [flashcardModuleId, setFlashcardModuleId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [subjectQuestions, setSubjectQuestions] = useState('')
    const [isSavingSubjectQuestions, setIsSavingSubjectQuestions] = useState(false)
    const [showSubjectQuestions, setShowSubjectQuestions] = useState(false)

    const supabase = createClient()

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch subject
            const { data: subjectData } = await supabase
                .from('exam_subjects')
                .select('*')
                .eq('id', subjectId)
                .single()

            if (!subjectData) {
                router.push('/dashboard/exam-prep')
                return
            }
            setSubject(subjectData)
            setSubjectQuestions(subjectData.important_questions || '')

            // Fetch modules
            const { data: modulesData } = await supabase
                .from('exam_modules')
                .select('*')
                .eq('subject_id', subjectId)
                .order('module_number')

            setModules(modulesData || [])

            // Fetch questions
            const moduleIds = modulesData?.map(m => m.id) || []
            if (moduleIds.length > 0) {
                const { data: questionsData } = await supabase
                    .from('exam_questions')
                    .select('*')
                    .in('module_id', moduleIds)

                setQuestions(questionsData || [])

                // Fetch flashcards
                const { data: flashcardsData } = await supabase
                    .from('exam_flashcards')
                    .select('*')
                    .in('module_id', moduleIds)

                setFlashcards(flashcardsData || [])

                // Fetch module files
                const { data: filesData } = await supabase
                    .from('exam_module_files')
                    .select('*')
                    .in('module_id', moduleIds)
                    .order('created_at', { ascending: false })

                setModuleFiles(filesData || [])
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }, [subjectId, supabase, router])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const saveSubjectQuestions = async () => {
        setIsSavingSubjectQuestions(true)
        try {
            const { error } = await supabase
                .from('exam_subjects')
                .update({ important_questions: subjectQuestions })
                .eq('id', subjectId)

            if (error) throw error
            toast.success('Subject strategy saved!')
            setSubject(prev => prev ? { ...prev, important_questions: subjectQuestions } : null)
        } catch (error) {
            console.error('Save error:', error)
            toast.error('Failed to save strategy')
        } finally {
            setIsSavingSubjectQuestions(false)
        }
    }

    useEffect(() => {
        if (flashcardModuleId) return
        if (modules.length === 0 || flashcards.length === 0) return
        const firstWithFlashcards = modules.find(m => flashcards.some(f => f.module_id === m.id))
        if (firstWithFlashcards) setFlashcardModuleId(firstWithFlashcards.id)
    }, [flashcards, modules, flashcardModuleId])

    const handleFileUpload = async (moduleId: string, files: File[]) => {
        if (files.length === 0) return

        setUploading(moduleId)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const uploadedPaths: string[] = []
            const fileNames: string[] = []

            // Upload all files
            for (const file of files) {
                const filePath = `${user.id}/${moduleId}/${file.name}`
                const { error: uploadError } = await supabase.storage
                    .from('exam-pdfs')
                    .upload(filePath, file, { upsert: true })

                if (uploadError) throw uploadError
                uploadedPaths.push(filePath)
                fileNames.push(file.name)

                // Also save to exam_module_files table
                await supabase.from('exam_module_files').insert({
                    module_id: moduleId,
                    user_id: user.id,
                    file_name: file.name,
                    file_path: filePath,
                    file_size: file.size
                })
            }

            // Update module record with first file (for backward compatibility)
            const { error: updateError } = await supabase
                .from('exam_modules')
                .update({
                    file_path: uploadedPaths[0],
                    file_name: fileNames.join(', '),
                    status: 'processing'
                })
                .eq('id', moduleId)

            if (updateError) throw updateError

            toast.success(`${files.length} file(s) uploaded! Processing all with AI...`)
            setUploading(null)
            setProcessing(moduleId)

            // Trigger AI processing for ALL files at once
            await processModule(moduleId, uploadedPaths)

        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Failed to upload files')
            setUploading(null)
        }
    }

    const handleReprocess = async (moduleId: string) => {
        // Find module files
        const files = moduleFiles.filter(f => f.module_id === moduleId)
        // Allow reprocessing even without files (Topic Generation)

        const filePaths = files.map(f => f.file_path)
        setProcessing(moduleId)
        await processModule(moduleId, filePaths)
        setProcessing(null)
    }

    const handleDeleteFile = async (fileId: string, filePath: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return

        try {
            // Delete from Storage
            const { error: storageError } = await supabase.storage
                .from('exam-pdfs')
                .remove([filePath])

            if (storageError) throw storageError

            // Delete from DB
            const { error: dbError } = await supabase
                .from('exam_module_files')
                .delete()
                .eq('id', fileId)

            if (dbError) throw dbError

            toast.success('File deleted successfully')
            fetchData() // Refresh list
        } catch (error) {
            console.error('Delete error:', error)
            toast.error('Failed to delete file')
        }
    }

    const processModule = async (moduleId: string, filePaths: string[]) => {
        let shouldMarkError = true
        try {
            const response = await fetch('/api/exam-prep/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduleId, filePaths })
            })

            if (!response.ok) {
                const cloned = response.clone()
                let message = `Processing failed (${response.status})`

                try {
                    const error = await response.json()
                    if (response.status === 429) {
                        shouldMarkError = false
                        const retry = typeof error?.retryAfterSeconds === 'number' ? error.retryAfterSeconds : undefined
                        message = retry
                            ? `Rate limited. Try again in ~${retry}s.`
                            : 'Rate limited. Try again in a moment.'
                    } else {
                        message = error?.message || error?.error || message
                    }
                    if (error?.stack) {
                        console.error('Process API stack:', error.stack)
                    }
                } catch {
                    const text = await cloned.text().catch(() => '')
                    if (text) message = text
                }

                throw new Error(message)
            }

            toast.success('Module processed! Questions and flashcards generated.')
            fetchData()
        } catch (error) {
            console.error('Processing error:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to process module')

            // Update status to error
            if (shouldMarkError) {
                await supabase
                    .from('exam_modules')
                    .update({ status: 'error' })
                    .eq('id', moduleId)
            }
        } finally {
            setProcessing(null)
        }
    }

    const handleShrinkSummary = async (moduleId: string, currentSummary: string) => {
        const toastId = toast.loading('Condensing summary...')
        try {
            const response = await fetch('/api/exam-prep/shrink-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduleId, currentSummary })
            })

            if (!response.ok) throw new Error('Failed to shrink summary')

            const { summary } = await response.json()

            // Update local state
            setModules(prev => prev.map(m =>
                m.id === moduleId ? { ...m, summary } : m
            ))

            toast.success('Summary condensed!', { id: toastId })
        } catch (error) {
            console.error(error)
            toast.error('Failed to shrink summary', { id: toastId })
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!subject) return null

    const readyModules = modules.filter(m => m.status === 'ready').length
    const selectedFlashcards = flashcardModuleId
        ? flashcards.filter(f => f.module_id === flashcardModuleId)
        : flashcards

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/exam-prep">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">{subject.name}</h1>
                    <p className="text-muted-foreground text-sm">
                        {subject.total_modules} modules • {subject.questions_per_module}Q × {subject.marks_per_question}M per module
                    </p>
                </div>
            </div>

            {/* Subject Strategy & Important Questions */}
            <Card className="glass-card border-amber-500/20 bg-amber-500/5">
                <CardHeader className="py-3 cursor-pointer" onClick={() => setShowSubjectQuestions(!showSubjectQuestions)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-amber-400" />
                            <CardTitle className="text-base">Exam Strategy & Syllabus Context</CardTitle>
                        </div>
                        {showSubjectQuestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </CardHeader>
                {showSubjectQuestions && (
                    <CardContent className="pt-0 pb-4 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Paste the **syllabus**, **midterm/endterm important questions**, or **recurring themes** here.
                                This context will be used for EVERY module generation in this subject.
                            </p>
                            <Textarea
                                value={subjectQuestions}
                                onChange={(e) => setSubjectQuestions(e.target.value)}
                                placeholder="E.g., 'For Midterms, focus on Unit 1 & 2 definitions. For Endterms, Unit 5 applications are key. Important questions: Explain MVC architecture...'"
                                className="min-h-[100px] bg-black/20 border-amber-500/20 focus:border-amber-500/50"
                            />
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    onClick={saveSubjectQuestions}
                                    disabled={isSavingSubjectQuestions}
                                    className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20 border"
                                >
                                    {isSavingSubjectQuestions ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                                    Save Strategy
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Progress Card */}
            <Card className="glass-card">
                <CardContent className="py-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10">
                                <Target className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="font-medium">Preparation Progress</p>
                                <p className="text-sm text-muted-foreground">
                                    {readyModules} of {modules.length} modules ready
                                </p>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-amber-400">
                            {modules.length > 0 ? Math.round((readyModules / modules.length) * 100) : 0}%
                        </p>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-linear-to-r from-amber-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${modules.length > 0 ? (readyModules / modules.length) * 100 : 0}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="modules" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 max-w-md">
                    <TabsTrigger value="modules" className="gap-2">
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">Modules</span>
                    </TabsTrigger>
                    <TabsTrigger value="questions" className="gap-2">
                        <FileQuestion className="h-4 w-4" />
                        <span className="hidden sm:inline">Questions</span>
                    </TabsTrigger>
                    <TabsTrigger value="flashcards" className="gap-2">
                        <Layers className="h-4 w-4" />
                        <span className="hidden sm:inline">Flashcards</span>
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Summary</span>
                    </TabsTrigger>
                </TabsList>

                {/* Modules Tab */}
                <TabsContent value="modules" className="space-y-4">
                    {modules.map((module) => (
                        <ModuleCard
                            key={module.id}
                            module={module}
                            files={moduleFiles.filter(f => f.module_id === module.id)}
                            uploading={uploading === module.id}
                            processing={processing === module.id}
                            onUpload={(file) => handleFileUpload(module.id, file)}
                            onReprocess={() => handleReprocess(module.id)}
                            onDeleteFile={handleDeleteFile}
                        />
                    ))}
                </TabsContent>

                {/* Questions Tab */}
                <TabsContent value="questions" className="space-y-4">
                    {modules.filter(m => m.status === 'ready').length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="py-12 text-center">
                                <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-muted-foreground">Upload and process modules to see predicted questions</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Export Button */}
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportToWord(subject.name, modules, questions)}
                                    className="gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Export to Word
                                </Button>
                            </div>
                            {modules.filter(m => m.status === 'ready').map((module) => {
                                const moduleQuestions = questions.filter(q => q.module_id === module.id)
                                return (
                                    <QuestionSection
                                        key={module.id}
                                        module={module}
                                        questions={moduleQuestions}
                                    />
                                )
                            })}
                        </>
                    )}
                </TabsContent>

                {/* Flashcards Tab */}
                <TabsContent value="flashcards">
                    {flashcards.length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="py-12 text-center">
                                <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-muted-foreground">Upload and process modules to get flashcards</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <Card className="glass-card">
                                <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Study flashcards by module
                                    </div>
                                    <div className="w-full sm:w-72">
                                        <Select value={flashcardModuleId} onValueChange={setFlashcardModuleId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a module" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {modules
                                                    .filter(m => flashcards.some(f => f.module_id === m.id))
                                                    .map(m => (
                                                        <SelectItem key={m.id} value={m.id}>
                                                            {m.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>

                            {selectedFlashcards.length === 0 ? (
                                <Card className="glass-card">
                                    <CardContent className="py-12 text-center">
                                        <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                        <p className="text-muted-foreground">No flashcards for this module yet</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <FlashcardStudy key={flashcardModuleId} flashcards={selectedFlashcards} />
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4">
                    {modules.filter(m => m.status === 'ready' && m.summary).length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="py-12 text-center">
                                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-muted-foreground">Upload and process modules to get short notes</p>
                            </CardContent>
                        </Card>
                    ) : (
                        modules.filter(m => m.status === 'ready' && m.summary).map((module) => (
                            <Collapsible key={module.id} defaultOpen className="group/collapsible">
                                <Card className="glass-card">
                                    <CardHeader className="py-4">
                                        <div className="flex items-center justify-between w-full">
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" className="p-0 hover:bg-transparent flex-1 justify-start gap-2 h-auto font-semibold text-lg">
                                                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                                                    <span className="flex items-center gap-2 text-foreground">
                                                        <FileText className="h-5 w-5 text-blue-400" />
                                                        {module.name}
                                                    </span>
                                                </Button>
                                            </CollapsibleTrigger>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-2 text-xs ml-2"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleShrinkSummary(module.id, module.summary || '')
                                                }}
                                            >
                                                <Sparkles className="h-3 w-3 text-amber-500" />
                                                <span className="hidden sm:inline">Shrink</span>
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CollapsibleContent>
                                        <CardContent>
                                            <div className="prose prose-invert max-w-none prose-pre:bg-muted/50 prose-pre:text-muted-foreground">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {module.summary}
                                                </ReactMarkdown>
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

function ModuleCard({
    module,
    files,
    uploading,
    processing,
    onUpload,
    onReprocess,
    onDeleteFile
}: {
    module: Module
    files: ModuleFile[]
    uploading: boolean
    processing: boolean
    onUpload: (files: File[]) => void
    onReprocess: () => void
    onDeleteFile: (fileId: string, filePath: string) => void
}) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            onUpload(Array.from(files))
        }
    }

    const getStatusIcon = () => {
        if (uploading || processing || module.status === 'processing') {
            return <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        }
        switch (module.status) {
            case 'ready':
                return <Check className="h-5 w-5 text-emerald-400" />
            case 'error':
                return <AlertCircle className="h-5 w-5 text-red-400" />
            default:
                return <Clock className="h-5 w-5 text-muted-foreground" />
        }
    }

    const getStatusText = () => {
        if (uploading) return 'Uploading...'
        if (processing || module.status === 'processing') return 'Processing with AI...'
        switch (module.status) {
            case 'ready':
                return 'Ready'
            case 'error':
                return 'Error - Try again'
            default:
                return 'Pending upload'
        }
    }

    return (
        <Card className={cn(
            "glass-card transition-all duration-300",
            module.status === 'ready' && "border-emerald-500/30"
        )}>
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-black/20 gap-3 sm:gap-0">
                {/* Left: Module Info */}
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                    <div className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold shrink-0",
                        module.status === 'ready' ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
                    )}>
                        {module.module_number}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium leading-none mb-1 truncate">{module.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                            {getStatusIcon()}
                            <span className="truncate">{getStatusText()}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Actions & Files */}
                <div className="flex items-center justify-end gap-2 w-full sm:w-auto ml-auto">
                    {files.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground px-2">
                                    <File className="h-4 w-4" />
                                    <span className="text-xs">{files.length}</span>
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 max-h-60 overflow-y-auto">
                                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Uploaded Files</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {files.map((file) => (
                                    <DropdownMenuItem key={file.id} className="flex flex-col items-start gap-1 p-2 focus:bg-accent cursor-default">
                                        <div className="flex items-center gap-2 w-full">
                                            <File className="h-3 w-3 text-blue-400 shrink-0" />
                                            <span className="truncate text-sm flex-1">{file.file_name}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDeleteFile(file.id, file.file_path)
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        {file.created_at && (
                                            <span className="text-[10px] text-muted-foreground pl-5">
                                                {new Date(file.created_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {(module.status === 'ready' || module.status === 'error') && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onReprocess}
                            disabled={processing}
                            className="gap-2 border-white/10 hover:bg-white/5 h-8 px-2 sm:px-3"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                            <span className="hidden sm:inline">Regenerate</span>
                        </Button>
                    )}

                    {/* Generate without files (Topic Based) */}
                    {module.status !== 'ready' && module.status !== 'processing' && files.length === 0 && (
                        <Button
                            size="sm"
                            variant="default"
                            onClick={onReprocess}
                            disabled={processing}
                            className="gap-2 h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/50 shadow-lg shadow-indigo-500/20"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Generate from Topic</span>
                            <span className="inline sm:hidden">Generate</span>
                        </Button>
                    )}

                    <label>
                        <input
                            type="file"
                            accept=".pdf,.ppt,.pptx"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={uploading || processing || module.status === 'processing'}
                        />
                        <Button
                            variant={module.status === 'ready' ? 'secondary' : 'outline'}
                            size="sm"
                            className={cn(
                                "cursor-pointer gap-2 h-8 px-3 whitespace-nowrap",
                                module.status !== 'ready' && files.length > 0 && "gradient-primary text-white border-0",
                                module.status !== 'ready' && files.length === 0 && "border-dashed border-muted-foreground/50 hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5"
                            )}
                            disabled={uploading || processing || module.status === 'processing'}
                            asChild
                        >
                            <span>
                                <Upload className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                    {module.status === 'ready' || files.length > 0 ? 'Upload / Replace' : 'Upload Materials'}
                                </span>
                                <span className="inline sm:hidden">
                                    Upload
                                </span>
                            </span>
                        </Button>
                    </label>
                </div>
            </CardContent>
        </Card>
    )
}

function QuestionSection({ module, questions }: { module: Module; questions: Question[] }) {
    const [expanded, setExpanded] = useState(true)

    return (
        <Card className="glass-card">
            <CardHeader
                className="cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileQuestion className="h-5 w-5 text-amber-400" />
                        {module.name}
                        <span className="text-sm font-normal text-muted-foreground">
                            ({questions.length} questions)
                        </span>
                    </CardTitle>
                    {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="space-y-3">
                    {questions.map((q) => (
                        <QuestionCard key={q.id} question={q} />
                    ))}
                </CardContent>
            )}
        </Card>
    )
}

function QuestionCard({ question }: { question: Question }) {
    const [showAnswer, setShowAnswer] = useState(false)

    return (
        <div className={cn(
            "rounded-xl border p-4 transition-all duration-300",
            question.is_most_likely
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-border bg-muted/30"
        )}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {question.is_most_likely && (
                    <div className="shrink-0">
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                            <Star className="h-3 w-3 fill-amber-400" />
                            Most Likely
                        </div>
                    </div>
                )}
                <div className="flex-1 space-y-3 min-w-0 w-full">
                    <p className="font-medium break-words">{question.question}</p>

                    {showAnswer ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                            <div className="text-sm text-muted-foreground prose prose-invert max-w-none prose-p:my-1 prose-pre:bg-black/50 overflow-hidden">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {question.answer}
                                </ReactMarkdown>
                            </div>

                            {/* Visual Diagram Button */}
                            {question.visual_search_query && (
                                <div className="mt-3 pt-3 border-t border-emerald-500/20 flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 h-7 text-xs border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
                                        asChild
                                    >
                                        <a
                                            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(question.visual_search_query)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            View Diagram
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAnswer(true)}
                            className="gap-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            Show Answer
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

function FlashcardStudy({ flashcards }: { flashcards: Flashcard[] }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [flipped, setFlipped] = useState(false)

    const currentCard = flashcards[currentIndex]

    const nextCard = () => {
        if (flashcards.length === 0) return
        setFlipped(false)
        setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % flashcards.length)
        }, 200)
    }

    const prevCard = () => {
        if (flashcards.length === 0) return
        setFlipped(false)
        setTimeout(() => {
            setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length)
        }, 200)
    }

    return (
        <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Card {currentIndex + 1} of {flashcards.length}</span>
                <div className="flex gap-1">
                    {flashcards.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                i === currentIndex ? "bg-violet-400 w-4" : "bg-muted"
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Card */}
            <div
                className="relative h-64 cursor-pointer perspective-1000"
                onClick={() => setFlipped(!flipped)}
            >
                <div className={cn(
                    "absolute inset-0 transition-transform duration-500 preserve-3d",
                    flipped && "rotate-y-180"
                )}>
                    {/* Front */}
                    <Card className="absolute inset-0 glass-card backface-hidden flex items-center justify-center p-6">
                        <div className="text-center">
                            <p className="text-lg font-medium">{currentCard?.front}</p>
                            <p className="text-sm text-muted-foreground mt-4">Click to flip</p>
                        </div>
                    </Card>

                    {/* Back */}
                    <Card className="absolute inset-0 glass-card backface-hidden rotate-y-180 flex items-center justify-center p-6 border-violet-500/30">
                        <div className="text-center">
                            <p className="text-lg">{currentCard?.back}</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
                <Button variant="outline" onClick={prevCard}>
                    Previous
                </Button>
                <Button onClick={nextCard} className="gradient-primary text-white">
                    Next
                </Button>
            </div>
        </div>
    )
}
