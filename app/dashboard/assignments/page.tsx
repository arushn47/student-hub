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
    ClipboardList,
    Plus,
    Calendar,
    CheckCircle2,
    Clock,
    Loader2,
    Trash2,
    Users,
    FileText,
    AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'

interface Assignment {
    id: string
    title: string
    course: string | null
    due_date: string | null
    status: 'pending' | 'in-progress' | 'submitted' | 'graded'
    grade: string | null
    is_group: boolean
    notes: string | null
    created_at: string
}

const statusConfig = {
    'pending': { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', icon: Clock },
    'in-progress': { label: 'In Progress', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: FileText },
    'submitted': { label: 'Submitted', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', icon: CheckCircle2 },
    'graded': { label: 'Graded', color: 'bg-violet-500/10 text-violet-500 border-violet-500/30', icon: CheckCircle2 }
}

export default function AssignmentsPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [filter, setFilter] = useState<string>('all')
    const [newAssignment, setNewAssignment] = useState({
        title: '',
        course: '',
        due_date: '',
        is_group: false,
        notes: ''
    })
    const supabase = createClient()

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
            setAssignments(data || [])
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
                    status: 'pending'
                })

            if (error) throw error

            toast.success('Assignment added!')
            setDialogOpen(false)
            setNewAssignment({ title: '', course: '', due_date: '', is_group: false, notes: '' })
            fetchAssignments()
        } catch (error) {
            console.error('Error creating assignment:', error)
            toast.error('Failed to create assignment')
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

    const filteredAssignments = assignments.filter(a => {
        if (filter === 'all') return true
        return a.status === filter
    })

    const stats = {
        total: assignments.length,
        pending: assignments.filter(a => a.status === 'pending').length,
        submitted: assignments.filter(a => a.status === 'submitted' || a.status === 'graded').length,
        overdue: assignments.filter(a => a.status === 'pending' && a.due_date && isPast(new Date(a.due_date))).length
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
                            <div className="p-2 rounded-lg bg-yellow-500/10">
                                <Clock className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.pending}</p>
                                <p className="text-xs text-muted-foreground">Pending</p>
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
                                <p className="text-2xl font-bold">{stats.submitted}</p>
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
                                <p className="text-2xl font-bold">{stats.overdue}</p>
                                <p className="text-xs text-muted-foreground">Overdue</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'in-progress', 'submitted', 'graded'].map((f) => (
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
    const isOverdue = assignment.due_date && isPast(new Date(assignment.due_date)) && assignment.status === 'pending'
    const isDueToday = assignment.due_date && isToday(new Date(assignment.due_date))

    return (
        <Card className={cn(
            "glass-card group transition-all duration-300",
            isOverdue && "border-red-500/50"
        )}>
            <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
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
                                        isOverdue && "text-red-400",
                                        isDueToday && !isOverdue && "text-yellow-400"
                                    )}>
                                        <Calendar className="h-3 w-3" />
                                        {isOverdue ? 'Overdue: ' : isDueToday ? 'Today: ' : ''}
                                        {format(new Date(assignment.due_date), 'MMM d, h:mm a')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Select value={assignment.status} onValueChange={(v) => onStatusChange(v as Assignment['status'])}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="graded">Graded</SelectItem>
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
