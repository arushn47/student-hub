'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/components/ui/sheet'
import {
    ClipboardList,
    Plus,
    Calendar,
    CheckCircle2,
    Clock,
    Loader2,
    Trash2,
    Users,
    FileText,
    AlertCircle,
    MessageCircle,
    UserPlus,
    RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, isPast, isToday } from 'date-fns'
import { InviteToGroupDialog } from '@/components/assignments/InviteToGroupDialog'
import { PendingInvitations } from '@/components/assignments/PendingInvitations'
import { GroupChat } from '@/components/assignments/GroupChat'

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    )
}

interface Assignment {
    id: string
    title: string
    course: string | null
    due_date: string | null
    status: 'assigned' | 'missing' | 'done'
    grade: string | null
    is_group: boolean
    group_id: string | null
    notes: string | null
    created_at: string
}

const statusConfig = {
    'assigned': { label: 'Assigned', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: Clock },
    'missing': { label: 'Missing', color: 'bg-red-500/10 text-red-500 border-red-500/30', icon: AlertCircle },
    'done': { label: 'Done', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', icon: CheckCircle2 }
}

export default function AssignmentsPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [importing, setImporting] = useState(false)
    const [filter, setFilter] = useState<string>('assigned')
    const [resyncing, setResyncing] = useState(false)
    const [newAssignment, setNewAssignment] = useState({
        title: '',
        course: '',
        due_date: '',
        is_group: false,
        notes: ''
    })
    const supabase = createClient()

    const resyncStatus = async () => {
        setResyncing(true)
        try {
            const res = await fetch('/api/google/classroom/resync', { method: 'POST' })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message || `Updated ${data.updated} assignments`)
                fetchAssignments()
            } else {
                toast.error(data.error || 'Failed to resync')
            }
        } catch {
            toast.error('Failed to resync assignments')
        } finally {
            setResyncing(false)
        }
    }

    useEffect(() => {
        fetchAssignments()
    }, [])

    const fetchAssignments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('assignments')
                .select('*')
                .eq('user_id', user.id)
                .order('due_date', { ascending: true, nullsFirst: false })

            if (error) throw error

            // Map old status values to new ones and check for overdue
            const mapStatus = (oldStatus: string, dueDate: string | null): 'assigned' | 'missing' | 'done' => {
                let status: 'assigned' | 'missing' | 'done'
                switch (oldStatus) {
                    case 'pending':
                    case 'in-progress':
                        status = 'assigned'
                        break
                    case 'submitted':
                    case 'graded':
                        status = 'done'
                        break
                    case 'assigned':
                    case 'missing':
                    case 'done':
                        status = oldStatus as 'assigned' | 'missing' | 'done'
                        break
                    default:
                        status = 'assigned'
                }

                // If assigned and past due date, mark as missing
                if (status === 'assigned' && dueDate && isPast(new Date(dueDate))) {
                    status = 'missing'
                }

                return status
            }

            const mappedData = (data || []).map(a => ({
                ...a,
                status: mapStatus(a.status, a.due_date)
            }))

            setAssignments(mappedData)
        } catch (error) {
            console.error('Error fetching assignments:', error)
        } finally {
            setLoading(false)
        }
    }

    const createAssignment = async () => {
        if (!newAssignment.title.trim()) {
            toast.error('Please enter an assignment title')
            return
        }

        setCreating(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .from('assignments')
                .insert({
                    user_id: user.id,
                    title: newAssignment.title.trim(),
                    course: newAssignment.course || null,
                    due_date: newAssignment.due_date || null,
                    is_group: newAssignment.is_group,
                    notes: newAssignment.notes || null,
                    status: 'assigned'
                })

            if (error) throw error

            toast.success('Assignment added!')
            setDialogOpen(false)
            setNewAssignment({ title: '', course: '', due_date: '', is_group: false, notes: '' })
            fetchAssignments()
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message :
                (error && typeof error === 'object' && 'message' in error) ? String((error as { message: string }).message) :
                    JSON.stringify(error)
            console.error('Error creating assignment:', errorMessage, error)
            toast.error(`Failed to create assignment: ${errorMessage}`)
        } finally {
            setCreating(false)
        }
    }

    const updateStatus = async (id: string, status: Assignment['status']) => {
        try {
            const { error } = await supabase
                .from('assignments')
                .update({ status })
                .eq('id', id)

            if (error) throw error
            fetchAssignments()
        } catch (error) {
            console.error('Error updating assignment:', error)
        }
    }

    const deleteAssignment = async (id: string) => {
        try {
            const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Assignment deleted')
            fetchAssignments()
        } catch (error) {
            console.error('Error deleting assignment:', error)
        }
    }

    const importFromClassroom = async () => {
        setImporting(true)
        try {
            const res = await fetch('/api/google/classroom', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) {
                if (data.error === 'Google not connected') {
                    toast.error('Please connect Google in Settings first')
                } else if (data.needsReconnect) {
                    toast.error('Please reconnect Google in Settings to enable Classroom access', {
                        duration: 5000,
                        action: {
                            label: 'Go to Settings',
                            onClick: () => window.location.href = '/dashboard/settings'
                        }
                    })
                } else {
                    toast.error(data.error || 'Failed to import')
                }
                return
            }

            toast.success(data.message || `Imported ${data.imported} assignments`)
            fetchAssignments()
        } catch (error) {
            console.error('Import error:', error)
            toast.error('Failed to import from Google Classroom')
        } finally {
            setImporting(false)
        }
    }

    const filteredAssignments = assignments.filter((a: Assignment) => {
        if (filter === 'all') return true
        return a.status === filter
    })

    const stats = {
        total: assignments.length,
        assigned: assignments.filter(a => a.status === 'assigned').length,
        done: assignments.filter(a => a.status === 'done').length,
        missing: assignments.filter(a => a.status === 'missing').length
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
                    <h1 className="text-3xl font-bold gradient-text">Assignments</h1>
                    <p className="text-muted-foreground mt-1">Track your assignments and deadlines</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        onClick={resyncStatus}
                        disabled={resyncing}
                        className="gap-2"
                        title="Update status for all assignments from Google Classroom"
                    >
                        {resyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Resync Status</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={importFromClassroom}
                        disabled={importing}
                        className="gap-2"
                    >
                        {importing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <GoogleIcon className="h-4 w-4" />
                        )}
                        Import from Classroom
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gradient-primary text-white gap-2">
                                <Plus className="h-4 w-4" />
                                Add Assignment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>New Assignment</DialogTitle>
                                <DialogDescription>Add a new assignment to track</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Assignment Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g. Data Structures Lab 3"
                                        value={newAssignment.title}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="course">Course</Label>
                                        <Input
                                            id="course"
                                            placeholder="e.g. CSE2001"
                                            value={newAssignment.course}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, course: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="due_date">Due Date</Label>
                                        <Input
                                            id="due_date"
                                            type="datetime-local"
                                            value={newAssignment.due_date}
                                            onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_group"
                                        checked={newAssignment.is_group}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, is_group: e.target.checked })}
                                        className="rounded"
                                    />
                                    <Label htmlFor="is_group" className="cursor-pointer">Group Assignment</Label>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Any additional notes..."
                                        value={newAssignment.notes}
                                        onChange={(e) => setNewAssignment({ ...newAssignment, notes: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button onClick={createAssignment} disabled={creating} className="gradient-primary text-white">
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Add Assignment
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                <ClipboardList className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <Clock className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.assigned}</p>
                                <p className="text-xs text-muted-foreground">Assigned</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.done}</p>
                                <p className="text-xs text-muted-foreground">Done</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <AlertCircle className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.missing}</p>
                                <p className="text-xs text-muted-foreground">Missing</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Invitations */}
            <PendingInvitations />

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'assigned', 'missing', 'done'].map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className={filter === f ? 'gradient-primary text-white' : ''}
                    >
                        {f === 'all' ? 'All' : statusConfig[f as keyof typeof statusConfig]?.label || f}
                    </Button>
                ))}
            </div>

            {/* Assignment List */}
            {filteredAssignments.length === 0 ? (
                <Card className="glass-card">
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No assignments found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredAssignments.map((assignment) => (
                        <AssignmentCard
                            key={assignment.id}
                            assignment={assignment}
                            onStatusChange={(status) => updateStatus(assignment.id, status)}
                            onDelete={() => deleteAssignment(assignment.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function AssignmentCard({
    assignment,
    onStatusChange,
    onDelete
}: {
    assignment: Assignment
    onStatusChange: (status: Assignment['status']) => void
    onDelete: () => void
}) {
    const config = statusConfig[assignment.status]
    const StatusIcon = config.icon
    const isMissing = assignment.status === 'missing'
    const isDueToday = assignment.due_date && isToday(new Date(assignment.due_date))

    return (
        <Card className={cn(
            "glass-card group transition-all duration-300",
            isMissing && "border-red-500/50"
        )}>
            <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                        {/* Status Badge */}
                        <div className={cn("p-2 rounded-lg shrink-0", config.color.split(' ')[0])}>
                            <StatusIcon className={cn("h-5 w-5", config.color.split(' ')[1])} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium truncate">{assignment.title}</h3>
                                {assignment.is_group && (
                                    <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full shrink-0">
                                        <Users className="h-3 w-3" />
                                        Group
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                {assignment.course && <span>{assignment.course}</span>}
                                {assignment.due_date && (
                                    <span className={cn(
                                        "flex items-center gap-1",
                                        isMissing && "text-red-400",
                                        isDueToday && !isMissing && "text-yellow-400"
                                    )}>
                                        <Calendar className="h-3 w-3" />
                                        {isMissing ? 'Missing: ' : isDueToday ? 'Today: ' : ''}
                                        {format(new Date(assignment.due_date), 'MMM d, h:mm a')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 sm:self-auto self-end w-full sm:w-auto justify-end">
                        {/* Group Actions */}
                        {assignment.is_group && assignment.group_id ? (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1">
                                        <MessageCircle className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">Chat</span>
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[350px] sm:w-[400px] p-0">
                                    <GroupChat groupId={assignment.group_id} assignmentTitle={assignment.title} />
                                </SheetContent>
                            </Sheet>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => toast.info('Group invites coming soon!')}
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Invite</span>
                            </Button>
                        )}

                        <Select value={assignment.status} onValueChange={(v) => onStatusChange(v as Assignment['status'])}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="missing">Missing</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={onDelete}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
