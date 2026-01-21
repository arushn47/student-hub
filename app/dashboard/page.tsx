import { createClient } from '@/lib/supabase/server'
import { MotivationCard } from '@/components/dashboard/MotivationCard'
import { TasksWidget } from '@/components/dashboard/TasksWidget'
import { NotesWidget } from '@/components/dashboard/NotesWidget'
import { NextClassWidget } from '@/components/dashboard/NextClassWidget'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { FileText, CheckSquare, Clock, Target, Palmtree, TrendingUp } from 'lucide-react'
import { StreakBadge } from '@/components/dashboard/StreakBadge'
import type { Task, Note, ClassSchedule, SemesterBreak, Semester } from '@/types'

async function getStats(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string) {
    const [notesResult, tasksResult, classesResult, semestersResult, breaksResult, subjectsResult] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('user_id', userId).is('deleted_at', null).order('due_date', { ascending: true }),
        supabase.from('class_schedules').select('*').eq('user_id', userId).eq('is_active', true),
        supabase.from('semesters').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
        supabase.from('semester_breaks').select('*').eq('user_id', userId).order('start_date', { ascending: true }),
        supabase.from('exam_subjects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    // Find active semester and filter breaks
    const semesters = (semestersResult.data || []) as Semester[]
    const allBreaks = (breaksResult.data || []) as SemesterBreak[]
    const activeSemester = semesters.find(s => s.is_active)

    // Filter breaks to only those in the active semester
    const breaks = activeSemester
        ? allBreaks.filter(b => b.semester_id === activeSemester.id)
        : allBreaks

    return {
        notes: (notesResult.data || []) as Note[],
        tasks: (tasksResult.data || []) as Task[],
        classes: (classesResult.data || []) as ClassSchedule[],
        subjects: (subjectsResult.data || []) as any[],
        breaks,
    }
}

// Check if a date is during any break
function isOnBreak(date: Date, breaks: SemesterBreak[]): { onBreak: boolean; breakName?: string } {
    const today = date.toISOString().split('T')[0]

    for (const b of breaks) {
        if (today >= b.start_date && today <= b.end_date) {
            return { onBreak: true, breakName: b.name }
        }
    }
    return { onBreak: false }
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Handle guest mode - show demo data
    if (!user) {
        return <DashboardContent
            notes={[]}
            tasks={[]}
            classes={[]}
            subjects={[]}
            breaks={[]}
            userName="Guest"
        />
    }

    const { notes, tasks, classes, subjects, breaks } = await getStats(supabase, user.id)
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Student'

    return <DashboardContent
        notes={notes}
        tasks={tasks}
        classes={classes}
        subjects={subjects}
        breaks={breaks}
        userName={firstName}
    />
}

function DashboardContent({
    notes,
    tasks,
    classes,
    subjects,
    breaks,
    userName
}: {
    notes: Note[]
    tasks: Task[]
    classes: ClassSchedule[]
    subjects: any[]
    breaks: SemesterBreak[]
    userName: string
}) {
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

    // Get today's date info
    const today = new Date()
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
    const formattedDate = today.toLocaleDateString('en-US', dateOptions)

    // Check if today is on break
    const breakStatus = isOnBreak(today, breaks)
    const classesToday = breakStatus.onBreak ? 0 : classes.filter(c => c.day_of_week === today.getDay()).length

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">{formattedDate}</p>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                        {greeting()}, <span className="gradient-text">{userName}</span>! 👋
                    </h1>
                    <p className="text-gray-400">Ready to crush your exams?</p>
                </div>

                {/* Quick stats badge */}
                <div className="flex items-center gap-2 text-sm">
                    {breakStatus.onBreak ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <Palmtree className="h-4 w-4" />
                            <span className="font-medium">{breakStatus.breakName || 'On Break'}</span>
                        </div>
                    ) : (
                        <StreakBadge pendingTasks={pendingTasks} />
                    )}
                </div>
            </div>

            {/* Exam Prep Hero (New!) */}
            {subjects.length > 0 ? (
                <div className="relative p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Target className="w-32 h-32 text-amber-500 transform rotate-12" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30">
                                    Top Priority
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Continue Studying</h3>
                            <p className="text-gray-400 max-w-lg">
                                You have {subjects.length} active subjects. Pick up where you left off with
                                <span className="text-amber-400 font-medium ml-1">{subjects[0].name}</span>.
                            </p>
                        </div>

                        <a href={`/dashboard/exam-prep/${subjects[0].id}`} className="shrink-0 w-full md:w-auto">
                            <button className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-amber-900/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2">
                                Resume Prep
                                <TrendingUp className="h-4 w-4" />
                            </button>
                        </a>
                    </div>
                </div>
            ) : (
                <MotivationCard />
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Target}
                    label="Active Subjects"
                    value={subjects.length}
                    color="amber"
                    trend="Exam Prep"
                />
                <StatCard
                    icon={CheckSquare}
                    label="Pending Tasks"
                    value={pendingTasks}
                    color="violet"
                    trend={`${completionRate}% complete`}
                />
                <StatCard
                    icon={FileText}
                    label="Total Notes"
                    value={notes.length}
                    color="emerald"
                    trend="Knowledge Base"
                />
                <StatCard
                    icon={breakStatus.onBreak ? Palmtree : Clock}
                    label="Classes Today"
                    value={classesToday}
                    color="cyan"
                    trend={breakStatus.onBreak ? 'Enjoy Break' : 'Scheduled'}
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
