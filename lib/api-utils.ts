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

// Simple in-memory rate limiter
// For production, consider using Upstash Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
    userId: string,
    endpoint: string,
    maxRequests: number = 10,
    windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetIn: number } {
    const key = `${userId}:${endpoint}`
    const now = Date.now()

    const record = rateLimitMap.get(key)

    // Clean up old entries periodically
    if (rateLimitMap.size > 1000) {
        for (const [k, v] of rateLimitMap.entries()) {
            if (v.resetTime < now) {
                rateLimitMap.delete(k)
            }
        }
    }

    if (!record || record.resetTime < now) {
        // New window
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs }
    }

    if (record.count >= maxRequests) {
        // Rate limited
        return {
            allowed: false,
            remaining: 0,
            resetIn: record.resetTime - now
        }
    }

    // Increment count
    record.count++
    return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetIn: record.resetTime - now
    }
}

// Rate limit error response
export function rateLimitResponse(resetIn: number) {
    return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil(resetIn / 1000)} seconds.` },
        {
            status: 429,
            headers: {
                'Retry-After': Math.ceil(resetIn / 1000).toString()
            }
        }
    )
}
