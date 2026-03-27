import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/feature-flags — list all feature flags
export async function GET() {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('feature_flags')
        .select('*')
        .order('name')

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch feature flags' }, { status: 500 })
    }
    return NextResponse.json(data)
}

// PATCH /api/admin/feature-flags — toggle a feature flag
export async function PATCH(request: Request) {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) return auth

    try {
        const body = await request.json()
        const { id, is_enabled } = body

        if (!id || typeof is_enabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid id or is_enabled' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from('feature_flags')
            .update({
                is_enabled,
                updated_by: auth.user.id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Toggle feature flag error:', error)
        return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
    }
}
