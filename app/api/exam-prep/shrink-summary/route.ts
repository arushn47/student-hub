import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/gemini'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { moduleId, currentSummary } = body

        if (!moduleId) {
            return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
        }

        // Generate condensed summary directly
        const prompt = `
        You are an expert study assistant.
        
        Refine the following study notes into a **"Micro-Summary"**:
        - Reduce length by 50%.
        - Keep ONLY the absolute most critical keywords, formulas, and mnemonics.
        - Use ONLY bullet points.
        - Max 10 lines.
        
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

        return NextResponse.json({ summary: condensed })

    } catch (error) {
        console.error('Shrink Summary Error:', error)
        return NextResponse.json({ error: 'Failed to shrink summary' }, { status: 500 })
    }
}
