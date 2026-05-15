/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PaperUploadDialog } from '@/components/papers/PaperUploadDialog'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'

const PaperCard = dynamic(() => import('@/components/papers/PaperCard').then(mod => mod.PaperCard), {
    loading: () => <div className="animate-pulse bg-white/5 rounded-2xl h-72" />
})
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, Folder, Upload } from 'lucide-react'
import { SUBJECTS, EXAM_TYPES } from '@/lib/constants'
import { useAuth } from '@/lib/auth-context'
import { normalizePaperExamType } from '@/lib/papers'

interface Paper {
    id: string
    title: string
    college: string
    subject: string
    exam_type: string | null
    year: number
    file_url: string | null
    file_urls?: string[] | null
    file_path?: string | null
    uploaded_by: string | null
    created_at: string
    slot?: string | null
    page_count?: number | null
}

export default function QuestionPapersPage() {
    const [papers, setPapers] = useState<Paper[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('all')
    const [yearFilter, setYearFilter] = useState('all')
    const [examTypeFilter, setExamTypeFilter] = useState('all')

    // Derived years only (since years are specific to data)
    const years = Array.from(new Set(papers.map(p => p.year))).sort((a, b) => b - a)

        const { user, isAdmin } = useAuth()

    const fetchPapers = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('question_papers')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setPapers(data)
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        fetchPapers()
    }, [fetchPapers])

    const filteredPapers = papers.filter(paper => {
        const normalizedExamType = normalizePaperExamType(paper.exam_type)
        const displayTitle = `${paper.subject} - ${(normalizedExamType ?? paper.exam_type ?? 'Exam')} (${paper.year})`
        const q = search.toLowerCase()

        const matchesSearch =
            paper.title.toLowerCase().includes(q) ||
            paper.subject.toLowerCase().includes(q) ||
            displayTitle.toLowerCase().includes(q) ||
            (normalizedExamType ? normalizedExamType.toLowerCase().includes(q) : false) ||
            (paper.slot ? paper.slot.toLowerCase().includes(q) : false)

        const matchesSubject = subjectFilter === 'all' || paper.subject === subjectFilter
        const matchesYear = yearFilter === 'all' || paper.year.toString() === yearFilter
        const matchesExamType = examTypeFilter === 'all' || normalizedExamType === examTypeFilter

        return matchesSearch && matchesSubject && matchesYear && matchesExamType
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-purple-400 to-pink-400">
                        Question Bank
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Curated collection of previous year questions (PYQs) for VIT Bhopal.
                    </p>
                </div>
                <div className="hidden md:block">
                    <PaperUploadDialog onUploadSuccess={fetchPapers} />
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Search papers, subjects, slots..."
                        className="pl-9 bg-black/20 border-white/10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                        <SelectTrigger className="w-full md:w-50 bg-black/20 border-white/10">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            <SelectItem value="all">All Subjects</SelectItem>
                            {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={examTypeFilter} onValueChange={setExamTypeFilter}>
                        <SelectTrigger className="w-full md:w-40 bg-black/20 border-white/10">
                            <SelectValue placeholder="Exam Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Exams</SelectItem>
                            {EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="w-full md:w-27.5 bg-black/20 border-white/10">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Card Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="animate-pulse bg-white/5 rounded-2xl h-72" />
                    ))}
                </div>
            ) : filteredPapers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPapers.map(paper => (
                        <PaperCard
                            key={paper.id}
                            paper={paper}
                            currentUserId={user?.id}
                            isAdmin={isAdmin}
                            onDelete={async () => {
                                // Delete from storage if file_url exists
                                if (paper.file_url) {
                                    try {
                                        const url = new URL(paper.file_url)
                                        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/papers\/(.+)/)
                                        if (pathMatch?.[1]) {
                                            await supabase.storage.from('papers').remove([decodeURIComponent(pathMatch[1])])
                                        }
                                    } catch {
                                        // Storage deletion failed, continue with DB deletion
                                    }
                                }
                                // Delete from DB
                                const { error } = await supabase
                                    .from('question_papers')
                                    .delete()
                                    .eq('id', paper.id)
                                if (error) {
                                    throw error
                                }
                                // Refresh list
                                fetchPapers()
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500 bg-black/20 rounded-2xl border border-dashed border-white/5">
                    <Folder className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-medium text-gray-400 mb-1">No papers found</h3>
                    <p className="text-sm mb-4 opacity-60">Try adjusting your filters or search query</p>
                    <Button
                        variant="outline"
                        className="text-gray-400 border-white/10 hover:text-white"
                        onClick={() => {
                            setSubjectFilter('all')
                            setYearFilter('all')
                            setExamTypeFilter('all')
                            setSearch('')
                        }}
                    >
                        Clear Filters
                    </Button>
                </div>
            )}

            {/* Mobile FAB */}
            <div className="md:hidden">
                <PaperUploadDialog
                    onUploadSuccess={fetchPapers}
                    trigger={(
                        <Button
                            className="fixed bottom-24 right-5 h-12 w-12 rounded-2xl shadow-xl bg-white text-gray-900 hover:bg-gray-100 z-50 flex items-center justify-center"
                        >
                            <Upload className="h-5 w-5" />
                        </Button>
                    )}
                />
            </div>
        </div>
    )
}
