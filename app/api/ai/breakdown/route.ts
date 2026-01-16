import { NextResponse } from 'next/server'
import { generateJSON } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse, checkRateLimit, rateLimitResponse } from '@/lib/api-utils'

export async function POST(request: Request) {
    try {
        // Check authentication
        const user = await getAuthenticatedUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Check rate limit (10 breakdown requests per minute)
        const rateLimit = checkRateLimit(user.id, 'breakdown', 10, 60000)
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetIn)
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
                    'X-RateLimit-Remaining': rateLimit.remaining.toString()
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
