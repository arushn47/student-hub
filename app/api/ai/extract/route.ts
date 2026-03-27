import { NextRequest, NextResponse } from 'next/server'
import { geminiModel } from '@/lib/gemini'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders } from '@/lib/rate-limit'

// Limit to 10 extractions per hour per user to save costs
const RATE_LIMIT = 10
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return unauthorizedResponse()

        const rl = await checkRateLimit(user.id, 'ai_extract', RATE_LIMIT, RATE_LIMIT_WINDOW / 1000)
        if (!rl.allowed) {
            return rateLimitExceededResponse({
                limit: RATE_LIMIT,
                remaining: rl.remaining,
                resetAt: rl.resetAt,
            })
        }

        const contentType = req.headers.get('content-type') || ''

        let file: File | null = null
        let type: string = ''
        let prompt: string = ''
        let text: string = ''

        // Handle both FormData (image uploads) and JSON (text-only requests like difficulty)
        if (contentType.includes('application/json')) {
            const body = await req.json()
            type = body.type
            text = body.text || ''
            prompt = body.prompt || ''
        } else {
            const formData = await req.formData()
            file = formData.get('image') as File
            type = formData.get('type') as string
            prompt = formData.get('prompt') as string
        }

        // For text-only types like difficulty, we don't need an image
        const textOnlyTypes = ['difficulty']
        if (!textOnlyTypes.includes(type) && (!file || !type)) {
            return NextResponse.json({ error: 'Image and type are required' }, { status: 400 })
        }

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
                systemPrompt = `Analyze this university timetable grid image VERY CAREFULLY. This is a weekly schedule with:
- ROWS = Days of the week (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday)
- COLUMNS = Time slots (morning to evening, e.g., 08:30, 10:05, 11:40, 13:15, 14:50, 16:25, 18:00, etc.)

YOU MUST SCAN EVERY SINGLE CELL IN THE GRID - from the first column to the LAST column, for EACH day.

For each cell, a class entry typically looks like:
- "CSE3009-LTP" or "B12-CSE3009-LTP-AB02-429" (Course Code + Type + Room)
- The format is often: [SlotID]-[CourseCode]-[Type]-[Building][Room]-[RoomNumber]

IGNORE cells that:
- Only contain slot IDs like "A11", "B12", "C13", "D14", "E13", "F13" without any course info
- Say "Lunch" or are empty

EXTRACT cells that contain actual course codes (e.g., CSE3009, MAT3002, CDS3005, PLA1006).

Parse the time from the header row (Start/End times shown at top).
For example, if a cell is in the 08:30 column with End 10:00, use that time range.

IMPORTANT: There may be 8+ columns of classes - extract from ALL of them, not just the first few!`
                jsonSchema = 'Return JSON: { "classes": [{ "day": "string (Full day name: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday)", "time": "string (HH:MM - HH:MM in 24h format, e.g., 10:05 - 11:35)", "subject": "string (Course Code like CSE3009-LTP)", "location": "string (Room like AB02-429 or AR-202)" }] }'
                break
            case 'expenses':
                systemPrompt = 'Analyze this receipt or bill. Extract the items purchased and total.'
                jsonSchema = 'Return JSON: { "items": [{ "description": "string", "amount": number, "category": "string (food, transport, etc)" }], "total": number }'
                break
            case 'difficulty':
                // Text-based endpoint for estimating course difficulty
                systemPrompt = `You are an expert academic advisor. Based on these university course names, estimate the difficulty level of each course.
    
Consider factors like:
- Math/Science courses are typically harder (Physics, Calculus, etc.)
- Programming/Technical courses vary (Data Structures is moderate, ML is hard)
- Humanities/Languages are typically easier
- Lab courses add complexity

Course names: ${text || 'No courses provided'}

For EACH course (in the same order provided), return a difficulty rating.`
                jsonSchema = 'Return JSON: { "difficulties": ["Easy" | "Medium" | "Hard" | "Very Hard"] } - One rating per course, maintaining order'
                break
            default:
                systemPrompt = prompt || 'Analyze this image.'
                jsonSchema = 'Return structured JSON data'
        }

        const fullPrompt = `${systemPrompt}\n\n${jsonSchema}\n\nIMPORTANT: Return ONLY valid JSON. No markdown formatting.`

        let result

        // Handle text-only requests differently
        if (textOnlyTypes.includes(type)) {
            // Text-only AI generation (no image)
            result = await geminiModel.generateContent(fullPrompt)
        } else {
            // Image-based AI generation
            if (!file) {
                return NextResponse.json({ error: 'Image is required for this type' }, { status: 400 })
            }

            // Convert file to base64
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const base64Image = buffer.toString('base64')

            result = await geminiModel.generateContent([
                fullPrompt,
                {
                    inlineData: {
                        mimeType: file.type,
                        data: base64Image
                    }
                }
            ])
        }

        const responseText = result.response.text()

        // Clean markdown if present
        const cleanedText = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        try {
            const data = JSON.parse(cleanedText)
            return NextResponse.json(
                { data },
                {
                    headers: {
                        ...rateLimitHeaders({
                            limit: RATE_LIMIT,
                            remaining: rl.remaining,
                            resetAt: rl.resetAt,
                        }),
                    },
                }
            )
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
