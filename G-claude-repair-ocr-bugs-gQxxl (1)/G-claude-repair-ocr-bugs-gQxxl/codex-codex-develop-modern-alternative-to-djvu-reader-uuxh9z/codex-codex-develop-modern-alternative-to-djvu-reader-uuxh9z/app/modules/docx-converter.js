// ─── PDF→DOCX Converter using 'docx' library ─────────────────────────────────
// Comprehensive PDF structure extraction with proper formatting preservation.
// Handles headings, paragraphs, lists, tables, multi-column layouts, inline
// formatting (bold/italic/font/size), paragraph spacing, and page breaks.

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
  'Arial-ItalicMT': 'Arial',
  'Arial-BoldItalicMT': 'Arial',
  'Courier': 'Courier New',
  'Courier-Bold': 'Courier New',
  'Courier-Oblique': 'Courier New',
  'Courier-BoldOblique': 'Courier New',
  'CourierNewPSMT': 'Courier New',
  'Symbol': 'Symbol',
  'ZapfDingbats': 'Wingdings',
  'Tahoma': 'Tahoma',
  'Trebuchet': 'Trebuchet MS',
  'TrebuchetMS': 'Trebuchet MS',
  'Garamond': 'Garamond',
  'BookAntiqua': 'Book Antiqua',
  'Palatino': 'Palatino Linotype',
  'PalatinLinotype': 'Palatino Linotype',
  'Century': 'Century',
  'CenturyGothic': 'Century Gothic',
  'LucidaSans': 'Lucida Sans',
  'ComicSansMS': 'Comic Sans MS',
  'Impact': 'Impact',
  'Consolas': 'Consolas',
};

function mapPdfFont(pdfFontName) {
  if (!pdfFontName) return 'Arial';
  if (FONT_MAP[pdfFontName]) return FONT_MAP[pdfFontName];
  // Strip suffix like -Bold, -Italic, ,Bold etc.
  const base = pdfFontName.replace(/[-,](Bold|Italic|Oblique|Regular|Roman|Light|Medium|Thin|Heavy|Black|Demi|Semi|Condensed|Narrow|Wide|BoldItalic|BoldOblique|MT|PS).*/i, '');
  if (FONT_MAP[base]) return FONT_MAP[base];
  // Common pattern matching
  const lower = pdfFontName.toLowerCase();
  if (/times|tnr/i.test(lower)) return 'Times New Roman';
  if (/arial|helvetica|helv/i.test(lower)) return 'Arial';
  if (/courier|mono|consola/i.test(lower)) return 'Courier New';
  if (/georgia/i.test(lower)) return 'Georgia';
  if (/verdana/i.test(lower)) return 'Verdana';
  if (/calibri/i.test(lower)) return 'Calibri';
  if (/cambria/i.test(lower)) return 'Cambria';
  if (/tahoma/i.test(lower)) return 'Tahoma';
  if (/trebuchet/i.test(lower)) return 'Trebuchet MS';
  if (/garamond/i.test(lower)) return 'Garamond';
  if (/palatino/i.test(lower)) return 'Palatino Linotype';
  if (/century/i.test(lower)) return 'Century';
  if (/lucida/i.test(lower)) return 'Lucida Sans';
  if (/segoe/i.test(lower)) return 'Segoe UI';
  return 'Arial';
}

function isBoldFont(fontName) {
  return /bold|black|heavy|demi(?!-?italic)/i.test(fontName || '');
}

function isItalicFont(fontName) {
  return /italic|oblique|slant/i.test(fontName || '');
}

function isMonospaceFont(fontName) {
  return /courier|mono|consola|fixed/i.test(fontName || '');
}

// ─── Text quality helpers ───────────────────────────────────────────────────

// Merge adjacent items on the same line that are very close (continuation of same word/phrase)
function mergeAdjacentItems(items, avgFontSize) {
  if (items.length <= 1) return items;
  const merged = [{ ...items[0] }];
  for (let i = 1; i < items.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = items[i];
    const gap = curr.x - (prev.x + prev.width);
    // If gap is smaller than a space width and same font, merge
    const spaceWidth = prev.fontSize * 0.25;
    if (gap >= 0 && gap < spaceWidth && prev.fontName === curr.fontName &&
        Math.abs(prev.fontSize - curr.fontSize) < 1) {
      prev.text += curr.text;
      prev.width = (curr.x + curr.width) - prev.x;
    } else if (gap >= 0 && gap < prev.fontSize * 0.6) {
      // Small gap — add space between
      prev.text += ' ' + curr.text;
      prev.width = (curr.x + curr.width) - prev.x;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

// Detect alignment from line items relative to page width
function detectAlignment(lineItems, pageWidth, leftMargin) {
  if (!lineItems.length || !pageWidth) return AlignmentType.LEFT;
  const lineLeft = Math.min(...lineItems.map(i => i.x));
  const lineRight = Math.max(...lineItems.map(i => i.x + i.width));
  const lineWidth = lineRight - lineLeft;
  const center = (lineLeft + lineRight) / 2;
  const pageCenter = pageWidth / 2;
  const rightMargin = pageWidth - lineRight;
  const leftIndent = lineLeft - leftMargin;

  // Centered: line center is near page center and both margins roughly equal
  if (Math.abs(center - pageCenter) < pageWidth * 0.05 &&
      Math.abs(leftIndent - rightMargin) < pageWidth * 0.1 &&
      lineWidth < pageWidth * 0.85) {
    return AlignmentType.CENTER;
  }
  // Right-aligned: big left margin, small right margin
  if (leftIndent > pageWidth * 0.4 && rightMargin < pageWidth * 0.15) {
    return AlignmentType.RIGHT;
  }
  return AlignmentType.LEFT;
}

// ─── Multi-column detection ─────────────────────────────────────────────────
// Detect if page has multi-column layout by analyzing X-position distribution
function detectColumns(lines, pageWidth) {
  if (lines.length < 6) return null; // Too few lines to determine

  // Collect all line start X positions
  const starts = lines.map(l => Math.min(...l.map(i => i.x)));
  const ends = lines.map(l => Math.max(...l.map(i => i.x + i.width)));

  // Find clusters of line start positions
  const sorted = [...starts].sort((a, b) => a - b);
  const clusters = [];
  let clusterStart = sorted[0];
  let clusterEnd = sorted[0];
  const clusterThreshold = pageWidth * 0.05;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - clusterEnd <= clusterThreshold) {
      clusterEnd = sorted[i];
    } else {
      clusters.push({ start: clusterStart, end: clusterEnd, count: 0 });
      clusterStart = sorted[i];
      clusterEnd = sorted[i];
    }
  }
  clusters.push({ start: clusterStart, end: clusterEnd, count: 0 });

  // Count lines in each cluster
  for (const x of starts) {
    for (const c of clusters) {
      if (x >= c.start - clusterThreshold && x <= c.end + clusterThreshold) {
        c.count++;
        break;
      }
    }
  }

  // Filter significant clusters (at least 15% of lines)
  const minCount = lines.length * 0.15;
  const significant = clusters.filter(c => c.count >= minCount);

  if (significant.length >= 2) {
    // Sort by position and check they don't overlap
    significant.sort((a, b) => a.start - b.start);
    const gap = significant[1].start - significant[0].end;
    if (gap > pageWidth * 0.05) {
      return {
        count: significant.length,
        boundaries: significant.map(c => ({
          left: c.start,
          center: (c.start + c.end) / 2,
        })),
        gutter: significant[0].end + gap / 2,
      };
    }
  }

  return null;
}

// Split lines into columns based on detected column boundaries
function splitLinesIntoColumns(lines, columnInfo) {
  const columns = Array.from({ length: columnInfo.count }, () => []);

  for (const line of lines) {
    const lineCenter = (Math.min(...line.map(i => i.x)) +
                        Math.max(...line.map(i => i.x + i.width))) / 2;

    // Full-width lines (spanning columns) go to column 0
    const lineLeft = Math.min(...line.map(i => i.x));
    const lineRight = Math.max(...line.map(i => i.x + i.width));
    if (lineRight - lineLeft > columnInfo.gutter * 1.5) {
      columns[0].push(line);
      continue;
    }

    // Assign to nearest column
    let bestCol = 0;
    let bestDist = Infinity;
    for (let c = 0; c < columnInfo.boundaries.length; c++) {
      const dist = Math.abs(lineCenter - columnInfo.boundaries[c].center);
      if (dist < bestDist) {
        bestDist = dist;
        bestCol = c;
      }
    }
    columns[bestCol].push(line);
  }

  return columns;
}

// ─── Heading detection with semantic patterns ───────────────────────────────
const HEADING_PATTERNS = [
  /^(глава|chapter|teil|chapitre|capítulo)\s+\d/i,
  /^(раздел|section|abschnitt)\s+\d/i,
  /^(часть|part|partie|parte)\s+[IVXivx\d]/i,
  /^\d+\.\s+[А-ЯA-Z]/,         // "1. Title"
  /^\d+\.\d+\s+[А-ЯA-Z]/,      // "1.1 SubTitle"
  /^(введение|заключение|приложение|содержание|оглавление|предисловие)/i,
  /^(introduction|conclusion|appendix|abstract|summary|preface|foreword|bibliography|references)/i,
  /^(table of contents|index|acknowledgements)/i,
];

function isSemanticHeading(text) {
  return HEADING_PATTERNS.some(p => p.test(text.trim()));
}

function isAllCaps(text) {
  const letters = text.replace(/[^а-яА-Яa-zA-ZÀ-ÿ]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
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
      // Font size from transform matrix (accounts for both scale and rotation)
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) || Math.abs(tx[3]) || 12;
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
      // Use font-size-aware threshold for same-line detection during sort
      const threshold = Math.max(2, Math.min(a.fontSize, b.fontSize) * 0.35);
      return Math.abs(dy) < threshold ? a.x - b.x : dy;
    });

  if (!items.length) return { blocks: [], pageWidth, pageHeight };

  // Group into lines (items with similar Y, using running average Y)
  const lines = [];
  let currentLine = [items[0]];
  let currentLineY = items[0].y;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    // Use the average font size of the current line for the threshold
    const lineAvgFs = currentLine.reduce((s, it) => s + it.fontSize, 0) / currentLine.length;
    const threshold = Math.max(3, lineAvgFs * 0.45);
    if (Math.abs(item.y - currentLineY) <= threshold) {
      currentLine.push(item);
      // Update running average Y
      currentLineY = currentLine.reduce((s, it) => s + it.y, 0) / currentLine.length;
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentLineY = item.y;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // Compute page-level stats using the median font size (more robust than mean)
  const allFontSizes = items.map(i => i.fontSize).sort((a, b) => a - b);
  const medianFontSize = allFontSizes[Math.floor(allFontSizes.length / 2)];
  const avgFontSize = allFontSizes.reduce((a, b) => a + b, 0) / allFontSizes.length;
  const bodyFontSize = medianFontSize; // Most text uses this size
  const leftMargin = Math.min(...items.map(i => i.x));

  // Detect multi-column layout
  const columnInfo = detectColumns(lines, pageWidth);

  // Process lines into blocks (possibly from multiple columns)
  let allBlocks;
  if (columnInfo && columnInfo.count >= 2) {
    const columns = splitLinesIntoColumns(lines, columnInfo);
    allBlocks = [];
    for (let ci = 0; ci < columns.length; ci++) {
      const colBlocks = processLinesToBlocks(columns[ci], bodyFontSize, avgFontSize, leftMargin, pageWidth);
      allBlocks.push(...colBlocks);
      // Add column separator between columns (except after last)
      if (ci < columns.length - 1 && colBlocks.length > 0) {
        allBlocks.push({ type: 'columnBreak' });
      }
    }
  } else {
    allBlocks = processLinesToBlocks(lines, bodyFontSize, avgFontSize, leftMargin, pageWidth);
  }

  return { blocks: allBlocks, pageWidth, pageHeight };
}

// Process a set of lines (from one column or the whole page) into blocks
function processLinesToBlocks(lines, bodyFontSize, avgFontSize, leftMargin, pageWidth) {
  const blocks = [];
  let tableCandidate = [];
  let prevLineBottom = 0;
  let consecutiveParagraphs = []; // For merging continuation paragraphs

  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li];
    const line = mergeAdjacentItems(rawLine, avgFontSize);
    const lineTop = Math.min(...line.map(i => i.y));
    const lineBottom = Math.max(...line.map(i => i.y + i.height));
    const lineAvgFontSize = line.reduce((s, i) => s + i.fontSize, 0) / line.length;
    const gap = li === 0 ? 0 : lineTop - prevLineBottom;

    // Flush table if gap is large
    if (tableCandidate.length && gap > lineAvgFontSize * 1.5) {
      flushTable(tableCandidate, blocks, avgFontSize, leftMargin);
      tableCandidate = [];
    }

    // Build line text
    const lineText = line.map(i => i.text).join(' ').trim();
    if (!lineText) { prevLineBottom = lineBottom; continue; }

    // Check if line looks like a table row
    const xPositions = line.map(i => i.x);
    const xSpan = Math.max(...xPositions) - Math.min(...xPositions);
    const hasMultipleColumns = line.length >= 2 && xSpan > pageWidth * 0.25;
    const hasLargeGap = line.some((item, idx) => idx > 0 &&
      item.x - (rawLine[idx-1].x + (rawLine[idx-1].width || 0)) > avgFontSize * 2.5);
    const tabSeparated = lineText.includes('\t');

    if ((hasMultipleColumns && hasLargeGap) || tabSeparated) {
      const columnItems = clusterByXGap(rawLine, avgFontSize * 2);
      if (columnItems.length >= 2) {
        // Flush pending paragraphs before table
        flushParagraphGroup(consecutiveParagraphs, blocks);
        consecutiveParagraphs = [];
        tableCandidate.push({ columns: columnItems, line: rawLine });
        prevLineBottom = lineBottom;
        continue;
      }
    }

    // Flush pending table
    if (tableCandidate.length) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      flushTable(tableCandidate, blocks, avgFontSize, leftMargin);
      tableCandidate = [];
    }

    // Detect list items (more precise: require indent or clear bullet/number prefix)
    const trimmedText = lineText.trimStart();
    const listMatch = trimmedText.match(
      /^([\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣]\s)|^(\d{1,3}[.)]\s)|^([a-zA-Zа-яА-Я][.)]\s(?=[A-ZА-Я]))/
    );
    const lineIndent = line[0].x - leftMargin;
    const isIndentedList = listMatch && lineIndent > avgFontSize * 0.5;
    const isClearList = listMatch && (trimmedText.match(/^[\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣]/) ||
      trimmedText.match(/^\d{1,3}[.)]\s/));

    if (isIndentedList || isClearList) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      const indent = Math.max(0, Math.round(lineIndent / avgFontSize));
      const cleanText = trimmedText
        .replace(/^[\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣]\s*/, '')
        .replace(/^\d{1,3}[.)]\s/, '')
        .replace(/^[a-zA-Zа-яА-Я][.)]\s/, '')
        .trim();
      blocks.push({
        type: 'list',
        text: cleanText,
        bullet: !trimmedText.match(/^\d/),
        level: Math.min(indent, 3),
        runs: buildRuns(line),
      });
      prevLineBottom = lineBottom;
      continue;
    }

    // Detect heading by font size, semantic patterns, or all-caps
    const sizeRatio = lineAvgFontSize / bodyFontSize;
    const isSemantic = isSemanticHeading(lineText);
    const isCaps = isAllCaps(lineText) && lineText.length > 2 && lineText.length < 80;
    const isBold = line.every(i => isBoldFont(i.fontName));
    const isShortLine = lineText.length < 100;

    let headingLevel = null;
    if (sizeRatio > 1.8 && isShortLine) headingLevel = HeadingLevel.HEADING_1;
    else if (sizeRatio > 1.4 && isShortLine) headingLevel = HeadingLevel.HEADING_2;
    else if (sizeRatio > 1.15 && isShortLine) headingLevel = HeadingLevel.HEADING_3;
    else if (isSemantic && isShortLine) headingLevel = HeadingLevel.HEADING_2;
    else if (isCaps && isBold && isShortLine) headingLevel = HeadingLevel.HEADING_3;

    if (headingLevel) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      blocks.push({
        type: 'heading',
        level: headingLevel,
        text: lineText,
        runs: buildRuns(line),
        alignment: detectAlignment(line, pageWidth, leftMargin),
      });
    } else {
      // Regular paragraph — collect for potential merging
      const isParagraphBreak = gap > lineAvgFontSize * 1.2;
      const indent = Math.max(0, Math.round(lineIndent / (avgFontSize * 2)));
      const alignment = detectAlignment(line, pageWidth, leftMargin);

      const para = {
        type: 'paragraph',
        text: lineText,
        runs: buildRuns(line),
        indent,
        paragraphBreak: isParagraphBreak,
        fontSize: lineAvgFontSize,
        alignment,
        lineBottom,
      };

      // Merge continuation lines into previous paragraph when:
      // - No paragraph break (small gap)
      // - Same indent level
      // - Same alignment
      // - Same approximate font size
      if (consecutiveParagraphs.length > 0 && !isParagraphBreak) {
        const prev = consecutiveParagraphs[consecutiveParagraphs.length - 1];
        const sameIndent = prev.indent === indent;
        const sameAlign = prev.alignment === alignment;
        const sameSize = Math.abs(prev.fontSize - lineAvgFontSize) < bodyFontSize * 0.15;
        if (sameIndent && sameAlign && sameSize) {
          // Merge into previous paragraph
          prev.text += ' ' + lineText;
          prev.runs.push(...buildRuns(line));
          prev.lineBottom = lineBottom;
          prevLineBottom = lineBottom;
          continue;
        }
      }

      consecutiveParagraphs.push(para);
    }
    prevLineBottom = lineBottom;
  }

  // Flush remaining
  flushParagraphGroup(consecutiveParagraphs, blocks);
  if (tableCandidate.length) {
    flushTable(tableCandidate, blocks, avgFontSize, leftMargin);
  }

  return blocks;
}

function flushParagraphGroup(paragraphs, blocks) {
  for (const p of paragraphs) {
    delete p.lineBottom;
    blocks.push(p);
  }
  paragraphs.length = 0;
}

function flushTable(tableCandidate, blocks, avgFontSize, leftMargin) {
  if (tableCandidate.length >= 2) {
    blocks.push(buildTableBlock(tableCandidate));
  } else {
    tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc.line, avgFontSize, leftMargin)));
  }
}

function buildRuns(lineItems) {
  // Merge adjacent items with same formatting into single runs
  const raw = lineItems.map(item => ({
    text: item.text,
    bold: isBoldFont(item.fontName),
    italic: isItalicFont(item.fontName),
    monospace: isMonospaceFont(item.fontName),
    fontFamily: mapPdfFont(item.fontName),
    fontSize: item.fontSize,
  }));

  if (raw.length <= 1) return raw;

  const merged = [{ ...raw[0] }];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = raw[i];
    if (prev.bold === curr.bold && prev.italic === curr.italic &&
        prev.fontFamily === curr.fontFamily &&
        Math.abs(prev.fontSize - curr.fontSize) < 0.5) {
      prev.text += ' ' + curr.text;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
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
    alignment: AlignmentType.LEFT,
  };
}

function clusterByXGap(items, gapThreshold) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.x - (prev.x + (prev.width || 0)) > gapThreshold) {
      clusters.push([curr]);
    } else {
      clusters[clusters.length - 1].push(curr);
    }
  }
  return clusters.map(c => c.map(i => i.text).join(' ').trim());
}

function buildTableBlock(rows) {
  const maxCols = Math.max(...rows.map(r => r.columns.length));
  // Estimate column widths from actual content positions
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
            children: block.runs.map(run => new TextRun({
              text: run.text + ' ',
              bold: true,
              italics: run.italic,
              font: run.fontFamily,
              // Heading sizes: use the actual font size from PDF, converted to half-points
              size: Math.round(Math.min(56, Math.max(20, run.fontSize)) * 2),
            })),
            spacing: { before: 240, after: 120 },
            alignment: block.alignment || AlignmentType.LEFT,
          }));
        } else if (block.type === 'paragraph') {
          const spacing = {};
          if (block.paragraphBreak) spacing.before = 120;
          spacing.after = 40;
          // Line spacing: 1.15x for readability
          spacing.line = Math.round(block.fontSize * 1.15 * 20);

          children.push(new Paragraph({
            children: block.runs.map(run => new TextRun({
              text: run.text + ' ',
              bold: run.bold,
              italics: run.italic,
              font: run.fontFamily,
              // Direct font size in half-points — no inflation
              size: Math.round(Math.min(36, Math.max(12, run.fontSize)) * 2),
            })),
            indent: block.indent > 0 ? { left: block.indent * 720 } : undefined,
            spacing,
            alignment: block.alignment || AlignmentType.LEFT,
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
              size: Math.round(Math.min(28, Math.max(12, run.fontSize || 12)) * 2),
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
