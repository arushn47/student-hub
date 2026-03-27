import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Verify user is authenticated and return user object
// Returns null if not authenticated
export async function getAuthenticatedUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return null
    }

    return user
}

// Unauthorized response helper
export function unauthorizedResponse() {
    return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
    )
}
