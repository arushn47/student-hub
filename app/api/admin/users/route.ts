import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/users — list all users with profiles
export async function GET(request: Request) {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const search = searchParams.get('search') || ''
        const offset = (page - 1) * limit

        const admin = createAdminClient()

        let query = admin
            .from('profiles')
            .select('id, email, full_name, avatar_url, role, created_at, updated_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (search) {
            query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
        }

        const { data: users, error, count } = await query

        if (error) throw error

        return NextResponse.json({
            users,
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        })
    } catch (error) {
        console.error('Admin users list error:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
}

// PATCH /api/admin/users — update a user's role
export async function PATCH(request: Request) {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const body = await request.json()
        const { userId, role } = body

        if (!userId || !role || !['user', 'admin'].includes(role)) {
            return NextResponse.json(
                { error: 'Invalid userId or role. Role must be "user" or "admin".' },
                { status: 400 }
            )
        }

        // Prevent removing own admin role
        if (userId === auth.user.id && role !== 'admin') {
            return NextResponse.json(
                { error: 'Cannot remove your own admin role.' },
                { status: 400 }
            )
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from('profiles')
            .update({ role })
            .eq('id', userId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Admin role update error:', error)
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }
}
