import { NextResponse } from 'next/server'
// Force HMR update
import { createClient } from '@/lib/supabase/server'
import { generateJSON, GeminiRateLimitError } from '@/lib/gemini'
import { Part } from '@google/generative-ai'

import { extractOfficeText } from '@/lib/office-extract'

// ... (code)

interface GeneratedContent {
    questions: {
        question: string
        answer: string
        is_most_likely: boolean
    }[]
    flashcards: {
        front: string
        back: string
    }[]
    summary: string
}

export async function POST(request: Request) {
    let stage = 'init'
    try {
        const supabase = await createClient()
        stage = 'auth.getUser'
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        stage = 'request.json'
        const body = await request.json().catch(() => ({}))
        const moduleId = body?.moduleId

        if (!moduleId) {
            return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
        }

        // Get module and subject info
        stage = 'db.exam_modules'
        const { data: module, error: moduleError } = await supabase
            .from('exam_modules')
            .select('*, exam_subjects(*)')
            .eq('id', moduleId)
            .eq('user_id', user.id)
            .single()

        if (moduleError || !module) {
            return NextResponse.json({ error: 'Module not found' }, { status: 404 })
        }

        const filePathsFromClient: unknown = body?.filePaths
        let filePaths: string[] = Array.isArray(filePathsFromClient)
            ? filePathsFromClient.filter((p): p is string => typeof p === 'string' && p.length > 0)
            : []

        if (filePaths.length === 0) {
            // Fetch ALL files for this module to ensure comprehensive context
            stage = 'db.exam_module_files'
            const { data: moduleFiles, error: filesError } = await supabase
                .from('exam_module_files')
                .select('file_path')
                .eq('module_id', moduleId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })

            if (filesError || !moduleFiles || moduleFiles.length === 0) {
                return NextResponse.json({ error: 'No files found for this module' }, { status: 400 })
            }

            filePaths = moduleFiles.map(f => f.file_path)
        }

        // Construct the parts
        const parts: (string | Part)[] = []

                const subjectName = module.exam_subjects?.name || 'this subject'
                const examType = module.exam_subjects?.exam_type || 'endterm'
                const mostLikelyCount = module.exam_subjects?.questions_per_module ?? 1
                const marksPerQuestion = module.exam_subjects?.marks_per_question ?? 10
                const maxQuestions = 10
                const flashcardsPerModule = Math.max(12, maxQuestions * 2)

                const examTypeGuidance: Record<string, string> = {
                        midterm: 'Midterm: focus on likely short/medium questions, core definitions, and typical problem patterns.',
                        endterm: 'Endterm: include broader coverage, integration questions, and exam-style long answers where relevant.',
                        quiz: 'Quiz: focus on concise, high-yield questions and quick recall flashcards.',
                        final: 'Final: treat like endterm with comprehensive coverage and tricky edge cases.',
                }

                const systemPrompt = `You are an expert exam-prep assistant.

Generate content for:
- Subject: ${subjectName}
- Module: ${module.name} (Module ${module.module_number})
- Exam type: ${examType}

Guidance: ${examTypeGuidance[examType] || examTypeGuidance.endterm}

Return ONLY valid JSON with this exact schema:
{
    "questions": [
        {"question": "string", "answer": "string", "is_most_likely": boolean}
    ],
    "flashcards": [
        {"front": "string", "back": "string"}
    ],
    "summary": "string"
}

Rules:
- Create as many questions as needed to cover the module, but cap at ${maxQuestions} total.
- Mark EXACTLY ${mostLikelyCount} questions as is_most_likely=true.
- All other questions must have is_most_likely=false.
- Each question should be worth ~${marksPerQuestion} marks.
- Create EXACTLY ${flashcardsPerModule} flashcards for this module (no more, no less).
- Make flashcards specific to THIS module only.
- Make summary point-wise, each point on a new line prefixed with "- ".
- Keep answers clear, structured, and exam-ready.
- No markdown, no code fences, no extra keys.`

                parts.push(systemPrompt)

        let addedAnyFileContent = false
        const skippedFiles: { filePath: string; reason: string }[] = []

        // Download and add files as parts
        for (const filePath of filePaths) {
            try {
                const normalizedPath = normalizeStoragePath(filePath)
                // Ensure bucket name matches
                stage = `storage.download:${normalizedPath}`
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('exam-pdfs')
                    .download(normalizedPath)

                if (downloadError) {
                    console.error(`Download failed for ${normalizedPath}: ${downloadError.message}`)
                    skippedFiles.push({ filePath: normalizedPath, reason: `Download failed: ${downloadError.message}` })
                    continue
                }

                if (!fileData) {
                    console.error(`No data for ${filePath}`)
                    continue
                }

                const buffer = await fileData.arrayBuffer()
                const bytes = new Uint8Array(buffer)

                // Determine file type
                const ext = normalizedPath.split('.').pop()?.toLowerCase()
                const isPdf = ext === 'pdf'

                if (isPdf) {
                    stage = `file.pdf.base64:${normalizedPath}`
                    const base64 = Buffer.from(buffer).toString('base64')
                    parts.push({
                        inlineData: {
                            data: base64,
                            mimeType: 'application/pdf',
                        },
                    })
                    addedAnyFileContent = true
                    continue
                }

                // Gemini does not accept PPT/PPTX as inlineData.
                // Extract text server-side (PPTX/DOCX only) and send as plain text.
                stage = `file.office.extractText:${normalizedPath}`
                const extractedText = await extractOfficeText(bytes, ext || '')
                const cleaned = (extractedText || '').trim()
                if (!cleaned) {
                    skippedFiles.push({ filePath: normalizedPath, reason: 'Unsupported file type or no text extracted' })
                    continue
                }

                parts.push(`\n\n[File: ${normalizedPath}]\n${cleaned}`)
                addedAnyFileContent = true

            } catch (err) {
                console.error(`Error processing file ${filePath}:`, err)
            }
        }

        if (!addedAnyFileContent) {
            const details = skippedFiles.length > 0 ? skippedFiles : undefined
            return NextResponse.json(
                {
                    error: 'No supported content could be extracted from the uploaded files. Please upload a PDF, or a PPTX/DOCX with selectable text.',
                    details,
                },
                { status: 415 }
            )
        }

        stage = 'gemini.generateJSON'
        const expectedMostLikely = module.exam_subjects?.questions_per_module ?? 1
        const expectedFlashcards = Math.max(12, 10 * 2)
        const result = await generateWithCountEnforcement(parts, {
            minQuestions: Math.max(1, expectedMostLikely),
            maxQuestions: 10,
            expectedMostLikely,
            expectedFlashcards,
        })

        // DELETE existing questions and flashcards for this module to prevent duplicates
        stage = 'db.delete_old_content'
        await supabase.from('exam_questions').delete().eq('module_id', moduleId)
        await supabase.from('exam_flashcards').delete().eq('module_id', moduleId)

        // Save new content
        stage = 'db.insert_new_content'
        await saveGeneratedContent(supabase, moduleId, user.id, result)

        stage = 'db.update_module'
        await supabase
            .from('exam_modules')
            .update({ status: 'ready', summary: result.summary })
            .eq('id', moduleId)

        return NextResponse.json({ success: true })


    } catch (error) {
        if (error instanceof GeminiRateLimitError) {
            return NextResponse.json(
                {
                    error: 'Rate limited by Gemini API',
                    stage,
                    retryAfterSeconds: error.retryAfterSeconds,
                    message: error.message,
                },
                { status: 429 }
            )
        }

        console.error('Process API Error:', { stage, error })

        const isProd = process.env.NODE_ENV === 'production'
        const message = error instanceof Error ? error.message : 'Unknown error'
        const stack = error instanceof Error ? error.stack : undefined

        return NextResponse.json(
            {
                error: 'Failed to process module',
                ...(isProd ? {} : { stage, message, stack }),
            },
            { status: 500 }
        )
    }
}

function normalizeStoragePath(path: string): string {
    // Supabase storage paths should be raw (not URL-encoded). Some clients may persist %20 etc.
    const trimmed = (path || '').trim()
    if (!trimmed) return trimmed

    // If a full URL was stored, extract the object key after the bucket segment.
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed)
            const pathname = url.pathname || ''
            const bucketMarker = '/storage/v1/object/'
            const idx = pathname.indexOf(bucketMarker)
            const after = idx >= 0 ? pathname.slice(idx + bucketMarker.length) : pathname

            // after looks like: sign/exam-pdfs/<key> OR public/exam-pdfs/<key> OR authenticated/exam-pdfs/<key>
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

    // Strip accidental bucket prefix.
    if (trimmed.startsWith('exam-pdfs/')) {
        return normalizeStoragePath(trimmed.slice('exam-pdfs/'.length))
    }

    // Decode only if it looks encoded; avoid throwing on malformed sequences.
    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
        try {
            return decodeURIComponent(trimmed)
        } catch {
            return trimmed
        }
    }

    return trimmed
}

async function generateWithCountEnforcement(
    baseParts: (string | Part)[],
    opts: {
        minQuestions: number
        maxQuestions: number
        expectedMostLikely: number
        expectedFlashcards: number
    }
): Promise<GeneratedContent> {
    const maxAttempts = 3
    let last: GeneratedContent | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const attemptParts = attempt === 1
            ? baseParts
            : [...baseParts, `\n\nIMPORTANT: Your previous output did not follow the rules. Regenerate JSON with up to ${opts.maxQuestions} total questions, EXACTLY ${opts.expectedMostLikely} marked is_most_likely=true, and EXACTLY ${opts.expectedFlashcards} flashcards. Summary must be point-wise with each line starting "- ". Output ONLY JSON.`]

        const generated = await generateJSON<GeneratedContent>(attemptParts)
        const normalized = normalizeGeneratedContent(generated, opts)
        last = normalized

        const hasEnoughQuestions = normalized.questions.length >= opts.minQuestions && normalized.questions.length <= opts.maxQuestions
        const hasEnoughFlashcards = normalized.flashcards.length === opts.expectedFlashcards
        const hasSummary = normalized.summary.trim().length > 0

        if (hasEnoughQuestions && hasEnoughFlashcards && hasSummary) {
            return normalized
        }
    }

    // Best-effort fallback: return whatever we have (already normalized/sliced)
    if (last) return last
    return { questions: [], flashcards: [], summary: '' }
}

function normalizeGeneratedContent(
    content: GeneratedContent,
    opts: { minQuestions: number; maxQuestions: number; expectedMostLikely: number; expectedFlashcards: number }
): GeneratedContent {
    const questions = Array.isArray(content.questions) ? content.questions : []
    const flashcards = Array.isArray(content.flashcards) ? content.flashcards : []
    const summary = typeof content.summary === 'string' ? content.summary : ''

    const cleanQuestions = questions
        .map(q => ({
            question: typeof q?.question === 'string' ? q.question.trim() : '',
            answer: typeof q?.answer === 'string' ? q.answer.trim() : '',
            is_most_likely: typeof (q as { is_most_likely?: unknown })?.is_most_likely === 'boolean'
                ? (q as { is_most_likely: boolean }).is_most_likely
                : Boolean((q as { is_most_likely?: unknown })?.is_most_likely),
        }))
        .filter(q => q.question.length > 0 && q.answer.length > 0)
        .slice(0, Math.max(0, opts.maxQuestions))

    // Ensure EXACT most-likely count if possible
    if (cleanQuestions.length > 0) {
        const desired = Math.min(opts.expectedMostLikely, cleanQuestions.length)

        // Cap any extra true flags
        const flaggedIdx: number[] = []
        cleanQuestions.forEach((q, idx) => {
            if (q.is_most_likely) flaggedIdx.push(idx)
        })

        if (flaggedIdx.length > desired) {
            for (let i = desired; i < flaggedIdx.length; i++) {
                cleanQuestions[flaggedIdx[i]].is_most_likely = false
            }
        } else if (flaggedIdx.length < desired) {
            for (let i = 0; i < cleanQuestions.length && flaggedIdx.length < desired; i++) {
                if (!cleanQuestions[i].is_most_likely) {
                    cleanQuestions[i].is_most_likely = true
                    flaggedIdx.push(i)
                }
            }
        }

        // Ensure non-most-likely questions are false
        if (desired === 0) {
            cleanQuestions.forEach(q => (q.is_most_likely = false))
        }
    }

    const cleanFlashcards = flashcards
        .map(f => ({
            front: typeof f?.front === 'string' ? f.front.trim() : '',
            back: typeof f?.back === 'string' ? f.back.trim() : '',
        }))
        .filter(f => f.front.length > 0 && f.back.length > 0)
        .slice(0, Math.max(0, opts.expectedFlashcards))

    let cleanSummary = ensurePointWiseSummary(summary)
    if (!cleanSummary) {
        cleanSummary = buildFallbackNotes(cleanQuestions, cleanFlashcards)
    }

    return {
        questions: cleanQuestions,
        flashcards: cleanFlashcards,
        summary: cleanSummary,
    }
}

function buildFallbackNotes(
    questions: { question: string; answer: string; is_most_likely: boolean }[],
    flashcards: { front: string; back: string }[]
): string {
    const lines: string[] = []

    for (const f of flashcards.slice(0, 10)) {
        lines.push(`- ${f.front}: ${f.back}`)
    }

    if (lines.length < 5) {
        for (const q of questions.slice(0, 8)) {
            const ans = q.answer.length > 140 ? `${q.answer.slice(0, 140)}…` : q.answer
            lines.push(`- ${q.question} — ${ans}`)
        }
    }

    return lines.join('\n')
}

function ensurePointWiseSummary(summary: string): string {
    const trimmed = (summary || '').trim()
    if (!trimmed) return ''

    // If it already looks point-wise, keep it.
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const looksBullet = lines.some(l => l.startsWith('- ') || l.startsWith('• '))
    if (looksBullet) {
        return lines.map(l => (l.startsWith('• ') ? `- ${l.slice(2).trim()}` : l)).join('\n')
    }

    // Fallback: split into sentences and bullet them.
    const sentences = trimmed
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, 12)

    if (sentences.length <= 1) return `- ${trimmed}`
    return sentences.map(s => `- ${s}`).join('\n')
}

async function saveGeneratedContent(
    supabase: Awaited<ReturnType<typeof createClient>>,
    moduleId: string,
    userId: string,
    content: GeneratedContent
) {
    if (content.questions?.length > 0) {
        const questions = content.questions.map(q => ({
            module_id: moduleId,
            user_id: userId,
            question: q.question,
            answer: q.answer,
            is_most_likely: q.is_most_likely || false
        }))
        await supabase.from('exam_questions').insert(questions)
    }

    if (content.flashcards?.length > 0) {
        const flashcards = content.flashcards.map(f => ({
            module_id: moduleId,
            user_id: userId,
            front: f.front,
            back: f.back
        }))
        await supabase.from('exam_flashcards').insert(flashcards)
    }
}
