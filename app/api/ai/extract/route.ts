import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders } from '@/lib/rate-limit'
import { AILimiter } from '@/lib/ai/limiter'
import { getRotatedModel, hasKeys } from '@/lib/ai/key-pool'

// Allow up to 60s on Vercel Pro; Hobby caps at 10s regardless.
export const maxDuration = 60

// Dedicated limiter with longer timeout for file extraction (PDFs can take 30-60s)
const extractLimiter = new AILimiter({
    concurrency: 3,
    maxQueue: 10,
    timeoutMs: 55000, // 55s — stay under Vercel's 60s max
    failureThreshold: 5,
    cooldownMs: 60000,
})

// Limit extractions per hour per user to save costs
const RATE_LIMIT = 30
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
    try {
        if (!hasKeys()) {
            return NextResponse.json(
                { error: 'AI service is not configured. Please contact the administrator.' },
                { status: 503 }
            )
        }

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

        // Build the prompt content (text-only or with image)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let promptContent: any

        if (textOnlyTypes.includes(type)) {
            promptContent = fullPrompt
        } else {
            if (!file) {
                return NextResponse.json({ error: 'Image is required for this type' }, { status: 400 })
            }

            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const base64Image = buffer.toString('base64')

            promptContent = [
                fullPrompt,
                {
                    inlineData: {
                        mimeType: file.type,
                        data: base64Image
                    }
                }
            ]
        }

        // Try with a rotated key from the pool; on 429/503, grab the next key and retry
        try {
            const model = getRotatedModel('gemini-2.5-flash')
            result = await extractLimiter.run(() => model.generateContent(promptContent))
        } catch (primaryErr) {
            const msg = primaryErr instanceof Error ? primaryErr.message : ''
            const status = (primaryErr as { status?: number })?.status
            const isRetryable = status === 503 || status === 429 || msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('high demand')

            if (isRetryable) {
                console.warn('Primary key/model unavailable, retrying with next key in pool')
                const fallback = getRotatedModel('gemini-2.0-flash')
                result = await fallback.generateContent(promptContent)
            } else {
                throw primaryErr
            }
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
        const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error'
        const statusCode = (error as { status?: number })?.status

        // 429 / Quota errors
        if (statusCode === 429 || errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
            return NextResponse.json(
                { error: 'AI quota exceeded. Please try again in a few minutes.' },
                { status: 429 }
            )
        }

        // 503 / High demand errors
        if (statusCode === 503 || errorMessage.includes('503') || errorMessage.toLowerCase().includes('high demand') || errorMessage.toLowerCase().includes('overloaded')) {
            return NextResponse.json(
                { error: 'AI service is temporarily busy. Please try again in a moment.' },
                { status: 503 }
            )
        }

        // Timeout errors from limiter
        if (errorMessage.includes('timed out')) {
            return NextResponse.json(
                { error: 'Request took too long. Try a smaller file or try again later.' },
                { status: 504 }
            )
        }

        // Circuit breaker open
        if (errorMessage.includes('circuit open') || errorMessage.includes('service busy')) {
            return NextResponse.json(
                { error: 'AI service is temporarily unavailable. Please wait a minute and try again.' },
                { status: 503 }
            )
        }

        return NextResponse.json({ error: errorMessage || 'Failed to process file. Please try again.' }, { status: 500 })
    }
}
