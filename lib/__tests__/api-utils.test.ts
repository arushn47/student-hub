import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit } from '../rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => {
    return {
        createAdminClient: vi.fn(),
    }
})

describe('checkRateLimit', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('should parse array RPC results', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: [{ allowed: true, remaining: 4, reset_at: '2020-01-01T00:00:30.000Z' }],
            error: null,
        })
        vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)

        const result = await checkRateLimit('userA', 'endpointA', 5, 60)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)
        expect(result.resetAt.toISOString()).toBe('2020-01-01T00:00:30.000Z')
    })

    it('should parse object RPC results', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: { allowed: false, remaining: 0, reset_at: '2020-01-01T00:01:00.000Z' },
            error: null,
        })
        vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)

        const result = await checkRateLimit('userB', 'endpointB', 5, 60)
        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
        expect(result.resetAt.toISOString()).toBe('2020-01-01T00:01:00.000Z')
    })
})
