// ─── PDF Operations via pdf-lib ─────────────────────────────────────────────
// Proper PDF merge/split/forms/annotations/watermarks without data loss.
// Uses pdf-lib which operates on the PDF structure directly (no rasterization).

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

// ─── Yield helper (keeps UI responsive during heavy loops) ──────────────────
const yieldToUI = () => new Promise(r => setTimeout(r, 0));

// ─── PDF Merge ──────────────────────────────────────────────────────────────
// Merges multiple PDF files preserving text, fonts, images, forms, links.
export async function mergePdfDocuments(files) {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    await yieldToUI();
    let sourcePdf;
    try {
      sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    } catch (err) {
      console.warn(`Skipping file ${file.name}: ${err.message}`);
      continue;
    }
    const indices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, indices);
    copiedPages.forEach(page => mergedPdf.addPage(page));
    await yieldToUI();
  }

  mergedPdf.setTitle('Merged Document');
  mergedPdf.setCreator('NovaReader');
  mergedPdf.setProducer('NovaReader + pdf-lib');

  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}

// ─── PDF Split ──────────────────────────────────────────────────────────────
// Extracts selected pages from a PDF preserving all content.
export async function splitPdfDocument(pdfArrayBuffer, pageNumbers) {
  const sourcePdf = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  // Convert to 0-indexed
  const indices = pageNumbers.map(n => n - 1).filter(i => i >= 0 && i < sourcePdf.getPageCount());
  if (!indices.length) return null;

  await yieldToUI();
  const copiedPages = await newPdf.copyPages(sourcePdf, indices);
  copiedPages.forEach(page => newPdf.addPage(page));

  newPdf.setCreator('NovaReader');
  newPdf.setProducer('NovaReader + pdf-lib');

  const bytes = await newPdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// Split into individual files (one page per PDF)
export async function splitPdfIntoIndividual(pdfArrayBuffer) {
  const sourcePdf = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const results = [];

  for (let i = 0; i < sourcePdf.getPageCount(); i++) {
    const singlePdf = await PDFDocument.create();
    const [page] = await singlePdf.copyPages(sourcePdf, [i]);
    singlePdf.addPage(page);
    const bytes = await singlePdf.save();
    results.push({
      pageNum: i + 1,
      blob: new Blob([bytes], { type: 'application/pdf' }),
    });
    await yieldToUI();
  }

  return results;
}

// ─── PDF Page Reorder / Delete ──────────────────────────────────────────────
export async function reorderPdfPages(pdfArrayBuffer, newOrder) {
  // newOrder is an array of 1-based page numbers in desired order
  const sourcePdf = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  const indices = newOrder.map(n => n - 1).filter(i => i >= 0 && i < sourcePdf.getPageCount());
  const copiedPages = await newPdf.copyPages(sourcePdf, indices);
  copiedPages.forEach(page => newPdf.addPage(page));

  const bytes = await newPdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Forms ──────────────────────────────────────────────────────────────
export async function getPdfFormFields(pdfArrayBuffer) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  return fields.map(field => {
    const type = field.constructor.name;
    const name = field.getName();
    let value = '';
    try {
      if (type === 'PDFTextField') value = field.getText() || '';
      else if (type === 'PDFCheckBox') value = field.isChecked();
      else if (type === 'PDFDropdown') value = field.getSelected() || [];
      else if (type === 'PDFRadioGroup') value = field.getSelected() || '';
      else if (type === 'PDFOptionList') value = field.getSelected() || [];
    } catch (err) { console.warn('[pdf-ops] error:', err?.message); }

    return { name, type, value };
  });
}

export async function fillPdfForm(pdfArrayBuffer, formData, flatten = false) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  for (const [fieldName, value] of Object.entries(formData)) {
    try {
      const field = form.getField(fieldName);
      const type = field.constructor.name;

      if (type === 'PDFTextField') {
        field.setText(String(value));
      } else if (type === 'PDFCheckBox') {
        if (value) field.check(); else field.uncheck();
      } else if (type === 'PDFDropdown') {
        field.select(String(value));
      } else if (type === 'PDFRadioGroup') {
        field.select(String(value));
      }
    } catch (err) {
      console.warn(`Cannot fill field "${fieldName}": ${err.message}`);
    }
  }

  if (flatten) form.flatten();

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Watermark ──────────────────────────────────────────────────────────
export async function addWatermarkToPdf(pdfArrayBuffer, text, options = {}) {
  const {
    fontSize = 60,
    opacity = 0.25,
    color = { r: 0.6, g: 0.6, b: 0.6 },
    rotation = -45,
    pages = null, // null = all pages, or array of 1-based page numbers
  } = options;

  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const allPages = pdfDoc.getPages();

  const targetPages = pages
    ? pages.map(n => allPages[n - 1]).filter(Boolean)
    : allPages;

  for (const page of targetPages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: (width - textWidth * Math.cos(Math.abs(rotation) * Math.PI / 180)) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(rotation),
    });
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Stamp ──────────────────────────────────────────────────────────────
const STAMP_CONFIGS = {
  approved: { text: 'УТВЕРЖДЕНО', color: rgb(0, 0.5, 0), borderColor: rgb(0, 0.5, 0) },
  rejected: { text: 'ОТКЛОНЕНО', color: rgb(0.7, 0, 0), borderColor: rgb(0.7, 0, 0) },
  draft: { text: 'ЧЕРНОВИК', color: rgb(0.5, 0.5, 0), borderColor: rgb(0.5, 0.5, 0) },
  confidential: { text: 'КОНФИДЕНЦИАЛЬНО', color: rgb(0.7, 0, 0), borderColor: rgb(0.7, 0, 0) },
  copy: { text: 'КОПИЯ', color: rgb(0, 0, 0.6), borderColor: rgb(0, 0, 0.6) },
};

export async function addStampToPdf(pdfArrayBuffer, stampType, options = {}) {
  const {
    pageNum = 1, // 1-based
    x = null,
    y = null,
    customText = null,
  } = options;

  const config = STAMP_CONFIGS[stampType] || STAMP_CONFIGS.draft;
  const text = customText || config.text;

  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPage(pageNum - 1);
  if (!page) return null;

  const { width, height } = page.getSize();
  const fontSize = 24;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const padding = 10;
  const stampWidth = textWidth + padding * 2;
  const stampHeight = fontSize + padding * 2;

  const stampX = x != null ? x : width - stampWidth - 40;
  const stampY = y != null ? y : height - stampHeight - 40;

  // Draw border
  page.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampWidth,
    height: stampHeight,
    borderColor: config.borderColor,
    borderWidth: 2,
    opacity: 0.8,
  });

  // Draw text
  page.drawText(text, {
    x: stampX + padding,
    y: stampY + padding + 2,
    size: fontSize,
    font,
    color: config.color,
    opacity: 0.8,
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Signature (embed image) ────────────────────────────────────────────
export async function addSignatureToPdf(pdfArrayBuffer, signatureImageBytes, options = {}) {
  const {
    pageNum = 1,
    x = 100,
    y = 100,
    width = 200,
    height = 80,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const page = pdfDoc.getPage(pageNum - 1);
  if (!page) return null;

  // Detect image type and embed
  let embeddedImage;
  try {
    embeddedImage = await pdfDoc.embedPng(signatureImageBytes);
  } catch (err) {
    console.warn('[pdf-ops] error:', err?.message);
    try {
      embeddedImage = await pdfDoc.embedJpg(signatureImageBytes);
    } catch (err) {
      console.warn('[pdf-ops] error:', err?.message);
      return null;
    }
  }

  const pageHeight = page.getSize().height;
  page.drawImage(embeddedImage, {
    x,
    y: pageHeight - y - height, // flip Y for PDF coordinate system
    width,
    height,
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Annotations Export ─────────────────────────────────────────────────
// Draw annotation strokes into the actual PDF pages
export async function exportAnnotationsIntoPdf(pdfArrayBuffer, annotationStore, canvasSize) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });

  for (const [pageNum, strokes] of annotationStore) {
    const page = pdfDoc.getPage(pageNum - 1);
    if (!page) continue;
    await yieldToUI();
    const { width: pdfW, height: pdfH } = page.getSize();
    const scaleX = pdfW / (canvasSize?.width || pdfW);
    const scaleY = pdfH / (canvasSize?.height || pdfH);

    for (const stroke of strokes) {
      const color = parseHexColor(stroke.color || '#000000');
      const lineWidth = (stroke.size || 2) * scaleX;

      if (stroke.tool === 'highlighter' && stroke.points?.length >= 2) {
        // Draw highlight as semi-transparent rectangle along stroke path
        const xs = stroke.points.map(p => p.x * scaleX);
        const ys = stroke.points.map(p => pdfH - p.y * scaleY);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        page.drawRectangle({
          x: minX, y: minY,
          width: maxX - minX || lineWidth * 4,
          height: maxY - minY || lineWidth * 2,
          color: rgb(color.r, color.g, color.b),
          opacity: 0.3,
        });
      } else if (stroke.tool === 'pen' && stroke.points?.length >= 2) {
        for (let i = 1; i < stroke.points.length; i++) {
          page.drawLine({
            start: { x: stroke.points[i-1].x * scaleX, y: pdfH - stroke.points[i-1].y * scaleY },
            end: { x: stroke.points[i].x * scaleX, y: pdfH - stroke.points[i].y * scaleY },
            thickness: lineWidth,
            color: rgb(color.r, color.g, color.b),
            opacity: stroke.opacity || 1,
          });
        }
      } else if (stroke.tool === 'rect' && stroke.bounds) {
        page.drawRectangle({
          x: stroke.bounds.x * scaleX,
          y: pdfH - (stroke.bounds.y + stroke.bounds.h) * scaleY,
          width: stroke.bounds.w * scaleX,
          height: stroke.bounds.h * scaleY,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: lineWidth,
        });
      } else if (stroke.tool === 'circle' && stroke.bounds) {
        const cx = (stroke.bounds.x + stroke.bounds.w / 2) * scaleX;
        const cy = pdfH - (stroke.bounds.y + stroke.bounds.h / 2) * scaleY;
        page.drawEllipse({
          x: cx, y: cy,
          xScale: (stroke.bounds.w / 2) * scaleX,
          yScale: (stroke.bounds.h / 2) * scaleY,
          borderColor: rgb(color.r, color.g, color.b),
          borderWidth: lineWidth,
        });
      } else if (stroke.tool === 'arrow' && stroke.points?.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        page.drawLine({
          start: { x: start.x * scaleX, y: pdfH - start.y * scaleY },
          end: { x: end.x * scaleX, y: pdfH - end.y * scaleY },
          thickness: lineWidth,
          color: rgb(color.r, color.g, color.b),
        });
        // Arrow head
        const angle = Math.atan2(
          (end.y - start.y) * scaleY,
          (end.x - start.x) * scaleX
        );
        const headLen = lineWidth * 5;
        const endX = end.x * scaleX;
        const endY = pdfH - end.y * scaleY;
        const ha1 = angle + Math.PI / 6;
        const ha2 = angle - Math.PI / 6;
        page.drawLine({
          start: { x: endX, y: endY },
          end: { x: endX - headLen * Math.cos(ha1), y: endY + headLen * Math.sin(ha1) },
          thickness: lineWidth,
          color: rgb(color.r, color.g, color.b),
        });
        page.drawLine({
          start: { x: endX, y: endY },
          end: { x: endX - headLen * Math.cos(ha2), y: endY + headLen * Math.sin(ha2) },
          thickness: lineWidth,
          color: rgb(color.r, color.g, color.b),
        });
      } else if (stroke.tool === 'line' && stroke.points?.length >= 2) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        page.drawLine({
          start: { x: start.x * scaleX, y: pdfH - start.y * scaleY },
          end: { x: end.x * scaleX, y: pdfH - end.y * scaleY },
          thickness: lineWidth,
          color: rgb(color.r, color.g, color.b),
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Page Rotation ──────────────────────────────────────────────────────
export async function rotatePdfPages(pdfArrayBuffer, pageNums, angleDeg) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });

  for (const pn of pageNums) {
    const page = pdfDoc.getPage(pn - 1);
    if (!page) continue;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angleDeg) % 360));
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF Metadata ───────────────────────────────────────────────────────────
export async function getPdfMetadata(pdfArrayBuffer) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  return {
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
    subject: pdfDoc.getSubject(),
    creator: pdfDoc.getCreator(),
    producer: pdfDoc.getProducer(),
    creationDate: pdfDoc.getCreationDate(),
    modificationDate: pdfDoc.getModificationDate(),
    pageCount: pdfDoc.getPageCount(),
    pages: pdfDoc.getPages().map((p, i) => ({
      num: i + 1,
      width: p.getSize().width,
      height: p.getSize().height,
      rotation: p.getRotation().angle,
    })),
  };
}

export async function setPdfMetadata(pdfArrayBuffer, metadata) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  if (metadata.title) pdfDoc.setTitle(metadata.title);
  if (metadata.author) pdfDoc.setAuthor(metadata.author);
  if (metadata.subject) pdfDoc.setSubject(metadata.subject);

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseHexColor(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return { r: r || 0, g: g || 0, b: b || 0 };
}

export function parsePageRange(str, maxPage) {
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    const rangeParts = part.split('-').map(s => parseInt(s.trim(), 10));
    if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
      const p = rangeParts[0];
      if (p >= 1 && p <= maxPage) result.push(p);
    } else if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
      const from = Math.max(1, rangeParts[0]);
      const to = Math.min(maxPage, rangeParts[1]);
      for (let i = from; i <= to; i++) result.push(i);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}
