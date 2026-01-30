"use client";

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PaperUploadDialog } from '@/components/papers/PaperUploadDialog'
import { PaperListItem } from '@/components/papers/PaperListItem'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, Folder } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { COLLEGES, SUBJECTS, EXAM_TYPES } from '@/lib/constants'

interface Paper {
    id: string
    title: string
    college: string
    subject: string
    exam_type: string | null
    year: number
    file_url: string | null
    created_at: string
}

export default function QuestionPapersPage() {
    const [papers, setPapers] = useState<Paper[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [collegeFilter, setCollegeFilter] = useState('all')
    const [subjectFilter, setSubjectFilter] = useState('all')
    const [yearFilter, setYearFilter] = useState('all')
    const [examTypeFilter, setExamTypeFilter] = useState('all')

    // Derived years only (since years are specific to data)
    const years = Array.from(new Set(papers.map(p => p.year))).sort((a, b) => b - a)

    const supabase = createClient()

    const fetchPapers = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('question_papers')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setPapers(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchPapers()
    }, [])

    const filteredPapers = papers.filter(paper => {
        const matchesSearch = paper.title.toLowerCase().includes(search.toLowerCase()) ||
            paper.college.toLowerCase().includes(search.toLowerCase()) ||
            paper.subject.toLowerCase().includes(search.toLowerCase())

        const matchesCollege = collegeFilter === 'all' || paper.college === collegeFilter
        const matchesSubject = subjectFilter === 'all' || paper.subject === subjectFilter
        const matchesYear = yearFilter === 'all' || paper.year.toString() === yearFilter
        const matchesExamType = examTypeFilter === 'all' || paper.exam_type === examTypeFilter

        return matchesSearch && matchesCollege && matchesSubject && matchesYear && matchesExamType
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-purple-400 to-pink-400">
                        Question Bank
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Curated collection of previous year questions (PYQs).
                    </p>
                </div>
                <PaperUploadDialog onUploadSuccess={fetchPapers} />
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                        placeholder="Search papers, colleges, subjects..."
                        className="pl-9 bg-black/20 border-white/10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                    <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                        <SelectTrigger className="w-full md:w-50 bg-black/20 border-white/10">
                            <SelectValue placeholder="All Colleges" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            <SelectItem value="all">All Colleges</SelectItem>
                            {COLLEGES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
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

            {/* Compact List View */}
            <div className="space-y-3">
                {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 animate-pulse bg-white/5 rounded-xl" />
                    ))
                ) : filteredPapers.length > 0 ? (
                    filteredPapers.map(paper => (
                        <PaperListItem key={paper.id} paper={paper} />
                    ))
                ) : (
                    <div className="text-center py-20 text-gray-500 bg-black/20 rounded-2xl border border-dashed border-white/5">
                        <Folder className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-gray-400 mb-1">No papers found</h3>
                        <p className="text-sm mb-4 opacity-60">Try adjusting your filters or search query</p>
                        <Button
                            variant="outline"
                            className="text-gray-400 border-white/10 hover:text-white"
                            onClick={() => {
                                setCollegeFilter('all')
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
            </div>
        </div>
    )
}
