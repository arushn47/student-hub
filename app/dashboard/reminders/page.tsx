'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
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
import { Bell, BellOff, Plus, Trash2, Clock, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { format, addMinutes, addHours, addDays, isPast } from 'date-fns'

interface Reminder {
    id: string
    title: string
    remind_at: string
    type: 'task' | 'event' | 'custom'
    is_completed: boolean
    created_at: string
}

export default function RemindersPage() {
    const [reminders, setReminders] = useState<Reminder[]>([])
    const [loading, setLoading] = useState(true)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
    )
    const [dialogOpen, setDialogOpen] = useState(false)
    const [newReminder, setNewReminder] = useState({
        title: '',
        quickTime: '15min',
        customDate: '',
        customTime: '',
        type: 'custom' as const,
    })

    const triggerNotification = useCallback((reminder: Reminder) => {
        if (notificationPermission === 'granted') {
            new Notification('⏰ Reminder', {
                body: reminder.title,
                icon: '/icon.png',
                tag: reminder.id,
            })
        }
        toast.info(`Reminder: ${reminder.title}`)
    }, [notificationPermission])

    // Fetch reminders from API on mount
    const fetchReminders = useCallback(async () => {
        try {
            const res = await fetch('/api/reminders')
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setReminders(data.reminders ?? [])
        } catch {
            toast.error('Failed to load reminders')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchReminders()
    }, [fetchReminders])

    // Check for due reminders every 30 seconds
    useEffect(() => {
        const checkReminders = () => {
            setReminders(prev => {
                let hasChanges = false
                const next = prev.map(reminder => {
                    if (!reminder.is_completed && isPast(new Date(reminder.remind_at))) {
                        triggerNotification(reminder)
                        hasChanges = true
                        // Mark completed in background
                        fetch('/api/reminders', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: reminder.id, is_completed: true }),
                        }).catch(() => { /* silent */ })
                        return { ...reminder, is_completed: true }
                    }
                    return reminder
                })
                return hasChanges ? next : prev
            })
        }

        const interval = setInterval(checkReminders, 30000)
        checkReminders()

        return () => clearInterval(interval)
    }, [triggerNotification])

    const requestPermission = async () => {
        if (!('Notification' in window)) {
            toast.error('This browser does not support notifications')
            return
        }

        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)

        if (permission === 'granted') {
            toast.success('Notifications enabled!')
            new Notification('StudentHub Reminders', {
                body: 'You will now receive reminder notifications! 🔔',
                icon: '/icon.png'
            })
        } else if (permission === 'denied') {
            toast.error('Notifications blocked. Enable them in browser settings.')
        }
    }

    const addReminder = async () => {
        if (!newReminder.title.trim()) {
            toast.error('Please enter a reminder title')
            return
        }

        let datetime: Date
        const now = new Date()

        switch (newReminder.quickTime) {
            case '15min':
                datetime = addMinutes(now, 15)
                break
            case '30min':
                datetime = addMinutes(now, 30)
                break
            case '1hour':
                datetime = addHours(now, 1)
                break
            case '3hours':
                datetime = addHours(now, 3)
                break
            case 'tomorrow':
                datetime = addDays(now, 1)
                datetime.setHours(9, 0, 0, 0)
                break
            case 'custom':
                if (!newReminder.customDate || !newReminder.customTime) {
                    toast.error('Please select date and time')
                    return
                }
                datetime = new Date(`${newReminder.customDate}T${newReminder.customTime}`)
                break
            default:
                datetime = addMinutes(now, 15)
        }

        // Optimistic insert with temp ID
        const tempId = crypto.randomUUID()
        const optimistic: Reminder = {
            id: tempId,
            title: newReminder.title,
            remind_at: datetime.toISOString(),
            type: newReminder.type,
            is_completed: false,
            created_at: now.toISOString(),
        }

        setReminders(prev =>
            [...prev, optimistic].sort((a, b) =>
                new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
            )
        )
        setNewReminder({ title: '', quickTime: '15min', customDate: '', customTime: '', type: 'custom' })
        setDialogOpen(false)
        toast.success(`Reminder set for ${format(datetime, 'MMM d, h:mm a')}`)

        // Persist to DB
        try {
            const res = await fetch('/api/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: optimistic.title,
                    remind_at: optimistic.remind_at,
                    type: optimistic.type,
                }),
            })
            if (!res.ok) throw new Error('Failed to save')
            const { reminder } = await res.json()
            // Replace temp ID with real DB record
            setReminders(prev => prev.map(r => r.id === tempId ? reminder : r))
        } catch {
            setReminders(prev => prev.filter(r => r.id !== tempId))
            toast.error('Failed to save reminder')
        }
    }

    const deleteReminder = async (id: string) => {
        const previous = reminders
        setReminders(prev => prev.filter(r => r.id !== id))
        toast.success('Reminder deleted')

        try {
            const res = await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
        } catch {
            setReminders(previous)
            toast.error('Failed to delete reminder')
        }
    }

    const upcomingReminders = reminders.filter(r => !r.is_completed && !isPast(new Date(r.remind_at)))
    const pastReminders = reminders.filter(r => r.is_completed || isPast(new Date(r.remind_at)))

    if (loading) {
        return (
            <div className="space-y-6 max-w-3xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Bell className="h-6 w-6 text-purple-400" />
                            Reminders
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Set reminders for tasks, events, and more</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-white/3 border border-white/10">
                            <div className="p-2 rounded-full bg-white/5">
                                <div className="h-4 w-4 rounded-full bg-white/10 animate-pulse" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
                                <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Bell className="h-6 w-6 text-purple-400" />
                        Reminders
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Set reminders for tasks, events, and more
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {notificationPermission !== 'granted' && (
                        <Button
                            variant="outline"
                            onClick={requestPermission}
                            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                        >
                            <BellOff className="mr-2 h-4 w-4" />
                            Enable Notifications
                        </Button>
                    )}
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Reminder
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-white/10">
                            <DialogHeader>
                                <DialogTitle className="text-white">New Reminder</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Input
                                    placeholder="What do you want to remember?"
                                    value={newReminder.title}
                                    onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                                />

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">When?</label>
                                    <Select
                                        value={newReminder.quickTime}
                                        onValueChange={(v) => setNewReminder(prev => ({ ...prev, quickTime: v }))}
                                    >
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-900 border-white/10">
                                            <SelectItem value="15min">In 15 minutes</SelectItem>
                                            <SelectItem value="30min">In 30 minutes</SelectItem>
                                            <SelectItem value="1hour">In 1 hour</SelectItem>
                                            <SelectItem value="3hours">In 3 hours</SelectItem>
                                            <SelectItem value="tomorrow">Tomorrow at 9 AM</SelectItem>
                                            <SelectItem value="custom">Custom date/time</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {newReminder.quickTime === 'custom' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="date"
                                            value={newReminder.customDate}
                                            onChange={(e) => setNewReminder(prev => ({ ...prev, customDate: e.target.value }))}
                                            className="bg-white/5 border-white/10 text-white"
                                        />
                                        <Input
                                            type="time"
                                            value={newReminder.customTime}
                                            onChange={(e) => setNewReminder(prev => ({ ...prev, customTime: e.target.value }))}
                                            className="bg-white/5 border-white/10 text-white"
                                        />
                                    </div>
                                )}

                                <Button
                                    onClick={addReminder}
                                    className="w-full bg-linear-to-r from-purple-500 to-pink-500"
                                >
                                    Set Reminder
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Notification Permission Alert */}
            {notificationPermission === 'default' && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
                    <BellOff className="h-5 w-5 text-yellow-400 shrink-0" />
                    <div className="flex-1">
                        <p className="text-yellow-200 text-sm">
                            Enable browser notifications to get alerted when reminders are due.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={requestPermission}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    >
                        Enable
                    </Button>
                </div>
            )}

            {/* Upcoming Reminders */}
            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Upcoming ({upcomingReminders.length})
                </h2>
                {upcomingReminders.length === 0 ? (
                    <div className="text-center py-8 rounded-lg bg-white/2 border border-white/5">
                        <Clock className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No upcoming reminders</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {upcomingReminders.map(reminder => (
                            <div
                                key={reminder.id}
                                className="flex items-center gap-3 p-4 rounded-lg bg-white/3 border border-white/10 hover:border-purple-500/30 transition-colors group"
                            >
                                <div className="p-2 rounded-full bg-purple-500/10">
                                    <Bell className="h-4 w-4 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-medium">{reminder.title}</p>
                                    <p className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(reminder.remind_at), 'EEE, MMM d')} at {format(new Date(reminder.remind_at), 'h:mm a')}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => deleteReminder(reminder.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Past Reminders */}
            {pastReminders.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                        Completed ({pastReminders.length})
                    </h2>
                    <div className="space-y-2 opacity-60">
                        {pastReminders.slice(0, 5).map(reminder => (
                            <div
                                key={reminder.id}
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/2 border border-white/5 group"
                            >
                                <div className="p-1.5 rounded-full bg-gray-500/10">
                                    <Bell className="h-3 w-3 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-gray-400 text-sm line-through">{reminder.title}</p>
                                    <p className="text-xs text-gray-500">
                                        {format(new Date(reminder.remind_at), 'MMM d, h:mm a')}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                    onClick={() => deleteReminder(reminder.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    {pastReminders.length > 5 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                                const ids = pastReminders.map(r => r.id)
                                setReminders(prev => prev.filter(r => !r.is_completed && !isPast(new Date(r.remind_at))))
                                for (const id of ids) {
                                    fetch(`/api/reminders?id=${id}`, { method: 'DELETE' }).catch(() => { /* silent */ })
                                }
                                toast.success('Cleared completed reminders')
                            }}
                            className="text-gray-500 hover:text-red-400"
                        >
                            Clear all completed
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
