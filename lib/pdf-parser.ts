'use client'

// ---------------------------------------------------------------------------
// Category distribution mapping (VIT codes → full names)
// ---------------------------------------------------------------------------
const DISTRIBUTION_MAP: Record<string, string> = {
    'PC': 'Programme Core',
    'PE': 'Programme Elective',
    'UCNSC': 'University Core - Natural Science',
    'UCNS': 'University Core - Natural Science',
    'UCBESC': 'University Core - Engineering Sciences',
    'UCBES': 'University Core - Engineering Sciences',
    'UCES': 'University Core - Engineering Sciences',
    'UCSDC': 'University Core - Skill Development',
    'UCSD': 'University Core - Skill Development',
    'UCHSSMC': 'University Core - Humanities & Social Science',
    'UCHSS': 'University Core - Humanities & Social Science',
    'UCPI': 'University Core - Project & Internships',
    'UENSE': 'University Elective - Natural Science',
    'UENS': 'University Elective - Natural Science',
    'UEHSSME': 'University Elective - Humanities & Social',
    'UEHSS': 'University Elective - Humanities & Social',
    'UEM': 'University Elective - Multidisciplinary',
    'UEOE': 'University Elective - Open Electives',
    'OE': 'University Elective - Open Electives',
    'NMC': 'Non-Graded Mandatory Courses',
}

// Known suffixes that PDFs split across lines from distribution codes
// e.g. "UCSD" + "C" → "UCSDC", "UCHSS" + "MC" → "UCHSSMC"
const DISTRIBUTION_SUFFIXES = new Set(['C', 'MC', 'ME', 'SE'])

// Valid grades
const VALID_GRADES = new Set(['S', 'A', 'B', 'C', 'D', 'E', 'F', 'O', 'P'])

// Month ordering for semester mapping
const MONTH_ORDER: Record<string, number> = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
    'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
    'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
}

interface ParsedCourse {
    name: string
    code: string
    credits: number
    grade: string
    semester: string
    category: string
    examMonth: string
    courseType: string
}

interface PDFLine {
    text: string
    y: number
    page: number
}

/**
 * Extract all text from a PDF file using pdfjs-dist.
 */
async function extractTextFromPDF(file: File): Promise<PDFLine[]> {
    // Dynamically import to avoid Next.js SSR/bundling issues
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs')
    
    // Set up the PDF.js worker from CDN if not already set
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    }

    const arrayBuffer = await file.arrayBuffer()
    const typedArray = new Uint8Array(arrayBuffer)

    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
    const lines: PDFLine[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()

        // Group text items by Y position to reconstruct rows
        // Use cluster-based grouping: items within 3px of each other belong to the same row
        const Y_TOLERANCE = 3
        const allItems: { x: number; y: number; str: string }[] = []

        for (const item of textContent.items) {
            if (!('str' in item) || !item.str.trim()) continue
            allItems.push({ x: item.transform[4], y: item.transform[5], str: item.str })
        }

        // Sort by Y descending (PDF coordinates: bottom-up)
        allItems.sort((a, b) => b.y - a.y)

        // Cluster consecutive items within Y_TOLERANCE into rows
        const rows: { items: { x: number; y: number; str: string }[], y: number }[] = []
        let currentRow: { x: number; y: number; str: string }[] = []
        let clusterY = allItems.length > 0 ? allItems[0].y : 0

        for (const item of allItems) {
            if (currentRow.length === 0 || Math.abs(item.y - clusterY) <= Y_TOLERANCE) {
                currentRow.push(item)
            } else {
                rows.push({ items: currentRow, y: clusterY })
                currentRow = [item]
                clusterY = item.y
            }
        }
        if (currentRow.length > 0) rows.push({ items: currentRow, y: clusterY })

        // Convert each row to a tab-separated line, sorted by X (left to right)
        for (const row of rows) {
            const sorted = row.items.sort((a, b) => a.x - b.x)
            const text = sorted.map(it => it.str).join('\t')
            lines.push({ text, y: row.y, page: i })
        }
    }

    return lines
}

/**
 * Parse exam month strings into sortable values for semester assignment.
 */
function parseExamMonth(examMonth: string): { year: number; month: number } | null {
    const match = examMonth.match(/^(\w{3})-(\d{4})$/)
    if (!match) return null

    const monthStr = match[1]
    const year = parseInt(match[2])
    const month = MONTH_ORDER[monthStr]

    if (!month || isNaN(year)) return null
    return { year, month }
}

/**
 * Normalize month for semester bucketing.
 * Jun/Jul are summer terms — bucket them with the preceding Apr semester.
 */
function normalizeForSemester(month: number, year: number): { month: number; year: number } {
    if (month === 6 || month === 7) return { month: 4, year }
    return { month, year }
}

/**
 * Map a sorted list of unique exam months to semester numbers.
 */
function buildSemesterMap(examMonths: string[]): Map<string, string> {
    // Parse, normalize, and sort chronologically
    const parsed = examMonths
        .map(em => ({ raw: em, parsed: parseExamMonth(em) }))
        .filter(e => e.parsed !== null)

    // Group by normalized (month, year) bucket
    const buckets = new Map<string, string[]>()
    for (const entry of parsed) {
        const norm = normalizeForSemester(entry.parsed!.month, entry.parsed!.year)
        const key = `${norm.year}-${norm.month}`
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push(entry.raw)
    }

    // Sort bucket keys chronologically
    const sortedKeys = [...buckets.keys()].sort((a, b) => {
        const [aY, aM] = a.split('-').map(Number)
        const [bY, bM] = b.split('-').map(Number)
        if (aY !== bY) return aY - bY
        return aM - bM
    })

    // Assign semester numbers
    const semMap = new Map<string, string>()
    sortedKeys.forEach((key, idx) => {
        const months = buckets.get(key)!
        for (const raw of months) {
            const semNum = idx + 1
            const semName = semNum > 8 ? 'Miscellaneous' : `Semester ${semNum}`
            semMap.set(raw, semName)
        }
    })

    return semMap
}

/**
 * Parse VIT grade history PDF and extract course data.
 * Entirely client-side — no API calls.
 */
export async function parseGradesPDF(file: File): Promise<{ courses: ParsedCourse[] }> {
    const rawLines = await extractTextFromPDF(file)
    console.log('PDF extracted lines count:', rawLines.length)

    const lines = rawLines.map(l => l.text)
    const courses: ParsedCourse[] = []
    const examMonthsSet = new Set<string>()

    // Regexes for identifying course data
    const courseCodeRegex = /\b([A-Z]{2,4}\d{3,4}[A-Z]?)\b/
    const examMonthRegex = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})\b/

    // Intermediate storage
    interface RawCourseRow {
        code: string
        title: string
        courseType: string
        credits: number
        grade: string
        examMonth: string
        distribution: string
    }

    const rawRows: RawCourseRow[] = []

    // Helper: check if text is a non-title token
    const isNonTitleToken = (text: string): boolean => {
        const trimmed = text.trim()
        const upper = trimmed.toUpperCase()
        if (!trimmed) return true
        // Single character: only exclude if it's a known grade letter, digit, or course type
        if (trimmed.length === 1) {
            if (VALID_GRADES.has(upper)) return true
            if (/^[0-9]$/.test(trimmed)) return true
            if (/^[LP]$/i.test(trimmed)) return true // single-letter course types
            // Keep other single letters (e.g. "I" in "Universal Human Values - I")
            return false
        }
        if (/^\d+(\.\d)?$/.test(trimmed)) return true
        if (DISTRIBUTION_MAP[upper]) return true
        if (DISTRIBUTION_SUFFIXES.has(upper)) return true
        if (/^\d+$/.test(trimmed)) return true
        if (/\d{1,2}-\w{3}-\d{4}/.test(trimmed)) return true
        if (/\d{1,2}-\d{1,2}-\d{4}/.test(trimmed)) return true
        if (/^(ELA|ETH|EPJ|TH|LO|SS|ECA|LTP|LT|LP|PJ|L|P)$/i.test(trimmed)) return true
        if (upper === 'NIL') return true
        // Single-word header keywords
        if (/^(Grade|Sl\.?No\.?|Course|Credits|Exam|Result|Option|Distribution|Title|Type|Month|Declared|On|History|Code|Distribu|ution|istrib|Distrib)$/i.test(trimmed)) return true
        // Multi-word header phrases (can appear as a single tab-separated token)
        if (/\b(Grade History|Course Code|Course Title|Course Type|Course Option|Course Distribution|Exam Month|Result Declared|Sl\.?\s*No)\b/i.test(trimmed)) return true
        if (courseCodeRegex.test(trimmed) && trimmed.length <= 8) return true
        if (examMonthRegex.test(trimmed)) return true
        return false
    }

    // Helper: detect header lines (contain 2+ known header keywords)
    const HEADER_KEYWORDS = ['sl.no', 'slno', 'course code', 'course title', 'credits', 'grade', 'exam month', 'result declared', 'course option', 'course distribu']
    const isHeaderLine = (text: string): boolean => {
        const lower = text.toLowerCase()
        const matches = HEADER_KEYWORDS.filter(kw => lower.includes(kw))
        return matches.length >= 2
    }

    // Track which line index each row came from
    const rowLineIndices: number[] = []

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const codeMatch = line.match(courseCodeRegex)
        const examMatch = line.match(examMonthRegex)

        if (!codeMatch || !examMatch) continue

        const code = codeMatch[1]
        const examMonth = examMatch[1]

        // Split by tab to get columns
        const rawParts = line.split('\t').map(p => p.trim()).filter(Boolean)

        // --- Pre-merge split distribution codes ---
        const parts: string[] = []
        for (let i = 0; i < rawParts.length; i++) {
            if (i + 1 < rawParts.length) {
                const merged = rawParts[i] + rawParts[i + 1]
                if (DISTRIBUTION_MAP[merged.toUpperCase()]) {
                    parts.push(merged)
                    i++
                    continue
                }
            }
            parts.push(rawParts[i])
        }

        // Find the position of the course code in parts — everything before it is Sl.No etc.
        const codeIndex = parts.findIndex(p => p.trim() === code || courseCodeRegex.test(p.trim()))

        // Extract course type FIRST so we can exclude it from grade detection
        const typeMatch = line.match(/\b(ELA|ETH|EPJ|TH|LO|SS|ECA|LTP|LT|LP|PJ|L|P)\b/)
        const courseType = typeMatch ? typeMatch[1] : ''

        let grade = ''
        let credits: number | null = null
        let title = ''
        let distribution = ''

        for (let pi = 0; pi < parts.length; pi++) {
            const part = parts[pi]
            const upperPart = part.toUpperCase().trim()

            // Check for distribution code
            if (DISTRIBUTION_MAP[upperPart]) {
                distribution = upperPart
                continue
            }

            // Skip known distribution suffixes that weren't merged
            if (DISTRIBUTION_SUFFIXES.has(upperPart)) {
                continue
            }

            // Check for grade (single letter) — only AFTER the course code
            // Also skip if it matches the course type token (e.g. "P" as course type, not grade)
            if (pi > codeIndex && VALID_GRADES.has(upperPart) && upperPart.length === 1 && !grade) {
                if (upperPart === courseType.toUpperCase()) continue // it's the course type, not grade
                grade = upperPart
                continue
            }

            // Check for credits — only AFTER the course code, must be X.0 format (VIT standard)
            // Use null sentinel so that 0-credit courses (0.0) are correctly captured
            if (pi > codeIndex && /^\d+\.0$/.test(part) && credits === null) {
                credits = parseFloat(part)
                continue
            }
        }

        // If we still don't have a grade, scan more aggressively
        if (!grade) {
            const allMatches = line.match(/\b([SABCDEFOP])\b/g)
            if (allMatches) {
                for (const m of allMatches) {
                    // Skip if this matches the course type (e.g. "P" course type vs "P" grade)
                    if (m === courseType.toUpperCase()) continue
                    if (VALID_GRADES.has(m)) {
                        grade = m
                        break
                    }
                }
            }
        }

        if (!grade) continue // Can't determine grade, skip

        // Extract course title: join all text segments that aren't codes, dates, or non-title tokens
        // Keep them in original order (left-to-right) so multi-part titles are properly assembled
        const titleCandidates = parts.filter(p => {
            const trimmed = p.trim()
            if (trimmed === code) return false
            if (trimmed === examMonth) return false
            return !isNonTitleToken(trimmed)
        })

        title = titleCandidates.map(t => t.trim()).join(' ').trim()

        // Course type already extracted above

        examMonthsSet.add(examMonth)

        rawRows.push({
            code,
            title: title || code,
            courseType,
            credits: credits ?? 0,
            grade: grade === 'O' ? 'S' : grade,
            examMonth,
            distribution,
        })
        rowLineIndices.push(lineIdx)
    }

    // --- Second pass: physically assign orphan title text to closest data row ---
    interface TrackedRow extends RawCourseRow {
        lineIdx: number
        partsBefore: { y: number; text: string }[]
        partsAfter: { y: number; text: string }[]
    }

    const trackedRows: TrackedRow[] = rawRows.map((r, i) => ({
        ...r,
        lineIdx: rowLineIndices[i],
        partsBefore: [],
        partsAfter: []
    }))

    for (let i = 0; i < rawLines.length; i++) {
        const lineText = rawLines[i].text
        // Ignore if it's a data row (has both code and exam month)
        if (courseCodeRegex.test(lineText) && examMonthRegex.test(lineText)) continue
        // Ignore header lines (contain multiple header keywords)
        if (isHeaderLine(lineText)) continue
        // Skip N1/N2/N3/N4 footnote lines
        if (/^N[1-4]\s*:/.test(lineText.trim())) continue
        // Skip footer/note lines (e.g. "Note : eGenerated Doc - To be verified...")
        if (/^Note\s*:/i.test(lineText.trim())) continue
        if (/eGenerated/i.test(lineText)) continue
        // Skip page number lines
        if (/^Page\s+\d+\s+of\s+\d+/i.test(lineText.trim())) continue

        // Extract meaningful candidate text
        const parts = lineText.split('\t').map(p => p.trim()).filter(Boolean)
        const validTitleParts = parts.filter(p => !isNonTitleToken(p))
        const hasDistributionPart = parts.some(p => {
            const upper = p.toUpperCase()
            return DISTRIBUTION_SUFFIXES.has(upper) || DISTRIBUTION_MAP[upper]
        })
        
        if (validTitleParts.length === 0 && !hasDistributionPart) continue

        // Find nearest data row on the same page
        let bestRow: TrackedRow | null = null
        let minDist = Infinity

        for (const row of trackedRows) {
            const dataLine = rawLines[row.lineIdx]
            if (dataLine.page === rawLines[i].page) {
                const dist = Math.abs(dataLine.y - rawLines[i].y)
                if (dist < minDist) {
                    minDist = dist
                    bestRow = row
                }
            }
        }

        // 50px threshold for rows in the same table
        if (bestRow && minDist <= 50) {
            const dataLine = rawLines[bestRow.lineIdx]
            
            // Check for distribution codes or suffixes
            for (const p of parts) {
                const upper = p.toUpperCase()
                if (DISTRIBUTION_SUFFIXES.has(upper)) {
                    const merged = bestRow.distribution + upper
                    if (DISTRIBUTION_MAP[merged]) {
                        bestRow.distribution = merged
                    }
                } else if (DISTRIBUTION_MAP[upper]) {
                    bestRow.distribution = upper
                }
            }

            const titleCandidate = validTitleParts.map(v => v.trim()).join(' ').trim()
            if (titleCandidate) {
                // PDF coordinates: Y increases bottom-up
                if (rawLines[i].y > dataLine.y) {
                    bestRow.partsBefore.push({ y: rawLines[i].y, text: titleCandidate })
                } else {
                    bestRow.partsAfter.push({ y: rawLines[i].y, text: titleCandidate })
                }
            }
        }
    }

    // Merge title parts for each row
    for (const row of trackedRows) {
        let currentTitle = row.title === row.code ? '' : row.title

        row.partsBefore.sort((a, b) => b.y - a.y)
        row.partsAfter.sort((a, b) => b.y - a.y)

        const beforeText = row.partsBefore.map(p => p.text).join(' ')
        const afterText = row.partsAfter.map(p => p.text).join(' ')

        if (beforeText) currentTitle = beforeText + (currentTitle ? ' ' + currentTitle : '')
        if (afterText) currentTitle = (currentTitle ? currentTitle + ' ' : '') + afterText

        if (currentTitle) {
            row.title = currentTitle.replace(/\s+/g, ' ').replace(/\s+-\s+/, ' - ').trim()
        } else if (!row.title) {
            row.title = row.code
        }
    }

    if (trackedRows.length === 0) {
        throw new Error('Could not parse grade data. Please ensure you uploaded a VIT grade history PDF.')
    }

    // Build semester mapping from exam months (with Jun/Jul bucketing)
    const semesterMap = buildSemesterMap([...examMonthsSet])

    // Final pass: build course objects
    for (const row of trackedRows) {
        const semester = semesterMap.get(row.examMonth) || 'Imported'
        const categoryName = DISTRIBUTION_MAP[row.distribution] || 'none'

        courses.push({
            name: row.title,
            code: row.code,
            credits: row.credits,
            grade: row.grade,
            semester,
            category: categoryName,
            examMonth: row.examMonth,
            courseType: row.courseType,
        })
    }

    console.log(`Parsed ${courses.length} courses from PDF across ${semesterMap.size} semesters`)

    return { courses }
}
/**
 * Parse VIT Timetable PDF and extract class schedule.
 * Entirely client-side — no API calls.
 */
export async function parseTimetablePDF(file: File): Promise<{ classes: any[] }> {
    const rawLines = await extractTextFromPDF(file)
    console.log('Timetable PDF extracted lines count:', rawLines.length)

    const classes: any[] = []
    const dayMap: Record<string, string> = {
        'MON': 'Monday',
        'TUE': 'Tuesday',
        'WED': 'Wednesday',
        'THU': 'Thursday',
        'FRI': 'Friday',
        'SAT': 'Saturday',
        'SUN': 'Sunday'
    }

    const timeSlots = [
        { start: '08:30', end: '10:00', x: [100, 200] }, // Rough X ranges - will be refined
        { start: '10:05', end: '11:35', x: [200, 300] },
        { start: '11:40', end: '13:10', x: [300, 400] },
        { start: '13:15', end: '14:45', x: [450, 550] },
        { start: '14:50', end: '16:20', x: [550, 650] },
        { start: '16:25', end: '17:55', x: [650, 750] },
        { start: '18:00', end: '19:30', x: [750, 850] }
    ]

    // Identify rows that start with a day name
    for (const line of rawLines) {
        const parts = line.text.split('\t').map(p => p.trim()).filter(Boolean)
        const firstPart = parts[0]?.toUpperCase()

        if (dayMap[firstPart]) {
            const dayName = dayMap[firstPart]
            
            // In VIT Timetables, a row often looks like: MON \t A11 \t B11-CSE1001-LTP...
            // We need to match these to the right time slot.
            // Since we don't have perfect X-coordinates in the joined text, we'll look for course codes.
            
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i]
                // Match course pattern: SLOT-CODE-TYPE-ROOM (e.g. B11-CSE3009-LTP-AB02-429)
                const courseMatch = part.match(/^([A-Z]\d{2})-([A-Z]{2,4}\d{3,4}(?:-[A-Z]+)?)-([A-Z]{1,3})/)
                
                if (courseMatch) {
                    const slotId = courseMatch[1]
                    const subject = part // Keep full string as subject
                    
                    // Map SlotID to Time
                    // A11/B11/C11/D11/E11/F11 -> 08:30
                    // A12/B12... -> Slot 2, etc.
                    // This is a common VIT pattern
                    const slotNum = parseInt(slotId.substring(1))
                    let timeIdx = -1
                    
                    if (slotNum >= 11 && slotNum <= 17) timeIdx = slotNum - 11
                    else if (slotNum >= 21 && slotNum <= 27) timeIdx = slotNum - 21
                    
                    if (timeIdx >= 0 && timeIdx < timeSlots.length) {
                        const slot = timeSlots[timeIdx]
                        classes.push({
                            day: dayName,
                            time: `${slot.start} - ${slot.end}`,
                            subject: subject,
                            location: part.split('-').slice(-2).join('-') // Guessing location from end of string
                        })
                    }
                }
            }
        }
    }

    // Fallback: If heuristic fails, try scanning for any course-code like strings with slot prefixes
    if (classes.length === 0) {
        console.warn('Timetable heuristic failed, falling back to regex scan')
        for (const line of rawLines) {
            const dayMatch = line.text.match(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/i)
            if (!dayMatch) continue
            
            const dayName = dayMap[dayMatch[1].toUpperCase()]
            const courseMatches = line.text.matchAll(/\b([A-Z]\d{2})-([A-Z]{2,4}\d{3,4}(?:-[A-Z]+)?)-([A-Z]{1,3})-([A-Z0-9-]{4,})\b/g)
            
            for (const m of courseMatches) {
                const slotId = m[1]
                const slotNum = parseInt(slotId.substring(1))
                let timeIdx = -1
                if (slotNum >= 11 && slotNum <= 17) timeIdx = slotNum - 11
                else if (slotNum >= 21 && slotNum <= 27) timeIdx = slotNum - 21
                
                if (timeIdx >= 0 && timeIdx < timeSlots.length) {
                    const slot = timeSlots[timeIdx]
                    classes.push({
                        day: dayName,
                        time: `${slot.start} - ${slot.end}`,
                        subject: m[0],
                        location: m[4]
                    })
                }
            }
        }
    }

    return { classes }
}
