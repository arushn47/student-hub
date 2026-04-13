import fs from 'fs'
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'

async function extractTextFromPDF(filePath) {
    const arrayBuffer = fs.readFileSync(filePath)
    const typedArray = new Uint8Array(arrayBuffer)

    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
    const lines = []

    const Y_TOLERANCE = 3
    const allItems = []

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()

        for (const item of textContent.items) {
            if (!('str' in item) || !item.str.trim()) continue
            allItems.push({ x: item.transform[4], y: item.transform[5], str: item.str, page: i })
        }
    }

    allItems.sort((a, b) => b.y - a.y)

    const rows = []
    let currentRow = []
    let clusterY = allItems.length > 0 ? allItems[0].y : 0

    for (const item of allItems) {
        if (currentRow.length === 0 || Math.abs(item.y - clusterY) <= Y_TOLERANCE) {
            currentRow.push({ x: item.x, str: item.str })
        } else {
            rows.push(currentRow)
            currentRow = [{ x: item.x, str: item.str }]
            clusterY = item.y
        }
    }
    if (currentRow.length > 0) rows.push(currentRow)

    for (const row of rows) {
        const sorted = row.sort((a, b) => a.x - b.x)
        const line = sorted.map(it => it.str).join('\t')
        lines.push(line)
    }

    fs.writeFileSync('pdf_dump.txt', lines.join('\n'))
    console.log('Done writing pdf_dump.txt')
}

extractTextFromPDF('Curriculum_Student_BTECH-BCE-2023_23BCE10472_2026-01-26_05-53-10.pdf').catch(console.error)
