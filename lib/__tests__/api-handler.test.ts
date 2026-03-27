import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withValidation, z } from '@/lib/api-handler'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mock Supabase auth so `getAuthenticatedUser()` works in tests
// ---------------------------------------------------------------------------
const mockUser = { id: 'user-123', email: 'test@example.com' }
let authReturnUser: typeof mockUser | null = mockUser

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: authReturnUser },
                error: authReturnUser ? null : { message: 'not authenticated' },
            })),
        },
    })),
}))

// Mock the admin Supabase client used by the DB-backed rate limiter
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({
        rpc: vi.fn(async () => ({
            data: [{ allowed: true, remaining: 9, reset_at: new Date(Date.now() + 60_000).toISOString() }],
            error: null,
        })),
    })),
}))

// Silence console.error during tests
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    authReturnUser = mockUser
})

// Helper to build a Request with a JSON body
function jsonRequest(body: unknown, opts?: { contentLength?: string }) {
    const req = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(opts?.contentLength ? { 'content-length': opts.contentLength } : {}),
        },
        body: JSON.stringify(body),
    })
    return req
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withValidation', () => {
    const testSchema = z.object({
        text: z.string().min(1).max(500),
        count: z.number().int().positive().optional(),
    })

    const successHandler = async ({ body }: { body: z.infer<typeof testSchema>; user: unknown; request: Request }) => {
        return NextResponse.json({ received: body })
    }

    // ---- Auth ---------------------------------------------------------

    it('should return 401 when user is not authenticated', async () => {
        authReturnUser = null
        const handler = withValidation(
            { schema: testSchema },
            successHandler,
        )
        const res = await handler(jsonRequest({ text: 'hello' }))
        expect(res.status).toBe(401)
    })

    it('should skip auth when auth: false', async () => {
        authReturnUser = null
        const handler = withValidation(
            { schema: testSchema, auth: false },
            successHandler,
        )
        const res = await handler(jsonRequest({ text: 'hello' }))
        expect(res.status).toBe(200)
    })

    // ---- Validation ---------------------------------------------------

    it('should pass validated body to handler', async () => {
        const handler = withValidation({ schema: testSchema }, successHandler)
        const res = await handler(jsonRequest({ text: 'hello', count: 5 }))
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.received).toEqual({ text: 'hello', count: 5 })
    })

    it('should return 400 for invalid body', async () => {
        const handler = withValidation({ schema: testSchema }, successHandler)
        const res = await handler(jsonRequest({ text: '' }))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toBe('Validation failed')
        expect(data.details).toBeDefined()
    })

    it('should return 400 for missing required fields', async () => {
        const handler = withValidation({ schema: testSchema }, successHandler)
        const res = await handler(jsonRequest({}))
        expect(res.status).toBe(400)
    })

    it('should return 400 for non-JSON body', async () => {
        const handler = withValidation({ schema: testSchema }, successHandler)
        const req = new Request('http://localhost/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'not json',
        })
        const res = await handler(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toBe('Invalid JSON in request body')
    })

    // ---- Sanitization -------------------------------------------------

    it('should strip control characters from string values', async () => {
        const handler = withValidation({ schema: testSchema }, successHandler)
        const res = await handler(jsonRequest({ text: 'hello\x00world\x1F' }))
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.received.text).toBe('helloworld')
    })

    // ---- Body size guard -----------------------------------------------

    it('should return 413 when content-length exceeds maxBodySize', async () => {
        const handler = withValidation(
            { schema: testSchema, maxBodySize: 100 },
            successHandler,
        )
        const res = await handler(jsonRequest({ text: 'hello' }, { contentLength: '200' }))
        expect(res.status).toBe(413)
    })

    // ---- No schema (GET-style) ----------------------------------------

    it('should work without a schema for GET handlers', async () => {
        const getHandler = withValidation(
            { auth: true, rateLimit: false },
            async ({ user }) => {
                return NextResponse.json({ userId: (user as { id: string }).id })
            },
        )
        const req = new Request('http://localhost/api/test', { method: 'GET' })
        const res = await getHandler(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.userId).toBe('user-123')
    })

    // ---- Handler errors -----------------------------------------------

    it('should catch handler errors and return 500', async () => {
        const throwing = withValidation(
            { schema: testSchema },
            async () => { throw new Error('boom') },
        )
        const res = await throwing(jsonRequest({ text: 'hello' }))
        expect(res.status).toBe(500)
    })

    // ---- Rate limiting (via options) -----------------------------------

    it('should accept rateLimit: false without error', async () => {
        const handler = withValidation(
            { schema: testSchema, rateLimit: false },
            successHandler,
        )
        const res = await handler(jsonRequest({ text: 'hello' }))
        expect(res.status).toBe(200)
    })
})
