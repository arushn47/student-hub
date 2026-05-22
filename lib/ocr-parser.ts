/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWorker } from 'tesseract.js'

/**
 * VIT slot → { day, timeSlot } mapping.
 *
 * VIT timetable uses a fixed slot grid. Each slot code like "A11", "B21" etc.
 * encodes a day letter + position. We map every known slot directly to its
 * day and time so we don't need the day label and course code on the same line.
 *
 * Theory/Slot table (standard VIT pattern):
 *   Theory slots:  A1/A2  B1/B2  C1/C2  D1/D2  E1/E2  F1/F2  G1/G2
 *   Lab slots:     L1–L60 (paired, e.g. L1+L2 = first lab on Monday etc.)
 *
 * The grid extracted below covers the most common VIT timetable format.
 */

interface SlotInfo {
    day: string
    time: string
}

// Standard VIT theory slot → day + time
const THEORY_SLOT_MAP: Record<string, SlotInfo> = {
    // Monday
    'A1':  { day: 'Monday',    time: '08:30 - 10:00' },
    'F1':  { day: 'Monday',    time: '10:05 - 11:35' },
    'D1':  { day: 'Monday',    time: '11:40 - 13:10' },
    'TB1': { day: 'Monday',    time: '13:15 - 14:45' },
    'TG1': { day: 'Monday',    time: '13:15 - 14:45' },
    'B1':  { day: 'Monday',    time: '14:50 - 16:20' },
    'G1':  { day: 'Monday',    time: '16:25 - 17:55' },
    // Tuesday
    'A2':  { day: 'Tuesday',   time: '08:30 - 10:00' },
    'F2':  { day: 'Tuesday',   time: '10:05 - 11:35' },
    'D2':  { day: 'Tuesday',   time: '11:40 - 13:10' },
    'TB2': { day: 'Tuesday',   time: '13:15 - 14:45' },
    'TG2': { day: 'Tuesday',   time: '13:15 - 14:45' },
    'B2':  { day: 'Tuesday',   time: '14:50 - 16:20' },
    'G2':  { day: 'Tuesday',   time: '16:25 - 17:55' },
    // Wednesday
    'C1':  { day: 'Wednesday', time: '08:30 - 10:00' },
    'E1':  { day: 'Wednesday', time: '10:05 - 11:35' },
    'TC1': { day: 'Wednesday', time: '11:40 - 13:10' },
    'TAA1':{ day: 'Wednesday', time: '11:40 - 13:10' },
    'A11': { day: 'Wednesday', time: '13:15 - 14:45' }, // some formats use A11
    'TA1': { day: 'Wednesday', time: '13:15 - 14:45' },
    // Thursday
    'C2':  { day: 'Thursday',  time: '08:30 - 10:00' },
    'E2':  { day: 'Thursday',  time: '10:05 - 11:35' },
    'TC2': { day: 'Thursday',  time: '11:40 - 13:10' },
    'TAA2':{ day: 'Thursday',  time: '11:40 - 13:10' },
    'TA2': { day: 'Thursday',  time: '13:15 - 14:45' },
    // Friday
    'F3':  { day: 'Friday',    time: '08:30 - 10:00' },
    'E3':  { day: 'Friday',    time: '10:05 - 11:35' },
    'TD1': { day: 'Friday',    time: '11:40 - 13:10' },
    'TD2': { day: 'Friday',    time: '13:15 - 14:45' },
}

// Lab slot pairs — each cell in VIT lab timetable is Lnn+Lnn
// L1-L2=Mon 08:00, L3-L4=Mon 08:00 (second batch), etc.
// Map individual L-slots to day+time
const LAB_SLOT_MAP: Record<string, SlotInfo> = {
    'L1':  { day: 'Monday',    time: '08:00 - 08:50' },
    'L2':  { day: 'Monday',    time: '08:51 - 09:40' },
    'L3':  { day: 'Monday',    time: '09:51 - 10:40' },
    'L4':  { day: 'Monday',    time: '10:41 - 11:30' },
    'L5':  { day: 'Monday',    time: '11:40 - 12:30' },
    'L6':  { day: 'Monday',    time: '12:31 - 13:20' },
    'L7':  { day: 'Monday',    time: '14:00 - 14:50' },
    'L8':  { day: 'Monday',    time: '14:51 - 15:40' },
    'L9':  { day: 'Monday',    time: '15:51 - 16:40' },
    'L10': { day: 'Monday',    time: '16:41 - 17:30' },
    'L11': { day: 'Tuesday',   time: '08:00 - 08:50' },
    'L12': { day: 'Tuesday',   time: '08:51 - 09:40' },
    'L13': { day: 'Tuesday',   time: '09:51 - 10:40' },
    'L14': { day: 'Tuesday',   time: '10:41 - 11:30' },
    'L15': { day: 'Tuesday',   time: '11:40 - 12:30' },
    'L16': { day: 'Tuesday',   time: '12:31 - 13:20' },
    'L17': { day: 'Tuesday',   time: '14:00 - 14:50' },
    'L18': { day: 'Tuesday',   time: '14:51 - 15:40' },
    'L19': { day: 'Tuesday',   time: '15:51 - 16:40' },
    'L20': { day: 'Tuesday',   time: '16:41 - 17:30' },
    'L21': { day: 'Wednesday', time: '08:00 - 08:50' },
    'L22': { day: 'Wednesday', time: '08:51 - 09:40' },
    'L23': { day: 'Wednesday', time: '09:51 - 10:40' },
    'L24': { day: 'Wednesday', time: '10:41 - 11:30' },
    'L25': { day: 'Wednesday', time: '11:40 - 12:30' },
    'L26': { day: 'Wednesday', time: '12:31 - 13:20' },
    'L27': { day: 'Wednesday', time: '14:00 - 14:50' },
    'L28': { day: 'Wednesday', time: '14:51 - 15:40' },
    'L29': { day: 'Wednesday', time: '15:51 - 16:40' },
    'L30': { day: 'Wednesday', time: '16:41 - 17:30' },
    'L31': { day: 'Thursday',  time: '08:00 - 08:50' },
    'L32': { day: 'Thursday',  time: '08:51 - 09:40' },
    'L33': { day: 'Thursday',  time: '09:51 - 10:40' },
    'L34': { day: 'Thursday',  time: '10:41 - 11:30' },
    'L35': { day: 'Thursday',  time: '11:40 - 12:30' },
    'L36': { day: 'Thursday',  time: '12:31 - 13:20' },
    'L37': { day: 'Thursday',  time: '14:00 - 14:50' },
    'L38': { day: 'Thursday',  time: '14:51 - 15:40' },
    'L39': { day: 'Thursday',  time: '15:51 - 16:40' },
    'L40': { day: 'Thursday',  time: '16:41 - 17:30' },
    'L41': { day: 'Friday',    time: '08:00 - 08:50' },
    'L42': { day: 'Friday',    time: '08:51 - 09:40' },
    'L43': { day: 'Friday',    time: '09:51 - 10:40' },
    'L44': { day: 'Friday',    time: '10:41 - 11:30' },
    'L45': { day: 'Friday',    time: '11:40 - 12:30' },
    'L46': { day: 'Friday',    time: '12:31 - 13:20' },
    'L47': { day: 'Friday',    time: '14:00 - 14:50' },
    'L48': { day: 'Friday',    time: '14:51 - 15:40' },
    'L49': { day: 'Friday',    time: '15:51 - 16:40' },
    'L50': { day: 'Friday',    time: '16:41 - 17:30' },
    'L51': { day: 'Saturday',  time: '08:00 - 08:50' },
    'L52': { day: 'Saturday',  time: '08:51 - 09:40' },
    'L53': { day: 'Saturday',  time: '09:51 - 10:40' },
    'L54': { day: 'Saturday',  time: '10:41 - 11:30' },
    'L55': { day: 'Saturday',  time: '11:40 - 12:30' },
    'L56': { day: 'Saturday',  time: '12:31 - 13:20' },
    'L57': { day: 'Saturday',  time: '14:00 - 14:50' },
    'L58': { day: 'Saturday',  time: '14:51 - 15:40' },
    'L59': { day: 'Saturday',  time: '15:51 - 16:40' },
    'L60': { day: 'Saturday',  time: '16:41 - 17:30' },
}

/**
 * Perform offline OCR on a VIT timetable image.
 * Does NOT require day name and course code to be on the same line.
 * Instead, scans all OCR text for slot codes and maps them via the fixed VIT slot table.
 */
export async function parseTimetableImage(file: File): Promise<{ classes: any[] }> {
    const worker = await createWorker('eng')
    await worker.setParameters({
        preserve_interword_spaces: '1',
        // Treat image as a single uniform block for better grid reading
        tessedit_pageseg_mode: '6' as any,
    })

    const { data } = await worker.recognize(file)
    await worker.terminate()

    const rawText = data.text
    console.log('OCR raw text:\n', rawText)

    const classes: any[] = []
    const seen = new Set<string>() // deduplicate slot+code combos

    // Normalise: collapse whitespace, remove newlines for global scan
    const text = rawText.replace(/\s+/g, ' ').toUpperCase()

    // ------------------------------------------------------------------
    // Strategy 1: Look for full VIT slot entries in format:
    //   SLOTCODE-COURSECODE-TYPE-VENUE  e.g. A1-CSE3009-TH-AB1-412
    //   or partial matches without venue
    // ------------------------------------------------------------------
    const fullSlotRegex = /\b([A-Z]{1,3}\d{1,2})\s*[-–]\s*([A-Z]{2,4}\d{3,4}[A-Z]?)\s*[-–]\s*([A-Z]{1,3})\b/g
    let match: RegExpExecArray | null

    while ((match = fullSlotRegex.exec(text)) !== null) {
        const slotCode = match[1]
        const courseCode = match[2]
        const courseType = match[3]

        const slotInfo = THEORY_SLOT_MAP[slotCode] || LAB_SLOT_MAP[slotCode]
        if (!slotInfo) continue

        const key = `${slotCode}-${courseCode}`
        if (seen.has(key)) continue
        seen.add(key)

        classes.push({
            day: slotInfo.day,
            time: slotInfo.time,
            subject: `${slotCode}-${courseCode}-${courseType}`,
            location: '',
            slot: slotCode,
        })
    }

    // ------------------------------------------------------------------
    // Strategy 2: If strategy 1 found nothing, scan for course codes
    //   anywhere near a recognisable slot code (within ±30 chars)
    // ------------------------------------------------------------------
    if (classes.length === 0) {
        // Find all slot code positions
        const slotRegex = /\b([A-Z]{1,3}\d{1,2})\b/g
        const courseCodeRegex = /\b([A-Z]{2,4}\d{3,4}[A-Z]?)\b/g

        // Collect all course code positions
        const coursePositions: { code: string; index: number }[] = []
        let cm: RegExpExecArray | null
        while ((cm = courseCodeRegex.exec(text)) !== null) {
            coursePositions.push({ code: cm[1], index: cm.index })
        }

        let sm: RegExpExecArray | null
        while ((sm = slotRegex.exec(text)) !== null) {
            const slotCode = sm[1]
            const slotInfo = THEORY_SLOT_MAP[slotCode] || LAB_SLOT_MAP[slotCode]
            if (!slotInfo) continue

            // Find nearest course code within 50 characters
            const slotIdx = sm.index
            const nearby = coursePositions.filter(cp => Math.abs(cp.index - slotIdx) <= 50)
            if (nearby.length === 0) continue

            const closest = nearby.reduce((a, b) =>
                Math.abs(a.index - slotIdx) < Math.abs(b.index - slotIdx) ? a : b
            )

            const key = `${slotCode}-${closest.code}`
            if (seen.has(key)) continue
            seen.add(key)

            classes.push({
                day: slotInfo.day,
                time: slotInfo.time,
                subject: `${slotCode}-${closest.code}`,
                location: '',
                slot: slotCode,
            })
        }
    }

    console.log(`OCR parsed ${classes.length} classes from timetable image`)
    return { classes }
}

/**
 * Perform offline OCR on a university attendance portal screenshot.
 * Extracts course codes and their attended/total numbers entirely in the browser.
 */
export async function parseAttendancePortalImage(file: File): Promise<{ courses: any[] }> {
    const worker = await createWorker('eng')
    await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: '6' as any,
    })

    const { data } = await worker.recognize(file)
    await worker.terminate()

    const rawText = data.text
    console.log('Offline Attendance OCR Raw Text:\n', rawText)

    const courses: any[] = []
    const seen = new Set<string>()

    // Normalize spaces and convert to uppercase
    const text = rawText.replace(/\s+/g, ' ').toUpperCase()

    // Regex to match course codes e.g. CDS3005, CSE1001, MAT2001
    const courseCodeRegex = /\b([A-Z]{3,4}\d{3,4}[A-Z]?)\b/g
    const matches: { code: string; index: number }[] = []
    let match: RegExpExecArray | null
    while ((match = courseCodeRegex.exec(text)) !== null) {
        matches.push({ code: match[1], index: match.index })
    }

    for (let i = 0; i < matches.length; i++) {
        const current = matches[i]
        if (seen.has(current.code)) continue
        seen.add(current.code)

        const startIdx = current.index
        const endIdx = i < matches.length - 1 ? matches[i + 1].index : text.length
        
        // Extract a slice of text following the course code to look for numbers
        const windowText = text.substring(startIdx, Math.min(startIdx + 200, endIdx))
        console.log(`Window for ${current.code}:`, windowText)

        let attended = 0
        let total = 0
        let found = false

        // Layer 1: Look for the specific pattern "<Attended> <Total> <Percentage>%" (e.g. "17 18 95%")
        // This is extremely common in university portal layouts like VIT Bhopal VTOP
        const percentagePatternMatch = windowText.match(/\b(\d+)\s+(\d+)\s+(\d+)\s*%/i)
        if (percentagePatternMatch) {
            const att = parseInt(percentagePatternMatch[1])
            const tot = parseInt(percentagePatternMatch[2])
            const pct = parseInt(percentagePatternMatch[3])
            
            // Validate: attended <= total, total is reasonable (< 150), and percentage fits
            if (att <= tot && tot > 0 && tot < 150 && pct <= 100) {
                attended = att
                total = tot
                found = true
                console.log(`Found via percentage pattern: ${attended}/${total} (${pct}%)`)
            }
        }

        // Layer 2: Look for fractional patterns like "17/18" or "17 of 18"
        if (!found) {
            const fractionRegex = /\b(\d+)\s*[\/|\\|of]\s*(\d+)\b/i
            const fractionMatch = windowText.match(fractionRegex)
            if (fractionMatch) {
                const att = parseInt(fractionMatch[1])
                const tot = parseInt(fractionMatch[2])
                if (att <= tot && tot > 0 && tot < 150) {
                    attended = att
                    total = tot
                    found = true
                    console.log(`Found via fraction pattern: ${attended}/${total}`)
                }
            }
        }

        // Layer 3: Heuristic scan of numbers backwards (from the end of the text block)
        // Since attendance data is at the end of the row (after slots, room numbers, faculty names),
        // scanning numbers backwards lets us ignore course numbers, year details, and slot numbers.
        if (!found) {
            const numbers = windowText.match(/\b\d+\b/g)
            if (numbers) {
                // Filter out obviously irrelevant large numbers (e.g. year codes, large IDs)
                const cleanNumbers = numbers.map(Number).filter(n => n < 1000)
                
                // Scan backwards starting from the end
                // If the last number in the sequence is a percentage (e.g. 70-100), we start checking
                // from the second-to-last element to skip it and treat it as the percentage column.
                let startIndex = cleanNumbers.length - 2
                const lastNum = cleanNumbers[cleanNumbers.length - 1]
                
                // If there are at least 3 numbers and the last number looks like a percentage (e.g., 0-100)
                if (cleanNumbers.length >= 3 && lastNum >= 0 && lastNum <= 100) {
                    startIndex = cleanNumbers.length - 3
                }

                for (let j = startIndex; j >= 0; j--) {
                    const first = cleanNumbers[j]
                    const second = cleanNumbers[j + 1]
                    // If first <= second and second is a reasonable class count (< 150)
                    if (first <= second && second > 0 && second < 150) {
                        // Skip if these numbers are likely slot numbers (e.g. from E11, E12 etc.)
                        // A slot pair like (11, 12) is often at the beginning of the row's numbers.
                        // Since we are scanning backwards, we will hit the attendance numbers (19, 20) first.
                        attended = first
                        total = second
                        found = true
                        console.log(`Found via backwards heuristic scan: ${attended}/${total}`)
                        break
                    }
                }
            }
        }

        if (found) {
            courses.push({
                code: current.code,
                name: `${current.code} (Offline OCR)`,
                attended,
                total
            })
        }
    }

    console.log('Offline attendance courses parsed:', courses)
    return { courses }
}

/**
 * Perform offline OCR on a university grade history screenshot.
 * Extracts course codes, titles, grades, credits, etc. entirely in the browser.
 */
export async function parseGradesImage(file: File): Promise<{ courses: any[] }> {
    const worker = await createWorker('eng')
    await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: '6' as any,
    })

    const { data } = await worker.recognize(file)
    await worker.terminate()

    const rawText = data.text
    console.log('Offline Grades OCR Raw Text:\n', rawText)

    const courses: any[] = []
    const seen = new Set<string>()

    // Normalize spaces and convert to uppercase
    const text = rawText.replace(/\s+/g, ' ').toUpperCase()

    // Regex to match course codes e.g. CDS3005, CSE1001, MAT2001
    const courseCodeRegex = /\b([A-Z]{3,4}\d{3,4}[A-Z]?)\b/g
    const matches: { code: string; index: number }[] = []
    let match: RegExpExecArray | null
    while ((match = courseCodeRegex.exec(text)) !== null) {
        matches.push({ code: match[1], index: match.index })
    }

    const VALID_GRADES = new Set(['S', 'A', 'B', 'C', 'D', 'E', 'F', 'O', 'P'])
    const COURSE_TYPES = ['ETH', 'ELA', 'EPJ', 'TH', 'LO', 'SS', 'ECA', 'LTP', 'LT', 'LP', 'PJ', 'L', 'P']

    for (let i = 0; i < matches.length; i++) {
        const current = matches[i]
        if (seen.has(current.code)) continue
        seen.add(current.code)

        const startIdx = current.index
        const endIdx = i < matches.length - 1 ? matches[i + 1].index : text.length
        
        // Extract window following the course code
        const windowText = text.substring(startIdx, Math.min(startIdx + 200, endIdx))
        console.log(`Grades Window for ${current.code}:`, windowText)

        // 1. Course Type
        let courseType = 'TH'
        for (const type of COURSE_TYPES) {
            const r = new RegExp(`\\b${type}\\b`, 'i')
            if (r.test(windowText)) {
                courseType = type
                break
            }
        }

        // 2. Credits: look for X.0 or a digit like 1, 2, 3, 4
        let credits = 3 // default
        const creditMatch = windowText.match(/\b([1-4])\.0\b/)
        if (creditMatch) {
            credits = parseFloat(creditMatch[1])
        } else {
            // Find integers in the window and take the one that represents credits
            const numbers = windowText.match(/\b([1-4])\b/g)
            if (numbers && numbers.length > 0) {
                credits = parseInt(numbers[0])
            }
        }

        // 3. Grade: S, A, B, C, D, E, F, O, P
        let grade = 'A' // default fallback
        let gradeFound = false
        
        // Look for letters that stand alone and are valid grades
        const words = windowText.split(' ')
        for (const word of words) {
            const clean = word.replace(/[^A-Z]/g, '')
            if (clean.length === 1 && VALID_GRADES.has(clean)) {
                // Make sure it isn't the course type letter (e.g. 'P' or 'L') if they match
                if (clean === 'P' && courseType === 'P') continue
                if (clean === 'L' && courseType === 'L') continue
                
                grade = clean
                gradeFound = true
                break
            }
        }

        if (!gradeFound) {
            // Check for any of S, A, B, C, D, E, F with word boundaries
            const m = windowText.match(/\b([SABCDEFOP])\b/)
            if (m) {
                grade = m[1]
            }
        }

        // Normalize grade S/O to S
        if (grade === 'O') grade = 'S'

        // 4. Semester or Exam Month
        let examMonth = 'Apr-2026'
        const examMatch = windowText.match(/\b((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-\d{4})\b/i)
        if (examMatch) {
            examMonth = examMatch[1]
            examMonth = examMonth.charAt(0) + examMonth.slice(1).toLowerCase()
        }

        // 5. Category Map (Heuristic)
        let category = 'none'
        const DISTRIBUTION_KEYWORDS = {
            'PC': 'Programme Core',
            'PE': 'Programme Elective',
            'UCNS': 'University Core - Natural Science',
            'UCBES': 'University Core - Engineering Sciences',
            'UCSD': 'University Core - Skill Development',
            'UCHSS': 'University Core - Humanities & Social Science',
            'UCPI': 'University Core - Project & Internships',
            'UENS': 'University Elective - Natural Science',
            'UEM': 'University Elective - Multidisciplinary',
            'UEHSS': 'University Elective - Humanities & Social',
            'UEOE': 'University Elective - Open Electives',
            'NMC': 'Non-Graded Mandatory Courses',
        }

        for (const [key, value] of Object.entries(DISTRIBUTION_KEYWORDS)) {
            const r = new RegExp(`\\b${key}\\b`, 'i')
            if (r.test(windowText)) {
                category = value
                break
            }
        }

        courses.push({
            name: `${current.code} (Offline OCR)`,
            code: current.code,
            courseType,
            grade,
            credits,
            semester: 'Semester 1',
            category,
            examMonth
        })
    }

    console.log('Offline grades parsed:', courses)
    return { courses }
}


