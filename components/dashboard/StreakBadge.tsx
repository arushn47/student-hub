'use client'

import { useEffect, useState } from 'react'
import { Flame, TrendingUp, CheckCircle2 } from 'lucide-react'

interface StreakData {
    streak: number
    isActiveToday?: boolean
    loading: boolean
}

export function StreakBadge({ pendingTasks }: { pendingTasks: number }) {
    const [streakData, setStreakData] = useState<StreakData>({ streak: 0, loading: true })

    useEffect(() => {
        // Log activity on page load
        fetch('/api/activity', { method: 'POST' }).catch(console.error)

        // Fetch streak
        fetch('/api/activity')
            .then(res => res.json())
            .then(data => {
                setStreakData({
                    streak: data.streak || 0,
                    isActiveToday: data.isActiveToday,
                    loading: false
                })
            })
            .catch(() => setStreakData({ streak: 0, loading: false }))
    }, [])

    if (streakData.loading) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 animate-pulse">
                <span className="font-medium">Loading...</span>
            </div>
        )
    }

    // Show streak if user has one
    if (streakData.streak > 0) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Flame className="h-4 w-4" />
                <span className="font-medium">{streakData.streak} day streak 🔥</span>
            </div>
        )
    }

    // No streak - show task status instead
    if (pendingTasks > 0) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">{pendingTasks} tasks pending</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">All caught up!</span>
        </div>
    )
}
