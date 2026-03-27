import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/stats — system-wide statistics
export async function GET() {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const admin = createAdminClient()

        // Run all stats queries in parallel
        const [
            usersResult,
            notesResult,
            tasksResult,
            assignmentsResult,
            chatResult,
            papersResult,
            activeToday,
        ] = await Promise.all([
            admin.from('profiles').select('id', { count: 'exact', head: true }),
            admin.from('notes').select('id', { count: 'exact', head: true }),
            admin.from('tasks').select('id', { count: 'exact', head: true }),
            admin.from('assignments').select('id', { count: 'exact', head: true }),
            admin.from('chat_messages').select('id', { count: 'exact', head: true }),
            admin.from('question_papers').select('id', { count: 'exact', head: true }),
            admin
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        ])

        // Recent signups (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const recentSignups = await admin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', sevenDaysAgo)

        return NextResponse.json({
            totalUsers: usersResult.count || 0,
            totalNotes: notesResult.count || 0,
            totalTasks: tasksResult.count || 0,
            totalAssignments: assignmentsResult.count || 0,
            totalChatMessages: chatResult.count || 0,
            totalPapers: papersResult.count || 0,
            activeToday: activeToday.count || 0,
            recentSignups: recentSignups.count || 0,
        })
    } catch (error) {
        console.error('Admin stats error:', error)
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }
}
