import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/gemini'
import { Part } from '@google/generative-ai'

function normalizeStoragePath(path: string): string {
    const trimmed = (path || '').trim()
    if (!trimmed) return trimmed
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed)
            const pathname = url.pathname || ''
            const bucketMarker = '/storage/v1/object/public/' // Adjust based on your public access
            // For private/authenticated buckets, download logic handles usually paths/keys.
            // Assuming we store relative path in DB from previous code: "user_id/subject_id/filename"
            return trimmed // simplified for now, usually we expect the DB to store the KEY
        } catch { return trimmed }
    }
    return trimmed
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { subjectId, syllabusPath } = body

        if (!subjectId || !syllabusPath) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Download Syllabus
        const validPath = normalizeStoragePath(syllabusPath)
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('exam-pdfs')
            .download(validPath)

        if (downloadError || !fileData) {
            console.error('Syllabus download error:', downloadError)
            return NextResponse.json({ error: 'Failed to download syllabus' }, { status: 500 })
        }

        const buffer = await fileData.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const ext = validPath.split('.').pop()?.toLowerCase()
        let mimeType = 'application/pdf'
        if (ext === 'png') mimeType = 'image/png'
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'

        // Construct AI Prompt
        const parts: (string | Part)[] = []
        parts.push({
            text: `Analyze this syllabus document. 
            Identify and EXTRACT any text that is visually HIGHLIGHTED (yellow/marker), CIRCLED (red pen), or explicitly marked as "Important".
            
            If NO text is clearly highlighted/marked, then summarize the top 3-5 high-level core topics listed in the document.

            Output Format:
            - Return ONLY the extracted text/topics. 
            - Use bullet points.
            - Be specific.`
        })
        parts.push({
            inlineData: {
                data: base64,
                mimeType
            }
        })

        const extractedText = await generateText(parts)

        // Update Database
        const { error: updateError } = await supabase
            .from('exam_subjects')
            .update({ important_questions: extractedText })
            .eq('id', subjectId)
            .eq('user_id', user.id)

        if (updateError) {
            throw updateError
        }

        return NextResponse.json({ success: true, important_topics: extractedText })

    } catch (error) {
        console.error('Syllabus analysis error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
