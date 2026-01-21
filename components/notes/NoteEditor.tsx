'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ReactMarkdown from 'react-markdown'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    ArrowLeft,
    Bold,
    Italic,
    List,
    ListOrdered,
    CheckSquare,
    Heading1,
    Heading2,
    Sparkles,
    HelpCircle,
    Undo,
    Redo,
    Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import type { Note, QuizQuestion } from '@/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { SpeechToTextButton, TextToSpeechButton } from '@/components/ui/speech'

interface NoteEditorProps {
    note: Note
}

export function NoteEditor({ note: initialNote }: NoteEditorProps) {
    const [note, setNote] = useState(initialNote)
    const [title, setTitle] = useState(initialNote.title)
    const [currentContent, setCurrentContent] = useState(initialNote.content || '')
    const [saving, setSaving] = useState(false)
    const [explainLoading, setExplainLoading] = useState(false)
    const [quizLoading, setQuizLoading] = useState(false)
    const [explainDialog, setExplainDialog] = useState<{ open: boolean; text: string; explanation: string }>({
        open: false,
        text: '',
        explanation: '',
    })
    const [quizDialog, setQuizDialog] = useState<{ open: boolean; questions: QuizQuestion[]; currentIndex: number; answers: (number | null)[] }>({
        open: false,
        questions: [],
        currentIndex: 0,
        answers: [],
    })
    const router = useRouter()
    const supabase = createClient()

    const editor = useEditor({
        extensions: [
            StarterKit,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Placeholder.configure({
                placeholder: 'Start writing...',
            }),
        ],
        content: note.content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none focus-visible:outline-none focus:ring-0 min-h-[50vh] px-1 py-2',
            },
        },
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            setCurrentContent(editor.getHTML())
        },
    })

    const saveNote = useCallback(async () => {
        if (!editor) return
        setSaving(true)

        const content = editor.getHTML()
        const plainText = editor.getText()

        const { error } = await supabase
            .from('notes')
            .update({
                title,
                content,
                plain_text: plainText,
                updated_at: new Date().toISOString(),
            })
            .eq('id', note.id)

        setSaving(false)
        if (error) {
            toast.error('Failed to save note')
        } else {
            setNote((prev) => ({ ...prev, title, content, plain_text: plainText, updated_at: new Date().toISOString() }))
        }
    }, [editor, title, note.id, supabase])

    // Auto-save on content/title change (debounced 2s)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (note.content !== currentContent || note.title !== title) {
                saveNote()
            }
        }, 2000)

        return () => clearTimeout(timeoutId)
    }, [currentContent, title, saveNote, note.content, note.title])

    // Manual Save Shortcut (Ctrl+S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                saveNote()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [saveNote])

    const explainSelection = async () => {
        if (!editor) return

        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')

        if (!selectedText.trim()) {
            toast.error('Please select some text to explain')
            return
        }

        setExplainLoading(true)
        setExplainDialog({ open: true, text: selectedText, explanation: '' })

        try {
            const response = await fetch('/api/ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: selectedText }),
            })

            if (!response.ok) throw new Error('Failed to get explanation')

            const data = await response.json()
            setExplainDialog((prev) => ({ ...prev, explanation: data.explanation }))
        } catch {
            toast.error('Failed to get explanation')
            setExplainDialog((prev) => ({ ...prev, open: false }))
        } finally {
            setExplainLoading(false)
        }
    }

    const generateQuiz = async () => {
        if (!editor) return

        const content = editor.getText()
        if (!content.trim() || content.length < 50) {
            toast.error('Please add more content to generate a quiz (at least 50 characters)')
            return
        }

        setQuizLoading(true)

        try {
            const response = await fetch('/api/ai/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            })

            if (!response.ok) throw new Error('Failed to generate quiz')

            const data = await response.json()
            setQuizDialog({
                open: true,
                questions: data.questions,
                currentIndex: 0,
                answers: new Array(data.questions.length).fill(null),
            })
        } catch {
            toast.error('Failed to generate quiz')
        } finally {
            setQuizLoading(false)
        }
    }

    const selectAnswer = (answerIndex: number) => {
        setQuizDialog((prev) => {
            const newAnswers = [...prev.answers]
            newAnswers[prev.currentIndex] = answerIndex
            return { ...prev, answers: newAnswers }
        })
    }

    const currentQuestion = quizDialog.questions[quizDialog.currentIndex]
    const currentAnswer = quizDialog.answers[quizDialog.currentIndex]
    const quizComplete = quizDialog.answers.every((a) => a !== null)
    const correctCount = quizDialog.answers.filter(
        (a, i) => a === quizDialog.questions[i]?.correctAnswer
    ).length

    return (
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            {/* Top Bar - Minimal */}
            <div className="flex items-center justify-between py-2 mb-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/dashboard/notes')}
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-1">
                    {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    <span className="text-xs text-gray-500">
                        {saving ? 'Saving...' : 'Saved'}
                    </span>
                </div>
            </div>

            {/* Note Content Area */}
            <div className="flex-1 overflow-y-auto rounded-xl bg-white/[0.02] border border-white/10 p-4 mb-4">
                {/* Title Input */}
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    className="text-xl font-semibold bg-transparent border-none text-white placeholder:text-gray-500 focus-visible:ring-0 px-0 mb-2"
                />

                {/* Editor */}
                <EditorContent editor={editor} />
            </div>

            {/* Timestamp */}
            <div className="text-center mb-2">
                <span className="text-xs text-gray-500">
                    Edited at {format(new Date(note.updated_at), 'd MMM yyyy, h:mm a')}
                </span>
            </div>

            {/* Bottom Toolbar - Responsive */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                {/* Formatting - Scrollable on mobile */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                        active={editor?.isActive('heading', { level: 1 })}
                        icon={Heading1}
                        tooltip="Heading 1"
                    />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        active={editor?.isActive('heading', { level: 2 })}
                        icon={Heading2}
                        tooltip="Heading 2"
                    />
                    <div className="w-px h-5 bg-white/10 mx-1 hidden md:block" />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        active={editor?.isActive('bold')}
                        icon={Bold}
                        tooltip="Bold"
                    />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        active={editor?.isActive('italic')}
                        icon={Italic}
                        tooltip="Italic"
                    />
                    <div className="w-px h-5 bg-white/10 mx-1 hidden md:block" />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        active={editor?.isActive('bulletList')}
                        icon={List}
                        tooltip="Bullet List"
                    />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        active={editor?.isActive('orderedList')}
                        icon={ListOrdered}
                        tooltip="Numbered List"
                    />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().toggleTaskList().run()}
                        active={editor?.isActive('taskList')}
                        icon={CheckSquare}
                        tooltip="Checklist"
                    />
                    <div className="w-px h-5 bg-white/10 mx-1 hidden md:block" />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().undo().run()}
                        disabled={!editor?.can().undo()}
                        icon={Undo}
                        tooltip="Undo"
                    />
                    <ToolbarButton
                        onClick={() => editor?.chain().focus().redo().run()}
                        disabled={!editor?.can().redo()}
                        icon={Redo}
                        tooltip="Redo"
                    />
                </div>

                {/* AI Actions */}
                <div className="flex items-center justify-end gap-1 border-t border-white/10 pt-2 md:border-0 md:pt-0">
                    <SpeechToTextButton
                        onTranscript={(text) => {
                            if (editor) {
                                editor.chain().focus().insertContent(text + ' ').run()
                            }
                        }}
                    />
                    <TextToSpeechButton text={editor?.getText() || ''} />
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={explainSelection}
                        disabled={explainLoading}
                        className="text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 text-xs"
                    >
                        {explainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4 mr-1" />}
                        Explain
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={generateQuiz}
                        disabled={quizLoading}
                        className="text-gray-400 hover:text-pink-400 hover:bg-pink-500/10 text-xs"
                    >
                        {quizLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Quiz
                    </Button>
                </div>
            </div>

            {/* Explain Dialog */}
            <Dialog open={explainDialog.open} onOpenChange={(open) => setExplainDialog((prev) => ({ ...prev, open }))}>
                <DialogContent className="bg-gray-900 border-white/10 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-purple-400" />
                            Explanation
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-sm text-gray-400 mb-1">Selected text:</p>
                            <p className="text-white">&quot;{explainDialog.text}&quot;</p>
                        </div>
                        {explainLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 max-h-[60vh] overflow-y-auto prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown>
                                    {explainDialog.explanation}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Quiz Dialog */}
            <Dialog open={quizDialog.open} onOpenChange={(open) => setQuizDialog((prev) => ({ ...prev, open }))}>
                <DialogContent className="bg-gray-900 border-white/10 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-pink-400" />
                            Quiz - Question {quizDialog.currentIndex + 1} of {quizDialog.questions.length}
                        </DialogTitle>
                    </DialogHeader>
                    {currentQuestion && (
                        <div className="space-y-4">
                            <p className="text-white font-medium">{currentQuestion.question}</p>
                            <div className="space-y-2">
                                {currentQuestion.options.map((option, index) => (
                                    <button
                                        key={index}
                                        onClick={() => selectAnswer(index)}
                                        className={cn(
                                            "w-full p-3 rounded-lg text-left transition-all",
                                            currentAnswer === index
                                                ? currentAnswer === currentQuestion.correctAnswer
                                                    ? "bg-green-500/20 border-green-500/50 text-green-300"
                                                    : "bg-red-500/20 border-red-500/50 text-red-300"
                                                : "bg-white/5 border-white/10 text-white hover:bg-white/10",
                                            "border"
                                        )}
                                        disabled={currentAnswer !== null}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            {currentAnswer !== null && currentQuestion.explanation && (
                                <p className="text-sm text-gray-400 p-3 rounded-lg bg-white/5">
                                    💡 {currentQuestion.explanation}
                                </p>
                            )}
                            <div className="flex justify-between pt-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setQuizDialog((prev) => ({ ...prev, currentIndex: prev.currentIndex - 1 }))}
                                    disabled={quizDialog.currentIndex === 0}
                                    className="text-gray-400 hover:text-white"
                                >
                                    Previous
                                </Button>
                                {quizDialog.currentIndex < quizDialog.questions.length - 1 ? (
                                    <Button
                                        onClick={() => setQuizDialog((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }))}
                                        disabled={currentAnswer === null}
                                        className="bg-gradient-to-r from-purple-500 to-pink-500"
                                    >
                                        Next
                                    </Button>
                                ) : quizComplete ? (
                                    <div className="text-right">
                                        <p className="text-white font-semibold">
                                            Score: {correctCount}/{quizDialog.questions.length}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            {correctCount === quizDialog.questions.length ? '🎉 Perfect!' : 'Keep practicing!'}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ToolbarButton({
    onClick,
    active,
    disabled,
    icon: Icon,
    tooltip,
}: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    icon: React.ComponentType<{ className?: string }>
    tooltip?: string
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            disabled={disabled}
            title={tooltip}
            className={cn(
                "h-8 w-8",
                active ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/10",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <Icon className="h-4 w-4" />
        </Button>
    )
}
