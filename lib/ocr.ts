import Tesseract from 'tesseract.js'

/**
 * Client-side OCR using Tesseract.js.
 * Extracts text from an image file without any API calls.
 */
export async function extractTextFromImage(
    file: File,
    onProgress?: (progress: number) => void
): Promise<string> {
    // Convert File to a URL for Tesseract
    const url = URL.createObjectURL(file)

    try {
        const result = await Tesseract.recognize(url, 'eng', {
            logger: (info) => {
                if (info.status === 'recognizing text' && onProgress) {
                    onProgress(Math.round(info.progress * 100))
                }
            },
        })

        return result.data.text.trim()
    } finally {
        URL.revokeObjectURL(url)
    }
}

/**
 * Extract text from multiple image files.
 * Returns combined text with separators.
 */
export async function extractTextFromImages(
    files: File[],
    onProgress?: (progress: number) => void
): Promise<string> {
    const texts: string[] = []
    const totalFiles = files.length

    for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Skip PDFs — Tesseract can't handle them, fall back to AI vision
        if (file.type === 'application/pdf') {
            return '' // Signal caller to use image-based extraction
        }

        const text = await extractTextFromImage(file, (fileProgress) => {
            if (onProgress) {
                // Combine per-file progress into overall progress
                const overall = Math.round(((i * 100) + fileProgress) / totalFiles)
                onProgress(overall)
            }
        })

        if (text) texts.push(text)
    }

    onProgress?.(100)
    return texts.join('\n\n---\n\n')
}
