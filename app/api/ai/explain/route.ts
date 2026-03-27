import { NextResponse } from 'next/server'
import { generateText } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

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

        const { text, noteId } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            )
        }

        // Truncate text block to prevent hash abuse
        const truncatedText = text.slice(0, 2000).trim()

        // 1. Generate a stable hash for the highlighted text
        const textHash = Array.from(
            new Uint8Array(
                await crypto.subtle.digest('SHA-256', new TextEncoder().encode(truncatedText))
            )
        ).map(b => b.toString(16).padStart(2, '0')).join('')

        const supabase = await createClient()

        // 2. Check the per-note cache if noteId is provided
        if (noteId) {
            const { data: noteCache } = await supabase
                .from('notes')
                .select('ai_explanations')
                .eq('id', noteId)
                .eq('user_id', user.id)
                .single()

            if (noteCache?.ai_explanations && noteCache.ai_explanations[textHash]) {
                console.log('✅ EXPLAIN: Cache hit for', noteId)
                return NextResponse.json(
                    { explanation: noteCache.ai_explanations[textHash], source: 'cache' },
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

        console.log('❌ EXPLAIN: Cache miss, calling Gemini')

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

        // 3. Save response to cache if noteId was provided
        if (noteId) {
            // We use raw sql/rpc or just fetch existing and merge.
            // Since we can't easily do parallel JSONB merges via simple .update() without overwriting,
            // we read current, merge, and write. (In high concurrency this might lose keys, but for personal notes it's fine)
            const { data: currentNote } = await supabase
                .from('notes')
                .select('ai_explanations')
                .eq('id', noteId)
                .eq('user_id', user.id)
                .single()

            const currentExplanations = currentNote?.ai_explanations || {}

            await supabase
                .from('notes')
                .update({
                    ai_explanations: {
                        ...currentExplanations,
                        [textHash]: explanation
                    }
                })
                .eq('id', noteId)
                .eq('user_id', user.id)
        }

        return NextResponse.json(
            { explanation, source: 'gemini' },
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
        console.error('Explain API Error:', error)
        return NextResponse.json(
            { error: 'Failed to generate explanation' },
            { status: 500 }
        )
    }
}
