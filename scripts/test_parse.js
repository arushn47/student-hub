const path = require('path');
const fs = require('fs');

async function main() {
    const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
    
    // Polyfill for worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const filePath = path.join(__dirname, '../Curriculum_Student_BTECH-BCE-2023_23BCE10472_2026-01-26_05-53-10.pdf');
    const arrayBuffer = fs.readFileSync(filePath);
    const typedArray = new Uint8Array(arrayBuffer);

    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
    console.log('Num pages:', pdf.numPages);
    
    // We just want to extract page 1 to see the lines
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    
    const Y_TOLERANCE = 3;
    const allItems = [];

    for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        allItems.push({ x: item.transform[4], y: item.transform[5], str: item.str });
    }

    allItems.sort((a, b) => b.y - a.y);

    const rows = [];
    let currentRow = [];
    let clusterY = allItems.length > 0 ? allItems[0].y : 0;

    for (const item of allItems) {
        if (currentRow.length === 0 || Math.abs(item.y - clusterY) <= Y_TOLERANCE) {
            currentRow.push({ x: item.x, str: item.str });
        } else {
            rows.push(currentRow);
            currentRow = [{ x: item.x, str: item.str }];
            clusterY = item.y;
        }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    const lines = [];
    for (const row of rows) {
        const sorted = row.sort((a, b) => a.x - b.x);
        lines.push(sorted.map(it => it.str).join('\t'));
    }

    fs.writeFileSync(path.join(__dirname, '../pdf_lines.txt'), lines.join('\n'));
    console.log('Wrote to pdf_lines.txt');
}

main().catch(console.error);
