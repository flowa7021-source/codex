// ─── PDF→DOCX Converter using 'docx' library ─────────────────────────────────
// Main conversion pipeline: PDF structure extraction → DOCX document assembly.
// Structure detection (fonts, columns, headings, images, blocks) is in
// docx-structure-detector.js.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  Header, Footer, PageNumber, NumberFormat, TabStopPosition, TabStopType,
  ShadingType, convertInchesToTwip,
} from 'docx';

import { extractStructuredContent, mapPdfFont, isBoldFont, isItalicFont, isMonospaceFont } from './docx-structure-detector.js';

// Re-export structure detector functions for backwards compatibility
export { extractStructuredContent, mapPdfFont, isBoldFont, isItalicFont, isMonospaceFont } from './docx-structure-detector.js';

/**
 * Build a TextRun from a run object, with optional color support.
 */
function makeTextRun(run, opts = {}) {
  const props = {
    text: run.text + ' ',
    bold: opts.bold ?? run.bold,
    italics: run.italic,
    font: run.fontFamily,
    size: Math.round(Math.min(opts.maxSize || 36, Math.max(opts.minSize || 12, run.fontSize)) * 2),
  };
  // Add color only if it's not black (default)
  if (run.color && run.color !== '000000' && run.color !== '#000000') {
    const c = run.color.startsWith('#') ? run.color.slice(1) : run.color;
    if (/^[0-9a-fA-F]{6}$/.test(c)) {
      props.color = c;
    }
  }
  if (opts.color) props.color = opts.color;
  return new TextRun(props);
}

// ─── Main conversion function ───────────────────────────────────────────────
export async function convertPdfToDocx(pdfDoc, title, pageCount, options = {}) {
  const {
    mode = 'text',  // 'text', 'text+images', 'layout', 'images-only'
    pageRange = null, // null = all, or [1,2,3]
    includeHeader = false,
    includeFooter = true,
    capturePageImage = null, // async function(pageNum) => Uint8Array (PNG)
    ocrWordCache = null, // Map<pageNum, words[]>
    ocrLanguage = null, // language code for OCR post-correction
  } = options;

  const pagesToConvert = pageRange || Array.from({ length: pageCount }, (_, i) => i + 1);
  const sections = [];

  for (const pageNum of pagesToConvert) {
    const children = [];

    if (mode === 'images-only') {
      if (capturePageImage) {
        const imgData = await capturePageImage(pageNum);
        if (imgData) {
          children.push(new Paragraph({
            children: [new ImageRun({
              data: imgData,
              transformation: { width: 595, height: 842 },
              type: 'png',
            })],
          }));
        }
      }
    } else {
      const content = await extractStructuredContent(pdfDoc, pageNum);

      let blocks = content.blocks;
      if (!blocks.length && ocrWordCache && ocrWordCache.has(pageNum)) {
        const words = ocrWordCache.get(pageNum);
        if (words && words.length) {
          blocks = buildBlocksFromOcrWords(words, ocrLanguage);
        }
      }

      for (const block of blocks) {
        if (block.type === 'columnBreak') {
          // Visual separator between columns — just add spacing
          children.push(new Paragraph({ spacing: { before: 80 } }));
          continue;
        }

        if (block.type === 'heading') {
          children.push(new Paragraph({
            heading: block.level,
            children: block.runs.map(run => makeTextRun(run, { bold: true, minSize: 20, maxSize: 56 })),
            spacing: { before: 240, after: 120 },
            alignment: block.alignment || AlignmentType.LEFT,
          }));
        } else if (block.type === 'paragraph') {
          const spacing = {};
          if (block.paragraphBreak) spacing.before = 120;
          spacing.after = 40;
          spacing.line = Math.round(block.fontSize * 1.15 * 20);

          children.push(new Paragraph({
            children: block.runs.map(run => makeTextRun(run)),
            indent: block.indent > 0 ? { left: block.indent * 720 } : undefined,
            spacing,
            alignment: block.alignment || AlignmentType.LEFT,
          }));
        } else if (block.type === 'table') {
          children.push(buildDocxTable(block));
        } else if (block.type === 'list') {
          children.push(new Paragraph({
            children: block.runs
              ? block.runs.map(run => makeTextRun(run, { minSize: 12, maxSize: 28 }))
              : [new TextRun(block.text)],
            bullet: { level: block.level || 0 },
          }));
        }
      }

      // Insert extracted inline images from the PDF page
      if (content.images && content.images.length && mode !== 'images-only') {
        for (const img of content.images) {
          children.push(new Paragraph({
            children: [new ImageRun({
              data: img.data,
              transformation: { width: Math.min(img.width, 500), height: Math.min(img.height, 700) },
              type: 'png',
            })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          }));
        }
      }

      // Add page image after text in 'text+images' mode
      if (mode === 'text+images' && capturePageImage) {
        const imgData = await capturePageImage(pageNum);
        if (imgData) {
          children.push(new Paragraph({ spacing: { before: 200 } }));
          children.push(new Paragraph({
            children: [new ImageRun({
              data: imgData,
              transformation: { width: 500, height: 700 },
              type: 'png',
            })],
            alignment: AlignmentType.CENTER,
          }));
        }
      }
    }

    // Empty page fallback
    if (!children.length) {
      children.push(new Paragraph({ text: '' }));
    }

    sections.push({
      properties: {
        page: {
          size: { width: 11906, height: 16838 },  // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: includeHeader ? {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: title || 'NovaReader', font: 'Arial', size: 16, color: '999999' })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      } : undefined,
      footers: includeFooter ? {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'Стр. ', font: 'Arial', size: 16, color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' }),
              new TextRun({ text: ' из ', font: 'Arial', size: 16, color: '999999' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: '999999' }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      } : undefined,
      children,
    });
  }

  const doc = new Document({
    title: title || 'NovaReader Export',
    creator: 'NovaReader',
    description: `Converted from PDF: ${title || 'unknown'}`,
    sections,
  });

  return await Packer.toBlob(doc);
}

function buildDocxTable(block) {
  const { rows, maxCols } = block;
  const colWidth = Math.floor(9000 / maxCols);

  const tableRows = rows.map((row, rowIdx) => {
    const cells = row.map(cellText => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({
          text: cellText || '',
          font: 'Arial',
          size: 20,
          bold: rowIdx === 0,
        })],
      })],
      width: { size: colWidth, type: WidthType.DXA },
      shading: rowIdx === 0 ? { type: ShadingType.CLEAR, fill: 'E8E8E8' } : undefined,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    }));
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

// ─── Build blocks from OCR word-level data ──────────────────────────────────
// Used when PDF has no native text (scanned documents). Applies post-correction
// and detects basic structure from word positions.
function buildBlocksFromOcrWords(words, ocrLanguage) {
  if (!words || !words.length) return [];

  const sorted = [...words].filter(w => w.bbox && w.text).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    return Math.abs(dy) < 5 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  // Group into lines using dynamic threshold from line height
  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].bbox.y0;

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    // Use the average line height of the current line for thresholding
    const avgH = currentLine.reduce((s, cw) => s + Math.abs(cw.bbox.y1 - cw.bbox.y0), 0) / currentLine.length;
    const threshold = Math.max(5, avgH * 0.45);
    if (Math.abs(w.bbox.y0 - currentY) <= threshold) {
      currentLine.push(w);
      currentY = currentLine.reduce((s, cw) => s + cw.bbox.y0, 0) / currentLine.length;
    } else {
      lines.push(currentLine);
      currentLine = [w];
      currentY = w.bbox.y0;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // Compute stats
  const allHeights = sorted.map(w => Math.abs(w.bbox.y1 - w.bbox.y0));
  const medianH = allHeights.sort((a, b) => a - b)[Math.floor(allHeights.length / 2)] || 12;
  const leftPositions = lines.map(l => Math.min(...l.map(w => w.bbox.x0)));
  const leftMargin = Math.min(...leftPositions);

  // Build blocks with structure detection
  const blocks = [];
  let prevBottom = 0;

  for (const lineWords of lines) {
    // Join words with smart spacing — detect large gaps as tab stops
    const sortedWords = [...lineWords].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    let lineText = '';
    for (let i = 0; i < sortedWords.length; i++) {
      if (i > 0) {
        const gap = sortedWords[i].bbox.x0 - sortedWords[i - 1].bbox.x1;
        const avgWordH = (Math.abs(sortedWords[i].bbox.y1 - sortedWords[i].bbox.y0) +
                          Math.abs(sortedWords[i - 1].bbox.y1 - sortedWords[i - 1].bbox.y0)) / 2;
        lineText += gap > avgWordH * 0.8 ? '  ' : ' ';
      }
      lineText += sortedWords[i].text;
    }
    lineText = lineText.trim();
    if (!lineText) continue;

    // Apply OCR post-correction if language is available
    if (ocrLanguage) {
      lineText = postCorrectOcrText(lineText, ocrLanguage);
    }

    const lineTop = Math.min(...lineWords.map(w => w.bbox.y0));
    const lineBottom = Math.max(...lineWords.map(w => w.bbox.y1));
    const avgH = lineWords.reduce((s, w) => s + Math.abs(w.bbox.y1 - w.bbox.y0), 0) / lineWords.length;
    const gap = lineTop - prevBottom;
    const lineX = Math.min(...lineWords.map(w => w.bbox.x0));
    const indent = Math.max(0, Math.round((lineX - leftMargin) / medianH));

    // Detect heading by size
    const sizeRatio = avgH / medianH;
    const isShort = lineText.length < 80;

    if (sizeRatio > 1.4 && isShort) {
      blocks.push({
        type: 'heading',
        level: sizeRatio > 1.8 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        text: lineText,
        runs: [{ text: lineText, bold: true, italic: false, fontFamily: 'Arial', fontSize: avgH }],
        alignment: AlignmentType.LEFT,
      });
    } else {
      // Check for list
      const listMatch = lineText.match(/^([\u2022\u2023\u25CF\u25CB•●○◦‣]\s)|^(\d{1,3}[.)]\s)/);
      if (listMatch && indent > 0) {
        const cleanText = lineText.replace(/^[\u2022\u2023\u25CF\u25CB•●○◦‣]\s*/, '').replace(/^\d{1,3}[.)]\s/, '').trim();
        blocks.push({
          type: 'list',
          text: cleanText,
          bullet: !lineText.match(/^\d/),
          level: Math.min(indent, 3),
          runs: [{ text: cleanText, bold: false, italic: false, fontFamily: 'Arial', fontSize: avgH }],
        });
      } else {
        const isParagraphBreak = gap > avgH * 1.2;

        // Try to merge with previous paragraph if continuation
        const prev = blocks.length > 0 ? blocks[blocks.length - 1] : null;
        if (prev && prev.type === 'paragraph' && !isParagraphBreak &&
            prev.indent === indent && Math.abs((prev.fontSize || medianH) - avgH) < medianH * 0.2) {
          prev.text += ' ' + lineText;
          prev.runs[prev.runs.length - 1].text += ' ' + lineText;
        } else {
          blocks.push({
            type: 'paragraph',
            text: lineText,
            runs: [{ text: lineText, bold: false, italic: false, fontFamily: 'Arial', fontSize: avgH }],
            indent,
            paragraphBreak: isParagraphBreak,
            fontSize: avgH,
            alignment: AlignmentType.LEFT,
          });
        }
      }
    }
    prevBottom = lineBottom;
  }

  return blocks;
}

// ─── OCR post-correction ────────────────────────────────────────────────────
// Common OCR error patterns that appear across all languages
const COMMON_OCR_FIXES = [
  [/\s{2,}/g, ' '],
  [/\u00AD/g, '-'],           // soft hyphen → regular hyphen
  [/[''`ʼ]/g, "'"],           // normalize quotes
  [/[""„«»]/g, '"'],          // normalize double quotes
  [/\s+([.,;:!?\)])/g, '$1'], // remove space before punctuation
  [/\(\s+/g, '('],            // remove space after opening paren
  [/\s+\)/g, ')'],            // remove space before closing paren
  [/(\w)\s*-\s*\n?\s*(\w)/g, '$1$2'], // rejoin hyphenated words
];

// Language-specific OCR fixes
const LANG_OCR_FIXES = {
  rus: [
    [/rn/g, 'т'],            // rn → т (Cyrillic context)
    [/0([А-Яа-я])/g, 'О$1'],
    [/([А-Яа-я])0/g, '$1о'],
    [/\bпо3/g, 'поз'],
    [/III/g, 'Ш'],
    [/II/g, 'П'],
    [/3([а-я])/g, 'з$1'],
  ],
  eng: [
    [/\brn\b/g, 'm'],
    [/\bcI/g, 'cl'],
    [/\btI/g, 'tl'],
    [/\bI\b(?=[a-z])/g, 'l'],
    [/\b0f\b/g, 'of'],
    [/\btbe\b/g, 'the'],
    [/\bwitb\b/g, 'with'],
  ],
  deu: [
    [/\brn/g, 'm'],
    [/\bfiir\b/g, 'für'],
    [/13/g, 'ß'],
  ],
  fra: [
    [/\brn/g, 'm'],
    [/I'/g, "l'"],
    [/\bqu '/g, "qu'"],
  ],
};

function postCorrectOcrText(text, lang) {
  if (!text) return text;
  let out = text;
  for (const [pat, rep] of COMMON_OCR_FIXES) {
    out = out.replace(pat, rep);
  }
  const langFixes = LANG_OCR_FIXES[lang];
  if (langFixes) {
    for (const [pat, rep] of langFixes) {
      out = out.replace(pat, rep);
    }
  }
  return out.trim();
}
