'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Shield,
    Users,
    BarChart3,
    Megaphone,
    ToggleLeft,
    Search,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Plus,
    UserCog,
    FileText,
    CheckSquare,
    ClipboardList,
    MessageSquare,
    FolderOpen,
    Activity,
    UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────

interface AdminUser {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: 'user' | 'admin'
    created_at: string
    updated_at: string
}

interface Stats {
    totalUsers: number
    totalNotes: number
    totalTasks: number
    totalAssignments: number
    totalChatMessages: number
    totalPapers: number
    activeToday: number
    recentSignups: number
}

interface Announcement {
    id: string
    title: string
    content: string
    type: 'info' | 'warning' | 'success' | 'maintenance'
    is_active: boolean
    created_at: string
    expires_at: string | null
}

interface FeatureFlag {
    id: string
    name: string
    description: string | null
    is_enabled: boolean
    updated_at: string
}

// ─── Component ─────────────────────────────────────────────────────

export default function AdminPage() {
    const { isAdmin } = useAuth()

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <Shield className="h-5 w-5" />
                            Access Denied
                        </CardTitle>
                        <CardDescription>
                            You don&apos;t have permission to access the admin panel.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                    <Shield className="h-6 w-6 text-red-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage users, view stats, and configure your app.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="stats" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                    <TabsTrigger value="stats" className="flex items-center gap-1.5">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Stats</span>
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Users</span>
                    </TabsTrigger>
                    <TabsTrigger value="announcements" className="flex items-center gap-1.5">
                        <Megaphone className="h-4 w-4" />
                        <span className="hidden sm:inline">Announce</span>
                    </TabsTrigger>
                    <TabsTrigger value="flags" className="flex items-center gap-1.5">
                        <ToggleLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Flags</span>
                    </TabsTrigger>
                </TabsList>

                {/* ─── Stats Tab ──────────────────────────────────── */}
                <TabsContent value="stats">
                    <StatsPanel />
                </TabsContent>

                {/* ─── Users Tab ──────────────────────────────────── */}
                <TabsContent value="users">
                    <UsersPanel />
                </TabsContent>

                {/* ─── Announcements Tab ─────────────────────────── */}
                <TabsContent value="announcements">
                    <AnnouncementsPanel />
                </TabsContent>

                {/* ─── Feature Flags Tab ──────────────────────────── */}
                <TabsContent value="flags">
                    <FeatureFlagsPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ─── Stats Panel ────────────────────────────────────────────────────

function StatsPanel() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/admin/stats')
            .then(r => r.json())
            .then(setStats)
            .catch(() => toast.error('Failed to load stats'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!stats) return null

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
        { label: 'Active Today', value: stats.activeToday, icon: Activity, color: 'text-green-400' },
        { label: 'New (7 days)', value: stats.recentSignups, icon: UserPlus, color: 'text-violet-400' },
        { label: 'Notes', value: stats.totalNotes, icon: FileText, color: 'text-amber-400' },
        { label: 'Tasks', value: stats.totalTasks, icon: CheckSquare, color: 'text-emerald-400' },
        { label: 'Assignments', value: stats.totalAssignments, icon: ClipboardList, color: 'text-indigo-400' },
        { label: 'Chat Messages', value: stats.totalChatMessages, icon: MessageSquare, color: 'text-pink-400' },
        { label: 'Papers', value: stats.totalPapers, icon: FolderOpen, color: 'text-orange-400' },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="bg-card/50 border-border/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
                            </div>
                            <Icon className={`h-8 w-8 ${color} opacity-60`} />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

// ─── Users Panel ────────────────────────────────────────────────────

function UsersPanel() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [roleUpdate, setRoleUpdate] = useState<{ userId: string; role: string; email: string } | null>(null)

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' })
            if (search) params.set('search', search)
            const res = await fetch(`/api/admin/users?${params}`)
            const data = await res.json()
            setUsers(data.users || [])
            setTotalPages(data.totalPages || 1)
            setTotal(data.total || 0)
        } catch {
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }, [page, search])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    const handleRoleChange = async () => {
        if (!roleUpdate) return
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: roleUpdate.userId, role: roleUpdate.role }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            toast.success(`Role updated to ${roleUpdate.role}`)
            fetchUsers()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update role')
        } finally {
            setRoleUpdate(null)
        }
    }

    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Users ({total})
                        </CardTitle>
                        <CardDescription>Manage user accounts and roles</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by email or name..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : users.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No users found.</p>
                ) : (
                    <div className="space-y-2">
                        {users.map(u => (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                            >
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={u.avatar_url || ''} />
                                    <AvatarFallback className="text-xs">
                                        {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {u.full_name || 'Unnamed'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                <Badge
                                    variant={u.role === 'admin' ? 'destructive' : 'secondary'}
                                    className="shrink-0"
                                >
                                    {u.role}
                                </Badge>
                                <Select
                                    value={u.role}
                                    onValueChange={(val) =>
                                        setRoleUpdate({ userId: u.id, role: val, email: u.email })
                                    }
                                >
                                    <SelectTrigger className="w-24 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                        <p className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Role change confirmation dialog */}
            <AlertDialog open={!!roleUpdate} onOpenChange={() => setRoleUpdate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5" />
                            Change User Role
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change <strong>{roleUpdate?.email}</strong>&apos;s
                            role to <Badge variant={roleUpdate?.role === 'admin' ? 'destructive' : 'secondary'} className="mx-1">{roleUpdate?.role}</Badge>?
                            {roleUpdate?.role === 'admin' && ' This will grant full admin access.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRoleChange}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}

// ─── Announcements Panel ────────────────────────────────────────────

function AnnouncementsPanel() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [type, setType] = useState<string>('info')
    const [creating, setCreating] = useState(false)

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/announcements?admin=true')
            const data = await res.json()
            setAnnouncements(Array.isArray(data) ? data : [])
        } catch {
            toast.error('Failed to load announcements')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

    const createAnnouncement = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error('Title and content are required')
            return
        }
        setCreating(true)
        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, type }),
            })
            if (!res.ok) throw new Error('Failed to create')
            toast.success('Announcement created')
            setTitle('')
            setContent('')
            setType('info')
            setShowForm(false)
            fetchAnnouncements()
        } catch {
            toast.error('Failed to create announcement')
        } finally {
            setCreating(false)
        }
    }

    const toggleActive = async (id: string, is_active: boolean) => {
        try {
            await fetch('/api/admin/announcements', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active }),
            })
            fetchAnnouncements()
        } catch {
            toast.error('Failed to update')
        }
    }

    const deleteAnnouncement = async (id: string) => {
        try {
            await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' })
            toast.success('Announcement deleted')
            fetchAnnouncements()
        } catch {
            toast.error('Failed to delete')
        }
    }

    const typeColors: Record<string, string> = {
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        maintenance: 'bg-red-500/10 text-red-400 border-red-500/30',
    }

    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5" />
                            Announcements
                        </CardTitle>
                        <CardDescription>Broadcast messages to all users</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setShowForm(!showForm)}>
                        <Plus className="h-4 w-4 mr-1" />
                        New
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Create Form */}
                {showForm && (
                    <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/20">
                        <Input
                            placeholder="Announcement title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                        <Textarea
                            placeholder="Announcement content..."
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={3}
                        />
                        <div className="flex items-center gap-3">
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="info">Info</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex-1" />
                            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={createAnnouncement} disabled={creating}>
                                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                Create
                            </Button>
                        </div>
                    </div>
                )}

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : announcements.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No announcements yet.</p>
                ) : (
                    <div className="space-y-2">
                        {announcements.map(a => (
                            <div
                                key={a.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${a.is_active ? 'border-border/50' : 'border-border/30 opacity-50'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className={typeColors[a.type] || ''} variant="outline">
                                            {a.type}
                                        </Badge>
                                        <span className="text-sm font-medium truncate">{a.title}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                        {new Date(a.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Switch
                                        checked={a.is_active}
                                        onCheckedChange={(val) => toggleActive(a.id, val)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => deleteAnnouncement(a.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ─── Feature Flags Panel ────────────────────────────────────────────

function FeatureFlagsPanel() {
    const [flags, setFlags] = useState<FeatureFlag[]>([])
    const [loading, setLoading] = useState(true)

    const fetchFlags = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/feature-flags')
            const data = await res.json()
            setFlags(Array.isArray(data) ? data : [])
        } catch {
            toast.error('Failed to load feature flags')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchFlags() }, [fetchFlags])

    const toggleFlag = async (id: string, is_enabled: boolean) => {
        try {
            await fetch('/api/admin/feature-flags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_enabled }),
            })
            setFlags(prev => prev.map(f => f.id === id ? { ...f, is_enabled } : f))
            toast.success(`Feature ${is_enabled ? 'enabled' : 'disabled'}`)
        } catch {
            toast.error('Failed to update')
        }
    }

    const flagLabels: Record<string, string> = {
        ai_chat: 'AI Study Buddy Chat',
        google_sync: 'Google Calendar/Classroom Sync',
        exam_prep: 'AI Exam Preparation',
        group_assignments: 'Group Assignments',
        budget_tracker: 'Budget Tracker',
        question_papers: 'Question Paper Sharing',
    }

    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ToggleLeft className="h-5 w-5" />
                    Feature Flags
                </CardTitle>
                <CardDescription>Enable or disable features across the platform</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : flags.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">No feature flags configured.</p>
                ) : (
                    <div className="space-y-3">
                        {flags.map(f => (
                            <div
                                key={f.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                            >
                                <div>
                                    <Label className="text-sm font-medium">
                                        {flagLabels[f.name] || f.name}
                                    </Label>
                                    {f.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {f.description}
                                        </p>
                                    )}
                                </div>
                                <Switch
                                    checked={f.is_enabled}
                                    onCheckedChange={(val) => toggleFlag(f.id, val)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
