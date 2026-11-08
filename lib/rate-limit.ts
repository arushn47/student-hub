import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type RateLimitResult = {
    allowed: boolean
    remaining: number
    resetAt: Date
}

export const RATE_LIMITS = {
    ai_general: { endpoint: 'ai_general', limit: 30, windowSeconds: 60 },
    exam_prep: { endpoint: 'exam_prep', limit: 20, windowSeconds: 300 },
    google_sync: { endpoint: 'google_sync', limit: 10, windowSeconds: 60 },
} as const

// Daily caps — uses the same RPC with a 24h (86400s) rolling window.
// Endpoint names are suffixed with '_daily' to keep counters separate.
export const DAILY_LIMITS = {
    exam_prep: { endpoint: 'exam_prep_daily', limit: 100, windowSeconds: 86400 },
    ai_general: { endpoint: 'ai_general_daily', limit: 150, windowSeconds: 86400 },
} as const

export async function checkRateLimit(
    userId: string,
    endpoint: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult> {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('rl_check_and_increment', {
        p_user_id: userId,
        p_endpoint: endpoint,
        p_limit: limit,
        p_window_seconds: windowSeconds,
    })

    if (error) {
        throw error
    }

    const row = Array.isArray(data) ? data[0] : data
    const resetAt = new Date(row.reset_at)

    return {
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining ?? 0),
        resetAt,
    }
}

export function rateLimitHeaders(params: {
    limit: number
    remaining: number
    resetAt: Date
}) {
    const resetSeconds = Math.ceil(params.resetAt.getTime() / 1000)
    return {
        'X-RateLimit-Limit': params.limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, params.remaining).toString(),
        'X-RateLimit-Reset': resetSeconds.toString(),
    }
}

export function rateLimitExceededResponse(params: {
    limit: number
    remaining: number
    resetAt: Date
    customMessage?: string
}) {
    const secondsLeft = Math.max(1, Math.ceil((params.resetAt.getTime() - Date.now()) / 1000))
    const timeDesc = secondsLeft < 60 ? `~${secondsLeft}s` : `~${Math.ceil(secondsLeft / 60)}m`
    const defaultMsg = `Rate limit exceeded. AI is taking a quick breather! ⏳ Ready in ${timeDesc}. Review the notes and flashcards on your ready modules while we prepare! 💡`

    return NextResponse.json(
        {
            error: params.customMessage || defaultMsg,
            retryAfterSeconds: secondsLeft,
            resetAt: params.resetAt.toISOString(),
        },
        {
            status: 429,
            headers: rateLimitHeaders(params),
        }
    )
}
