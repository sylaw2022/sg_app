// Generate PNG icons from SVG using sharp
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    // SVG for 192x192
    const svg192 = `<svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad192" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="textGrad192" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="192" height="192" rx="42" ry="42" fill="url(#bgGrad192)"/>
      <text x="96" y="73" font-family="Arial, sans-serif" font-size="54" font-weight="bold" 
            fill="url(#textGrad192)" text-anchor="middle" dominant-baseline="middle">SG</text>
      <text x="96" y="131" font-family="Arial, sans-serif" font-size="54" font-weight="bold" 
            fill="url(#textGrad192)" text-anchor="middle" dominant-baseline="middle">APP</text>
    </svg>`;

    // SVG for 512x512
    const svg512 = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad512" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="textGrad512" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" ry="112" fill="url(#bgGrad512)"/>
      <text x="256" y="195" font-family="Arial, sans-serif" font-size="144" font-weight="bold" 
            fill="url(#textGrad512)" text-anchor="middle" dominant-baseline="middle">SG</text>
      <text x="256" y="350" font-family="Arial, sans-serif" font-size="144" font-weight="bold" 
            fill="url(#textGrad512)" text-anchor="middle" dominant-baseline="middle">APP</text>
    </svg>`;

    // Convert SVG to PNG
    const buffer192 = Buffer.from(svg192);
    const buffer512 = Buffer.from(svg512);

    await sharp(buffer192)
      .resize(192, 192)
      .png()
      .toFile(path.join(__dirname, 'icon-192.png'));

    await sharp(buffer512)
      .resize(512, 512)
      .png()
      .toFile(path.join(__dirname, 'icon-512.png'));

    console.log('✅ PNG icons generated successfully!');
    console.log('   - icon-192.png (192x192)');
    console.log('   - icon-512.png (512x512)');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    console.log('💡 Alternative: Open create-icons.html in a browser to generate PNG icons');
  }
}

generateIcons();


