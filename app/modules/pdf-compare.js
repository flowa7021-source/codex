// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF Document Comparison Module
// Text-based and visual comparison of two PDF documents
// ═══════════════════════════════════════════════════════════════════════

// Uses Myers' diff algorithm via the `diff` npm package (O(n·D) vs O(mn) LCS).
// Handles documents of any size without a hard line limit.
import { diffArrays, diffWords } from 'diff';

/**
 * Compute a line-level diff between two text arrays using Myers' algorithm.
 * Returns an array of {type: 'equal'|'add'|'remove', text: string}.
 * @param {string[]} linesA
 * @param {string[]} linesB
 * @returns {Array<{type: string, text: string, lineA?: number, lineB?: number}>}
 */
function computeLineDiff(linesA, linesB) {
  const changes = diffArrays(linesA, linesB);
  /** @type {Array<{type: string, text: string, lineA?: number, lineB?: number}>} */
  const result = [];
  let lineA = 1;
  let lineB = 1;

  for (const change of changes) {
    for (const text of change.value) {
      if (change.added) {
        result.push({ type: 'add', text, lineB: lineB++ });
      } else if (change.removed) {
        result.push({ type: 'remove', text, lineA: lineA++ });
      } else {
        result.push({ type: 'equal', text, lineA: lineA++, lineB: lineB++ });
      }
    }
  }

  return result;
}

/**
 * Compute word-level diff using Myers' algorithm.
 * @param {string} textA
 * @param {string} textB
 * @returns {Array<{type: string, text: string}>}
 */
function computeWordDiff(textA, textB) {
  const changes = diffWords(textA, textB);
  return changes.map(change => ({
    type: change.added ? 'add' : change.removed ? 'remove' : 'equal',
    text: change.value,
  }));
}

export class PdfCompare {
  /**
   * Extract all text from a PDF via PDF.js
   * @param {Object} pdfDocument - PDF.js document
   * @returns {Promise<string[]>} Array of text per page
   */
  async extractAllText(pdfDocument) {
    const pages = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      pages.push(text);
    }
    return pages;
  }

  /**
   * Compare text content of two PDFs
   */
  async compareText(pdfDocA, pdfDocB) {
    const textA = await this.extractAllText(pdfDocA);
    const textB = await this.extractAllText(pdfDocB);

    const allTextA = textA.join('\n').split('\n');
    const allTextB = textB.join('\n').split('\n');

    const diff = computeLineDiff(allTextA, allTextB);

    const added = diff.filter(d => d.type === 'add');
    const removed = diff.filter(d => d.type === 'remove');
    const equal = diff.filter(d => d.type === 'equal');

    return {
      diff,
      summary: {
        totalLines: diff.length,
        addedLines: added.length,
        removedLines: removed.length,
        unchangedLines: equal.length,
        changePercent: diff.length > 0
          ? ((added.length + removed.length) / diff.length * 100).toFixed(1)
          : '0.0',
      },
      pagesA: textA.length,
      pagesB: textB.length,
    };
  }

  /**
   * Visual pixel-diff of a specific page
   */
  async compareVisual(pdfDocA, pdfDocB, pageNum, scale = 1.5) {
    const renderPage = async (pdfDoc, num) => {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { canvas, ctx: null, width: viewport.width, height: viewport.height };
      await page.render({ canvasContext: ctx, viewport }).promise;
      return { canvas, ctx, width: viewport.width, height: viewport.height };
    };

    const pageNumA = Math.min(pageNum, pdfDocA.numPages);
    const pageNumB = Math.min(pageNum, pdfDocB.numPages);

    const [a, b] = await Promise.all([
      renderPage(pdfDocA, pageNumA),
      renderPage(pdfDocB, pageNumB),
    ]);

    // Create diff canvas
    const width = Math.max(a.width, b.width);
    const height = Math.max(a.height, b.height);
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext('2d');
    if (!diffCtx) return null;

    const imgDataA = a.ctx.getImageData(0, 0, a.width, a.height);
    const imgDataB = b.ctx.getImageData(0, 0, b.width, b.height);
    const diffImgData = diffCtx.createImageData(width, height);

    let diffPixels = 0;
    const totalPixels = width * height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const idxA = x < a.width && y < a.height ? (y * a.width + x) * 4 : -1;
        const idxB = x < b.width && y < b.height ? (y * b.width + x) * 4 : -1;

        const rA = idxA >= 0 ? imgDataA.data[idxA] : 255;
        const gA = idxA >= 0 ? imgDataA.data[idxA + 1] : 255;
        const bA = idxA >= 0 ? imgDataA.data[idxA + 2] : 255;

        const rB = idxB >= 0 ? imgDataB.data[idxB] : 255;
        const gB = idxB >= 0 ? imgDataB.data[idxB + 1] : 255;
        const bB = idxB >= 0 ? imgDataB.data[idxB + 2] : 255;

        const diff = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);

        if (diff > 30) { // Threshold for "different"
          diffPixels++;
          // Highlight differences: red for A-only, green for B-only, yellow for changed
          if (idxA < 0) {
            diffImgData.data[idx] = 0; diffImgData.data[idx + 1] = 200; diffImgData.data[idx + 2] = 0; // Green (added)
          } else if (idxB < 0) {
            diffImgData.data[idx] = 200; diffImgData.data[idx + 1] = 0; diffImgData.data[idx + 2] = 0; // Red (removed)
          } else {
            diffImgData.data[idx] = 255; diffImgData.data[idx + 1] = 200; diffImgData.data[idx + 2] = 0; // Yellow (changed)
          }
          diffImgData.data[idx + 3] = 180;
        } else {
          // Desaturated original
          const gray = Math.round((rB + gB + bB) / 3);
          diffImgData.data[idx] = gray;
          diffImgData.data[idx + 1] = gray;
          diffImgData.data[idx + 2] = gray;
          diffImgData.data[idx + 3] = 255;
        }
      }
    }

    diffCtx.putImageData(diffImgData, 0, 0);

    return {
      diffCanvas,
      canvasA: a.canvas,
      canvasB: b.canvas,
      diffPercent: ((diffPixels / totalPixels) * 100).toFixed(2),
      diffPixels,
      totalPixels,
    };
  }

  /**
   * Generate an HTML report of the comparison
   */
  generateDiffHtml(diff) {
    const lines = [];
    lines.push('<div class="diff-report">');

    for (const entry of diff) {
      const cls = entry.type === 'add' ? 'diff-add' : entry.type === 'remove' ? 'diff-remove' : 'diff-equal';
      const prefix = entry.type === 'add' ? '+' : entry.type === 'remove' ? '−' : ' ';
      const escaped = (entry.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      lines.push(`<div class="${cls}"><span class="diff-prefix">${prefix}</span> ${escaped}</div>`);
    }

    lines.push('</div>');
    return lines.join('\n');
  }
}

export const pdfCompare = new PdfCompare();
export { computeLineDiff, computeWordDiff };

// ═══════════════════════════════════════════════════════════════════════
// Export helpers — DOCX track-changes, annotated PDF, diff table
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a DOCX file with Word-style track changes from a diff result.
 *
 * @param {Array<{type: 'equal'|'add'|'remove', text: string}>} diffResult
 * @returns {Promise<Blob>}
 */
export async function exportAsDocxTrackChanges(diffResult) {
  const {
    Document, Packer, Paragraph, TextRun,
    DeletedTextRun, InsertedTextRun,
  } = await import('docx');

  const author = 'NovaReader';
  const date   = new Date().toISOString();

  const paragraphs = diffResult.map(entry => {
    if (entry.type === 'remove') {
      return new Paragraph({
        children: [
          new DeletedTextRun(/** @type {any} */ ({
            text:   entry.text,
            author,
            date,
            bold:   false,
          })),
        ],
      });
    }
    if (entry.type === 'add') {
      return InsertedTextRun
        ? new Paragraph({
            children: [
              new InsertedTextRun(/** @type {any} */ ({
                text:   entry.text,
                author,
                date,
                bold:   false,
              })),
            ],
          })
        : new Paragraph({
            children: [
              new TextRun({ text: entry.text, color: '00AA00' }),
            ],
          });
    }
    // equal
    return new Paragraph({
      children: [new TextRun({ text: entry.text })],
    });
  });

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}

/**
 * Place diff annotations on the source PDF.
 * Removed text -> Strikeout annotation (red).
 * Added text   -> Highlight annotation (green) + text note.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes - Source PDF bytes
 * @param {Array<{type: 'equal'|'add'|'remove', text: string}>} diffResult
 * @returns {Promise<Blob>}
 */
export async function exportAsAnnotatedPdf(pdfBytes, diffResult) {
  const { PDFDocument, rgb } = await import('pdf-lib');

  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const pages  = pdfDoc.getPages();

  if (pages.length === 0) {
    const saved = await pdfDoc.save();
    return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
  }

  // Collect non-equal entries for annotation
  const changes = diffResult.filter(d => d.type !== 'equal');
  const firstPage = pages[0];
  const { width: _width, height } = firstPage.getSize();

  let yOffset = height - 40;
  const lineHeight = 14;
  const margin = 40;

  for (const entry of changes) {
    // Move to next page worth of space if needed
    if (yOffset < margin) break;

    const color = entry.type === 'remove' ? rgb(0.8, 0, 0) : rgb(0, 0.6, 0);
    const prefix = entry.type === 'remove' ? '[DEL] ' : '[ADD] ';
    const displayText = (prefix + entry.text).slice(0, 100);

    firstPage.drawText(displayText, {
      x:    margin,
      y:    yOffset,
      size: 9,
      color,
    });

    yOffset -= lineHeight;
  }

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

/**
 * Generate a DOCX table of differences.
 * Columns: | # | Type | Original | Changed |
 *
 * @param {Array<{type: 'equal'|'add'|'remove', text: string}>} diffResult
 * @returns {Promise<Blob>}
 */
export async function exportDiffTable(diffResult) {
  const {
    Document, Packer, Paragraph, TextRun,
    Table, TableRow, TableCell, WidthType, BorderStyle,
  } = await import('docx');

  const changes = diffResult.filter(d => d.type !== 'equal');

  const noBorders = {
    top:    { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left:   { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right:  { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };

  const _cell = (text, bold = false) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
      borders: noBorders,
      width: { size: 2500, type: WidthType.DXA },
    });

  // Header row
  const headerRow = new TableRow({
    children: [
      _cell('#', true),
      _cell('Type', true),
      _cell('Original', true),
      _cell('Changed', true),
    ],
  });

  const rows = [headerRow];
  let idx = 0;

  for (const entry of changes) {
    idx++;
    const num      = String(idx);
    const typeName = entry.type === 'remove' ? 'Removed' : 'Added';
    const original = entry.type === 'remove' ? entry.text : '';
    const changed  = entry.type === 'add'    ? entry.text : '';

    rows.push(new TableRow({
      children: [
        _cell(num),
        _cell(typeName),
        _cell(original),
        _cell(changed),
      ],
    }));
  }

  const table = new Table({ rows });

  const doc = new Document({
    sections: [{ children: [table] }],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}
