import { NextResponse } from 'next/server'
import { Part } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { generateText, GeminiRateLimitError } from '@/lib/gemini'
import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit'
import { extractOfficeText } from '@/lib/office-extract'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

function normalizeStoragePath(path: string): string {
    const trimmed = (path || '').trim()
    if (!trimmed) return trimmed

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed)
            const pathname = url.pathname || ''
            const bucketMarker = '/storage/v1/object/'
            const idx = pathname.indexOf(bucketMarker)
            const after = idx >= 0 ? pathname.slice(idx + bucketMarker.length) : pathname

            const parts = after.split('/').filter(Boolean)
            const bucketIndex = parts.findIndex(p => p === 'exam-pdfs')
            if (bucketIndex >= 0 && bucketIndex + 1 < parts.length) {
                const key = parts.slice(bucketIndex + 1).join('/')
                return normalizeStoragePath(key)
            }
        } catch {
            // fall through
        }
    }

    if (trimmed.startsWith('exam-pdfs/')) {
        return normalizeStoragePath(trimmed.slice('exam-pdfs/'.length))
    }

    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
        try {
            return decodeURIComponent(trimmed)
        } catch {
            return trimmed
        }
    }

    return trimmed
}

export async function POST(request: Request) {
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null
    let userId: string | null = null
    let moduleId: string | null = null

    try {
        supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        userId = user.id

        const rl = await checkRateLimit(
            user.id,
            RATE_LIMITS.exam_prep.endpoint,
            RATE_LIMITS.exam_prep.limit,
            RATE_LIMITS.exam_prep.windowSeconds
        )

        if (!rl.allowed) {
            const retry = Math.max(1, Math.ceil((new Date(rl.resetAt).getTime() - Date.now()) / 1000))
            const timeDesc = retry < 60 ? `~${retry}s` : `~${Math.ceil(retry / 60)}m`
            return rateLimitExceededResponse({
                limit: RATE_LIMITS.exam_prep.limit,
                remaining: rl.remaining,
                resetAt: rl.resetAt,
                customMessage: `AI is taking a quick breather! ⏳ Ready in ${timeDesc}. Review the notes and flashcards on your ready modules! 💡`,
            })
        }

        const body = await request.json().catch(() => ({}))
        moduleId = body?.moduleId

        if (!moduleId) {
            return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
        }

        // Fetch module and subject details
        const { data: module, error: moduleError } = await supabase
            .from('exam_modules')
            .select('*, exam_subjects(*)')
            .eq('id', moduleId)
            .eq('user_id', user.id)
            .single()

        if (moduleError || !module) {
            return NextResponse.json({ error: 'Module not found' }, { status: 404 })
        }

        const subjectName = module.exam_subjects?.name || 'this subject'
        const examType = module.exam_subjects?.exam_type || 'endterm'
        const subjectImportantQuestions = module.exam_subjects?.important_questions || ''
        const importantContext = subjectImportantQuestions
            ? `\n\nSUBJECT IMPORTANT TOPICS & CONTEXT:\n${subjectImportantQuestions}\n`
            : ''

        const parts: (string | Part)[] = []

        // Attach syllabus if present
        if (module.exam_subjects?.syllabus_path) {
            try {
                const normalizedSyllabusPath = normalizeStoragePath(module.exam_subjects.syllabus_path)
                const { data: syllabusData } = await supabase.storage
                    .from('exam-pdfs')
                    .download(normalizedSyllabusPath)

                if (syllabusData) {
                    const buffer = await syllabusData.arrayBuffer()
                    const ext = normalizedSyllabusPath.split('.').pop()?.toLowerCase() || ''

                    if (ext === 'pdf') {
                        const base64 = Buffer.from(buffer).toString('base64')
                        parts.push({
                            text: 'OFFICIAL COURSE SYLLABUS (Use this to strictly frame and scope the module topics):'
                        })
                        parts.push({
                            inlineData: {
                                data: base64,
                                mimeType: 'application/pdf'
                            }
                        })
                    } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
                        const base64 = Buffer.from(buffer).toString('base64')
                        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
                        parts.push({
                            text: 'OFFICIAL COURSE SYLLABUS (Use this to strictly frame and scope the module topics):'
                        })
                        parts.push({
                            inlineData: {
                                data: base64,
                                mimeType
                            }
                        })
                    } else if (ext === 'pptx' || ext === 'docx') {
                        const extracted = await extractOfficeText(new Uint8Array(buffer), ext)
                        if (extracted?.trim()) {
                            parts.push({
                                text: `OFFICIAL COURSE SYLLABUS (Use this to strictly frame and scope the module topics):\n${extracted.trim()}`
                            })
                        }
                    } else if (ext === 'txt' || ext === 'md') {
                        const text = Buffer.from(buffer).toString('utf-8')
                        if (text.trim()) {
                            parts.push({
                                text: `OFFICIAL COURSE SYLLABUS:\n${text.trim()}`
                            })
                        }
                    }
                }
            } catch (err) {
                console.error('Error attaching syllabus:', err)
            }
        }

        // Fetch module study materials if present
        const { data: moduleFiles } = await supabase
            .from('exam_module_files')
            .select('file_path, file_name')
            .eq('module_id', moduleId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        if (moduleFiles && moduleFiles.length > 0) {
            for (const file of moduleFiles) {
                try {
                    const normalizedPath = normalizeStoragePath(file.file_path)
                    const { data: fileData } = await supabase.storage
                        .from('exam-pdfs')
                        .download(normalizedPath)

                    if (fileData) {
                        const buffer = await fileData.arrayBuffer()
                        if (buffer.byteLength <= MAX_FILE_SIZE_BYTES) {
                            const ext = file.file_name.split('.').pop()?.toLowerCase() || ''

                            if (ext === 'pdf') {
                                const base64 = Buffer.from(buffer).toString('base64')
                                parts.push({
                                    text: `MODULE STUDY MATERIAL (${file.file_name}):`
                                })
                                parts.push({
                                    inlineData: {
                                        data: base64,
                                        mimeType: 'application/pdf'
                                    }
                                })
                            } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
                                const base64 = Buffer.from(buffer).toString('base64')
                                const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
                                parts.push({
                                    text: `MODULE STUDY MATERIAL (${file.file_name}):`
                                })
                                parts.push({
                                    inlineData: {
                                        data: base64,
                                        mimeType
                                    }
                                })
                            } else if (ext === 'pptx' || ext === 'docx') {
                                const extracted = await extractOfficeText(new Uint8Array(buffer), ext)
                                if (extracted?.trim()) {
                                    parts.push({
                                        text: `MODULE STUDY MATERIAL (${file.file_name}):\n${extracted.trim()}`
                                    })
                                }
                            } else if (ext === 'txt' || ext === 'md') {
                                const text = Buffer.from(buffer).toString('utf-8')
                                if (text.trim()) {
                                    parts.push({
                                        text: `MODULE STUDY MATERIAL (${file.file_name}):\n${text.trim()}`
                                    })
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error attaching file ${file.file_name}:`, err)
                }
            }
        }

        const promptText = `
You are an expert university professor and top academic exam coach.

TASK:
Generate a high-yield, comprehensive TOPIC CHEAT SHEET / EXAM REVISION GUIDE for:
- Subject: ${subjectName}
- Module: Module ${module.module_number} - "${module.name}"
- Exam Type: ${examType}${importantContext}

STRICT ARCHITECTURE & FORMAT RULES:
1. ABSOLUTELY NO QUESTIONS OR ANSWERS. DO NOT write "Question 1:", "Q:", "What is...", or mock test questions.
2. ABSOLUTELY NO FLASHCARDS. DO NOT write "Key Concepts (Flashcards)" or front/back cards.
3. This is a PURE, HIGH-DENSITY TOPIC CHEAT SHEET organized topic-by-topic according to the syllabus.
4. STRUCTURE BY TOPIC / SUBTOPIC:
   For every major topic and concept in this module, format as:
   ### [Topic / Concept Name]
   - **Core Definition**: 1-2 sharp, precise sentences.
   - **Key Mechanics / Principles**: Crisp bullet points covering workflows, architecture, formulas, algorithms, or steps.
   - **Comparison & Trade-offs**: When to use this vs alternatives, pros & cons. USE MARKDOWN TABLES for comparisons (e.g. Waterfall vs Agile vs Spiral, Static vs Dynamic, Black Box vs White Box). ALWAYS place the markdown table on its own block with a blank line before and after the table. NEVER put table pipes inline on the same line as the bullet.
   - **Exam Watch & Trap Alerts**: High-probability exam tricks, key distinctions professors test on, and common student misconceptions.
5. FORMATTING:
   - Use clean Markdown headers (###), bullet points, and bold text for key terms.
   - Use Markdown tables (\`| Concept | Feature A | Feature B |\`) wherever two or more concepts or models can be compared. Always ensure blank lines exist before the table header and after the last table row.
   - Wrap code snippets or pseudocode in triple-backtick fenced code blocks with language identifiers (\`\`\`python, \`\`\`java, \`\`\`cpp).
6. CONCISE & COMPACT:
   - Condense lengthy definitions and explanations into concise, high-yield bullet points (aiming for 25–35% more compact notes).
   - Remove repetition, wordy prose, and conversational filler while preserving all syllabus topics.
   - Retain all core concepts, classifications, comparison tables, formulas, and exam watch/trap alerts without oversimplifying.
   - Output ONLY the formatted markdown cheat sheet. Do not include meta chatter or introduction like "Here is your cheat sheet:".
`

        parts.push({ text: promptText })

        const generatedSummary = await generateText(parts)
        const cleanSummary = generatedSummary.trim()

        if (!cleanSummary) {
            throw new Error('AI returned an empty response')
        }

        // Update database
        const { error: updateError } = await supabase
            .from('exam_modules')
            .update({ summary: cleanSummary })
            .eq('id', moduleId)
            .eq('user_id', user.id)

        if (updateError) throw updateError

        return NextResponse.json(
            { success: true, summary: cleanSummary },
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
        if (error instanceof GeminiRateLimitError) {
            return NextResponse.json(
                {
                    error: 'Rate limited by Gemini API',
                    retryAfterSeconds: error.retryAfterSeconds,
                    message: error.message,
                },
                { status: 429 }
            )
        }

        console.error('Generate Notes Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate short notes' },
            { status: 500 }
        )
    }
}

