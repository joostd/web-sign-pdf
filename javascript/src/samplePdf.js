#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Build a minimal one-page PDF for trying out the signing demo.
 */
async function makePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([200, 200]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Hello, signed PDF!', { x: 20, y: 100, size: 14, font, color: rgb(0, 0, 0) });
  return pdfDoc.save();
}

async function main() {
  const outputPath = process.argv[2] || 'sample.pdf';
  const pdfBytes = await makePdf();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Wrote ${outputPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { makePdf };
