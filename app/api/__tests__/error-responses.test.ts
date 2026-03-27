/**
 * Integration tests for error response helpers in lib/errors.ts.
 *
 * These tests exercise the NextResponse-based helpers that API routes depend on,
 * verifying status codes, bodies, and edge-case behaviour end-to-end through
 * the same code-path the server uses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    AppError,
    createApiErrorResponse,
    validationErrorResponse,
    notFoundResponse,
    forbiddenResponse,
    successResponse,
} from '@/lib/errors'

// Silence console.error during tests since createApiErrorResponse logs
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Helper to extract JSON from a NextResponse
async function responseJson(res: Response) {
    return res.json()
}

// ---------------------------------------------------------------------------
// createApiErrorResponse
// ---------------------------------------------------------------------------
describe('createApiErrorResponse', () => {
    it('should return the correct status for AppError', async () => {
        const err = new AppError('Payment required', 402)
        const res = createApiErrorResponse(err)
        expect(res.status).toBe(402)
        expect((await responseJson(res)).error).toBe('Payment required')
    })

    it('should return 401 when error message contains "unauthorized"', async () => {
        const res = createApiErrorResponse(new Error('unauthorized access detected'))
        expect(res.status).toBe(401)
    })

    it('should return 404 when error message contains "not found"', async () => {
        const res = createApiErrorResponse(new Error('Resource not found'))
        expect(res.status).toBe(404)
    })

    it('should default to 500 for unknown Error instances', async () => {
        const res = createApiErrorResponse(new Error('something broke'))
        expect(res.status).toBe(500)
        expect((await responseJson(res)).error).toBe('something broke')
    })

    it('should use defaultMessage for non-Error values', async () => {
        const res = createApiErrorResponse('string-err', 'Custom fallback')
        expect(res.status).toBe(500)
        expect((await responseJson(res)).error).toBe('Custom fallback')
    })

    it('should handle null error gracefully', async () => {
        const res = createApiErrorResponse(null)
        expect(res.status).toBe(500)
    })
})

// ---------------------------------------------------------------------------
// validationErrorResponse
// ---------------------------------------------------------------------------
describe('validationErrorResponse', () => {
    it('should return 400 with the given message', async () => {
        const res = validationErrorResponse('Invalid email')
        expect(res.status).toBe(400)
        const body = await responseJson(res)
        expect(body.error).toBe('Invalid email')
    })

    it('should include details object when provided', async () => {
        const res = validationErrorResponse('Validation failed', { email: 'Required' })
        const body = await responseJson(res)
        expect(body.details).toEqual({ email: 'Required' })
    })
})

// ---------------------------------------------------------------------------
// notFoundResponse
// ---------------------------------------------------------------------------
describe('notFoundResponse', () => {
    it('should return 404 with default resource name', async () => {
        const res = notFoundResponse()
        expect(res.status).toBe(404)
        expect((await responseJson(res)).error).toBe('Resource not found')
    })

    it('should include custom resource name', async () => {
        const res = notFoundResponse('Note')
        expect((await responseJson(res)).error).toBe('Note not found')
    })
})

// ---------------------------------------------------------------------------
// forbiddenResponse
// ---------------------------------------------------------------------------
describe('forbiddenResponse', () => {
    it('should return 403 with default message', async () => {
        const res = forbiddenResponse()
        expect(res.status).toBe(403)
    })

    it('should return custom message when provided', async () => {
        const res = forbiddenResponse('Nope')
        expect((await responseJson(res)).error).toBe('Nope')
    })
})

// ---------------------------------------------------------------------------
// successResponse
// ---------------------------------------------------------------------------
describe('successResponse', () => {
    it('should return 200 with data', async () => {
        const res = successResponse({ items: [1, 2, 3] })
        expect(res.status).toBe(200)
        expect((await responseJson(res)).items).toEqual([1, 2, 3])
    })

    it('should accept custom status codes', async () => {
        const res = successResponse({ created: true }, 201)
        expect(res.status).toBe(201)
    })
})
