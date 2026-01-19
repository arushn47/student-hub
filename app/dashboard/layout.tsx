import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar, MobileSidebar } from '@/components/dashboard/Sidebar'
import { StudyBuddyWidget } from '@/components/chat/StudyBuddyWidget'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
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

            {/* Desktop Sidebar */}
            <div className="hidden md:block relative z-20 h-full">
                <Sidebar user={user} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden p-4 border-b border-border bg-card/50 backdrop-blur-2xl flex items-center justify-between shrink-0">
                    <MobileSidebar user={user} />
                    <h1 className="text-lg font-bold text-foreground">
                        StudentHub
                    </h1>
                    <div className="w-8" />
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto scrollbar-thin">
                    <div className="max-w-7xl mx-auto pb-20">
                        {children}
                    </div>
                </main>
            </div>

            {/* Study Buddy Chat Widget */}
            <StudyBuddyWidget />
        </div>
    )
}
