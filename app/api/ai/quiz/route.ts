import { NextResponse } from 'next/server'
import { generateJSON } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import type { QuizQuestion } from '@/types'

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

        const { content, noteId } = await request.json()

        if (!content || typeof content !== 'string') {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            )
        }

        // Limit input size to prevent token abuse
        const truncatedContent = content.slice(0, 5000).trim()

        // 1. Generate a stable hash for the note content
        const contentHash = Array.from(
            new Uint8Array(
                await crypto.subtle.digest('SHA-256', new TextEncoder().encode(truncatedContent))
            )
        ).map(b => b.toString(16).padStart(2, '0')).join('')

        const supabase = await createClient()

        // 2. Check the per-note cache
        if (noteId) {
            const { data: noteCache } = await supabase
                .from('notes')
                .select('ai_quizzes')
                .eq('id', noteId)
                .eq('user_id', user.id)
                .single()

            if (noteCache?.ai_quizzes && noteCache.ai_quizzes[contentHash]) {
                console.log('✅ QUIZ: Cache hit for', noteId)
                return NextResponse.json(
                    { questions: noteCache.ai_quizzes[contentHash], source: 'cache' },
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
            }
        }

        console.log('❌ QUIZ: Cache miss, calling Gemini')

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

        // 3. Save response to cache if noteId was provided
        if (noteId) {
            const { data: currentNote } = await supabase
                .from('notes')
                .select('ai_quizzes')
                .eq('id', noteId)
                .eq('user_id', user.id)
                .single()

            const currentQuizzes = currentNote?.ai_quizzes || {}

            await supabase
                .from('notes')
                .update({
                    ai_quizzes: {
                        ...currentQuizzes,
                        [contentHash]: questions
                    }
                })
                .eq('id', noteId)
                .eq('user_id', user.id)
        }

        return NextResponse.json(
            { questions, source: 'gemini' },
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
        console.error('Quiz API Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate quiz' },
            { status: 500 }
        )
    }
}
