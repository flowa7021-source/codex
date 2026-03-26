// @ts-check
// ─── PDF Operations via pdf-lib ─────────────────────────────────────────────
// Proper PDF merge/split/forms/annotations/watermarks without data loss.
// Uses pdf-lib which operates on the PDF structure directly (no rasterization).

import { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFDict, PDFString, PDFArray, PDFNumber, decodePDFRawStream } from 'pdf-lib';

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
  return new Blob([/** @type {any} */ (mergedBytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
      blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }),
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
      const f = /** @type {any} */ (field);
      if (type === 'PDFTextField') value = f.getText() || '';
      else if (type === 'PDFCheckBox') value = f.isChecked();
      else if (type === 'PDFDropdown') value = f.getSelected() || [];
      else if (type === 'PDFRadioGroup') value = f.getSelected() || '';
      else if (type === 'PDFOptionList') value = f.getSelected() || [];
    } catch (err) { console.warn('[pdf-ops] error:', err?.message); }

    return { name, type, value };
  });
}

export async function fillPdfForm(pdfArrayBuffer, formData, flatten = false) {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  for (const [fieldName, value] of Object.entries(formData)) {
    try {
      const field = /** @type {any} */ (form.getField(fieldName));
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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
  return new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });
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

// ─── Split by Bookmarks ─────────────────────────────────────────────────────
// Splits a PDF into multiple files based on top-level bookmark (outline) entries.
// Each bookmark defines a split point; pages between consecutive bookmarks form one file.
export async function splitByBookmarks(pdfBytes) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  // Read outline from catalog
  const catalog = pdfDoc.catalog;
  const outlinesRef = catalog.get(PDFName.of('Outlines'));
  if (!outlinesRef) {
    // No bookmarks — return entire document as single result
    const bytes = await pdfDoc.save();
    return [{ name: 'Full Document', blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }) }];
  }

  const ctx = pdfDoc.context;
  const outlinesDict = ctx.lookup(outlinesRef);
  if (!outlinesDict || !(outlinesDict instanceof PDFDict)) {
    const bytes = await pdfDoc.save();
    return [{ name: 'Full Document', blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }) }];
  }

  const firstRef = outlinesDict.get(PDFName.of('First'));
  if (!firstRef) {
    const bytes = await pdfDoc.save();
    return [{ name: 'Full Document', blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }) }];
  }

  // Build page ref → index map
  const pageRefs = pdfDoc.getPages().map(p => p.ref);
  const pageRefMap = new Map();
  for (let i = 0; i < pageRefs.length; i++) {
    pageRefMap.set(pageRefs[i], i);
  }

  // Walk the linked list of top-level outline entries
  const bookmarks = [];
  let currentRef = firstRef;
  const visited = new Set();
  while (currentRef) {
    const entryDict = ctx.lookup(currentRef);
    if (!entryDict || !(entryDict instanceof PDFDict) || visited.has(currentRef)) break;
    visited.add(currentRef);

    const titleObj = entryDict.get(PDFName.of('Title'));
    const title = titleObj instanceof PDFString ? titleObj.decodeText() : 'Untitled';

    // Resolve destination page number
    let destPageIndex = -1;
    const dest = entryDict.get(PDFName.of('Dest'));
    if (dest) {
      const destResolved = ctx.lookup(dest);
      if (destResolved instanceof PDFArray && destResolved.size() > 0) {
        const pageRef = destResolved.get(0);
        const idx = pageRefMap.get(pageRef);
        if (idx !== undefined) destPageIndex = idx;
      }
    }

    // If /Dest not found, try /A (action) → /D
    if (destPageIndex === -1) {
      const action = entryDict.get(PDFName.of('A'));
      if (action) {
        const actionDict = ctx.lookup(action);
        if (actionDict instanceof PDFDict) {
          const dVal = actionDict.get(PDFName.of('D'));
          if (dVal) {
            const dResolved = ctx.lookup(dVal);
            if (dResolved instanceof PDFArray && dResolved.size() > 0) {
              const pageRef = dResolved.get(0);
              const idx = pageRefMap.get(pageRef);
              if (idx !== undefined) destPageIndex = idx;
            }
          }
        }
      }
    }

    if (destPageIndex === -1) destPageIndex = 0; // fallback to first page

    bookmarks.push({ title, pageIndex: destPageIndex });
    currentRef = entryDict.get(PDFName.of('Next'));
  }

  if (bookmarks.length === 0) {
    const bytes = await pdfDoc.save();
    return [{ name: 'Full Document', blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }) }];
  }

  // Sort bookmarks by page index (just in case they aren't ordered)
  bookmarks.sort((a, b) => a.pageIndex - b.pageIndex);

  // Create split ranges
  const results = [];
  for (let i = 0; i < bookmarks.length; i++) {
    const startPage = bookmarks[i].pageIndex + 1; // 1-based
    const endPage = (i + 1 < bookmarks.length) ? bookmarks[i + 1].pageIndex : pageCount; // 1-based inclusive
    const pages = [];
    for (let p = startPage; p <= endPage; p++) pages.push(p);

    const blob = await splitPdfDocument(data, pages);
    if (blob) {
      results.push({ name: bookmarks[i].title, blob });
    }
    await yieldToUI();
  }

  return results;
}

// ─── Split by File Size ─────────────────────────────────────────────────────
// Splits a PDF so that each output file is at or under maxSizeBytes.
// Uses a greedy approach: adds pages one by one until adding the next would exceed the limit.
export async function splitByFileSize(pdfBytes, maxSizeBytes) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const sourcePdf = await PDFDocument.load(data, { ignoreEncryption: true });
  const pageCount = sourcePdf.getPageCount();

  const results = [];
  let startPage = 1;

  while (startPage <= pageCount) {
    let endPage = startPage;

    // Try to include as many pages as possible
    while (endPage <= pageCount) {
      const pages = [];
      for (let p = startPage; p <= endPage; p++) pages.push(p);

      const blob = await splitPdfDocument(data, pages);
      if (!blob) break;

      if (blob.size > maxSizeBytes && pages.length > 1) {
        // Back off by one page
        endPage--;
        break;
      }

      if (endPage === pageCount) break;
      endPage++;
    }

    // Build the final chunk
    const chunkPages = [];
    for (let p = startPage; p <= endPage; p++) chunkPages.push(p);
    const blob = await splitPdfDocument(data, chunkPages);
    if (blob) {
      results.push({ blob, pages: chunkPages });
    }
    startPage = endPage + 1;
    await yieldToUI();
  }

  return results;
}

// ─── Split by Blank Pages ───────────────────────────────────────────────────
// Splits a PDF at blank pages (pages with very little or no text content).
// Blank pages are treated as separators and removed from output.
export async function splitByBlankPages(pdfBytes, blankThreshold = 0.01) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const sourcePdf = await PDFDocument.load(data, { ignoreEncryption: true });
  const pageCount = sourcePdf.getPageCount();

  // Determine which pages are blank by checking text operators in the content stream
  const blankPages = new Set();
  // Use a character-count threshold: if total extracted text length is below threshold
  // fraction of a nominal page (~1000 chars), treat as blank. With default 0.01 → ~10 chars.
  const charThreshold = Math.max(1, Math.floor(blankThreshold * 1000));

  for (let i = 0; i < pageCount; i++) {
    const page = sourcePdf.getPage(i);
    // Extract raw content stream text operators
    // pdf-lib doesn't have a full text extraction API, so we inspect the raw content
    const contents = page.node.get(PDFName.of('Contents'));
    let textLen = 0;
    if (contents) {
      const resolved = sourcePdf.context.lookup(contents);
      if (resolved) {
        try {
          textLen = _measureTextInContentStreams(sourcePdf.context, resolved);
        } catch (_) {
          // If we can't decode, assume non-blank
          textLen = charThreshold + 1;
        }
      }
    }

    if (textLen < charThreshold) {
      blankPages.add(i + 1); // 1-based
    }
  }

  // Split into sections at blank pages
  const results = [];
  let currentSection = [];

  for (let p = 1; p <= pageCount; p++) {
    if (blankPages.has(p)) {
      // Blank page = separator
      if (currentSection.length > 0) {
        const blob = await splitPdfDocument(data, currentSection);
        if (blob) results.push({ blob, pages: [...currentSection] });
        currentSection = [];
      }
    } else {
      currentSection.push(p);
    }
    await yieldToUI();
  }

  // Don't forget the last section
  if (currentSection.length > 0) {
    const blob = await splitPdfDocument(data, currentSection);
    if (blob) results.push({ blob, pages: [...currentSection] });
  }

  return results;
}

// ─── Split by Range ─────────────────────────────────────────────────────────
// Splits a PDF by explicit user-defined ranges.
// ranges = [{ start, end, filename }] — start/end are 1-based page numbers.
export async function splitByRange(pdfBytes, ranges) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const results = [];

  for (const range of ranges) {
    const pages = [];
    for (let p = range.start; p <= range.end; p++) pages.push(p);

    const blob = await splitPdfDocument(data, pages);
    if (blob) {
      results.push({ blob, filename: range.filename || `pages_${range.start}-${range.end}.pdf` });
    }
    await yieldToUI();
  }

  return results;
}

// ─── Merge with Outlines ────────────────────────────────────────────────────
// Merges multiple PDFs and creates a bookmark outline with each source file as a top-level entry.
// Sub-entries from each file's original outline are preserved with adjusted page offsets.
export async function mergePdfWithOutlines(files) {
  const mergedPdf = await PDFDocument.create();
  const ctx = mergedPdf.context;

  // Track: { name, pageOffset, sourceOutlineEntries[] }
  const fileMeta = [];

  let pageOffset = 0;
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

    // Read source outline entries for sub-bookmarks
    const sourceOutline = _readOutlineFromDoc(sourcePdf);

    fileMeta.push({
      name: file.name,
      pageOffset,
      sourceOutline,
      pageCount: indices.length,
    });

    pageOffset += indices.length;
    await yieldToUI();
  }

  mergedPdf.setTitle('Merged Document');
  mergedPdf.setCreator('NovaReader');
  mergedPdf.setProducer('NovaReader + pdf-lib');

  // Build outline tree
  if (fileMeta.length > 0) {
    const pageRefs = mergedPdf.getPages().map(p => p.ref);
    const outlineTree = fileMeta.map(meta => ({
      title: meta.name,
      pageNum: meta.pageOffset + 1,
      children: meta.sourceOutline.map(entry => _offsetOutlineItem(entry, meta.pageOffset)),
      open: true,
    }));

    const outlinesRef = _buildMergeOutlineTree(ctx, outlineTree, pageRefs);
    mergedPdf.catalog.set(PDFName.of('Outlines'), outlinesRef);
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([/** @type {any} */ (mergedBytes)], { type: 'application/pdf' });
}

// ─── Internal helpers for extended operations ────────────────────────────────

/** Read outline entries from a loaded PDFDocument (without pdf.js dependency). */
function _readOutlineFromDoc(pdfDoc) {
  const catalog = pdfDoc.catalog;
  const outlinesRef = catalog.get(PDFName.of('Outlines'));
  if (!outlinesRef) return [];

  const ctx = pdfDoc.context;
  const outlinesDict = ctx.lookup(outlinesRef);
  if (!outlinesDict || !(outlinesDict instanceof PDFDict)) return [];

  const firstRef = outlinesDict.get(PDFName.of('First'));
  if (!firstRef) return [];

  const pageRefs = pdfDoc.getPages().map(p => p.ref);
  const pageRefMap = new Map();
  for (let i = 0; i < pageRefs.length; i++) {
    pageRefMap.set(pageRefs[i], i);
  }

  return _walkOutlineList(ctx, firstRef, pageRefMap);
}

/** Walk a linked list of outline entries, returning an array of { title, pageNum, children }. */
function _walkOutlineList(ctx, firstRef, pageRefMap) {
  const items = [];
  let currentRef = firstRef;
  const visited = new Set();

  while (currentRef) {
    const dict = ctx.lookup(currentRef);
    if (!dict || !(dict instanceof PDFDict) || visited.has(currentRef)) break;
    visited.add(currentRef);

    const titleObj = dict.get(PDFName.of('Title'));
    const title = titleObj instanceof PDFString ? titleObj.decodeText() : 'Untitled';

    let pageNum = 1;
    const dest = dict.get(PDFName.of('Dest'));
    if (dest) {
      const destResolved = ctx.lookup(dest);
      if (destResolved instanceof PDFArray && destResolved.size() > 0) {
        const idx = pageRefMap.get(destResolved.get(0));
        if (idx !== undefined) pageNum = idx + 1;
      }
    }

    // Recurse children
    const childFirstRef = dict.get(PDFName.of('First'));
    const children = childFirstRef ? _walkOutlineList(ctx, childFirstRef, pageRefMap) : [];

    items.push({ title, pageNum, children, open: true });
    currentRef = dict.get(PDFName.of('Next'));
  }

  return items;
}

/** Offset all pageNum values in an outline item tree. */
function _offsetOutlineItem(item, offset) {
  return {
    title: item.title,
    pageNum: item.pageNum + offset,
    children: (item.children || []).map(child => _offsetOutlineItem(child, offset)),
    open: item.open ?? true,
  };
}

/** Build the PDF outline tree structure (same pattern as outline-editor.js _buildOutlineTree). */
function _buildMergeOutlineTree(ctx, items, pageRefs) {
  const outlinesDict = ctx.obj({ Type: 'Outlines' });
  const outlinesRef = ctx.register(outlinesDict);

  if (items.length === 0) return outlinesRef;

  const refs = items.map(item => _buildMergeOutlineItem(ctx, item, pageRefs, outlinesRef));

  for (let i = 0; i < refs.length; i++) {
    const dict = ctx.lookup(refs[i]);
    if (i > 0)              dict.set(PDFName.of('Prev'), refs[i - 1]);
    if (i < refs.length - 1) dict.set(PDFName.of('Next'), refs[i + 1]);
  }

  outlinesDict.set(PDFName.of('First'), refs[0]);
  outlinesDict.set(PDFName.of('Last'),  refs[refs.length - 1]);
  outlinesDict.set(PDFName.of('Count'), PDFNumber.of(_countAll(items)));

  return outlinesRef;
}

function _buildMergeOutlineItem(ctx, item, pageRefs, parentRef) {
  const pageIdx = Math.max(0, Math.min((item.pageNum ?? 1) - 1, pageRefs.length - 1));
  const pageRef = pageRefs[pageIdx];

  const dest = ctx.obj([pageRef, PDFName.of('Fit')]);

  const dict = ctx.obj({});
  dict.set(PDFName.of('Title'),  PDFString.of(item.title ?? 'Untitled'));
  dict.set(PDFName.of('Parent'), parentRef);
  dict.set(PDFName.of('Dest'),   dest);

  const ref = ctx.register(dict);

  if (item.children?.length > 0) {
    const childRefs = item.children.map(child =>
      _buildMergeOutlineItem(ctx, child, pageRefs, ref),
    );

    for (let i = 0; i < childRefs.length; i++) {
      const childDict = ctx.lookup(childRefs[i]);
      if (i > 0)                    childDict.set(PDFName.of('Prev'), childRefs[i - 1]);
      if (i < childRefs.length - 1) childDict.set(PDFName.of('Next'), childRefs[i + 1]);
    }

    dict.set(PDFName.of('First'), childRefs[0]);
    dict.set(PDFName.of('Last'),  childRefs[childRefs.length - 1]);
    dict.set(PDFName.of('Count'), PDFNumber.of(_countAll(item.children)));
  }

  return ref;
}

/** Count total outline items (including nested children). */
function _countAll(items) {
  let count = 0;
  for (const item of items) {
    count += 1;
    if (item.children?.length) count += _countAll(item.children);
  }
  return count;
}

/**
 * Measure text content length from a PDF content stream (or array of streams).
 * Handles both PDFArray containers and individual stream objects,
 * including FlateDecode-compressed streams via pdf-lib's decodePDFRawStream.
 */
function _measureTextInContentStreams(ctx, resolved) {
  // Collect individual stream objects
  const streams = [];
  if (resolved instanceof PDFArray) {
    for (let j = 0; j < resolved.size(); j++) {
      const item = ctx.lookup(resolved.get(j));
      if (item) streams.push(item);
    }
  } else {
    streams.push(resolved);
  }

  let totalTextLen = 0;
  for (const stream of streams) {
    const s = /** @type {any} */ (stream);
    let raw = null;

    // Use pdf-lib's built-in decodePDFRawStream for decompression (handles FlateDecode etc.)
    if (s.dict) {
      try {
        const decoded = decodePDFRawStream(s);
        const bytes = decoded.decode();
        raw = new TextDecoder('latin1').decode(bytes);
      } catch (_) { /* fall through to other methods */ }
    }

    // Fallback: try high-level decode methods
    if (!raw) {
      if (typeof s.decodeText === 'function') {
        totalTextLen += s.decodeText().trim().length;
        continue;
      }
      if (typeof s.decode === 'function') {
        try { raw = new TextDecoder('latin1').decode(s.decode()); } catch (_) { /* ignore */ }
      }
    }

    if (raw) {
      // Look for text-showing operators: Tj, TJ, ', "
      // Match hex strings <...>Tj and literal strings (...)Tj
      const hexMatches = raw.match(/<([0-9A-Fa-f]+)>\s*Tj/g);
      const litMatches = raw.match(/\(([^)]*)\)\s*Tj/g);
      if (hexMatches) {
        // Each hex pair = 1 character
        totalTextLen += hexMatches.reduce((sum, m) => {
          const hex = m.match(/<([0-9A-Fa-f]+)>/);
          return sum + (hex ? hex[1].length / 2 : 0);
        }, 0);
      }
      if (litMatches) {
        totalTextLen += litMatches.reduce((sum, m) => sum + m.length - 4, 0); // strip () and Tj
      }
      // Also check TJ arrays: [(...) ...] TJ or [<hex> ...] TJ
      const tjArrays = raw.match(/\[([^\]]*)\]\s*TJ/g);
      if (tjArrays) {
        for (const arr of tjArrays) {
          const hexInArr = arr.match(/<([0-9A-Fa-f]+)>/g);
          if (hexInArr) {
            totalTextLen += hexInArr.reduce((sum, h) => sum + (h.length - 2) / 2, 0);
          }
          const litInArr = arr.match(/\(([^)]*)\)/g);
          if (litInArr) {
            totalTextLen += litInArr.reduce((sum, m) => sum + m.length - 2, 0);
          }
        }
      }
    }
  }

  return totalTextLen;
}
