import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

async function extractText(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath))
    const pdf = await pdfjsLib.getDocument({ data }).promise
    
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        
        let lastY = -1
        let line = ''
        
        for (const item of content.items) {
            if (!('str' in item)) continue
            
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 3) {
                text += line + '\n'
                line = ''
            }
            line += item.str + ' '
            lastY = item.transform[5]
        }
        text += line + '\n\n--- PAGE ' + i + ' ---\n\n'
    }
    return text
}

async function main() {
    const docsDir = path.join(process.cwd(), 'docs')
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'))
    
    for (const file of files) {
        try {
            console.log(`Processing ${file}`)
            const txt = await extractText(path.join(docsDir, file))
            fs.writeFileSync(file.replace('.pdf', '.txt'), txt)
        } catch (err) {
            console.error(`Error on ${file}:`, err.message)
        }
    }
}

main().catch(console.error)
