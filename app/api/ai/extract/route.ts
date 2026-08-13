/* eslint-disable @typescript-eslint/no-explicit-any */
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
            case 'attendance_portal':
                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from a university student attendance portal page (e.g., VIT Bhopal - VTOP attendance table).
Extract the courses, along with their attended classes/days and total conducted classes.

Each course entry should contain:
- course code (e.g., CDS3005, CSE3009, etc.)
- course name (e.g., Foundations of Data Science, Internet of Things, etc.)
- attended classes count
- total classes count

OCR TEXT:
\${text}`
                    : `Analyze this screenshot of a university student attendance portal page (e.g., VIT Bhopal - VTOP attendance table).
Scan the table very carefully and extract EVERY SINGLE COURSE along with their:
1. Course Code (e.g., CDS3005, CSE3009, etc.) and Course Name (e.g., Foundations of Data Science)
2. Attended Classes/Days (number of classes present or attended)
3. Total Conducted Classes (number of total classes held)

Typically, the columns are like "Course Detail" (which holds code & name), "Attended Classes" or "Classes Attended", and "Total Classes" or "Conducted Classes".
Extract all rows of courses in the table.`;
                jsonSchema = 'Return JSON: { "courses": [{ "code": "string (e.g. CDS3005)", "name": "string (e.g. Foundations of Data Science)", "attended": number, "total": number }] }'
                break
            case 'grades':
                const categoryMappingInstructions = `
IMPORTANT - CATEGORY MAPPING (Course Distribution):
If the text/image includes a "Course Distribution" or similar column (like PC, UCNSC, NMC, etc.), map it exactly to ONE of these specific categories. Pay close attention to split letters like "C" or "MC" on the next line (e.g. UCBES + C = UCBESC):
- "Programme Core" (if PC)
- "Programme Elective" (if PE)
- "University Core - Natural Science" (if UCNS or UCNSC)
- "University Core - Engineering Sciences" (if UCBES, UCES, or UCBESC)
- "University Core - Skill Development" (if UCSD or UCSDC)
- "University Core - Humanities & Social Science" (if UCHSS or UCHSSMC)
- "University Core - Project & Internships" (if UCPI)
- "University Elective - Natural Science" (if UENS or UENSE)
- "University Elective - Multidisciplinary" (if UEM)
- "University Elective - Humanities & Social" (if UEHSS or UEHSSME)
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

For VIT Bhopal, India grades: S = 10, A = 9, B = 8, C = 7, D = 6, E = 5, F = 0`;

                const strictExtractionInstructions = `
CRITICAL: Do not omit any row. Extraction is considered failed if any table row is skipped. You must extract EVERY SINGLE COURSE listed in the grade report.`;

                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from a grade report.\n${strictExtractionInstructions}\n\nExtract the courses with their grades, credits, semester, AND category.\n${semesterMappingInstructions}\n${categoryMappingInstructions}\n\nOCR TEXT:\n${text}`
                    : `Analyze this image of a grade report.\n${strictExtractionInstructions}\n\nExtract the courses with their grades, credits, semester, AND category.\n${semesterMappingInstructions}\n${categoryMappingInstructions}`;

                jsonSchema = 'Return JSON: { "courses": [{ "name": "string (course title from Course Title column)", "code": "string (course code from Course Code column)", "courseType": "string (from Course Type column, e.g. LTP, LT)", "grade": "string (S/A/B/C/D/E/F/O/P from Grade column)", "credits": number (from Credits column), "semester": "string (e.g. Semester 1, Semester 2 based on Exam Month)", "category": "string (Mapped category, default none)", "examMonth": "string (from Exam Month column)" }] }'
                break
            case 'flashcards':
                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from study material. Create a set of flashcards (Question/Answer) covering the key concepts.\n\nOCR TEXT:\n${text}`
                    : 'Analyze this study material (notes, textbook, diagram). Create a set of flashcards (Question/Answer) covering the key concepts.'
                jsonSchema = 'Return JSON: { "deckName": "string (suggested title)", "flashcards": [{ "front": "string", "back": "string" }] }'
                break
            case 'timetable':
                systemPrompt = hasOcrText
                    ? `Analyze this OCR-extracted text from a university timetable. Extract all occupied class entries.
Each class entry should contain the day, time slot, course code/subject (exclude slot/room), slot code, and room/location.
OCR TEXT:
${text}`
                    : `Analyze this university timetable grid image VERY CAREFULLY. This is a weekly schedule with:
- ROWS = Days of the week (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday)
- COLUMNS = Time slots (morning to evening, e.g., 08:30, 10:05, 11:40, 13:15, 14:50, 16:25, 18:00, etc.)

YOU MUST SCAN EVERY SINGLE CELL IN THE GRID. Look for HIGHLIGHTED or occupied classes.

IGNORE empty cells.
IGNORE cells that ONLY contain slot IDs (like "A11", "D11", "L1") without any course info.
IGNORE cells that say "Lunch".

For the highlighted/occupied cells (e.g. "B11-MAT1001-LT-AB-301-FS"), extract exactly this:
1. Subject / Course Code (e.g., MAT1001) - Do NOT include the slot code (B11) or room in the course code!
2. Slot Code (e.g., B11, L1)
3. Room/Location (e.g., AB-301)
4. Time of that slot. Parse the time from the top header column for that specific cell (e.g. "10:05 - 11:35"). Read the actual time written in the column header.
5. Day of the week from the row.

Extract EVERY single highlighted class in the grid.`
                jsonSchema = 'Return JSON: { "classes": [{ "day": "string (Full day name: Monday, Tuesday, etc.)", "time": "string (HH:MM - HH:MM)", "subject": "string (Course Code only, e.g. MAT1001)", "slot": "string (e.g. B11)", "location": "string (Room e.g. AB-301)" }] }'
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

        // Use gemini-2.5-flash for extraction
        const result = await generateContent(promptContent, 55000)

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

        return NextResponse.json({ 
            error: {
                message: errorMessage === 'fetch failed' ? 'Network connection failed. This is usually an ISP issue (Jio/IPv6).' : errorMessage,
                details: (error as any)?.details || null,
                hint: (error as any)?.hint || null,
                code: (error as any)?.code || null
            } 
        }, { status: 500 })
    }
}
