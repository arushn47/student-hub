import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/gemini'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rl = await checkRateLimit(
            user.id,
            RATE_LIMITS.exam_prep.endpoint,
            RATE_LIMITS.exam_prep.limit,
            RATE_LIMITS.exam_prep.windowSeconds
        )
        if (!rl.allowed) {
            return rateLimitExceededResponse({
                limit: RATE_LIMITS.exam_prep.limit,
                remaining: rl.remaining,
                resetAt: rl.resetAt,
            })
        }

        const body = await request.json()
        const { moduleId, currentSummary } = body

        if (!moduleId) {
            return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
        }

        // Shorten notes by 25-35% while strictly preserving headings, tables, formulas, and exam traps
        const prompt = `
        You are an expert academic editor and exam coach.
        
        TASK:
        Shorten the provided study notes by approximately 25–35% while preserving all important exam-relevant content.
        
        STRICT RULES:
        1. STRUCTURE & HEADINGS: Keep the exact same section headings (###, ####) and overall logical structure.
        2. CONDENSE: Convert lengthy definitions, prose paragraphs, and explanations into concise, punchy bullet points.
        3. RETAIN CRITICAL EXAM CONTENT:
           - Retain all core concepts, classifications, and principles.
           - Retain ALL comparison tables in full Markdown table format (ensure blank lines exist before and after tables).
           - Retain ALL formulas (preserve LaTeX format like $E / (E + D)$).
           - Retain examples where necessary for clarity.
           - Retain all "Exam Watch & Trap Alerts".
        4. TRIM: Remove repetitive explanations, conversational filler, and redundant wording.
        5. NO OMISSION: Do NOT omit any syllabus topics or oversimplify critical technical explanations.
        6. OUTPUT ONLY the refined markdown notes. Do not include introductory text or meta commentary.
        
        Original Notes:
        ${currentSummary}
        `

        const condensed = await generateText(prompt)

        // Update DB
        const { error } = await supabase
            .from('exam_modules')
            .update({ summary: condensed })
            .eq('id', moduleId)
            .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json(
            { summary: condensed },
            {
                headers: {
                    ...rateLimitHeaders({
                        limit: RATE_LIMITS.exam_prep.limit,
                        remaining: rl.remaining,
                        resetAt: rl.resetAt,
                    }),
                },
            }
        )

    } catch (error) {
        console.error('Shrink Summary Error:', error)
        return NextResponse.json({ error: 'Failed to shrink summary' }, { status: 500 })
    }
}
