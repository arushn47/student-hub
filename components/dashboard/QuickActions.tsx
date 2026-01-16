'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    Timer,
    FileText,
    CheckSquare,
    Layers
} from 'lucide-react'

const quickActions = [
    {
        label: 'New Note',
        icon: FileText,
        href: '/dashboard/notes/new',
        color: 'from-blue-500 to-cyan-500',
    },
    {
        label: 'Add Task',
        icon: CheckSquare,
        href: '/dashboard/tasks?new=true',
        color: 'from-emerald-500 to-teal-500',
    },
    {
        label: 'Start Focus',
        icon: Timer,
        href: '/dashboard/pomodoro',
        color: 'from-rose-500 to-pink-500',
    },
    {
        label: 'Study Cards',
        icon: Layers,
        href: '/dashboard/flashcards',
        color: 'from-amber-500 to-orange-500',
    },
]

export function QuickActions() {
    return (
        <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action) => (
                    <Link key={action.label} href={action.href}>
                        <Button
                            variant="ghost"
                            className={`w-full h-auto py-4 flex-col gap-2 bg-gradient-to-br ${action.color} bg-opacity-10 hover:bg-opacity-20 border border-white/[0.08] hover:border-white/[0.15] rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group`}
                        >
                            <div className="p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                                <action.icon className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-sm font-medium text-white">{action.label}</span>
                        </Button>
                    </Link>
                ))}
            </div>
        </div>
    )
}
