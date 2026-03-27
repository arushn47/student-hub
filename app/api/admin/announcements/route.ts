import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/announcements — list all announcements (admin sees all, users see active)
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const adminView = searchParams.get('admin') === 'true'

    if (adminView) {
        const auth = await requireAdmin()
        if (auth instanceof NextResponse) return auth

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
        }
        return NextResponse.json(data)
    }

    // Public: active, non-expired announcements only
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content, type, created_at, expires_at')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(5)

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
    }
    return NextResponse.json(data)
}

// POST /api/admin/announcements — create an announcement
export async function POST(request: Request) {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const body = await request.json()
        const { title, content, type, expires_at } = body

        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('announcements')
            .insert({
                title: title.trim(),
                content: content.trim(),
                type: type || 'info',
                created_by: auth.user.id,
                expires_at: expires_at || null,
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error('Create announcement error:', error)
        return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
    }
}

// PATCH /api/admin/announcements — toggle announcement active status
export async function PATCH(request: Request) {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const body = await request.json()
        const { id, is_active } = body

        if (!id || typeof is_active !== 'boolean') {
            return NextResponse.json({ error: 'Invalid id or is_active' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from('announcements')
            .update({ is_active })
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Toggle announcement error:', error)
        return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
    }
}

// DELETE /api/admin/announcements — delete an announcement
export async function DELETE(request: Request) {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Announcement ID required' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from('announcements')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete announcement error:', error)
        return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
    }
}
