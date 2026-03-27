import { NextResponse } from 'next/server'
import { generateJSON } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: Request) {
    try {
        // Check authentication
        const user = await getAuthenticatedUser()
        if (!user) {
            return unauthorizedResponse()
        }

        const rl = await checkRateLimit(
            user.id,
            RATE_LIMITS.ai_general.endpoint,
            RATE_LIMITS.ai_general.limit,
            RATE_LIMITS.ai_general.windowSeconds
        )
        if (!rl.allowed) {
            return rateLimitExceededResponse({
                limit: RATE_LIMITS.ai_general.limit,
                remaining: rl.remaining,
                resetAt: rl.resetAt,
            })
        }

        const { task } = await request.json()

        if (!task || typeof task !== 'string') {
            return NextResponse.json(
                { error: 'Task description is required' },
                { status: 400 }
            )
        }

        // Limit input size
        const truncatedTask = task.slice(0, 500)

        const prompt = `A student has a goal or large task they want to accomplish:
"${truncatedTask}"

Break this down into 4-6 smaller, actionable subtasks that can be completed individually. Each subtask should be:
1. Specific and actionable
2. Reasonable to complete in one sitting
3. Ordered logically (what to do first, second, etc.)

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "subtasks": [
    { "title": "First subtask description" },
    { "title": "Second subtask description" }
  ]
}

Keep subtask titles concise but clear.`

        const result = await generateJSON<{ subtasks: { title: string }[] }>(prompt)

        if (!result.subtasks || !Array.isArray(result.subtasks)) {
            throw new Error('Invalid response format')
        }

        return NextResponse.json(
            { subtasks: result.subtasks },
            {
                headers: {
                    ...rateLimitHeaders({
                        limit: RATE_LIMITS.ai_general.limit,
                        remaining: rl.remaining,
                        resetAt: rl.resetAt,
                    })
                }
            }
        )
    } catch (error) {
        console.error('Breakdown API Error:', error)
        return NextResponse.json(
            { error: 'Failed to break down task' },
            { status: 500 }
        )
    }
}
