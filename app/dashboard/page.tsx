import { createClient } from '@/lib/supabase/server'
import { MotivationCard } from '@/components/dashboard/MotivationCard'
import { TasksWidget } from '@/components/dashboard/TasksWidget'
import { NotesWidget } from '@/components/dashboard/NotesWidget'
import { NextClassWidget } from '@/components/dashboard/NextClassWidget'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { FileText, CheckSquare, Clock, Target, Timer, Flame, TrendingUp } from 'lucide-react'
import type { Task, Note, ClassSchedule } from '@/types'

async function getStats(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string) {
    const [notesResult, tasksResult, classesResult] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('user_id', userId).is('deleted_at', null).order('due_date', { ascending: true }),
        supabase.from('class_schedules').select('*').eq('user_id', userId).eq('is_active', true),
    ])

    return {
        notes: (notesResult.data || []) as Note[],
        tasks: (tasksResult.data || []) as Task[],
        classes: (classesResult.data || []) as ClassSchedule[],
    }
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { notes, tasks, classes } = await getStats(supabase, user!.id)

    const completedTasks = tasks.filter(t => t.status === 'done').length
    const totalTasks = tasks.length
    const pendingTasks = totalTasks - completedTasks
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const greeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Student'

    // Get today's date info
    const today = new Date()
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
    const formattedDate = today.toLocaleDateString('en-US', dateOptions)

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">{formattedDate}</p>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                        {greeting()}, <span className="gradient-text">{firstName}</span>! 👋
                    </h1>
                    <p className="text-gray-400">Here&apos;s your productivity overview for today.</p>
                </div>

                {/* Quick stats badge */}
                <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Flame className="h-4 w-4" />
                        <span className="font-medium">3 day streak</span>
                    </div>
                </div>
            </div>

            {/* Motivation Card */}
            <MotivationCard />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={FileText}
                    label="Total Notes"
                    value={notes.length}
                    color="violet"
                    trend="+2 this week"
                />
                <StatCard
                    icon={CheckSquare}
                    label="Pending Tasks"
                    value={pendingTasks}
                    color="amber"
                    trend={`${completionRate}% complete`}
                />
                <StatCard
                    icon={Target}
                    label="Completed"
                    value={completedTasks}
                    color="emerald"
                    trend="Keep it up!"
                />
                <StatCard
                    icon={Clock}
                    label="Classes Today"
                    value={classes.filter(c => c.day_of_week === today.getDay()).length}
                    color="cyan"
                    trend={`${classes.length} total`}
                />
            </div>

            {/* Quick Actions */}
            <QuickActions />

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TasksWidget tasks={tasks} />
                <NotesWidget notes={notes} />
            </div>

            {/* Next Class */}
            <NextClassWidget classes={classes} />
        </div>
    )
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    trend
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: number
    color: 'violet' | 'amber' | 'emerald' | 'cyan'
    trend?: string
}) {
    const colors = {
        violet: {
            bg: 'from-violet-500/15 to-violet-500/5',
            border: 'border-violet-500/20',
            icon: 'text-violet-400',
            iconBg: 'bg-violet-500/20',
        },
        amber: {
            bg: 'from-amber-500/15 to-amber-500/5',
            border: 'border-amber-500/20',
            icon: 'text-amber-400',
            iconBg: 'bg-amber-500/20',
        },
        emerald: {
            bg: 'from-emerald-500/15 to-emerald-500/5',
            border: 'border-emerald-500/20',
            icon: 'text-emerald-400',
            iconBg: 'bg-emerald-500/20',
        },
        cyan: {
            bg: 'from-cyan-500/15 to-cyan-500/5',
            border: 'border-cyan-500/20',
            icon: 'text-cyan-400',
            iconBg: 'bg-cyan-500/20',
        },
    }

    const c = colors[color]

    return (
        <div className={`p-5 rounded-2xl bg-gradient-to-br ${c.bg} ${c.border} border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-default group`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${c.iconBg} transition-transform group-hover:scale-110`}>
                    <Icon className={`h-5 w-5 ${c.icon}`} />
                </div>
                {trend && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-sm text-gray-400">{label}</p>
        </div>
    )
}
