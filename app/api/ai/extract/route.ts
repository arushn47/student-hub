import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/api-utils'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders } from '@/lib/rate-limit'
import { hasKey, generateContent } from '@/lib/gemini'

// Allow up to 60s on Vercel Pro; Hobby caps at 10s regardless.
export const maxDuration = 60

// Limit extractions per hour per user to save costs
const RATE_LIMIT = 30
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
    try {
        if (!hasKey()) {
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

        let files: File[] = []
        let type: string = ''
        let prompt: string = ''
        let text: string = ''

        // Handle both FormData (image/PDF uploads) and JSON (OCR text or text-only requests)
        if (contentType.includes('application/json')) {
            const body = await req.json()
            type = body.type
            text = body.text || ''
            prompt = body.prompt || ''
        } else {
            const formData = await req.formData()
            files = formData.getAll('image') as File[]
            type = formData.get('type') as string
            prompt = formData.get('prompt') as string
        }

        // OCR text can come from client-side Tesseract for any type
        const hasOcrText = text && text.trim().length > 0
        const textOnlyTypes = ['difficulty']

        // Require either OCR text, image files, or text-only type
        if (!hasOcrText && !textOnlyTypes.includes(type) && (files.length === 0 || !type)) {
            return NextResponse.json({ error: 'Image(s) or text and type are required' }, { status: 400 })
        }

        // Define specific prompts based on type
        let systemPrompt = ''
        let jsonSchema = ''

        switch (type) {
            case 'grades':
                const categoryMappingInstructions = `
IMPORTANT - CATEGORY MAPPING (Course Distribution):
If the text/image includes a "Course Distribution" or similar column (like PC, UCNS, NMC, etc.), map it exactly to ONE of these specific categories:
- "Programme Core" (if PC)
- "Programme Elective" (if PE)
- "University Core - Natural Science" (if UCNS)
- "University Core - Engineering Sciences" (if UCBES or UCES)
- "University Core - Skill Development" (if UCSD)
- "University Core - Humanities & Social Science" (if UCHSS)
- "University Core - Project & Internships" (if UCPI)
- "University Elective - Natural Science" (if UENS or UENSE)
- "University Elective - Multidisciplinary" (if UEM)
- "University Elective - Humanities & Social" (if UEHSS)
- "University Elective - Open Electives" (if UEOE or OE)
- "Non-Graded Mandatory Courses" (if NMC)
If no mapping matches, omit the category or make your best guess.`;

                const semesterMappingInstructions = `
IMPORTANT - SEMESTER MAPPING:
- If you see "Exam Month" (e.g., Jan-2024, Apr-2024, Aug-2024), map chronologically:
  - Sort unique exam months by date
  - Earliest = "Semester 1", Second = "Semester 2", etc.
  - Example: Jan-2024 -> "Semester 1", Apr-2024 -> "Semester 2", Aug-2024 -> "Semester 3"
- If explicit semester info exists (e.g., "Fall 2024"), keep as-is

For VIT India grades: O/S = 10, A = 9, B = 8, C = 7, D = 6, E = 5, F = 0`;

                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from a grade report. Extract ALL courses with their grades, credits, semester, AND category.\n${semesterMappingInstructions}\n${categoryMappingInstructions}\n\nOCR TEXT:\n${text}`
                    : `Analyze this image of a grade report. Extract ALL courses with their grades, credits, semester, AND category.\n${semesterMappingInstructions}\n${categoryMappingInstructions}`;
                
                jsonSchema = 'Return JSON: { "courses": [{ "name": "string (course title)", "grade": "string (S/A/B/C/D/E/F/O)", "credits": number, "semester": "string (e.g. Semester 1, Semester 2)", "category": "string (Mapped category, default none)" }] }'
                break
            case 'flashcards':
                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from study material. Create a set of flashcards (Question/Answer) covering the key concepts.\n\nOCR TEXT:\n${text}`
                    : 'Analyze this study material (notes, textbook, diagram). Create a set of flashcards (Question/Answer) covering the key concepts.'
                jsonSchema = 'Return JSON: { "deckName": "string (suggested title)", "flashcards": [{ "front": "string", "back": "string" }] }'
                break
            case 'timetable':
                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from a university timetable. Extract all class entries.

Each class entry should contain the day, time slot, course code/subject, and room/location.
Parse carefully — OCR text may have formatting artifacts. Extract as many classes as possible.

OCR TEXT:
${text}`
                    : `Analyze this university timetable grid image VERY CAREFULLY. This is a weekly schedule with:
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
                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from a receipt or bill. Extract the items purchased and total.\n\nOCR TEXT:\n${text}`
                    : 'Analyze this receipt or bill. Extract the items purchased and total.'
                jsonSchema = 'Return JSON: { "items": [{ "description": "string", "amount": number, "category": "string (food, transport, etc)" }], "total": number }'
                break
            case 'difficulty':
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

        // Build the prompt content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let promptContent: any

        if (hasOcrText || textOnlyTypes.includes(type)) {
            // Text-only: OCR text is embedded in the system prompt, no image tokens needed
            promptContent = fullPrompt
            console.log(`Using OCR text path (${text.length} chars) for type: ${type}`)
        } else {
            // Image/PDF-based extraction (fallback when OCR isn't possible, e.g. PDFs)
            if (files.length === 0) {
                return NextResponse.json({ error: 'Image is required for this type' }, { status: 400 })
            }
            if (files.some(f => f.type === 'application/pdf') && files.length > 1) {
                return NextResponse.json({ error: 'PDFs must be uploaded one at a time' }, { status: 400 })
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parts: any[] = [fullPrompt]

            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const base64Image = buffer.toString('base64')

                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64Image
                    }
                })
            }

            promptContent = parts
            console.log(`Using image path (${files.length} file(s)) for type: ${type}`)
        }

        // Try gemini-2.5-flash first, fallback to 2.0-flash on 429/503
        result = await generateContent(promptContent, 55000)

        if (!result || !result.response) {
            throw new Error("Invalid AI response")
        }
        const responseText = await result.response.text()
        if (!responseText) {
            throw new Error("Empty AI response")
        }

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

        // Timeout errors
        if (errorMessage.includes('timed out')) {
            return NextResponse.json(
                { error: 'Request took too long. Try a smaller file or try again later.' },
                { status: 504 }
            )
        }

        return NextResponse.json({ error: errorMessage || 'Failed to process file. Please try again.' }, { status: 500 })
    }
}
