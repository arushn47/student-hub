// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const AI_ICON = 'C:\\Users\\ARUSH\\.gemini\\antigravity\\brain\\6fd2dd41-6b3b-4f93-9353-2337a07f28c3\\studenthub_icon_1774642183213.png';

async function generate() {
    const BG = { r: 26, g: 26, b: 46, alpha: 1 }; // #1a1a2e

    // 1. Trim white border from AI icon
    const trimmed = await sharp(AI_ICON).trim().toBuffer({ resolveWithObject: true });
    console.log(`After trim: ${trimmed.info.width}x${trimmed.info.height}`);

    // 2. Scale UP so the rounded corners extend beyond the final 512px frame
    const overSize = 560;
    const oversized = await sharp(trimmed.data)
        .resize(overSize, overSize, { fit: 'fill', background: BG })
        .toBuffer();

    // 3. Crop the center 512x512 from the oversized image
    const offset = Math.round((overSize - 512) / 2);
    await sharp(oversized)
        .extract({ left: offset, top: offset, width: 512, height: 512 })
        .png()
        .toFile('public/icons/icon-512.png');
    console.log('Created icon-512.png');

    // 4. Generate smaller sizes
    await sharp('public/icons/icon-512.png').resize(192).png().toFile('public/icons/icon-192.png');
    console.log('Created icon-192.png');

    await sharp('public/icons/icon-512.png').resize(180).png().toFile('app/icon.png');
    console.log('Created app/icon.png');
}

generate().catch(console.error);
