const fs = require('fs');

async function extractText() {
    const pdf = await import('pdfjs-dist/build/pdf.mjs');
    const data = new Uint8Array(fs.readFileSync('docs/Timetable.pdf'));
    const doc = await pdf.getDocument({ data }).promise;
    let fullText = '';
    
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group items by their Y coordinate to reconstruct lines
        const items = textContent.items.map(item => ({
            str: item.str,
            y: item.transform[5],
            x: item.transform[4]
        }));
        
        items.sort((a, b) => b.y - a.y || a.x - b.x);
        
        let currentY = -1;
        let line = '';
        for (const item of items) {
            if (Math.abs(item.y - currentY) > 5) {
                fullText += line + '\n';
                line = '';
                currentY = item.y;
            }
            line += item.str + '\t';
        }
        fullText += line + '\n';
    }
    
    console.log(fullText);
}

extractText().catch(console.error);
