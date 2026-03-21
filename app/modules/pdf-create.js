// ─── PDF Creator ────────────────────────────────────────────────────────────
// Create PDF documents from images, blank pages, or HTML content.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/**
 * Create a PDF from a set of images.
 * @param {Array<{data: Uint8Array, type: string, name: string}>} images
 * @param {object} [options]
 * @param {'fit' | 'stretch' | 'actual'} [options.scaling='fit']
 * @param {'auto' | 'portrait' | 'landscape'} [options.orientation='auto']
 * @param {boolean} [options.addLabels=false]
 * @returns {Promise<Blob>}
 */
export async function createPdfFromImages(images, options = {}) {
  const { scaling = 'fit', orientation = 'auto', addLabels = false } = options;
  const pdfDoc = await PDFDocument.create();

  let font = null;
  if (addLabels) {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    let pdfImage;
    try {
      if (img.type === 'image/png' || img.name?.endsWith('.png')) {
        pdfImage = await pdfDoc.embedPng(img.data);
      } else {
        pdfImage = await pdfDoc.embedJpg(img.data);
      }
    } catch (err) {
      console.warn('[pdf-ops] error:', err?.message);
      // Try the other format as fallback
      try {
        pdfImage = await pdfDoc.embedJpg(img.data);
      } catch (err) {
        console.warn('[pdf-ops] error:', err?.message);
        pdfImage = await pdfDoc.embedPng(img.data);
      }
    }

    const imgWidth = pdfImage.width;
    const imgHeight = pdfImage.height;

    // Determine page size based on orientation
    let pageWidth, pageHeight;
    if (orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight)) {
      pageWidth = A4_HEIGHT;
      pageHeight = A4_WIDTH;
    } else {
      pageWidth = A4_WIDTH;
      pageHeight = A4_HEIGHT;
    }

    // Calculate image placement
    let drawX, drawY, drawWidth, drawHeight;

    switch (scaling) {
      case 'actual':
        drawWidth = imgWidth;
        drawHeight = imgHeight;
        drawX = (pageWidth - drawWidth) / 2;
        drawY = (pageHeight - drawHeight) / 2;
        break;

      case 'stretch':
        drawWidth = pageWidth;
        drawHeight = pageHeight;
        drawX = 0;
        drawY = 0;
        break;

      case 'fit':
      default: {
        const margin = 36; // 0.5 inch margin
        const availWidth = pageWidth - margin * 2;
        const availHeight = pageHeight - margin * 2 - (addLabels ? 20 : 0);
        const scaleX = availWidth / imgWidth;
        const scaleY = availHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

        drawWidth = imgWidth * scale;
        drawHeight = imgHeight * scale;
        drawX = (pageWidth - drawWidth) / 2;
        drawY = (pageHeight - drawHeight) / 2 + (addLabels ? 10 : 0);
        break;
      }
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(pdfImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });

    if (addLabels && font) {
      const label = `${i + 1} / ${images.length}`;
      const labelWidth = font.widthOfTextAtSize(label, 8);
      page.drawText(label, {
        x: (pageWidth - labelWidth) / 2,
        y: 12,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Create a blank PDF with specified number of pages.
 * @param {object} [options]
 * @param {number} [options.pages=1]
 * @param {number} [options.width=595.28] - A4 width in points
 * @param {number} [options.height=841.89] - A4 height in points
 * @param {boolean} [options.lined=false] - Add lines
 * @param {boolean} [options.grid=false] - Add grid
 * @returns {Promise<Blob>}
 */
export async function createBlankPdf(options = {}) {
  const {
    pages = 1,
    width = A4_WIDTH,
    height = A4_HEIGHT,
    lined = false,
    grid = false,
  } = options;

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < pages; i++) {
    const page = pdfDoc.addPage([width, height]);

    if (lined) {
      const lineColor = rgb(0.85, 0.85, 0.85);
      const margin = 72; // 1 inch
      const lineSpacing = 24; // ~8.5mm

      for (let y = height - margin; y > margin; y -= lineSpacing) {
        page.drawLine({
          start: { x: margin, y },
          end: { x: width - margin, y },
          thickness: 0.5,
          color: lineColor,
        });
      }
    }

    if (grid) {
      const gridColor = rgb(0.9, 0.9, 0.9);
      const spacing = 20; // ~7mm grid

      for (let x = spacing; x < width; x += spacing) {
        page.drawLine({
          start: { x, y: 0 },
          end: { x, y: height },
          thickness: 0.25,
          color: gridColor,
        });
      }
      for (let y = spacing; y < height; y += spacing) {
        page.drawLine({
          start: { x: 0, y },
          end: { x: width, y },
          thickness: 0.25,
          color: gridColor,
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Combine multiple single-page canvases into a PDF.
 * @param {HTMLCanvasElement[]} canvases
 * @returns {Promise<Blob>}
 */
export async function canvasesToPdf(canvases) {
  const pdfDoc = await PDFDocument.create();

  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL('image/png');
    const response = await fetch(dataUrl);
    const imgBytes = new Uint8Array(await response.arrayBuffer());
    const pdfImage = await pdfDoc.embedPng(imgBytes);

    const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
    page.drawImage(pdfImage, {
      x: 0, y: 0,
      width: pdfImage.width,
      height: pdfImage.height,
    });
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
