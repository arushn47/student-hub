'use client'

import { useState, useEffect } from 'react'
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
    datetime: Date
    type: 'task' | 'event' | 'custom'
    notified: boolean
}

export default function RemindersPage() {
    const [reminders, setReminders] = useState<Reminder[]>([])
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

    const triggerNotification = (reminder: Reminder) => {
        if (notificationPermission === 'granted') {
            new Notification('⏰ Reminder', {
                body: reminder.title,
                icon: '/icon.png',
                tag: reminder.id,
            })
        }
        toast.info(`Reminder: ${reminder.title}`)
    }

    // Check notification permission on mount
    // Check notification permission on mount
    useEffect(() => {
        // Load reminders from localStorage
        const saved = localStorage.getItem('reminders')
        if (saved) {
            const parsed = JSON.parse(saved).map((r: Reminder & { datetime: string }) => ({
                ...r,
                datetime: new Date(r.datetime)
            }))
            setReminders(parsed)
        }
    }, [])

    // Save reminders to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('reminders', JSON.stringify(reminders))
    }, [reminders])

    // Check for due reminders every 30 seconds
    useEffect(() => {
        const checkReminders = () => {
            setReminders(prev => {
                let hasChanges = false
                const next = prev.map(reminder => {
                    if (!reminder.notified && isPast(reminder.datetime)) {
                        triggerNotification(reminder)
                        hasChanges = true
                        return { ...reminder, notified: true }
                    }
                    return reminder
                })
                return hasChanges ? next : prev
            })
        }

        const interval = setInterval(checkReminders, 30000)
        checkReminders() // Check immediately

        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notificationPermission])

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



    const addReminder = () => {
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

        const reminder: Reminder = {
            id: crypto.randomUUID(),
            title: newReminder.title,
            datetime,
            type: newReminder.type,
            notified: false,
        }

        setReminders(prev => [...prev, reminder].sort((a, b) => a.datetime.getTime() - b.datetime.getTime()))
        setNewReminder({ title: '', quickTime: '15min', customDate: '', customTime: '', type: 'custom' })
        setDialogOpen(false)
        toast.success(`Reminder set for ${format(datetime, 'MMM d, h:mm a')}`)
    }

    const deleteReminder = (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id))
        toast.success('Reminder deleted')
    }

    const upcomingReminders = reminders.filter(r => !r.notified && !isPast(r.datetime))
    const pastReminders = reminders.filter(r => r.notified || isPast(r.datetime))

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
                            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
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
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
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
                    <BellOff className="h-5 w-5 text-yellow-400 flex-shrink-0" />
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
                    <div className="text-center py-8 rounded-lg bg-white/[0.02] border border-white/5">
                        <Clock className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No upcoming reminders</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {upcomingReminders.map(reminder => (
                            <div
                                key={reminder.id}
                                className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-colors group"
                            >
                                <div className="p-2 rounded-full bg-purple-500/10">
                                    <Bell className="h-4 w-4 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-medium">{reminder.title}</p>
                                    <p className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(reminder.datetime, 'EEE, MMM d')} at {format(reminder.datetime, 'h:mm a')}
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
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 group"
                            >
                                <div className="p-1.5 rounded-full bg-gray-500/10">
                                    <Bell className="h-3 w-3 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-gray-400 text-sm line-through">{reminder.title}</p>
                                    <p className="text-xs text-gray-500">
                                        {format(reminder.datetime, 'MMM d, h:mm a')}
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
                            onClick={() => setReminders(prev => prev.filter(r => !r.notified && !isPast(r.datetime)))}
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
