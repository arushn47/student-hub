'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    FileText,
    CheckSquare,
    Calendar,
    Timer,
    GraduationCap,
    Brain,
    Sparkles,
    ArrowRight,
    BookOpen,
    Target,
    Bell,
    ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
    {
        icon: FileText,
        title: 'Smart Notes',
        description: 'AI-powered note-taking with auto-summaries, quizzes, and speech-to-text',
        color: 'from-violet-500 to-purple-500',
        bgColor: 'bg-violet-500/10',
        borderColor: 'border-violet-500/20',
    },
    {
        icon: CheckSquare,
        title: 'Task Management',
        description: 'Kanban boards and intelligent task prioritization to stay organized',
        color: 'from-amber-500 to-orange-500',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
    },
    {
        icon: GraduationCap,
        title: 'Exam Prep',
        description: 'AI generates practice questions, flashcards, and study guides from your notes',
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
    },
    {
        icon: Timer,
        title: 'Pomodoro Timer',
        description: 'Stay focused with customizable work sessions and break reminders',
        color: 'from-rose-500 to-pink-500',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/20',
    },
    {
        icon: Calendar,
        title: 'Smart Calendar',
        description: 'Class schedules, assignments, and tasks all in one unified view',
        color: 'from-cyan-500 to-blue-500',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/20',
    },
    {
        icon: Bell,
        title: 'Reminders',
        description: 'Never miss a deadline with smart push notifications',
        color: 'from-fuchsia-500 to-purple-500',
        bgColor: 'bg-fuchsia-500/10',
        borderColor: 'border-fuchsia-500/20',
    },
]

const stats = [
    { value: '10x', label: 'More Productive' },
    { value: '100%', label: 'Free to Use' },
    { value: '24/7', label: 'AI Assistant' },
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
                                <BookOpen className="h-5 w-5 text-white" />
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
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-purple-300">AI-Powered Student Productivity</span>
                    </div>

                    {/* Main Heading */}
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
                        Your Ultimate
                        <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                            Study Companion
                        </span>
                    </h1>

                    {/* Subheading */}
                    <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                        Notes, tasks, exam prep, and focus tools — all powered by AI.
                        Everything you need to ace your studies in one beautiful app.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <Link href="/signup">
                            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105">
                                Start Free Today
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Link href="/dashboard">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl border-border hover:bg-muted/50">
                                <Target className="mr-2 h-5 w-5" />
                                Try Demo
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
                            Everything You Need to
                            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Excel</span>
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Powerful tools designed specifically for students, enhanced with AI to save you time.
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

            {/* AI Study Buddy Section */}
            <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-border/50">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                                <Brain className="h-4 w-4 text-emerald-400" />
                                <span className="text-sm text-emerald-300">AI-Powered</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                                Meet Your Personal
                                <span className="block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                                    Study Buddy
                                </span>
                            </h2>
                            <p className="text-muted-foreground mb-8">
                                An AI assistant that understands your courses, helps explain concepts,
                                generates practice questions, and keeps you motivated throughout your study sessions.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Explain complex topics in simple terms',
                                    'Generate quizzes from your notes',
                                    'Create flashcards automatically',
                                    'Answer questions 24/7',
                                ].map((item, index) => (
                                    <li key={index} className="flex items-center gap-3">
                                        <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <Sparkles className="h-3 w-3 text-emerald-400" />
                                        </div>
                                        <span className="text-muted-foreground">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
                            <div className="relative bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500">
                                        <Brain className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Study Buddy</p>
                                        <p className="text-xs text-muted-foreground">Always here to help</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-muted/50 rounded-lg rounded-bl-none p-3">
                                        <p className="text-sm text-muted-foreground">
                                            Can you explain the concept of recursion in simple terms?
                                        </p>
                                    </div>
                                    <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-lg rounded-br-none p-3">
                                        <p className="text-sm text-foreground">
                                            Think of recursion like a Russian nesting doll 🪆 — each doll contains a smaller version of itself.
                                            In programming, a function calls itself with a simpler version of the problem until it reaches the simplest case!
                                        </p>
                                    </div>
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
                                Ready to Transform Your
                                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Study Routine?</span>
                            </h2>
                            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                                Join thousands of students who are already studying smarter, not harder.
                            </p>
                            <Link href="/signup">
                                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105">
                                    Get Started for Free
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
                            <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">StudentHub</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        © 2026 StudentHub. Built for students, by students.
                    </p>
                </div>
            </footer>
        </div>
    )
}
