import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit } from '../api-utils'

describe('checkRateLimit', () => {
    beforeEach(() => {
        // Reset the rate limit map between tests by waiting for window to expire
        vi.useFakeTimers()
    })

    it('should allow first request', () => {
        const result = checkRateLimit('user1', 'endpoint1', 10, 60000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(9)
    })

    it('should track multiple requests', () => {
        const userId = 'user2'
        const endpoint = 'endpoint2'

        // First request
        let result = checkRateLimit(userId, endpoint, 5, 60000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)

        // Second request
        result = checkRateLimit(userId, endpoint, 5, 60000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(3)

        // Third request
        result = checkRateLimit(userId, endpoint, 5, 60000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(2)
    })

    it('should block after max requests', () => {
        const userId = 'user3'
        const endpoint = 'endpoint3'

        // Use up all requests
        for (let i = 0; i < 3; i++) {
            checkRateLimit(userId, endpoint, 3, 60000)
        }

        // This should be blocked
        const result = checkRateLimit(userId, endpoint, 3, 60000)
        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('should separate different users', () => {
        const endpoint = 'shared-endpoint'

        // User A makes request
        const resultA = checkRateLimit('userA', endpoint, 5, 60000)
        expect(resultA.remaining).toBe(4)

        // User B makes request - should have full quota
        const resultB = checkRateLimit('userB', endpoint, 5, 60000)
        expect(resultB.remaining).toBe(4)
    })

    it('should separate different endpoints', () => {
        const userId = 'user4'

        // Request to endpoint A
        const resultA = checkRateLimit(userId, 'endpointA', 5, 60000)
        expect(resultA.remaining).toBe(4)

        // Request to endpoint B - should have full quota
        const resultB = checkRateLimit(userId, 'endpointB', 5, 60000)
        expect(resultB.remaining).toBe(4)
    })

    it('should reset after window expires', () => {
        const userId = 'user5'
        const endpoint = 'endpoint5'

        // Make some requests
        checkRateLimit(userId, endpoint, 5, 1000)
        checkRateLimit(userId, endpoint, 5, 1000)

        // Advance time past the window
        vi.advanceTimersByTime(1500)

        // Should have full quota again
        const result = checkRateLimit(userId, endpoint, 5, 1000)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4)
    })
})
