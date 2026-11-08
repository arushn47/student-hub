'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    ClipboardList,
    CalendarDays,
    Timer,
    GraduationCap,
    BookOpen,
    Sparkles,
    ArrowRight,
    Bell,
    ChevronRight,
    BarChart3,
    Clock,
    BookMarked,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
    {
        icon: BarChart3,
        title: 'Grade Simulator',
        description: 'See what your CGPA can realistically reach. Simulate grade changes across subjects and instantly know your ceiling before exams — no spreadsheets needed.',
        color: 'from-violet-500 to-purple-500',
        bgColor: 'bg-violet-500/10',
        borderColor: 'border-violet-500/20',
    },
    {
        icon: Sparkles,
        title: 'GPA Improvement Advisor',
        description: 'Not all grade improvements are equal. StudentHub ranks which subjects would give you the highest CGPA boost if you appeared for supply — so you focus on the right ones.',
        color: 'from-amber-500 to-orange-500',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
    },
    {
        icon: BookMarked,
        title: 'Question Papers Bank',
        description: 'Past papers are hard to find — people rarely share them. StudentHub gives you a shared, searchable bank of question papers by subject, year, and exam type.',
        color: 'from-rose-500 to-pink-500',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/20',
    },
    {
        icon: Clock,
        title: 'Attendance Tracker',
        description: 'Log attendance per subject and simulate how many more classes you can skip before falling below 75%. Know your limit before you hit it.',
        color: 'from-sky-500 to-cyan-500',
        bgColor: 'bg-sky-500/10',
        borderColor: 'border-sky-500/20',
    },
    {
        icon: GraduationCap,
        title: 'Exam Prep',
        description: 'Generate practice questions and topic breakdowns from your notes. Useful when you actually have notes — still a work in progress.',
        color: 'from-indigo-500 to-violet-500',
        bgColor: 'bg-indigo-500/10',
        borderColor: 'border-indigo-500/20',
    },
    {
        icon: Bell,
        title: 'Smart Reminders',
        description: 'Set custom alerts for exams, project deadlines, and academic milestones so nothing slips through the cracks.',
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
    },
    {
        icon: CalendarDays,
        title: 'Timetable',
        description: 'Slot-based weekly schedule with class timing, classroom locations, and day-by-day lecture overviews.',
        color: 'from-fuchsia-500 to-purple-500',
        bgColor: 'bg-fuchsia-500/10',
        borderColor: 'border-fuchsia-500/20',
    },
    {
        icon: Timer,
        title: 'Pomodoro Timer',
        description: 'Customizable focus sessions with work/break intervals. Stay in flow without burning out.',
        color: 'from-orange-500 to-red-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
    },
    {
        icon: CalendarDays,
        title: 'Google Calendar Sync',
        description: 'Sync your timetable, exams, and personal events directly with Google Calendar for seamless scheduling.',
        color: 'from-lime-500 to-green-500',
        bgColor: 'bg-lime-500/10',
        borderColor: 'border-lime-500/20',
    },
]

const stats = [
    { value: '8+', label: 'Tools' },
    { value: 'CGPA', label: 'Simulator' },
    { value: 'Free', label: 'Question Papers' },
]

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-3xl" />
                <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='white'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
                    }}
                />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 border-b border-border/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
                                <GraduationCap className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-foreground">StudentHub</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/login">
                                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                                    Sign In
                                </Button>
                            </Link>
                            <Link href="/signup">
                                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                                    Get Started
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-20 pb-32 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8">
                        <BookOpen className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-purple-300">Built for VIT students</span>
                    </div>

                    {/* Main Heading */}
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
                        One Place for
                        <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                            Everything Academic
                        </span>
                    </h1>

                    {/* Subheading */}
                    <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                        Grades, timetable, attendance, exam prep, and past papers —
                        all in one dashboard. No more switching between ten different apps.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <Link href="/signup">
                            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105">
                                Get Started Free
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Link href="/login">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl border-border hover:bg-muted/50">
                                Sign In
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center">
                                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    {stat.value}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-border/50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                            Every Tool You Actually
                            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Need</span>
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            StudentHub replaces the scattered mess of apps, PDFs, and spreadsheets with one cohesive workspace built around how students actually study.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "group relative p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300",
                                    "hover:scale-[1.02] hover:shadow-xl cursor-default",
                                    feature.bgColor,
                                    feature.borderColor
                                )}
                            >
                                <div className={cn(
                                    "inline-flex p-3 rounded-xl bg-gradient-to-r mb-4",
                                    feature.color
                                )}>
                                    <feature.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold text-foreground mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    {feature.description}
                                </p>
                                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Grade Tracker Highlight Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-border/50">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
                                <Sparkles className="h-4 w-4 text-violet-400" />
                                <span className="text-sm text-violet-300">Smart Grade Tracking</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                                Know Exactly Where
                                <span className="block bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                    You Stand
                                </span>
                            </h2>
                            <p className="text-muted-foreground mb-8">
                                Upload your VIT grade history PDF and StudentHub parses it automatically —
                                calculating your CGPA, mapping courses to your curriculum distribution,
                                and showing exactly how many more credits you need in each category.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Auto-parse VIT grade PDFs — no manual entry',
                                    'Live CGPA & semester-wise SGPA',
                                    'Curriculum distribution tracking (B.Tech & M.Tech)',
                                    'Grade improvement advisor for supply/backlog planning',
                                ].map((item, index) => (
                                    <li key={index} className="flex items-center gap-3">
                                        <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                                            <ChevronRight className="h-3 w-3 text-violet-400" />
                                        </div>
                                        <span className="text-muted-foreground">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-3xl" />
                            <div className="relative bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6 space-y-3">
                                {[
                                    { label: 'Programme Core', earned: 55, total: 55, pct: 100, color: 'bg-emerald-500' },
                                    { label: 'Programme Elective', earned: 12, total: 15, pct: 80, color: 'bg-violet-500' },
                                    { label: 'UC - Natural Science Core', earned: 23, total: 23, pct: 100, color: 'bg-emerald-500' },
                                    { label: 'UC - Skill Development', earned: 10, total: 14, pct: 71, color: 'bg-amber-500' },
                                    { label: 'UC - Project and Internships', earned: 3, total: 17, pct: 18, color: 'bg-rose-500' },
                                ].map((row, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-muted-foreground truncate pr-2">{row.label}</span>
                                            <span className="text-foreground font-medium flex-shrink-0">{row.earned}/{row.total}</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-border flex justify-between">
                                    <span className="text-sm font-medium text-foreground">CGPA</span>
                                    <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">8.44</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-border/50">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 rounded-3xl blur-3xl" />
                        <div className="relative bg-card/30 backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-12">
                            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                                Stop Managing University
                                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Across 10 Tabs</span>
                            </h2>
                            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                                Everything from your grades to your timetable to your next exam deadline — in one place, always.
                            </p>
                            <Link href="/signup">
                                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105">
                                    Get Started Free
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-border/50 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                            <GraduationCap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">StudentHub</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        © 2026 StudentHub · Built by Arush Nandakumar Menon
                    </p>
                </div>
            </footer>
        </div>
    )
}
