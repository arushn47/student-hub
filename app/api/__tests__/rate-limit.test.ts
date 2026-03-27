/**
 * Integration tests for rate-limiting behaviour exposed via api-utils helpers.
 *
 * These verify that the JSON responses match what API routes would return,
 * including status codes, Retry-After headers, and body shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

beforeEach(() => {
    vi.restoreAllMocks()
})

describe('unauthorizedResponse', () => {
    it('should return 401 with correct body', async () => {
        const res = unauthorizedResponse()
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.error).toContain('Unauthorized')
    })
})

describe('rateLimitHeaders', () => {
    it('should return correct X-RateLimit-* headers', () => {
        const resetAt = new Date('2020-01-01T00:00:30.000Z')
        const headers = rateLimitHeaders({ limit: 10, remaining: 7, resetAt })
        expect(headers['X-RateLimit-Limit']).toBe('10')
        expect(headers['X-RateLimit-Remaining']).toBe('7')
        expect(headers['X-RateLimit-Reset']).toBe('1577836830')
    })
})

describe('rateLimitExceededResponse', () => {
    it('should return 429 with X-RateLimit-* headers and JSON body', async () => {
        const resetAt = new Date('2020-01-01T00:00:30.000Z')
        const res = rateLimitExceededResponse({ limit: 10, remaining: 0, resetAt })
        expect(res.status).toBe(429)
        expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
        expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
        expect(res.headers.get('X-RateLimit-Reset')).toBe('1577836830')
        const body = await res.json()
        expect(body.error).toContain('Rate limit exceeded')
        expect(body.resetAt).toBe(resetAt.toISOString())
    })
})

describe('checkRateLimit', () => {
    it('should call RPC and parse the result', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: [{ allowed: true, remaining: 9, reset_at: '2020-01-01T00:00:30.000Z' }],
            error: null,
        })

        vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)

        const result = await checkRateLimit('user1', 'endpoint1', 10, 60)
        expect(rpc).toHaveBeenCalledWith('rl_check_and_increment', {
            p_user_id: 'user1',
            p_endpoint: 'endpoint1',
            p_limit: 10,
            p_window_seconds: 60,
        })
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(9)
        expect(result.resetAt.toISOString()).toBe('2020-01-01T00:00:30.000Z')
    })
})

vi.mock('@/lib/supabase/admin', () => {
    return {
        createAdminClient: vi.fn(),
    }
})
