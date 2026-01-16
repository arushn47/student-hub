'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Plus,
    Search,
    FileText,
    Link as LinkIcon,
    Image as ImageIcon,
    Video,
    MoreVertical,
    Download,
    ExternalLink,
    Filter,
    FolderOpen,
    Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Resource {
    id: string
    title: string
    type: 'pdf' | 'link' | 'video' | 'image' | 'other'
    url: string
    course: string
    size: string
    created_at: string
}

const typeIcons = {
    pdf: FileText,
    link: LinkIcon,
    image: ImageIcon,
    video: Video,
    other: FileText,
}

const typeColors = {
    pdf: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    link: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    image: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    video: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    other: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
}

export default function ResourcesPage() {
    const [resources, setResources] = useState<Resource[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedType, setSelectedType] = useState<string | null>(null)

    // Add Form State
    const [showAddForm, setShowAddForm] = useState(false)
    const [newResource, setNewResource] = useState<Partial<Resource>>({
        type: 'link'
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        fetchResources()
    }, [])

    const fetchResources = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('resources')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setResources(data || [])
        } catch (error) {
            console.error('Error fetching resources:', error)
            toast.error('Failed to load resources')
        } finally {
            setLoading(false)
        }
    }

    const addResource = async () => {
        if (!newResource.title || !newResource.url || !newResource.type) {
            toast.error('Please fill in title and URL')
            return
        }

        try {
            setIsSubmitting(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('You must be logged in')
                return
            }

            const { data, error } = await supabase
                .from('resources')
                .insert({
                    user_id: user.id,
                    title: newResource.title,
                    type: newResource.type,
                    url: newResource.url,
                    course: newResource.course || 'General',
                    size: newResource.size || '' // Optional
                })
                .select()
                .single()

            if (error) throw error

            setResources([data, ...resources])
            setNewResource({ type: 'link' })
            setShowAddForm(false)
            toast.success('Resource added successfully')
        } catch (error) {
            console.error('Error adding resource:', error)
            toast.error('Failed to add resource')
        } finally {
            setIsSubmitting(false)
        }
    }

    const filteredResources = resources.filter(resource => {
        const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            resource.course.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = selectedType ? resource.type === selectedType : true
        return matchesSearch && matchesType
    })

    const courses = Array.from(new Set(resources.map(r => r.course)))

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Resources</h1>
                    <p className="text-gray-400 mt-1">Organize your study materials, links, and documents</p>
                </div>
                <Button
                    onClick={() => setShowAddForm(true)}
                    className="gradient-primary text-white gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Add Resource
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search resources..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <FilterButton
                        label="All"
                        active={selectedType === null}
                        onClick={() => setSelectedType(null)}
                    />
                    <FilterButton
                        label="PDFs"
                        active={selectedType === 'pdf'}
                        onClick={() => setSelectedType('pdf')}
                        icon={FileText}
                    />
                    <FilterButton
                        label="Links"
                        active={selectedType === 'link'}
                        onClick={() => setSelectedType('link')}
                        icon={LinkIcon}
                    />
                    <FilterButton
                        label="Images"
                        active={selectedType === 'image'}
                        onClick={() => setSelectedType('image')}
                        icon={ImageIcon}
                    />
                </div>
            </div>

            {/* Add Resource Form */}
            {showAddForm && (
                <Card className="glass-card border-violet-500/30 bg-violet-500/5">
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-400">Title</Label>
                                    <Input
                                        placeholder="e.g., Calculus cheatsheet"
                                        value={newResource.title || ''}
                                        onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                        className="bg-white/5 border-white/10 text-white mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-400">Type</Label>
                                    <select
                                        value={newResource.type}
                                        onChange={(e) => setNewResource({ ...newResource, type: e.target.value as any })}
                                        className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white mt-1"
                                    >
                                        <option value="link" className="bg-gray-900">Link</option>
                                        <option value="pdf" className="bg-gray-900">PDF</option>
                                        <option value="video" className="bg-gray-900">Video</option>
                                        <option value="image" className="bg-gray-900">Image</option>
                                        <option value="other" className="bg-gray-900">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <Label className="text-gray-400">URL / Link</Label>
                                <Input
                                    placeholder="https://..."
                                    value={newResource.url || ''}
                                    onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                                    className="bg-white/5 border-white/10 text-white mt-1"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-400">Course (Optional)</Label>
                                    <Input
                                        placeholder="e.g., Math 101"
                                        value={newResource.course || ''}
                                        onChange={(e) => setNewResource({ ...newResource, course: e.target.value })}
                                        className="bg-white/5 border-white/10 text-white mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-400">Size (Optional)</Label>
                                    <Input
                                        placeholder="e.g., 2 MB"
                                        value={newResource.size || ''}
                                        onChange={(e) => setNewResource({ ...newResource, size: e.target.value })}
                                        className="bg-white/5 border-white/10 text-white mt-1"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button onClick={addResource} className="gradient-primary text-white" disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Resource'}
                                </Button>
                                <Button variant="ghost" onClick={() => setShowAddForm(false)} className="text-gray-400" disabled={isSubmitting}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Resources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                ))}
            </div>

            {filteredResources.length === 0 && !showAddForm && (
                <div className="text-center py-12">
                    <FolderOpen className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No resources found</p>
                    <Button
                        variant="link"
                        onClick={() => setShowAddForm(true)}
                        className="text-violet-400 mt-2"
                    >
                        Add your first resource
                    </Button>
                </div>
            )}
        </div>
    )
}

function ResourceCard({ resource }: { resource: Resource }) {
    const Icon = typeIcons[resource.type] || FileText
    const colorClass = typeColors[resource.type] || typeColors.other

    return (
        <Card className="glass-card border-white/[0.06] hover:border-white/[0.12] transition-colors group">
            <CardContent className="p-4">
                <div className="flex items-start gap-4">
                    <div className={cn("p-2.5 rounded-xl shrink-0", colorClass)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{resource.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                                {resource.course}
                            </span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-500">{new Date(resource.created_at).toLocaleDateString()}</span>
                            {resource.size && (
                                <>
                                    <span className="text-xs text-gray-500">•</span>
                                    <span className="text-xs text-gray-500">{resource.size}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 flex gap-1">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                            <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function FilterButton({
    label,
    active,
    onClick,
    icon: Icon
}: {
    label: string,
    active: boolean,
    onClick: () => void,
    icon?: React.ComponentType<{ className?: string }>
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
                active
                    ? "bg-white text-black shadow-lg shadow-white/10"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            )}
        >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
        </button>
    )
}
