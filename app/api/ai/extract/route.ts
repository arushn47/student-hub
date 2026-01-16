import { NextRequest, NextResponse } from 'next/server'
import { geminiModel } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse, rateLimitResponse, checkRateLimit } from '@/lib/api-utils'

// Limit to 10 extractions per hour per user to save costs
const RATE_LIMIT = 10
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const { allowed, resetIn } = checkRateLimit(user.id, 'ai_extract', RATE_LIMIT, RATE_LIMIT_WINDOW)
        if (!allowed) return rateLimitResponse(resetIn)

        const formData = await req.formData()
        const file = formData.get('image') as File
        const type = formData.get('type') as string
        const prompt = formData.get('prompt') as string

        if (!file || !type) {
            return NextResponse.json({ error: 'Image and type are required' }, { status: 400 })
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64Image = buffer.toString('base64')

        // Define specific prompts based on type
        let systemPrompt = ''
        let jsonSchema = ''

        switch (type) {
            case 'grades':
                systemPrompt = `Analyze this image of a grade report, transcript, or result slip. Extract ALL courses/subjects with their grades, credits, AND semester.

IMPORTANT - SEMESTER MAPPING:
- If the image shows "Exam Month" (e.g., Jan-2024, Apr-2024, Aug-2024), map them to semesters CHRONOLOGICALLY:
  - Sort all unique exam months by date
  - The EARLIEST exam month = "Semester 1"
  - The SECOND earliest = "Semester 2", and so on
- Example: If you see Jan-2024, Apr-2024, Aug-2024, Jan-2025:
  - Jan-2024 → "Semester 1"
  - Apr-2024 → "Semester 2"  
  - Aug-2024 → "Semester 3"
  - Jan-2025 → "Semester 4"
- If explicit semester info exists (e.g., "Fall 2024", "Winter 2025"), keep as-is

For VIT India grades: O/S = 10, A = 9, B = 8, C = 7, D = 6, E = 5, F = 0`
                jsonSchema = 'Return JSON: { "courses": [{ "name": "string (course title)", "grade": "string (S/A/B/C/D/E/F/O)", "credits": number, "semester": "string (e.g. Semester 1, Semester 2)" }] }'
                break
            case 'flashcards':
                systemPrompt = 'Analyze this study material (notes, textbook, diagram). Create a set of flashcards (Question/Answer) covering the key concepts.'
                jsonSchema = 'Return JSON: { "deckName": "string (suggested title)", "flashcards": [{ "front": "string", "back": "string" }] }'
                break
            case 'timetable':
                systemPrompt = 'Analyze this timetable/schedule image. It is a university grid. IMPORTANT: Only extract cells that contain actual COURSE CODES (e.g., "CSE3009", "MAT1001") or Subject Names. IGNORE cells that only contain Slot IDs like "A11", "B11", "C1", "D12", etc. If a cell has "A11" but NO course code, it is empty/free. Ignore "Lunch".'
                jsonSchema = 'Return JSON: { "classes": [{ "day": "string (Full day name e.g. Monday)", "time": "string (Start - End e.g. 08:00 AM - 09:30 AM)", "subject": "string (Course Code + Name)", "location": "string (Room No)" }] }'
                break
            case 'expenses':
                systemPrompt = 'Analyze this receipt or bill. Extract the items purchased and total.'
                jsonSchema = 'Return JSON: { "items": [{ "description": "string", "amount": number, "category": "string (food, transport, etc)" }], "total": number }'
                break
            default:
                systemPrompt = prompt || 'Analyze this image.'
                jsonSchema = 'Return structured JSON data'
        }

        const fullPrompt = `${systemPrompt}\n\n${jsonSchema}\n\nIMPORTANT: Return ONLY valid JSON. No markdown formatting.`

        const result = await geminiModel.generateContent([
            fullPrompt,
            {
                inlineData: {
                    mimeType: file.type,
                    data: base64Image
                }
            }
        ])

        const responseText = result.response.text()

        // Clean markdown if present
        const cleanedText = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        try {
            const data = JSON.parse(cleanedText)
            return NextResponse.json({ data })
        } catch (e) {
            console.error('JSON Parse Error:', e, 'Raw Text:', responseText)
            return NextResponse.json({ error: 'Failed to parse AI response', raw: responseText }, { status: 500 })
        }

    } catch (error: unknown) {
        console.error('Extraction API Error:', error)
        // Check for 429/Quota errors from Google
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isQuotaError = errorMessage.includes('429') || (error as { status?: number })?.status === 429;

        if (isQuotaError) {
            return NextResponse.json(
                { error: 'AI Quota Exceeded. Please try again later or check your API limit.' },
                { status: 429 }
            )
        }
        return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 })
    }
}
