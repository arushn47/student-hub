import { createClient } from '@/lib/supabase/server'
import { Sidebar, MobileSidebar } from '@/components/dashboard/Sidebar'
import { StudyBuddyWidget } from '@/components/chat/StudyBuddyWidget'
import { GoogleSyncProvider } from '@/components/providers/GoogleSyncProvider'
import { AuthProvider } from '@/lib/auth-context'
import Link from 'next/link'
import { LogIn, Sparkles } from 'lucide-react'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Create a serializable user object for the client
    const serializedUser = user ? {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
    } : null

    return (
        <AuthProvider initialUser={user}>
            <div className="h-screen w-full bg-background flex relative overflow-hidden">
                {/* Decorative Background Elements - only show in dark mode */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none dark:block hidden">
                    {/* Top-right glow */}
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
                    {/* Bottom-left glow */}
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl" />
                    {/* Center glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
                    {/* Grid pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-[0.02]"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='white'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
                        }}
                    />
                </div>

                {/* Guest Mode Banner */}
                {!user && (
                    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-sm py-2 px-4">
                        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-white text-sm">
                            <Sparkles className="h-4 w-4" />
                            <span>You&apos;re in demo mode. Sign in to save your work!</span>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                            >
                                <LogIn className="h-3.5 w-3.5" />
                                Sign In
                            </Link>
                        </div>
                    </div>
                )}

                {/* Desktop Sidebar */}
                <div className="hidden md:block relative z-20 h-full">
                    <Sidebar user={serializedUser} />
                </div>

                {/* Main Content */}
                <div className={`flex-1 flex flex-col h-full relative z-10 overflow-hidden ${!user ? 'pt-10' : ''}`}>
                    {/* Mobile Header */}
                    <header className={`md:hidden p-4 border-b border-border bg-card/50 backdrop-blur-2xl flex items-center justify-between shrink-0 ${!user ? 'mt-8' : ''}`}>
                        <MobileSidebar user={serializedUser} />
                        <Link href="/dashboard" className="text-lg font-bold text-foreground hover:opacity-80 transition-opacity">
                            StudentHub
                        </Link>
                        <div className="w-8" />
                    </header>

                    {/* Page Content */}
                    <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto scrollbar-thin">
                        <div className="max-w-7xl mx-auto pb-20">
                            {children}
                        </div>
                    </main>
                </div>

                {/* Background Google Sync */}
                {user && <GoogleSyncProvider />}

                {/* Study Buddy Chat Widget */}
                <StudyBuddyWidget />
            </div>
        </AuthProvider>
    )
}
