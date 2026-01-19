'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Quote,
    Link as LinkIcon,
    Book,
    FileText,
    Copy,
    Check,
    Loader2,
    Trash2,
    Sparkles,
    Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Citation {
    id: string
    title: string
    citation_apa: string | null
    citation_mla: string | null
    citation_chicago: string | null
    source_url: string | null
    created_at: string
}

export default function CitationsPage() {
    const [citations, setCitations] = useState<Citation[]>([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [activeTab, setActiveTab] = useState<'url' | 'book' | 'article'>('url')
    const [copied, setCopied] = useState<string | null>(null)

    // Form states
    const [urlInput, setUrlInput] = useState('')
    const [bookInput, setBookInput] = useState({
        title: '',
        author: '',
        publisher: '',
        year: '',
        edition: ''
    })
    const [articleInput, setArticleInput] = useState({
        title: '',
        author: '',
        journal: '',
        year: '',
        volume: '',
        pages: ''
    })

    const supabase = createClient()

    useEffect(() => {
        fetchCitations()
    }, [])

    const fetchCitations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('saved_citations')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCitations(data || [])
        } catch (error) {
            console.error('Error fetching citations:', error)
        } finally {
            setLoading(false)
        }
    }

    const generateFromUrl = async () => {
        if (!urlInput.trim()) {
            toast.error('Please enter a URL')
            return
        }

        setGenerating(true)
        try {
            const response = await fetch('/api/citations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'url', url: urlInput })
            })

            if (!response.ok) throw new Error('Failed to generate citation')

            const data = await response.json()
            await saveCitation(data)
            setUrlInput('')
            toast.success('Citation generated!')
        } catch (error) {
            console.error('Error generating citation:', error)
            toast.error('Failed to generate citation')
        } finally {
            setGenerating(false)
        }
    }

    const generateFromBook = async () => {
        if (!bookInput.title.trim() || !bookInput.author.trim()) {
            toast.error('Please enter book title and author')
            return
        }

        setGenerating(true)
        try {
            const response = await fetch('/api/citations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'book', ...bookInput })
            })

            if (!response.ok) throw new Error('Failed to generate citation')

            const data = await response.json()
            await saveCitation(data)
            setBookInput({ title: '', author: '', publisher: '', year: '', edition: '' })
            toast.success('Citation generated!')
        } catch (error) {
            console.error('Error generating citation:', error)
            toast.error('Failed to generate citation')
        } finally {
            setGenerating(false)
        }
    }

    const generateFromArticle = async () => {
        if (!articleInput.title.trim() || !articleInput.author.trim()) {
            toast.error('Please enter article title and author')
            return
        }

        setGenerating(true)
        try {
            const response = await fetch('/api/citations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'article', ...articleInput })
            })

            if (!response.ok) throw new Error('Failed to generate citation')

            const data = await response.json()
            await saveCitation(data)
            setArticleInput({ title: '', author: '', journal: '', year: '', volume: '', pages: '' })
            toast.success('Citation generated!')
        } catch (error) {
            console.error('Error generating citation:', error)
            toast.error('Failed to generate citation')
        } finally {
            setGenerating(false)
        }
    }

    const saveCitation = async (citation: Partial<Citation>) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('saved_citations')
            .insert({
                user_id: user.id,
                ...citation
            })

        if (error) throw error
        fetchCitations()
    }

    const deleteCitation = async (id: string) => {
        try {
            const { error } = await supabase
                .from('saved_citations')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Citation deleted')
            fetchCitations()
        } catch (error) {
            console.error('Error deleting citation:', error)
        }
    }

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text)
        setCopied(id)
        toast.success('Copied to clipboard!')
        setTimeout(() => setCopied(null), 2000)
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
            <div>
                <h1 className="text-3xl font-bold gradient-text">Citation Generator</h1>
                <p className="text-muted-foreground mt-1">Generate citations in APA, MLA, and Chicago formats</p>
            </div>

            {/* Generator Card */}
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                        Generate Citation
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                        <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
                            <TabsTrigger value="url" className="gap-2">
                                <Globe className="h-4 w-4" />
                                Website
                            </TabsTrigger>
                            <TabsTrigger value="book" className="gap-2">
                                <Book className="h-4 w-4" />
                                Book
                            </TabsTrigger>
                            <TabsTrigger value="article" className="gap-2">
                                <FileText className="h-4 w-4" />
                                Article
                            </TabsTrigger>
                        </TabsList>

                        {/* URL Tab */}
                        <TabsContent value="url" className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Paste a URL (e.g. https://example.com/article)"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={generateFromUrl}
                                    disabled={generating}
                                    className="gradient-primary text-white gap-2"
                                >
                                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    Generate
                                </Button>
                            </div>
                        </TabsContent>

                        {/* Book Tab */}
                        <TabsContent value="book" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Book Title *</Label>
                                    <Input
                                        placeholder="e.g. Clean Code"
                                        value={bookInput.title}
                                        onChange={(e) => setBookInput({ ...bookInput, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Author(s) *</Label>
                                    <Input
                                        placeholder="e.g. Robert C. Martin"
                                        value={bookInput.author}
                                        onChange={(e) => setBookInput({ ...bookInput, author: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Publisher</Label>
                                    <Input
                                        placeholder="e.g. Pearson"
                                        value={bookInput.publisher}
                                        onChange={(e) => setBookInput({ ...bookInput, publisher: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Input
                                        placeholder="e.g. 2008"
                                        value={bookInput.year}
                                        onChange={(e) => setBookInput({ ...bookInput, year: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={generateFromBook}
                                disabled={generating}
                                className="gradient-primary text-white gap-2"
                            >
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Generate Citation
                            </Button>
                        </TabsContent>

                        {/* Article Tab */}
                        <TabsContent value="article" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Article Title *</Label>
                                    <Input
                                        placeholder="e.g. Machine Learning in Healthcare"
                                        value={articleInput.title}
                                        onChange={(e) => setArticleInput({ ...articleInput, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Author(s) *</Label>
                                    <Input
                                        placeholder="e.g. John Smith"
                                        value={articleInput.author}
                                        onChange={(e) => setArticleInput({ ...articleInput, author: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Journal Name</Label>
                                    <Input
                                        placeholder="e.g. Nature"
                                        value={articleInput.journal}
                                        onChange={(e) => setArticleInput({ ...articleInput, journal: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Input
                                        placeholder="e.g. 2023"
                                        value={articleInput.year}
                                        onChange={(e) => setArticleInput({ ...articleInput, year: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={generateFromArticle}
                                disabled={generating}
                                className="gradient-primary text-white gap-2"
                            >
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Generate Citation
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Saved Citations */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Saved Citations ({citations.length})</h2>
                {citations.length === 0 ? (
                    <Card className="glass-card">
                        <CardContent className="py-12 text-center">
                            <Quote className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No saved citations yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {citations.map((citation) => (
                            <CitationCard
                                key={citation.id}
                                citation={citation}
                                onDelete={() => deleteCitation(citation.id)}
                                onCopy={copyToClipboard}
                                copied={copied}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function CitationCard({
    citation,
    onDelete,
    onCopy,
    copied
}: {
    citation: Citation
    onDelete: () => void
    onCopy: (text: string, id: string) => void
    copied: string | null
}) {
    const [activeFormat, setActiveFormat] = useState<'apa' | 'mla' | 'chicago'>('apa')

    const currentCitation = {
        'apa': citation.citation_apa,
        'mla': citation.citation_mla,
        'chicago': citation.citation_chicago
    }[activeFormat]

    return (
        <Card className="glass-card group">
            <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                        <h3 className="font-medium">{citation.title}</h3>
                        {citation.source_url && (
                            <a
                                href={citation.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                                <LinkIcon className="h-3 w-3" />
                                {citation.source_url.slice(0, 50)}...
                            </a>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Format Tabs */}
                <div className="flex gap-2 mb-3">
                    {['apa', 'mla', 'chicago'].map((format) => (
                        <Button
                            key={format}
                            variant={activeFormat === format ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveFormat(format as typeof activeFormat)}
                            className={activeFormat === format ? 'gradient-primary text-white' : ''}
                        >
                            {format.toUpperCase()}
                        </Button>
                    ))}
                </div>

                {/* Citation Text */}
                <div className="relative bg-muted/50 rounded-lg p-3">
                    <p className="text-sm pr-10">{currentCitation || 'Citation not available'}</p>
                    {currentCitation && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={() => onCopy(currentCitation, `${citation.id}-${activeFormat}`)}
                        >
                            {copied === `${citation.id}-${activeFormat}` ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
