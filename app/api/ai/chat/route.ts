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

        // Check rate limit (20 chat messages per minute)
        const rateLimit = checkRateLimit(user.id, 'chat', 20, 60000)
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetIn)
        }

        const { messages } = await request.json()

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: 'Messages array is required' },
                { status: 400 }
            )
        }

        // Limit conversation history to prevent token abuse
        const recentMessages = messages.slice(-10)

        // Build conversation context
        const conversationHistory = recentMessages
            .map((msg: { role: string; content: string }) =>
                `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`
            )
            .join('\n')

        const prompt = `You are a helpful, friendly study tutor called "Study Buddy" for the StudentHub platform.

Role & Restrictions:
1. STRICTLY limited to academic topics, study advice, and helping users navigate this StudentHub website.
2. Refuse to answer inappropriate, NSFW, political, or non-educational off-topic questions.
3. If asked about website features, explain them: Dashboard, Notes (AI-powered), Tasks, Pomodoro, Flashcards, Grades (CGPA), Resources, and Budget.

Guidelines:
- Be encouraging and supportive
- Explain concepts in simple, easy-to-understand terms
- Use examples when helpful
- Keep responses concise but thorough
- If you don't know something, be honest about it
- Focus on education and learning

Conversation so far:
${conversationHistory}

Provide a helpful response as the tutor. Be conversational and friendly.`

        const response = await generateText(prompt)

        return NextResponse.json(
            { response },
            {
                headers: {
                    'X-RateLimit-Remaining': rateLimit.remaining.toString()
                }
            }
        )
    } catch (error) {
        console.error('Chat API Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate response. Please try again.' },
            { status: 500 }
        )
    }
}
