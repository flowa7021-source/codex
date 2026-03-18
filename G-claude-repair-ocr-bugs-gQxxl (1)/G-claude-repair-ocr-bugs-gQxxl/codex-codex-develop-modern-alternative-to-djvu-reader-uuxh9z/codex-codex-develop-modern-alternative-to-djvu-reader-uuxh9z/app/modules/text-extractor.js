// ─── Intelligent Text Extraction ────────────────────────────────────────────
// PDF→Plain Text with reading order, column detection, header/footer removal.

/**
 * @typedef {object} TextItem
 * @property {string} str
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} fontSize
 */

/**
 * Extract text from structured text items with intelligent reading order.
 * Groups items into lines, detects columns, sorts by reading order.
 *
 * @param {TextItem[]} items - Text items from PDF.js getTextContent()
 * @param {object} [options]
 * @param {number} [options.lineThreshold=3] - Y-distance to consider same line
 * @param {number} [options.columnGap=50] - Min gap to detect column break
 * @param {boolean} [options.removeHeaders=true]
 * @param {boolean} [options.removeFooters=true]
 * @param {number} [options.pageHeight=842] - Page height for header/footer detection
 * @returns {string}
 */
export function extractTextInReadingOrder(items, options = {}) {
  const {
    lineThreshold = 3,
    columnGap = 50,
    removeHeaders = true,
    removeFooters = true,
    pageHeight = 842,
  } = options;

  if (!items || items.length === 0) return '';

  // Filter headers and footers
  let filtered = items;
  if (removeHeaders || removeFooters) {
    const headerZone = pageHeight * 0.05;
    const footerZone = pageHeight * 0.95;
    filtered = items.filter(item => {
      if (removeHeaders && item.y > footerZone) return false;
      if (removeFooters && item.y < headerZone) return false;
      return true;
    });
  }

  // Group into lines by Y coordinate
  const lines = groupIntoLines(filtered, lineThreshold);

  // Detect columns
  const columns = detectColumns(lines, columnGap);

  if (columns.length <= 1) {
    // Single column: simple top-to-bottom
    return lines
      .sort((a, b) => b[0].y - a[0].y) // top to bottom (PDF Y is bottom-up)
      .map(line => lineToText(line))
      .join('\n');
  }

  // Multi-column: process each column top-to-bottom, left-to-right
  const result = [];
  for (const column of columns) {
    const colLines = column
      .sort((a, b) => b[0].y - a[0].y);
    for (const line of colLines) {
      result.push(lineToText(line));
    }
    result.push(''); // blank line between columns
  }

  return result.join('\n').trim();
}

/**
 * Group text items into lines based on Y proximity.
 */
function groupIntoLines(items, threshold) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let currentLine = [];
  let currentY = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= threshold) {
      currentLine.push(item);
      currentY = currentY ?? item.y;
    } else {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Sort items within each line left to right
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
  }

  return lines;
}

/**
 * Detect column layout from lines.
 * Returns array of column groups (each is an array of lines).
 */
function detectColumns(lines, minGap) {
  if (lines.length < 3) return [lines];

  // Collect all X start positions
  const xStarts = lines.map(line => line[0].x);
  const xEnds = lines.map(line => {
    const last = line[line.length - 1];
    return last.x + (last.width || 0);
  });

  // Find clusters of X positions
  const sortedStarts = [...new Set(xStarts)].sort((a, b) => a - b);

  // Look for significant gap in start positions
  const gaps = [];
  for (let i = 1; i < sortedStarts.length; i++) {
    const gap = sortedStarts[i] - sortedStarts[i - 1];
    if (gap > minGap) {
      gaps.push({ index: i, position: (sortedStarts[i - 1] + sortedStarts[i]) / 2, gap });
    }
  }

  if (gaps.length === 0) return [lines];

  // Split lines into columns based on largest gap
  gaps.sort((a, b) => b.gap - a.gap);
  const splitX = gaps[0].position;

  const leftColumn = lines.filter(line => line[0].x < splitX);
  const rightColumn = lines.filter(line => line[0].x >= splitX);

  const columns = [];
  if (leftColumn.length > 0) columns.push(leftColumn);
  if (rightColumn.length > 0) columns.push(rightColumn);

  return columns;
}

/**
 * Convert a line of text items to a string with appropriate spacing.
 */
function lineToText(line) {
  if (line.length === 0) return '';
  if (line.length === 1) return line[0].str;

  let text = '';
  for (let i = 0; i < line.length; i++) {
    const item = line[i];
    if (i > 0) {
      const prev = line[i - 1];
      const prevEnd = prev.x + (prev.width || 0);
      const gap = item.x - prevEnd;
      // Add space if significant gap
      if (gap > (item.fontSize || 12) * 0.3) {
        text += ' ';
      }
    }
    text += item.str;
  }
  return text;
}

/**
 * Extract text from multiple pages and combine.
 * @param {Array<{items: TextItem[], pageHeight: number}>} pages
 * @param {object} [options]
 * @param {boolean} [options.addPageBreaks=true]
 * @param {string} [options.pageBreakMarker='\n--- Page {n} ---\n']
 * @returns {string}
 */
export function extractMultiPageText(pages, options = {}) {
  const { addPageBreaks = true, pageBreakMarker = '\n--- Page {n} ---\n' } = options;
  const parts = [];

  for (let i = 0; i < pages.length; i++) {
    if (addPageBreaks && i > 0) {
      parts.push(pageBreakMarker.replace('{n}', String(i + 1)));
    }
    const pageText = extractTextInReadingOrder(pages[i].items, {
      pageHeight: pages[i].pageHeight,
    });
    parts.push(pageText);
  }

  return parts.join('\n');
}

/**
 * Download extracted text as a .txt file.
 * @param {string} text
 * @param {string} filename
 */
export function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
