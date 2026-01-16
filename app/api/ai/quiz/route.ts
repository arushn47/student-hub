import { NextResponse } from 'next/server'
import { generateJSON } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse, checkRateLimit, rateLimitResponse } from '@/lib/api-utils'
import type { QuizQuestion } from '@/types'

export async function POST(request: Request) {
    try {
        // Check authentication
        const user = await getAuthenticatedUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Check rate limit (5 quiz generations per minute)
        const rateLimit = checkRateLimit(user.id, 'quiz', 5, 60000)
        if (!rateLimit.allowed) {
            return rateLimitResponse(rateLimit.resetIn)
        }

        const { content } = await request.json()

        if (!content || typeof content !== 'string') {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            )
        }

        // Limit input size to prevent token abuse
        const truncatedContent = content.slice(0, 5000)

        const prompt = `Based on the following study notes, generate 4 multiple-choice quiz questions to help the student test their understanding.

Study Notes:
${truncatedContent}

Generate exactly 4 questions. Each question should:
1. Test understanding of key concepts from the notes
2. Have 4 answer options
3. Have exactly one correct answer
4. Include a brief explanation of why the correct answer is right

Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "question": "The question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]

Where correctAnswer is the 0-based index of the correct option.`

        const questions = await generateJSON<QuizQuestion[]>(prompt)

        // Validate the response
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Invalid quiz format')
        }

        return NextResponse.json(
            { questions },
            {
                headers: {
                    'X-RateLimit-Remaining': rateLimit.remaining.toString()
                }
            }
        )
    } catch (error) {
        console.error('Quiz API Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate quiz' },
            { status: 500 }
        )
    }
}
