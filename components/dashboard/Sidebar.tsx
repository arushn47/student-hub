'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    LayoutDashboard,
    FileText,
    CheckSquare,
    Calendar,
    Clock,
    LogOut,
    Menu,
    Settings,
    ChevronLeft,
    ChevronRight,
    Timer,
    Target,
    GraduationCap,
    Wallet,
    FolderOpen,
    Sparkles,
    Bell,
    ClipboardList,
    Quote,
    UserCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
    user: {
        email?: string
        user_metadata?: {
            full_name?: string
            avatar_url?: string
        }
    } | null
}

const navGroups = [
    {
        title: null, // "Overview" implied
        items: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'violet' },
        ]
    },
    {
        title: 'Academics',
        items: [
            { href: '/dashboard/exam-prep', label: 'Exam Prep', icon: Target, color: 'amber' },
            { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare, color: 'emerald' },
            { href: '/dashboard/notes', label: 'Notes', icon: FileText, color: 'blue' },
            { href: '/dashboard/assignments', label: 'Assignments', icon: ClipboardList, color: 'indigo' },
            { href: '/dashboard/grades', label: 'Grades', icon: GraduationCap, color: 'pink' },
            { href: '/dashboard/citations', label: 'Citations', icon: Quote, color: 'teal' },
        ]
    },
    {
        title: 'Campus Life',
        items: [
            { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, color: 'cyan' },
            { href: '/dashboard/timetable', label: 'Timetable', icon: Clock, color: 'purple' },
            { href: '/dashboard/attendance', label: 'Attendance', icon: UserCheck, color: 'lime' },
        ]
    },
    {
        title: 'Tools',
        items: [
            { href: '/dashboard/pomodoro', label: 'Focus Timer', icon: Timer, color: 'rose' },
            { href: '/dashboard/reminders', label: 'Reminders', icon: Bell, color: 'yellow' },
            { href: '/dashboard/budget', label: 'Budget', icon: Wallet, color: 'green' },
        ]
    },
    {
        title: 'System',
        items: [
            { href: '/dashboard/settings/semesters', label: 'Semesters', icon: GraduationCap, color: 'fuchsia' },
            { href: '/dashboard/settings', label: 'Settings', icon: Settings, color: 'slate' },
        ]
    }
]

const iconColors: Record<string, string> = {
    violet: 'group-hover:text-violet-400',
    blue: 'group-hover:text-blue-400',
    emerald: 'group-hover:text-emerald-400',
    rose: 'group-hover:text-rose-400',
    amber: 'group-hover:text-amber-400',
    cyan: 'group-hover:text-cyan-400',
    yellow: 'group-hover:text-yellow-400',
    purple: 'group-hover:text-purple-400',
    pink: 'group-hover:text-pink-400',
    orange: 'group-hover:text-orange-400',
    green: 'group-hover:text-green-400',
    slate: 'group-hover:text-slate-400',
    lime: 'group-hover:text-lime-400',
    indigo: 'group-hover:text-indigo-400',
    teal: 'group-hover:text-teal-400',
    fuchsia: 'group-hover:text-fuchsia-400',
}

const activeColors: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    pink: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    lime: 'text-lime-400 bg-lime-500/10 border-lime-500/30',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    fuchsia: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30',
}

import NProgress from 'nprogress'
import { ClientOnly } from '../ClientOnly'

function NavItem({
    href,
    label,
    icon: Icon,
    color,
    isActive,
    collapsed,
    onClick
}: {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    isActive: boolean
    collapsed: boolean
    onClick?: () => void
}) {
    const handleClick = () => {
        if (!isActive) {
            NProgress.start()
        }
        onClick?.()
    }

    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <Link
            href={href}
            onClick={handleClick}
            prefetch={true}
            scroll={false}
        >
            <div
                className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent",
                    "hover:bg-white/5 hover:border-white/5",
                    isActive
                        ? activeColors[color]
                        : "text-muted-foreground"
                )}
            >
                <div className="flex items-center justify-center">
                    {/* Hydration fix: Only render icon after mount to ensure match with server (which renders placeholder) */}
                    {mounted ? (
                        <Icon className={cn(
                            "h-4 w-4 aspect-square flex-shrink-0 transition-colors",
                            isActive ? '' : iconColors[color]
                        )} />
                    ) : (
                        <div className="h-4 w-4 aspect-square" />
                    )}
                </div>
                {!collapsed && (
                    <span
                        suppressHydrationWarning
                        className={cn(
                            "text-sm font-medium transition-colors",
                            isActive ? '' : 'group-hover:text-foreground'
                        )}
                    >
                        {label}
                    </span>
                )}
            </div>
        </Link>
    )
}

export function Sidebar({ user }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const userInitials = user?.user_metadata?.full_name
        ?.split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase() || user?.email?.[0].toUpperCase() || 'G'

    return (
        <aside
            className={cn(
                "h-screen flex flex-col bg-sidebar backdrop-blur-2xl border-r border-sidebar-border transition-all duration-300",
                collapsed ? "w-[72px]" : "w-64"
            )}
        >
            {/* Toggle Button - Absolute Positioned */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                    "absolute -right-3 top-6 z-50 h-6 w-6 rounded-full border bg-card shadow-md transition-all duration-300 hover:bg-accent",
                    "border-border text-muted-foreground hover:text-foreground"
                )}
            >
                {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>

            {/* Header */}
            <div className={cn(
                "flex items-center p-4 border-b border-sidebar-border h-[65px]",
                collapsed ? "justify-center" : "justify-between"
            )}>
                <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    {!collapsed && (
                        <h1 className="text-xl font-bold gradient-text whitespace-nowrap opacity-100 transition-opacity duration-300">
                            StudentHub
                        </h1>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {navGroups.map((group, i) => (
                    <div key={i} className="space-y-1">
                        {!collapsed && group.title && (
                            <h4 className="px-3 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">
                                {group.title}
                            </h4>
                        )}
                        {collapsed && group.title && i > 0 && (
                            <div className="h-px bg-white/5 my-2 mx-2" />
                        )}
                        {group.items.map((item) => (
                            <NavItem
                                key={item.href}
                                href={item.href}
                                label={item.label}
                                icon={item.icon}
                                color={item.color}
                                isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                                collapsed={collapsed}
                            />
                        ))}
                    </div>
                ))}
            </nav>

            {/* User Menu */}
            <div className="p-3 border-t border-sidebar-border">
                {user ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 px-3 py-6 hover:bg-white/[0.06] rounded-xl transition-all",
                                    collapsed && "justify-center px-0"
                                )}
                            >
                                <Avatar className="h-9 w-9 ring-2 ring-violet-500/20">
                                    <AvatarImage src={user.user_metadata?.avatar_url} />
                                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                                        {userInitials}
                                    </AvatarFallback>
                                </Avatar>
                                {!collapsed && (
                                    <div className="flex flex-col items-start text-left overflow-hidden">
                                        <span className="text-sm font-medium text-foreground truncate w-full">
                                            {user.user_metadata?.full_name || 'User'}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate w-full">
                                            {user.email}
                                        </span>
                                    </div>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-popover backdrop-blur-xl border-border">
                            <DropdownMenuLabel className="text-muted-foreground">My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                                onClick={() => router.push('/dashboard/settings')}
                                className="text-foreground focus:bg-accent cursor-pointer"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout} className="text-rose-500 focus:bg-rose-500/10 focus:text-rose-500 cursor-pointer">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Link href="/login">
                        <Button
                            className={cn(
                                "w-full justify-start gap-3 px-3 py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all",
                                collapsed && "justify-center px-0"
                            )}
                        >
                            <LogOut className="h-5 w-5 rotate-180" />
                            {!collapsed && <span>Sign In</span>}
                        </Button>
                    </Link>
                )}
            </div>
        </aside>
    )
}

export function MobileSidebar({ user }: SidebarProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const userInitials = user?.user_metadata?.full_name
        ?.split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase() || user?.email?.[0].toUpperCase() || 'G'

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-foreground hover:bg-accent">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar backdrop-blur-2xl border-sidebar-border">
                {/* Header */}
                <div className="p-4 border-b border-sidebar-border">
                    <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <h1 className="text-xl font-bold gradient-text">
                            StudentHub
                        </h1>
                    </Link>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-sidebar-border">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-2 ring-violet-500/20">
                            <AvatarImage src={user?.user_metadata?.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-medium">
                                {userInitials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-foreground truncate">
                                {user?.user_metadata?.full_name || (user ? 'User' : 'Guest')}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {user?.email || 'Demo Mode'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {navGroups.map((group, i) => (
                        <div key={i} className="space-y-1">
                            {group.title && (
                                <h4 className="px-3 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">
                                    {group.title}
                                </h4>
                            )}
                            {group.title && i > 0 && <div className="h-px bg-white/5 my-2 mx-2" />}
                            {group.items.map((item) => (
                                <NavItem
                                    key={item.href}
                                    href={item.href}
                                    label={item.label}
                                    icon={item.icon}
                                    color={item.color}
                                    isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                                    collapsed={false}
                                    onClick={() => setOpen(false)}
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Logout/Login */}
                <div className="p-3 border-t border-sidebar-border">
                    {user ? (
                        <Button
                            variant="ghost"
                            onClick={handleLogout}
                            className="w-full justify-start gap-3 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg"
                        >
                            <LogOut className="h-5 w-5" />
                            Logout
                        </Button>
                    ) : (
                        <Link href="/login" onClick={() => setOpen(false)}>
                            <Button
                                className="w-full justify-start gap-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg"
                            >
                                <LogOut className="h-5 w-5 rotate-180" />
                                Sign In
                            </Button>
                        </Link>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
