import { NextResponse } from 'next/server'
// Force HMR update
import { createClient } from '@/lib/supabase/server'
import { generateJSON, GeminiRateLimitError } from '@/lib/gemini'
import { Part } from '@google/generative-ai'

import { checkRateLimit, rateLimitExceededResponse, rateLimitHeaders, RATE_LIMITS, DAILY_LIMITS } from '@/lib/rate-limit'

import { extractOfficeText } from '@/lib/office-extract'

// ... (code)

interface GeneratedContent {
    questions: {
        question: string
        answer: string
        is_most_likely: boolean
        visual_search_query?: string
    }[]
    flashcards: {
        front: string
        back: string
    }[]
    summary: string
}

export async function POST(request: Request) {
    let stage = 'init'
    let moduleId: string | null = null
    let userId: string | null = null
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null

    try {
        supabase = await createClient()
        stage = 'auth.getUser'
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        userId = user.id

        // Daily cap check first (3 processes/day)
        stage = 'rateLimit.exam_prep_daily'
        const dailyRl = await checkRateLimit(
            user.id,
            DAILY_LIMITS.exam_prep.endpoint,
            DAILY_LIMITS.exam_prep.limit,
            DAILY_LIMITS.exam_prep.windowSeconds
        )
        if (!dailyRl.allowed) {
            const resetDate = dailyRl.resetAt
            const resetTime = resetDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
            const secondsLeft = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 1000))
            const hoursLeft = Math.ceil(secondsLeft / 3600)
            return NextResponse.json(
                {
                    error: `You've crushed so much studying today! 🎯 Daily AI quota resets around ${resetTime} IST (~${hoursLeft}h). Perfect time to test yourself with the Flashcards and Questions already generated! 💡`,
                    retryAfterSeconds: secondsLeft,
                    resetAt: resetDate.toISOString(),
                    isDaily: true,
                },
                { status: 429, headers: rateLimitHeaders({ limit: DAILY_LIMITS.exam_prep.limit, remaining: 0, resetAt: resetDate }) }
            )
        }

        // Per-window burst limit (20 processes / 5 minutes)
        stage = 'rateLimit.exam_prep'
        const rl = await checkRateLimit(
            user.id,
            RATE_LIMITS.exam_prep.endpoint,
            RATE_LIMITS.exam_prep.limit,
            RATE_LIMITS.exam_prep.windowSeconds
        )
        if (!rl.allowed) {
            const secondsLeft = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000))
            const timeDesc = secondsLeft < 60 ? `~${secondsLeft}s` : `~${Math.ceil(secondsLeft / 60)}m`
            return rateLimitExceededResponse({
                limit: RATE_LIMITS.exam_prep.limit,
                remaining: rl.remaining,
                resetAt: rl.resetAt,
                customMessage: `AI is taking a quick breather! ⏳ Ready in ${timeDesc}. Review the flashcards and questions above while we prepare the next module! 💡`,
            })
        }

        stage = 'request.json'
        const body = await request.json().catch(() => ({}))
        moduleId = body?.moduleId

        const topicOnly = typeof body?.topicOnly === 'boolean' ? body.topicOnly : false
        const forceRegenerate = typeof body?.force === 'boolean' ? body.force : false


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

        // Cache check: if module already has generated content, skip Gemini
        if (module.status === 'ready' && !forceRegenerate) {
            stage = 'cache.check'
            const { count: qCount } = await supabase
                .from('exam_questions')
                .select('id', { count: 'exact', head: true })
                .eq('module_id', moduleId)
            const { count: fCount } = await supabase
                .from('exam_flashcards')
                .select('id', { count: 'exact', head: true })
                .eq('module_id', moduleId)

            if ((qCount ?? 0) > 0 && (fCount ?? 0) > 0) {
                return NextResponse.json(
                    { success: true, cached: true, message: 'Content already generated. Use force=true to regenerate.' },
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
            }
        }

        const filePathsFromClient: unknown = body?.filePaths
        let filePaths: string[] = Array.isArray(filePathsFromClient)
            ? filePathsFromClient.filter((p): p is string => typeof p === 'string' && p.length > 0)
            : []

        // Topic-only regeneration explicitly ignores any module files (even if stored).
        if (topicOnly) {
            filePaths = []
        } else if (filePaths.length === 0) {
            // Fetch ALL files for this module to ensure comprehensive context
            stage = 'db.exam_module_files'
            const { data: moduleFiles, error: filesError } = await supabase
                .from('exam_module_files')
                .select('file_path')
                .eq('module_id', moduleId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })

            if (filesError) {
                throw filesError
            }

            filePaths = moduleFiles ? moduleFiles.map(f => f.file_path) : []
        }

        // Guardrail: file count and size limits to control token usage
        const MAX_FILES_PER_PROCESS = 3
        const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB per file
        if (filePaths.length > MAX_FILES_PER_PROCESS) {
            // Avoid leaving the module stuck in "processing".
            try {
                await supabase
                    .from('exam_modules')
                    .update({ status: 'error' })
                    .eq('id', moduleId)
                    .eq('user_id', user.id)
            } catch {
                // ignore
            }

            return NextResponse.json(
                {
                    error: `Too many files selected (${filePaths.length}). Please select ${MAX_FILES_PER_PROCESS} or fewer (combine PDFs if needed).`,
                },
                { status: 413 }
            )
        }

        // Construct the parts
        const parts: (string | Part)[] = []

        const subjectName = module.exam_subjects?.name || 'this subject'
        const examType = module.exam_subjects?.exam_type || 'endterm'
        const mostLikelyCount = module.exam_subjects?.questions_per_module ?? 1
        const marksPerQuestion = module.exam_subjects?.marks_per_question ?? 10
        const maxQuestions = 10
        const flashcardsPerModule = 15

        const examTypeGuidance: Record<string, string> = {
            midterm: 'Midterm: focus on likely short/medium questions, core definitions, and typical problem patterns.',
            endterm: 'Endterm: include broader coverage, integration questions, and exam-style long answers where relevant.',
            quiz: 'Quiz: focus on concise, high-yield questions and quick recall flashcards.',
            final: 'Final: treat like endterm with comprehensive coverage and tricky edge cases.',
        }

        // Add important topics instruction if provided (Global Subject Level + Module Level)
        const subjectImportantQuestions = module.exam_subjects?.important_questions || ''
        const globalContextSection = subjectImportantQuestions
            ? `\n\nSUBJECT-WIDE IMPORTANT MIDTERM/ENDTERM QUESTIONS & SYLLABUS CONTEXT:\n${subjectImportantQuestions}\n`
            : ''

        const systemPrompt = `You are an expert exam-prep assistant for university students.

            Generate content for:
            - Subject: ${subjectName}
            - Module: ${module.name} (Module ${module.module_number})
            - Exam type: ${examType}

            Guidance: ${examTypeGuidance[examType] || examTypeGuidance.endterm}${globalContextSection}

            Return ONLY valid JSON with this exact schema:
            {
                "questions": [
                    {"question": "string", "answer": "string", "is_most_likely": boolean, "visual_search_query": "string or null"}
                ],
                "flashcards": [
                    {"front": "string", "back": "string"}
                ],
                "short_notes": "string"
            }

            RULES — follow every rule exactly:

            QUESTIONS:
            - Create questions to cover the module, cap at ${maxQuestions} total.
            - Mark EXACTLY ${mostLikelyCount} questions as is_most_likely=true; all others must be false.
            - Each question should be worth ~${marksPerQuestion} marks.
            - Answers must be detailed, exam-ready, structured with headers/bullets where appropriate.
            - If the question involves code, ALWAYS wrap code in triple-backtick fenced blocks with the language tag:
              \`\`\`cpp
              // properly indented code here
              \`\`\`
              NEVER write code as inline prose. Always use proper indentation and line breaks inside the block.
            - If a question would benefit from a diagram, set visual_search_query to a specific Google Images search (e.g. "labeled UML class diagram"). Otherwise set to null.

            FLASHCARDS (VERY IMPORTANT — read carefully):
            - Flashcards are quick revision aids, NOT question-answer pairs from the exam.
            - Front: A concise term, concept name, or keyword (e.g. "Polymorphism", "Stack overflow", "Deadlock condition").
            - Back: A SHORT definition or key fact in 1-3 sentences MAX. Think dictionary-style, not essay-style.
            - Do NOT copy exam questions onto flashcards. Front must be a term/keyword, not a full sentence question.
            - Create AT LEAST 10 flashcards, aim for ${flashcardsPerModule}. Cover every key term in the module.
            - Example good flashcard: {"front": "Encapsulation", "back": "Binding data and methods into a single class unit, hiding internal state from outside access."}
            - Example BAD flashcard: {"front": "Explain the four pillars of OOP", "back": "The four pillars are..."} — this is an exam question, not a flashcard.

            SHORT NOTES (Cheat Sheet):
            - Field name in JSON is \"short_notes\" (not \"summary\").
            - Generate a pure topic-based exam cheat sheet / revision notes for this module.
            - STRICTLY FORBIDDEN: DO NOT write study questions, practice questions, or flashcards here.
            - Organize strictly by syllabus topics and subtopics using headers (###).
            - For each topic: core definition (1-2 sentences), key mechanics/principles in bullet points, and comparison tables where applicable (always separate tables with blank lines before and after).
            - Keep it dense, high-yield, and scannable so a student can review the theory before an exam.

            ${subjectImportantQuestions ? '- PRIORITIZE the important topics/questions provided above when creating questions and flashcards.' : ''}
            ${topicOnly ? '\n- TOPIC-ONLY MODE: Use ONLY content relevant to this module topic. If the syllabus includes other modules/units, IGNORE them.' : ''}
            - If provided with PDF images, pay special attention to HIGHLIGHTED TEXT (yellow/colored) or red-circled items — these are priority areas.
            - Return pure JSON only. No markdown wrapper around the JSON.`

        parts.push(systemPrompt)

        // Process Syllabus File (if exists)
        const syllabusPath = module.exam_subjects?.syllabus_path
        if (syllabusPath) {
            try {
                const normalizedSyllabusPath = normalizeStoragePath(syllabusPath)
                stage = `storage.download.syllabus:${normalizedSyllabusPath}`
                const { data: syllabusData, error: syllabusError } = await supabase.storage
                    .from('exam-pdfs')
                    .download(normalizedSyllabusPath)

                if (!syllabusError && syllabusData) {
                    const buffer = await syllabusData.arrayBuffer()
                    const base64 = Buffer.from(buffer).toString('base64')
                    const ext = normalizedSyllabusPath.split('.').pop()?.toLowerCase()
                    let mimeType = 'application/pdf'
                    if (ext === 'png') mimeType = 'image/png'
                    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'

                    parts.push({
                        text: "SYLLABUS DOCUMENT (Use this to prioritize questions and scope):"
                    })
                    parts.push({
                        inlineData: {
                            data: base64,
                            mimeType
                        }
                    })
                    console.log(`Attached syllabus: ${normalizedSyllabusPath} (${mimeType})`)
                }
            } catch (e) {
                console.error('Error processing syllabus:', e)
                // Continue without syllabus if it fails
            }
        }

        let addedAnyFileContent = false
        const skippedFiles: { filePath: string; reason: string }[] = []

        // Download and add files as parts
        if (filePaths.length === 0) {
            console.log(topicOnly ? 'Topic-only mode. Skipping module files; using syllabus + internal knowledge.' : 'No files provided. Generating from topic solely.')
            parts.push(`
                WARNING: NO STUDY FILES WERE UPLOADED FOR THIS MODULE.
                ${topicOnly ? 'YOU MUST GENERATE CONTENT USING THE SYLLABUS (if attached) AND YOUR INTERNAL KNOWLEDGE.' : 'YOU MUST GENERATE CONTENT SOLELY BASED ON YOUR INTERNAL KNOWLEDGE.'}
                
                Context:
                - Subject: ${subjectName}
                - Module Topic: "${module.name}"
                - Exam Type: ${examType}
                
                INSTRUCTIONS:
                - You represent an expert professor in **${subjectName}**.
                - Create questions, flashcards, and a summary that effectively cover the standard curriculum for the topic **"${module.name}"**.
                - Ensure the questions range from fundamental concepts to advanced applications typical for this topic.
                - Use the "Important Questions" context provided above if relevant.
                ${topicOnly ? '- If the syllabus covers multiple modules, ONLY use the section relevant to this module topic.' : ''}
                `)
            addedAnyFileContent = true
        } else {
            console.log(`Processing ${filePaths.length} files...`)
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

                    // File size check
                    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
                        const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(1)
                        skippedFiles.push({
                            filePath: normalizedPath,
                            reason: `File too large (${sizeMB}MB). Maximum is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. Please compress your PDF (e.g. using ilovepdf.com).`,
                        })
                        continue
                    }

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
        const expectedFlashcards = 15
        const result = await generateWithCountEnforcement(parts, {
            minQuestions: Math.max(1, expectedMostLikely),
            maxQuestions: 10,
            expectedMostLikely,
            expectedFlashcards,
        })

        // DELETE existing questions and flashcards for this module to prevent duplicates
        stage = 'db.delete_old_content'
        {
            const { error: deleteQuestionsError } = await supabase.from('exam_questions').delete().eq('module_id', moduleId)
            if (deleteQuestionsError) throw deleteQuestionsError
            const { error: deleteFlashcardsError } = await supabase.from('exam_flashcards').delete().eq('module_id', moduleId)
            if (deleteFlashcardsError) throw deleteFlashcardsError
        }

        // Save new content
        stage = 'db.insert_new_content'
        await saveGeneratedContent(supabase, moduleId, user.id, result)

        stage = 'db.update_module'
        {
            const { error: updateModuleError } = await supabase
                .from('exam_modules')
                .update({ status: 'ready', summary: result.summary })
                .eq('id', moduleId)
            if (updateModuleError) throw updateModuleError
        }

        return NextResponse.json(
            { success: true },
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
            // Don't leave module stuck in processing on rate-limit.
            if (supabase && moduleId && userId) {
                try {
                    await supabase
                        .from('exam_modules')
                        .update({ status: 'pending' })
                        .eq('id', moduleId)
                        .eq('user_id', userId)
                } catch {
                    // ignore
                }
            }

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

        // Ensure module is not left stuck in processing after failures.
        if (supabase && moduleId && userId) {
            try {
                await supabase
                    .from('exam_modules')
                    .update({ status: 'error' })
                    .eq('id', moduleId)
                    .eq('user_id', userId)
            } catch {
                // ignore
            }
        }

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
    const maxAttempts = 2
    let last: GeneratedContent | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const attemptParts = attempt === 1
            ? baseParts
            : [...baseParts, `\n\nIMPORTANT: Your previous output did not follow the rules. Regenerate JSON with up to ${opts.maxQuestions} total questions, EXACTLY ${opts.expectedMostLikely} marked is_most_likely=true, and AT LEAST 10 flashcards (front = term/keyword, back = short definition). Use "short_notes" (not "summary") for the cheat sheet field. Output ONLY JSON.`]

        const generated = await generateJSON<GeneratedContent>(attemptParts)
        const normalized = normalizeGeneratedContent(generated, opts)
        last = normalized

        const hasEnoughQuestions = normalized.questions.length >= opts.minQuestions && normalized.questions.length <= opts.maxQuestions
        // Relaxed validation: accept if we have at least 5 flashcards, don't enforce strict equality which causes retries
        const hasEnoughFlashcards = normalized.flashcards.length >= 5
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
    const contentObj = (content as unknown) as Record<string, unknown>
    const rawFlashcards = Array.isArray(content.flashcards)
        ? content.flashcards
        : Array.isArray(contentObj.flash_cards)
        ? (contentObj.flash_cards as unknown[])
        : Array.isArray(contentObj.flashCards)
        ? (contentObj.flashCards as unknown[])
        : Array.isArray(contentObj.cards)
        ? (contentObj.cards as unknown[])
        : Array.isArray(contentObj.deck)
        ? (contentObj.deck as unknown[])
        : Array.isArray((contentObj.flashcards as Record<string, unknown>)?.cards)
        ? ((contentObj.flashcards as Record<string, unknown>).cards as unknown[])
        : []
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

    const cleanFlashcardsRaw = rawFlashcards
        .map((f: unknown) => {
            const getStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

            // Support a few common alternative shapes from the model.
            if (typeof f === 'string') {
                const s = f.trim()
                const splitByColon = s.split(/\s*:\s*/)
                if (splitByColon.length >= 2) {
                    const front = splitByColon[0] || ''
                    const back = splitByColon.slice(1).join(':') || ''
                    return { front: front.trim(), back: back.trim() }
                }

                const splitByDash = s.split(/\s*-\s*/)
                if (splitByDash.length >= 2) {
                    const front = splitByDash[0] || ''
                    const back = splitByDash.slice(1).join('-') || ''
                    return { front: front.trim(), back: back.trim() }
                }

                return { front: '', back: '' }
            }

            const obj = (f || {}) as Record<string, unknown>
            const front =
                getStr(obj.front) ||
                getStr(obj.Front) ||
                getStr(obj.term) ||
                getStr(obj.Term) ||
                getStr(obj.keyword) ||
                getStr(obj.Keyword) ||
                getStr(obj.concept) ||
                getStr(obj.Concept) ||
                getStr(obj.title) ||
                getStr(obj.Title) ||
                getStr(obj.question) ||
                getStr(obj.Question) ||
                getStr(obj.q) ||
                getStr(obj.Q)

            const back =
                getStr(obj.back) ||
                getStr(obj.Back) ||
                getStr(obj.definition) ||
                getStr(obj.Definition) ||
                getStr(obj.description) ||
                getStr(obj.Description) ||
                getStr(obj.meaning) ||
                getStr(obj.Meaning) ||
                getStr(obj.answer) ||
                getStr(obj.Answer) ||
                getStr(obj.a) ||
                getStr(obj.A) ||
                getStr(obj.summary) ||
                getStr(obj.Summary)

            return { front, back }
        })
        .filter(f => f.front.length > 0 && f.back.length > 0)

    const contentAny = content as unknown as Record<string, unknown>
    const rawShortNotes =
        (typeof contentAny.short_notes === 'string' && contentAny.short_notes.trim())
            ? (contentAny.short_notes as string).trim()
            : (typeof content.summary === 'string' && content.summary.trim())
            ? content.summary.trim()
            : ''
    let cleanSummary = ensurePointWiseSummary(rawShortNotes)
    if (!cleanSummary) {
        cleanSummary = buildFallbackNotes(cleanFlashcardsRaw)
    }

    let cleanFlashcards = cleanFlashcardsRaw.slice(0, Math.max(0, opts.expectedFlashcards))
    if (cleanFlashcards.length < 5) {
        const extracted = extractFallbackFlashcards(cleanQuestions, cleanSummary, opts.expectedFlashcards)
        const existingFronts = new Set(cleanFlashcards.map(f => f.front.toLowerCase()))
        for (const ext of extracted) {
            if (!existingFronts.has(ext.front.toLowerCase())) {
                cleanFlashcards.push(ext)
                existingFronts.add(ext.front.toLowerCase())
            }
            if (cleanFlashcards.length >= opts.expectedFlashcards) break
        }
    }

    return {
        questions: cleanQuestions,
        flashcards: cleanFlashcards,
        summary: cleanSummary,
    }
}

function extractFallbackFlashcards(
    questions: { question: string; answer: string }[],
    summary: string,
    desiredCount: number = 10
): { front: string; back: string }[] {
    const cards: { front: string; back: string }[] = []
    const seen = new Set<string>()

    // 1. Extract from markdown bullet points like - **Term**: Definition or - **Term** - Definition
    const lines = (summary || '').split(/\r?\n/)
    for (const line of lines) {
        const trimmed = line.trim()
        const boldMatch = trimmed.match(/^[-*•]\s*\*\*([^*]+)\*\*\s*[:\-–]\s*(.+)$/)
        if (boldMatch) {
            const front = boldMatch[1].trim()
            const back = boldMatch[2].trim()
            if (front && back && !seen.has(front.toLowerCase())) {
                seen.add(front.toLowerCase())
                cards.push({ front, back: back.slice(0, 300) })
            }
        }
        if (cards.length >= desiredCount) break
    }

    // 2. Extract from questions if still need more
    if (cards.length < desiredCount) {
        for (const q of questions) {
            let front = q.question.trim()
            front = front.replace(/^(what is|what are|explain|define|describe|discuss|differentiate between|compare)\s+/i, '')
            front = front.replace(/\?$/, '').trim()
            if (front.length > 50) front = front.slice(0, 50).trim() + '...'

            const firstSentence = q.answer.split(/(?<=[.!?])\s+/)[0]?.trim() || q.answer.slice(0, 150)
            if (front && firstSentence && !seen.has(front.toLowerCase())) {
                seen.add(front.toLowerCase())
                cards.push({ front, back: firstSentence.slice(0, 300) })
            }
            if (cards.length >= desiredCount) break
        }
    }

    return cards
}

function buildFallbackNotes(
    flashcards: { front: string; back: string }[]
): string {
    const lines: string[] = []

    lines.push('### Core Concepts & Topic Summary\n')
    for (const f of flashcards) {
        lines.push(`- **${f.front}**: ${f.back}`)
    }

    return lines.join('\n')
}

function ensurePointWiseSummary(summary: string): string {
    const trimmed = (summary || '').trim()
    if (!trimmed) return ''

    // If it already looks formatted (bullets, tables, headers), keep it.
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const hasMarkdown = lines.some(l => l.startsWith('- ') || l.startsWith('• ') || l.startsWith('#') || l.startsWith('|') || l.startsWith('**'))

    if (hasMarkdown) {
        return trimmed
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
            is_most_likely: q.is_most_likely || false,
            visual_search_query: q.visual_search_query || null
        }))
        const { error } = await supabase.from('exam_questions').insert(questions)
        if (error) throw error
    }

    if (content.flashcards?.length > 0) {
        const flashcards = content.flashcards.map(f => ({
            module_id: moduleId,
            user_id: userId,
            front: f.front,
            back: f.back
        }))
        const { error } = await supabase.from('exam_flashcards').insert(flashcards)
        if (error) throw error
    }
}
