// ─── PDF→DOCX Converter using 'docx' library ─────────────────────────────────
// Replaces the hand-built OOXML generator with a proper DOCX creation library
// that supports styles, fonts, tables, images, headers, footers, lists.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  Header, Footer, PageNumber, NumberFormat, TabStopPosition, TabStopType,
  ShadingType, convertInchesToTwip,
} from 'docx';

// ─── Font mapping: PDF standard fonts → Word fonts ──────────────────────────
const FONT_MAP = {
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'Times-BoldItalic': 'Times New Roman',
  'Times-Italic': 'Times New Roman',
  'TimesNewRomanPSMT': 'Times New Roman',
  'TimesNewRomanPS-BoldMT': 'Times New Roman',
  'TimesNewRomanPS-ItalicMT': 'Times New Roman',
  'TimesNewRomanPS-BoldItalicMT': 'Times New Roman',
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Helvetica-Oblique': 'Arial',
  'Helvetica-BoldOblique': 'Arial',
  'ArialMT': 'Arial',
  'Arial-BoldMT': 'Arial',
  'Courier': 'Courier New',
  'Courier-Bold': 'Courier New',
  'Courier-Oblique': 'Courier New',
  'CourierNewPSMT': 'Courier New',
  'Symbol': 'Symbol',
  'ZapfDingbats': 'Wingdings',
};

function mapPdfFont(pdfFontName) {
  if (!pdfFontName) return 'Arial';
  // Direct match
  if (FONT_MAP[pdfFontName]) return FONT_MAP[pdfFontName];
  // Try without suffix
  const base = pdfFontName.replace(/[-,].*/, '');
  if (FONT_MAP[base]) return FONT_MAP[base];
  // Common patterns
  if (/times/i.test(pdfFontName)) return 'Times New Roman';
  if (/arial|helvetica/i.test(pdfFontName)) return 'Arial';
  if (/courier/i.test(pdfFontName)) return 'Courier New';
  if (/georgia/i.test(pdfFontName)) return 'Georgia';
  if (/verdana/i.test(pdfFontName)) return 'Verdana';
  if (/calibri/i.test(pdfFontName)) return 'Calibri';
  if (/cambria/i.test(pdfFontName)) return 'Cambria';
  return 'Arial';
}

function isBoldFont(fontName) {
  return /bold|black|heavy|demi/i.test(fontName || '');
}

function isItalicFont(fontName) {
  return /italic|oblique|slant/i.test(fontName || '');
}

// ─── Extract structured text content from PDF page via PDF.js ───────────────
export async function extractStructuredContent(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent({ includeMarkedContent: false });
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  // Transform items: PDF.js gives transform[4]=x, transform[5]=y (from bottom)
  // Convert to top-down Y coordinates
  const items = textContent.items
    .filter(item => item.str && item.str.trim())
    .map(item => {
      const tx = item.transform;
      const fontSize = Math.abs(tx[0]) || Math.abs(tx[3]) || 12;
      const x = tx[4];
      const y = pageHeight - tx[5]; // flip Y
      return {
        text: item.str,
        x, y,
        width: item.width || 0,
        height: item.height || fontSize,
        fontSize,
        fontName: item.fontName || '',
      };
    })
    .sort((a, b) => {
      const dy = a.y - b.y;
      return Math.abs(dy) < 3 ? a.x - b.x : dy;
    });

  if (!items.length) return { blocks: [], pageWidth, pageHeight };

  // Group into lines (items with similar Y)
  const lines = [];
  let currentLine = [items[0]];
  let currentY = items[0].y;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const threshold = Math.max(3, currentLine[0].fontSize * 0.4);
    if (Math.abs(item.y - currentY) <= threshold) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // Compute stats
  const allFontSizes = items.map(i => i.fontSize);
  const avgFontSize = allFontSizes.reduce((a, b) => a + b, 0) / allFontSizes.length;
  const leftMargin = Math.min(...items.map(i => i.x));

  // Convert lines into blocks (paragraphs, headings, table candidates, lists)
  const blocks = [];
  let tableCandidate = [];
  let prevLineBottom = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineTop = Math.min(...line.map(i => i.y));
    const lineBottom = Math.max(...line.map(i => i.y + i.height));
    const lineAvgFontSize = line.reduce((s, i) => s + i.fontSize, 0) / line.length;
    const gap = lineTop - prevLineBottom;

    // Flush table if gap is large
    if (tableCandidate.length && gap > lineAvgFontSize * 1.5) {
      if (tableCandidate.length >= 2) {
        blocks.push(buildTableBlock(tableCandidate, pageWidth));
      } else {
        tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc, avgFontSize, leftMargin)));
      }
      tableCandidate = [];
    }

    // Build line text and runs
    const lineText = line.map(i => i.text).join(' ').trim();
    if (!lineText) { prevLineBottom = lineBottom; continue; }

    // Check if line looks like a table row (multiple tab-separated or spaced columns)
    const xPositions = line.map(i => i.x);
    const hasMultipleColumns = xPositions.length >= 2 &&
      (Math.max(...xPositions) - Math.min(...xPositions)) > pageWidth * 0.3;
    const tabSeparated = lineText.includes('\t') ||
      line.some((item, idx) => idx > 0 && item.x - (line[idx-1].x + line[idx-1].width) > avgFontSize * 3);

    if (hasMultipleColumns || tabSeparated) {
      // Cluster items into columns by X-position gaps
      const columnItems = clusterByXGap(line, avgFontSize * 2);
      if (columnItems.length >= 2) {
        tableCandidate.push({ columns: columnItems, line });
        prevLineBottom = lineBottom;
        continue;
      }
    }

    // Flush pending table
    if (tableCandidate.length) {
      if (tableCandidate.length >= 2) {
        blocks.push(buildTableBlock(tableCandidate, pageWidth));
      } else {
        tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc.line, avgFontSize, leftMargin)));
      }
      tableCandidate = [];
    }

    // Detect list items
    const listMatch = lineText.match(/^(\s*)([\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣–—-]|\d+[.)]\s|[a-zA-Zа-яА-Я][.)]\s)/);
    if (listMatch) {
      const indent = Math.max(0, Math.round((line[0].x - leftMargin) / avgFontSize));
      blocks.push({
        type: 'list',
        text: lineText.replace(/^[\s\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣–—-]+/, '').replace(/^\d+[.)]\s/, '').replace(/^[a-zA-Zа-яА-Я][.)]\s/, '').trim(),
        bullet: !!listMatch[2].match(/[^\d\w]/),
        level: indent,
        runs: buildRuns(line),
      });
      prevLineBottom = lineBottom;
      continue;
    }

    // Detect heading
    const isHeading = lineAvgFontSize > avgFontSize * 1.25;
    const headingLevel = lineAvgFontSize > avgFontSize * 1.8 ? HeadingLevel.HEADING_1
      : lineAvgFontSize > avgFontSize * 1.4 ? HeadingLevel.HEADING_2
      : isHeading ? HeadingLevel.HEADING_3 : null;

    if (headingLevel) {
      blocks.push({
        type: 'heading',
        level: headingLevel,
        text: lineText,
        runs: buildRuns(line),
      });
    } else {
      // Regular paragraph
      const isParagraphBreak = gap > lineAvgFontSize * 1.3;
      const indent = Math.max(0, Math.round((line[0].x - leftMargin) / (avgFontSize * 2)));
      blocks.push({
        type: 'paragraph',
        text: lineText,
        runs: buildRuns(line),
        indent,
        paragraphBreak: isParagraphBreak,
        fontSize: lineAvgFontSize,
      });
    }
    prevLineBottom = lineBottom;
  }

  // Flush remaining table
  if (tableCandidate.length) {
    if (tableCandidate.length >= 2) {
      blocks.push(buildTableBlock(tableCandidate, pageWidth));
    } else {
      tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc.line, avgFontSize, leftMargin)));
    }
  }

  return { blocks, pageWidth, pageHeight };
}

function buildRuns(lineItems) {
  return lineItems.map(item => ({
    text: item.text,
    bold: isBoldFont(item.fontName),
    italic: isItalicFont(item.fontName),
    fontFamily: mapPdfFont(item.fontName),
    fontSize: item.fontSize,
  }));
}

function buildParagraphBlock(line, avgFontSize, leftMargin) {
  const arr = Array.isArray(line) ? line : (line.line || [line]);
  const lineText = arr.map(i => i.text).join(' ').trim();
  return {
    type: 'paragraph',
    text: lineText,
    runs: buildRuns(arr),
    indent: 0,
    paragraphBreak: false,
    fontSize: avgFontSize,
  };
}

function clusterByXGap(items, gapThreshold) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.x - (prev.x + prev.width) > gapThreshold) {
      clusters.push([curr]);
    } else {
      clusters[clusters.length - 1].push(curr);
    }
  }
  return clusters.map(c => c.map(i => i.text).join(' ').trim());
}

function buildTableBlock(rows, pageWidth) {
  const maxCols = Math.max(...rows.map(r => r.columns.length));
  const tableRows = rows.map(r => {
    const cells = [];
    for (let c = 0; c < maxCols; c++) {
      cells.push(r.columns[c] || '');
    }
    return cells;
  });
  return { type: 'table', rows: tableRows, maxCols };
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
  } = options;

  const pagesToConvert = pageRange || Array.from({ length: pageCount }, (_, i) => i + 1);
  const sections = [];

  for (const pageNum of pagesToConvert) {
    const children = [];

    if (mode === 'images-only') {
      // Just page images
      if (capturePageImage) {
        const imgData = await capturePageImage(pageNum);
        if (imgData) {
          children.push(new Paragraph({
            children: [new ImageRun({
              data: imgData,
              transformation: { width: 595, height: 842 }, // A4 approx
              type: 'png',
            })],
          }));
        }
      }
    } else {
      // Extract structured text
      const content = await extractStructuredContent(pdfDoc, pageNum);

      // If no text found and we have OCR data, use that
      let blocks = content.blocks;
      if (!blocks.length && ocrWordCache && ocrWordCache.has(pageNum)) {
        const words = ocrWordCache.get(pageNum);
        if (words && words.length) {
          blocks = buildBlocksFromOcrWords(words);
        }
      }

      for (const block of blocks) {
        if (block.type === 'heading') {
          children.push(new Paragraph({
            heading: block.level,
            children: block.runs.map(run => new TextRun({
              text: run.text + ' ',
              bold: run.bold || true,
              italics: run.italic,
              font: run.fontFamily,
              size: Math.round(Math.min(48, Math.max(16, run.fontSize * 1.5)) * 2),
            })),
            spacing: { before: 240, after: 120 },
          }));
        } else if (block.type === 'paragraph') {
          const spacing = {};
          if (block.paragraphBreak) spacing.before = 120;

          children.push(new Paragraph({
            children: block.runs.map(run => new TextRun({
              text: run.text + ' ',
              bold: run.bold,
              italics: run.italic,
              font: run.fontFamily,
              size: Math.round(Math.min(28, Math.max(16, run.fontSize)) * 2),
            })),
            indent: block.indent > 0 ? { left: block.indent * 720 } : undefined,
            spacing,
          }));
        } else if (block.type === 'table') {
          children.push(buildDocxTable(block));
        } else if (block.type === 'list') {
          children.push(new Paragraph({
            children: block.runs ? block.runs.map(run => new TextRun({
              text: run.text + ' ',
              bold: run.bold,
              italics: run.italic,
              font: run.fontFamily,
            })) : [new TextRun(block.text)],
            bullet: { level: block.level || 0 },
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
    }));
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

// Build blocks from OCR word-level data when PDF native text is absent
function buildBlocksFromOcrWords(words) {
  if (!words || !words.length) return [];

  const sorted = [...words].filter(w => w.bbox).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    return Math.abs(dy) < 5 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  // Group into lines
  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].bbox.y0;

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    const threshold = Math.max(5, Math.abs(sorted[0].bbox.y1 - sorted[0].bbox.y0) * 0.5);
    if (Math.abs(w.bbox.y0 - currentY) <= threshold) {
      currentLine.push(w);
    } else {
      lines.push(currentLine);
      currentLine = [w];
      currentY = w.bbox.y0;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // Convert lines to paragraph blocks
  return lines.map(lineWords => ({
    type: 'paragraph',
    text: lineWords.map(w => w.text).join(' '),
    runs: [{ text: lineWords.map(w => w.text).join(' '), bold: false, italic: false, fontFamily: 'Arial', fontSize: 12 }],
    indent: 0,
    paragraphBreak: false,
    fontSize: 12,
  }));
}
