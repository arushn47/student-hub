import { NextResponse } from 'next/server'
import { z, ZodSchema } from 'zod'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { createApiErrorResponse } from '@/lib/errors'
import { checkRateLimit, rateLimitExceededResponse, RATE_LIMITS } from '@/lib/rate-limit'
import type { User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteHandlerContext<T = unknown> {
    /** Authenticated Supabase user (present when `auth: true`) */
    user: User
    /** Parsed & validated request body (present when `schema` is provided) */
    body: T
    /** Original request object */
    request: Request
}

interface RouteOptions<T = unknown> {
    /**
     * Zod schema to validate the JSON request body against.
     * Omit for GET / DELETE routes or routes with no body.
     */
    schema?: ZodSchema<T>

    /**
     * Whether the route requires authentication (default: `true`).
     */
    auth?: boolean

    /**
     * Rate-limit configuration.  Set to `false` to disable.
     * Defaults to 10 requests / 60 s.
     */
    rateLimit?: { maxRequests: number; windowSeconds: number; endpoint: string } | false

    /**
     * Maximum allowed `Content-Length` in bytes (default: 1 MB).
     * Prevents oversized payloads from reaching the JSON parser.
     */
    maxBodySize?: number
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_BODY = 1_048_576 // 1 MB
const DEFAULT_RATE_LIMIT_V2 = {
    maxRequests: RATE_LIMITS.ai_general.limit,
    windowSeconds: RATE_LIMITS.ai_general.windowSeconds,
    endpoint: RATE_LIMITS.ai_general.endpoint,
}

// ---------------------------------------------------------------------------
// Sanitiser — strips known-dangerous characters from user-supplied strings
// to reduce stored-XSS / log-injection surface area.
// ---------------------------------------------------------------------------

function deepSanitize<T>(value: T): T {
    if (typeof value === 'string') {
        // Strip NUL bytes and control chars (except whitespace)
        // eslint-disable-next-line no-control-regex
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') as unknown as T
    }
    if (Array.isArray(value)) {
        return value.map(deepSanitize) as unknown as T
    }
    if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) {
            out[k] = deepSanitize(v)
        }
        return out as T
    }
    return value
}

// ---------------------------------------------------------------------------
// Validation-error formatter – flattens Zod issues into a simple object.
// ---------------------------------------------------------------------------

function formatZodErrors(error: z.ZodError): Record<string, string> {
    const formatted: Record<string, string> = {}
    for (const issue of error.issues) {
        const path = issue.path.join('.') || '_root'
        formatted[path] = issue.message
    }
    return formatted
}

// ---------------------------------------------------------------------------
// Core wrapper
// ---------------------------------------------------------------------------

/**
 * Production-grade API route wrapper.
 *
 * Handles authentication, rate-limiting, body validation, input sanitization,
 * body-size enforcement and error handling in a single composable layer so
 * individual route handlers stay clean and focused.
 *
 * @example
 * ```ts
 * import { withValidation } from '@/lib/api-handler'
 * import { z } from 'zod'
 *
 * const schema = z.object({ text: z.string().min(1).max(2000) })
 *
 * export const POST = withValidation({ schema, rateLimit: { maxRequests: 10, windowMs: 60_000, endpoint: 'explain' } },
 *   async ({ user, body }) => {
 *     const explanation = await generateText(body.text)
 *     return NextResponse.json({ explanation })
 *   }
 * )
 * ```
 */
export function withValidation<T>(
    options: RouteOptions<T>,
    handler: (ctx: RouteHandlerContext<T>) => Promise<NextResponse>
) {
    const {
        schema,
        auth = true,
        rateLimit: rateLimitOpts = DEFAULT_RATE_LIMIT_V2,
        maxBodySize = DEFAULT_MAX_BODY,
    } = options

    return async (request: Request): Promise<NextResponse> => {
        try {
            // ---------------------------------------------------------------
            // 1. Authentication
            // ---------------------------------------------------------------
            let user: User | null = null
            if (auth) {
                user = await getAuthenticatedUser()
                if (!user) {
                    return unauthorizedResponse()
                }
            }

            // ---------------------------------------------------------------
            // 2. Rate Limiting
            // ---------------------------------------------------------------
            if (rateLimitOpts !== false && user) {
                const rl = await checkRateLimit(
                    user.id,
                    rateLimitOpts.endpoint,
                    rateLimitOpts.maxRequests,
                    rateLimitOpts.windowSeconds,
                )
                if (!rl.allowed) {
                    return rateLimitExceededResponse({
                        limit: rateLimitOpts.maxRequests,
                        remaining: rl.remaining,
                        resetAt: rl.resetAt,
                    })
                }
            }

            // ---------------------------------------------------------------
            // 3. Body size guard
            // ---------------------------------------------------------------
            const contentLength = request.headers.get('content-length')
            if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
                return NextResponse.json(
                    { error: 'Request body too large' },
                    { status: 413 }
                )
            }

            // ---------------------------------------------------------------
            // 4. Parse & validate body
            // ---------------------------------------------------------------
            let body: T = undefined as unknown as T
            if (schema) {
                let rawBody: unknown
                try {
                    rawBody = await request.json()
                } catch {
                    return NextResponse.json(
                        { error: 'Invalid JSON in request body' },
                        { status: 400 }
                    )
                }

                const result = schema.safeParse(rawBody)
                if (!result.success) {
                    return NextResponse.json(
                        {
                            error: 'Validation failed',
                            details: formatZodErrors(result.error),
                        },
                        { status: 400 }
                    )
                }
                body = deepSanitize(result.data)
            }

            // ---------------------------------------------------------------
            // 5. Execute handler
            // ---------------------------------------------------------------
            return await handler({ user: user!, body, request })
        } catch (error) {
            return createApiErrorResponse(error)
        }
    }
}

// ---------------------------------------------------------------------------
// Re-export schemas so routes can import everything from one place
// ---------------------------------------------------------------------------
export { z }
