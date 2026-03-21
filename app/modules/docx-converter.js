// ─── PDF→DOCX Converter using 'docx' library ─────────────────────────────────
// Main conversion pipeline: PDF structure extraction → DOCX document assembly.
// Structure detection (fonts, columns, headings, images, blocks) is in
// docx-structure-detector.js.

// Heavy 'docx' library is loaded lazily on first use to reduce initial bundle size.
// The cached module reference is populated by _loadDocx().
let _docx = null;

async function _loadDocx() {
  if (!_docx) {
    _docx = await import('docx');
  }
  return _docx;
}

import { extractStructuredContent, mapPdfFont, isMonospaceFont } from './docx-structure-detector.js';

// Re-export structure detector functions for backwards compatibility
export { extractStructuredContent, mapPdfFont, isBoldFont, isItalicFont, isMonospaceFont } from './docx-structure-detector.js';

// ─── PDF→DOCX Font Mapping ──────────────────────────────────────────────────
// Comprehensive mapping of common PDF font names to system/DOCX-safe fonts.
// The canonical mapping lives in docx-structure-detector.js (mapPdfFont).
// This constant provides a quick-reference subset used during TextRun creation.
const PDF_TO_DOCX_FONT_MAP = {
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Helvetica-Oblique': 'Arial',
  'Helvetica-BoldOblique': 'Arial',
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'Times-Italic': 'Times New Roman',
  'Times-BoldItalic': 'Times New Roman',
  'Courier': 'Courier New',
  'Courier-Bold': 'Courier New',
  'Courier-Oblique': 'Courier New',
  'Courier-BoldOblique': 'Courier New',
  'Symbol': 'Symbol',
  'ZapfDingbats': 'Wingdings',
  'ArialMT': 'Arial',
  'TimesNewRomanPSMT': 'Times New Roman',
  'CourierNewPSMT': 'Courier New',
  'Consolas': 'Consolas',
};

/**
 * Build a TextRun from a run object, with full formatting support.
 */
function makeTextRun(run, opts = {}) {
  // Map PDF font name to a DOCX-compatible system font
  const rawFont = run.fontFamily || '';
  const mappedFont = PDF_TO_DOCX_FONT_MAP[rawFont] || mapPdfFont(rawFont);
  const mono = isMonospaceFont(rawFont);

  const props = {
    text: run.text,
    bold: opts.bold ?? run.bold,
    italics: opts.italic ?? run.italic,
    font: mappedFont,
    size: Math.min((opts.maxSize || 72) * 2, Math.max((opts.minSize || 8) * 2, Math.round(run.fontSize * 2))),
  };

  // Apply monospace-specific formatting: use Courier New and slightly smaller size
  if (mono) {
    props.font = 'Courier New';
  }
  // Underline
  if (run.underline) {
    props.underline = { type: 'single' };
  }
  // Strikethrough
  if (run.strikethrough) {
    props.strike = true;
  }
  // Superscript / subscript
  if (run.superscript) {
    props.superScript = true;
  } else if (run.subscript) {
    props.subScript = true;
  }
  // Color
  if (run.color && run.color !== '000000' && run.color !== '#000000') {
    const c = run.color.startsWith('#') ? run.color.slice(1) : run.color;
    if (/^[0-9a-fA-F]{6}$/.test(c)) props.color = c;
  }
  if (opts.color) props.color = opts.color;
  // Character spacing
  if (run.characterSpacing && run.characterSpacing !== 0) {
    props.characterSpacing = Math.round(run.characterSpacing * 20);
  }
  return new _docx.TextRun(props);
}

/**
 * Build an array of TextRuns with space runs inserted between them.
 * Since makeTextRun no longer appends a trailing space, we insert explicit
 * space runs between consecutive text runs.
 */
function makeRunsWithSpaces(runs, opts = {}) {
  const result = [];
  for (let i = 0; i < runs.length; i++) {
    result.push(makeTextRun(runs[i], opts));
    if (i < runs.length - 1) {
      const spaceFont = PDF_TO_DOCX_FONT_MAP[runs[i].fontFamily] || mapPdfFont(runs[i].fontFamily || '');
      result.push(new _docx.TextRun({ text: ' ', font: spaceFont, size: Math.round(runs[i].fontSize * 2) }));
    }
  }
  return result;
}

/**
 * Build a hyperlink element for runs that have a url property.
 */
function makeHyperlinkRun(run) {
  const mappedFont = PDF_TO_DOCX_FONT_MAP[run.fontFamily] || mapPdfFont(run.fontFamily || '');
  return new _docx.ExternalHyperlink({
    children: [new _docx.TextRun({
      text: run.text,
      style: 'Hyperlink',
      color: '0563C1',
      underline: { type: 'single' },
      font: mappedFont,
      size: Math.round(run.fontSize * 2),
    })],
    link: run.url,
  });
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
    const footnoteChildren = [];

    if (mode === 'images-only') {
      if (capturePageImage) {
        const imgData = await capturePageImage(pageNum);
        if (imgData) {
          children.push(new _docx.Paragraph({
            children: [new _docx.ImageRun({
              data: imgData,
              transformation: { width: 595, height: 842 },
              type: 'png',
            })],
          }));
        }
      }
    } else {
      const content = await extractStructuredContent(pdfDoc, pageNum);

      // Use actual PDF page dimensions converted to twips (1pt = 20 twips)
      const pgWidth = Math.round((content.pageWidth || 595) * 20);
      const pgHeight = Math.round((content.pageHeight || 842) * 20);

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
          children.push(new _docx.Paragraph({ spacing: { before: 80 } }));
          continue;
        }

        if (block.type === 'heading') {
          const headingPara = new _docx.Paragraph({
            heading: block.level,
            children: makeRunsWithSpaces(block.runs, { bold: true, minSize: 20, maxSize: 56 }),
            spacing: { before: 240, after: 120 },
            alignment: block.alignment || _docx.AlignmentType.LEFT,
          });
          headingPara._blockY = block.y ?? Infinity;
          children.push(headingPara);
        } else if (block.type === 'paragraph') {
          const spacing = {};
          if (block.paragraphBreak) spacing.before = 120;
          spacing.after = 40;
          // Line spacing: use 1.15× body font or exact value from block
          spacing.line = Math.round((block.fontSize || 12) * 1.15 * 20);

          // Build children: handle hyperlinks within runs
          const paraChildren = [];
          if (block.runs) {
            for (let i = 0; i < block.runs.length; i++) {
              const run = block.runs[i];
              if (run.url) {
                paraChildren.push(makeHyperlinkRun(run));
              } else {
                paraChildren.push(makeTextRun(run));
              }
              if (i < block.runs.length - 1) {
                const spFont = PDF_TO_DOCX_FONT_MAP[run.fontFamily] || mapPdfFont(run.fontFamily || '');
                paraChildren.push(new _docx.TextRun({ text: ' ', font: spFont, size: Math.round(run.fontSize * 2) }));
              }
            }
          }

          const para = new _docx.Paragraph({
            children: paraChildren,
            indent: block.indent > 0 ? { left: block.indent * 720 } : undefined,
            spacing,
            alignment: block.alignment || _docx.AlignmentType.LEFT,
          });
          para._blockY = block.y ?? Infinity;
          children.push(para);
        } else if (block.type === 'table') {
          children.push(buildDocxTable(block));
        } else if (block.type === 'list') {
          const listRef = block.bullet ? 'bullet-list' : 'numbered-list';
          children.push(new _docx.Paragraph({
            children: block.runs
              ? makeRunsWithSpaces(block.runs, { minSize: 8, maxSize: 28 })
              : [new _docx.TextRun(block.text)],
            numbering: { reference: listRef, level: block.level || 0 },
            spacing: { after: 40 },
          }));
        } else if (block.type === 'footnote') {
          // Footnote separator + smaller text at the bottom
          footnoteChildren.push(new _docx.Paragraph({
            children: makeRunsWithSpaces(block.runs, { maxSize: 18 }),
            spacing: { before: 40, after: 20 },
            indent: { left: 360, hanging: 360 },
          }));
        }
      }

      // Insert extracted inline images from the PDF page
      // Track image insertion points by Y coordinate
      if (content.images && content.images.length && mode !== 'images-only') {
        for (const img of content.images) {
          const imgParagraph = new _docx.Paragraph({
            children: [new _docx.ImageRun({
              data: img.data,
              transformation: { width: Math.min(img.width, 500), height: Math.min(img.height, 700) },
              type: 'png',
            })],
            alignment: _docx.AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
          });
          // Insert at approximate Y position if available
          if (img.y !== undefined && children.length > 0) {
            let insertIdx = children.length;
            for (let ci = 0; ci < children.length; ci++) {
              if (children[ci]._blockY !== undefined && children[ci]._blockY > img.y) {
                insertIdx = ci;
                break;
              }
            }
            children.splice(insertIdx, 0, imgParagraph);
          } else {
            children.push(imgParagraph);
          }
        }
      }

      // Append footnotes at the end of the page content
      if (footnoteChildren.length) {
        // Add a visual separator before footnotes
        children.push(new _docx.Paragraph({
          children: [new _docx.TextRun({ text: '───────────────────────', font: 'Arial', size: 16, color: '999999' })],
          spacing: { before: 200, after: 40 },
        }));
        children.push(...footnoteChildren);
      }

      // Add page image after text in 'text+images' mode
      if (mode === 'text+images' && capturePageImage) {
        const imgData = await capturePageImage(pageNum);
        if (imgData) {
          children.push(new _docx.Paragraph({ spacing: { before: 200 } }));
          children.push(new _docx.Paragraph({
            children: [new _docx.ImageRun({
              data: imgData,
              transformation: { width: 500, height: 700 },
              type: 'png',
            })],
            alignment: _docx.AlignmentType.CENTER,
          }));
        }
      }

      // Build section properties with actual page dimensions
      const sectionProperties = {
        page: {
          size: { width: pgWidth, height: pgHeight },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      };

      // Section-level columns for multi-column content
      if (content.columnInfo && content.columnInfo.count >= 2) {
        sectionProperties.column = {
          count: content.columnInfo.count,
          space: 720, // 0.5 inch gutter
          separate: true,
        };
      }

      // Store section properties for this page
      // (used below when building the section object)
      children._sectionProperties = sectionProperties;
    }

    // Empty page fallback
    if (!children.length) {
      children.push(new _docx.Paragraph({ text: '' }));
    }

    const sectionProperties = children._sectionProperties || {
      page: {
        size: { width: 11906, height: 16838 },  // A4 default
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    };

    sections.push({
      properties: sectionProperties,
      headers: includeHeader ? {
        default: new _docx.Header({
          children: [new _docx.Paragraph({
            children: [new _docx.TextRun({ text: title || 'NovaReader', font: 'Arial', size: 16, color: '999999' })],
            alignment: _docx.AlignmentType.RIGHT,
          })],
        }),
      } : undefined,
      footers: includeFooter ? {
        default: new _docx.Footer({
          children: [new _docx.Paragraph({
            children: [
              new _docx.TextRun({ text: 'Стр. ', font: 'Arial', size: 16, color: '999999' }),
              new _docx.TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' }),
              new _docx.TextRun({ text: ' из ', font: 'Arial', size: 16, color: '999999' }),
              new _docx.TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: '999999' }),
            ],
            alignment: _docx.AlignmentType.CENTER,
          })],
        }),
      } : undefined,
      children,
    });
  }

  const doc = new _docx.Document({
    title: title || 'NovaReader Export',
    creator: 'NovaReader',
    description: `Converted from PDF: ${title || 'unknown'}`,
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24 },
          paragraph: { spacing: { line: 276 } },
        },
      },
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', run: { font: 'Arial', size: 24 } },
        { id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 48, font: 'Arial' },
          paragraph: { spacing: { before: 480, after: 240 } } },
        { id: 'Heading2', name: 'heading 2', basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 36, font: 'Arial' },
          paragraph: { spacing: { before: 360, after: 160 } } },
        { id: 'Heading3', name: 'heading 3', basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 28, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 120 } } },
      ],
      characterStyles: [
        { id: 'Hyperlink', name: 'Hyperlink', run: { color: '0563C1', underline: { type: 'single' } } },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            { level: 0, format: 'bullet', text: '\u2022', alignment: _docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: 'bullet', text: '\u25CB', alignment: _docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: 'bullet', text: '\u25AA', alignment: _docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
        {
          reference: 'numbered-list',
          levels: [
            { level: 0, format: 'decimal', text: '%1.', alignment: _docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: 'lowerLetter', text: '%2)', alignment: _docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: 'lowerRoman', text: '%3.', alignment: _docx.AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections,
  });

  return await Packer.toBlob(doc);
}

function buildDocxTable(block) {
  const { rows, maxCols } = block;
  const colWidth = Math.floor(9000 / maxCols);

  const tableRows = rows.map((row, rowIdx) => {
    const cells = [];
    for (let c = 0; c < maxCols; c++) {
      const cellData = row.cells ? row.cells[c] : null;
      const cellText = cellData?.text || (typeof row === 'object' && !row.cells ? (row[c] || '') : '');
      const cellRuns = cellData?.runs;

      const children = cellRuns && cellRuns.length
        ? cellRuns.map(r => makeTextRun(r, { minSize: 8, maxSize: 28 }))
        : [new _docx.TextRun({ text: cellText || '', font: 'Arial', size: 20, bold: rowIdx === 0 })];

      cells.push(new _docx.TableCell({
        children: [new _docx.Paragraph({ children })],
        width: { size: colWidth, type: WidthType.DXA },
        shading: rowIdx === 0 ? { type: ShadingType.CLEAR, fill: 'E8E8E8' } : undefined,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
        },
      }));
    }
    return new _docx.TableRow({ children: cells });
  });

  return new _docx.Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

// ─── Build blocks from OCR word-level data ──────────────────────────────────
// Used when PDF has no native text (scanned documents). Applies post-correction
// and detects basic structure from word positions.

// Heading patterns for OCR text
const OCR_HEADING_PATTERNS = [
  /^(глава|chapter|teil|chapitre|capítulo)\s+\d/i,
  /^(раздел|section|abschnitt)\s+\d/i,
  /^(часть|part|partie|parte)\s+[IVXivx\d]/i,
  /^\d+\.\s+[А-ЯA-Z]/,
  /^\d+\.\d+\s+[А-ЯA-Z]/,
  /^(введение|заключение|приложение|содержание|оглавление|предисловие)/i,
  /^(introduction|conclusion|appendix|abstract|summary|preface|foreword|bibliography|references)/i,
];

// List patterns including dashes/en-dashes/em-dashes
const OCR_BULLET_RE = /^([\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣\-–—]\s)/;
const OCR_NUM_RE = /^(\d{1,3}[.)]\s)/;
const OCR_ALPHA_RE = /^([a-zA-Zа-яА-Я][.)]\s(?=[A-ZА-Я]))/;

function _isAllCapsText(text) {
  const letters = text.replace(/[^а-яА-Яa-zA-ZÀ-ÿ]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
}

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
  const sortedHeights = [...allHeights].sort((a, b) => a - b);
  const medianH = sortedHeights[Math.floor(sortedHeights.length / 2)] || 12;
  const leftPositions = lines.map(l => Math.min(...l.map(w => w.bbox.x0)));
  const leftMargin = Math.min(...leftPositions);

  // Build blocks with structure detection
  const blocks = [];
  let prevBottom = 0;
  let tableCandidate = [];

  for (const lineWords of lines) {
    // Join words with smart spacing — detect large gaps as tab stops
    const sortedWords = [...lineWords].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    let lineText = '';
    let hasLargeGap = false;
    for (let i = 0; i < sortedWords.length; i++) {
      if (i > 0) {
        const gap = sortedWords[i].bbox.x0 - sortedWords[i - 1].bbox.x1;
        const avgWordH = (Math.abs(sortedWords[i].bbox.y1 - sortedWords[i].bbox.y0) +
                          Math.abs(sortedWords[i - 1].bbox.y1 - sortedWords[i - 1].bbox.y0)) / 2;
        if (gap > avgWordH * 2) {
          hasLargeGap = true;
          lineText += '\t';
        } else if (gap > avgWordH * 0.8) {
          lineText += '  ';
        } else {
          lineText += ' ';
        }
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

    // Detect font info from word-level data when available
    const wordFontName = lineWords[0].fontName || lineWords[0].font || '';
    const isBoldLine = /bold|black|heavy/i.test(wordFontName) ||
      lineWords.every(w => /bold|black|heavy/i.test(w.fontName || w.font || ''));
    const isItalicLine = /italic|oblique/i.test(wordFontName) ||
      lineWords.every(w => /italic|oblique/i.test(w.fontName || w.font || ''));

    // Build runs with per-word font detection
    const buildLineRuns = () => {
      const runs = [];
      let currentRun = {
        text: sortedWords[0].text,
        bold: /bold|black|heavy/i.test(sortedWords[0].fontName || sortedWords[0].font || '') || isBoldLine,
        italic: /italic|oblique/i.test(sortedWords[0].fontName || sortedWords[0].font || '') || isItalicLine,
        fontFamily: 'Arial',
        fontSize: avgH,
      };
      for (let wi = 1; wi < sortedWords.length; wi++) {
        const w = sortedWords[wi];
        const wBold = /bold|black|heavy/i.test(w.fontName || w.font || '') || isBoldLine;
        const wItalic = /italic|oblique/i.test(w.fontName || w.font || '') || isItalicLine;
        if (wBold === currentRun.bold && wItalic === currentRun.italic) {
          currentRun.text += ' ' + w.text;
        } else {
          runs.push(currentRun);
          currentRun = { text: w.text, bold: wBold, italic: wItalic, fontFamily: 'Arial', fontSize: avgH };
        }
      }
      runs.push(currentRun);
      return runs;
    };

    // Flush table on large gap or non-table line
    if (tableCandidate.length && gap > avgH * 1.5) {
      if (tableCandidate.length >= 2) {
        const maxCols = Math.max(...tableCandidate.map(r => r.cells.length));
        blocks.push({
          type: 'table',
          rows: tableCandidate.map(r => ({
            cells: Array.from({ length: maxCols }, (_, c) => r.cells[c] || { text: '', runs: [] }),
          })),
          maxCols,
        });
      } else {
        for (const tc of tableCandidate) {
          blocks.push({
            type: 'paragraph', text: tc.text,
            runs: [{ text: tc.text, bold: false, italic: false, fontFamily: 'Arial', fontSize: avgH }],
            indent: 0, paragraphBreak: false, fontSize: avgH, alignment: _docx.AlignmentType.LEFT,
          });
        }
      }
      tableCandidate = [];
    }

    // Table detection: multiple distinct x-position clusters with large gaps
    if (hasLargeGap && sortedWords.length >= 2) {
      const cells = lineText.split(/\t/).map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        tableCandidate.push({
          cells: cells.map(c => ({ text: c, runs: [{ text: c, bold: false, italic: false, fontFamily: 'Arial', fontSize: avgH }] })),
          text: lineText,
        });
        prevBottom = lineBottom;
        continue;
      }
    }

    // Flush any pending table
    if (tableCandidate.length) {
      if (tableCandidate.length >= 2) {
        const maxCols = Math.max(...tableCandidate.map(r => r.cells.length));
        blocks.push({
          type: 'table',
          rows: tableCandidate.map(r => ({
            cells: Array.from({ length: maxCols }, (_, c) => r.cells[c] || { text: '', runs: [] }),
          })),
          maxCols,
        });
      } else {
        for (const tc of tableCandidate) {
          blocks.push({
            type: 'paragraph', text: tc.text,
            runs: [{ text: tc.text, bold: false, italic: false, fontFamily: 'Arial', fontSize: avgH }],
            indent: 0, paragraphBreak: false, fontSize: avgH, alignment: _docx.AlignmentType.LEFT,
          });
        }
      }
      tableCandidate = [];
    }

    // Detect heading by size, semantic patterns, bold + short, or ALL CAPS
    const sizeRatio = avgH / medianH;
    const isShort = lineText.length < 80;
    const isSemantic = OCR_HEADING_PATTERNS.some(p => p.test(lineText));
    const isCaps = _isAllCapsText(lineText) && isShort && lineText.length > 2;

    if ((sizeRatio > 1.4 && isShort) || (isSemantic && isShort) || (isCaps && isBoldLine && isShort)) {
      let level;
      if (sizeRatio > 1.8) level = _docx.HeadingLevel.HEADING_1;
      else if (sizeRatio > 1.4 || isSemantic) level = HeadingLevel.HEADING_2;
      else level = HeadingLevel.HEADING_3;

      blocks.push({
        type: 'heading',
        level,
        text: lineText,
        runs: buildLineRuns(),
        alignment: _docx.AlignmentType.LEFT,
      });
    } else {
      // Check for list (extended patterns: dashes, en-dashes, em-dashes)
      const bulletMatch = OCR_BULLET_RE.test(lineText);
      const numMatch = OCR_NUM_RE.test(lineText);
      const alphaMatch = OCR_ALPHA_RE.test(lineText);
      const isList = (bulletMatch || numMatch || alphaMatch) && (indent > 0 || bulletMatch || numMatch);

      if (isList) {
        const cleanText = lineText
          .replace(OCR_BULLET_RE, '')
          .replace(OCR_NUM_RE, '')
          .replace(OCR_ALPHA_RE, '')
          .trim();
        blocks.push({
          type: 'list',
          text: cleanText,
          bullet: !numMatch,
          level: Math.min(indent, 3),
          runs: buildLineRuns(),
        });
      } else {
        const isParagraphBreak = gap > avgH * 1.2;

        // Try to merge with previous paragraph if continuation
        const prev = blocks.length > 0 ? blocks[blocks.length - 1] : null;
        if (prev && prev.type === 'paragraph' && !isParagraphBreak &&
            prev.indent === indent && Math.abs((prev.fontSize || medianH) - avgH) < medianH * 0.2) {
          prev.text += ' ' + lineText;
          // Append new runs rather than concatenating text in last run
          const newRuns = buildLineRuns();
          prev.runs.push(...newRuns);
        } else {
          blocks.push({
            type: 'paragraph',
            text: lineText,
            runs: buildLineRuns(),
            indent,
            paragraphBreak: isParagraphBreak,
            fontSize: avgH,
            alignment: _docx.AlignmentType.LEFT,
          });
        }
      }
    }
    prevBottom = lineBottom;
  }

  // Flush remaining table candidates
  if (tableCandidate.length >= 2) {
    const maxCols = Math.max(...tableCandidate.map(r => r.cells.length));
    blocks.push({
      type: 'table',
      rows: tableCandidate.map(r => ({
        cells: Array.from({ length: maxCols }, (_, c) => r.cells[c] || { text: '', runs: [] }),
      })),
      maxCols,
    });
  } else if (tableCandidate.length === 1) {
    const tc = tableCandidate[0];
    blocks.push({
      type: 'paragraph', text: tc.text,
      runs: [{ text: tc.text, bold: false, italic: false, fontFamily: 'Arial', fontSize: medianH }],
      indent: 0, paragraphBreak: false, fontSize: medianH, alignment: _docx.AlignmentType.LEFT,
    });
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
