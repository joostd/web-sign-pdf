import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** Build a minimal one-page PDF for trying out the signing demo. */
export async function makeSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 150]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Hello, signed PDF!', { x: 20, y: 100, size: 18, font, color: rgb(0, 0, 0) });
  return pdfDoc.save();
}
