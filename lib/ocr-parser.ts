/* eslint-disable @typescript-eslint/no-explicit-any */
import { createWorker } from 'tesseract.js'

/**
 * Perform offline OCR on an image and attempt to parse a VIT timetable.
 */
export async function parseTimetableImage(file: File): Promise<{ classes: any[] }> {
    const worker = await createWorker('eng')
    
    // Set parameters for better grid/table recognition if possible
    // Tesseract doesn't have a specific "table" mode, but "preserve_interword_spaces" helps
    await worker.setParameters({
        preserve_interword_spaces: '1',
    })

    const { data } = await worker.recognize(file)
    await worker.terminate()

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
        { start: '08:30', end: '10:00' },
        { start: '10:05', end: '11:35' },
        { start: '11:40', end: '13:10' },
        { start: '13:15', end: '14:45' },
        { start: '14:50', end: '16:20' },
        { start: '16:25', end: '17:55' },
        { start: '18:00', end: '19:30' }
    ]

    // Group text items by line (spatial grouping)
    // Tesseract provides lines in data.lines
    const lines = (data as any).lines || []
    if (lines.length > 0) {
        for (const line of lines) {
            const lineText = (line.text || '').toUpperCase()
            
            // Check if the line contains a day name
            let dayName = ''
            for (const [abbr, full] of Object.entries(dayMap)) {
                if (lineText.includes(abbr)) {
                    dayName = full
                    break
                }
            }

            if (dayName) {
                // Scan the line for VIT course patterns: SLOT-CODE-TYPE-ROOM
                // Regex: [A-Z]\d{2}-[A-Z]{2,4}\d{3,4}-[A-Z]+-[A-Z0-9-]+
                const courseRegex = /([A-Z]\d{2})-([A-Z]{2,4}\d{3,4}(?:-[A-Z]+)?)-([A-Z]{1,3})-([A-Z0-9-]{4,})/g
                const matches = lineText.matchAll(courseRegex)
                
                for (const m of matches) {
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
    }

    // Fallback: If no lines matched, try a global regex scan
    if (classes.length === 0) {
        const text = data.text.toUpperCase()
        const chunks = text.split(/\n+/)
        
        for (const chunk of chunks) {
            let dayName = ''
            for (const [abbr, full] of Object.entries(dayMap)) {
                if (chunk.includes(abbr)) {
                    dayName = full
                    break
                }
            }
            if (!dayName) continue

            const courseRegex = /([A-Z]\d{2})-([A-Z]{2,4}\d{3,4}(?:-[A-Z]+)?)-([A-Z]{1,3})-([A-Z0-9-]{4,})/g
            const matches = chunk.matchAll(courseRegex)
            for (const m of matches) {
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
