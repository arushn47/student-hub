import JSZip from 'jszip'

function decodeXmlEntities(input: string): string {
    // Minimal XML entity decode for Office XML content
    return input
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function extractTextFromXml(xml: string, tagName: string): string {
    const tag = tagName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')

    const parts: string[] = []
    let match: RegExpExecArray | null
    while ((match = re.exec(xml)) !== null) {
        const raw = match[1]
        const cleaned = decodeXmlEntities(raw).replace(/\s+/g, ' ').trim()
        if (cleaned) parts.push(cleaned)
    }

    return parts.join(' ')
}

export async function extractOfficeText(bytes: Uint8Array, ext: string): Promise<string | null> {
    const lower = ext.toLowerCase()
    if (lower !== 'pptx' && lower !== 'docx') return null

    const zip = await JSZip.loadAsync(bytes)

    if (lower === 'docx') {
        const doc = zip.file('word/document.xml')
        if (!doc) return null
        const xml = await doc.async('string')
        const text = extractTextFromXml(xml, 'w:t')
        return text || null
    }

    // pptx
    const slideNames = Object.keys(zip.files)
        .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
        .sort((a, b) => {
            const ai = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0)
            const bi = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0)
            return ai - bi
        })

    if (slideNames.length === 0) return null

    const slideTexts: string[] = []
    for (const name of slideNames) {
        const f = zip.file(name)
        if (!f) continue
        const xml = await f.async('string')
        const text = extractTextFromXml(xml, 'a:t')
        if (text) slideTexts.push(text)
    }

    const combined = slideTexts.join('\n')
    return combined.trim() ? combined : null
}
