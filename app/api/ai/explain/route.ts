import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse, checkRateLimit, rateLimitResponse } from '@/lib/api-utils'

export async function POST(request: Request) {
    try {
        // Check authentication
        const user = await getAuthenticatedUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Check rate limit (10 explain requests per minute)
        const rateLimit = checkRateLimit(user.id, 'explain', 10, 60000)
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetIn)
        }

        const { text } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            )
        }

        // Limit input size to prevent token abuse
        const truncatedText = text.slice(0, 2000)

        const prompt = `You are a helpful tutor. A student has highlighted the following text and wants you to explain it in simple terms.

Text to explain:
"${truncatedText}"

Provide a clear, simple explanation that:
1. Breaks down complex concepts into easy-to-understand parts
2. Uses everyday analogies when helpful
3. Is concise but thorough
4. Addresses any technical terms

Keep your explanation focused and educational.`

        const explanation = await generateText(prompt)

        return NextResponse.json(
            { explanation },
            {
                headers: {
                    'X-RateLimit-Remaining': rateLimit.remaining.toString()
                }
            }
        )
    } catch (error) {
        console.error('Explain API Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate explanation' },
            { status: 500 }
        )
    }
}
