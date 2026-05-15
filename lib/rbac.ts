import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type UserRole = 'user' | 'admin'

/**
 * Get the role of the currently authenticated user.
 * Returns null if unauthenticated.
 */
export async function getUserRole(): Promise<UserRole | null> {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return (profile?.role as UserRole) ?? 'user'
}

/**
 * Check if the current authenticated user has admin role.
 * For use in server components or API routes.
 */
export async function isAdmin(): Promise<boolean> {
    const role = await getUserRole()
    return role === 'admin'
}

/**
 * API route guard: returns the authenticated user if they have admin role.
 * Returns a 403 JSON response if not admin or 401 if unauthenticated.
 *
 * Usage in API routes:
 * ```ts
 * const result = await requireAdmin()
 * if (result instanceof NextResponse) return result
 * const { user, supabase } = result
 * ```
 */
export async function requireAdmin() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
        return NextResponse.json(
            { error: 'Unauthorized. Please log in.' },
            { status: 401 }
        )
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return NextResponse.json(
            { error: 'Forbidden. Admin access required.' },
            { status: 403 }
        )
    }

    return { user, supabase }
}
