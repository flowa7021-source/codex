// ─── Layout Analysis ────────────────────────────────────────────────────────
// Zone detection, reading order analysis, table structure recognition.

/**
 * @typedef {object} Zone
 * @property {string} type - 'text' | 'image' | 'table' | 'header' | 'footer' | 'sidebar'
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} order - Reading order index
 * @property {TextItem[]} [items] - Text items in this zone
 */

/**
 * Analyze page layout and detect zones.
 * @param {TextItem[]} items - Text items from PDF.js
 * @param {object} pageInfo - { width, height }
 * @returns {Zone[]}
 */
export function analyzeLayout(items, pageInfo) {
  if (!items || items.length === 0) return [];

  const { width: pageWidth, height: pageHeight } = pageInfo;
  const zones = [];

  // 1. Detect header/footer zones
  const headerItems = items.filter(i => i.y > pageHeight * 0.92);
  const footerItems = items.filter(i => i.y < pageHeight * 0.08);
  const bodyItems = items.filter(i => i.y >= pageHeight * 0.08 && i.y <= pageHeight * 0.92);

  if (headerItems.length > 0) {
    zones.push(createZone('header', headerItems, pageWidth));
  }
  if (footerItems.length > 0) {
    zones.push(createZone('footer', footerItems, pageWidth));
  }

  // 2. Detect columns in body
  const columns = detectColumns(bodyItems, pageWidth);

  // 3. Within each column, detect text blocks and tables
  for (const column of columns) {
    const blocks = segmentIntoBlocks(column.items);
    for (const block of blocks) {
      const type = classifyBlock(block, pageWidth);
      zones.push({
        type,
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        items: block.items,
        order: 0,
      });
    }
  }

  // 4. Assign reading order
  assignReadingOrder(zones, columns.length);

  return zones;
}

/**
 * Detect table structure from text items.
 * @param {TextItem[]} items
 * @param {object} [options]
 * @param {number} [options.minRows=2]
 * @param {number} [options.minCols=2]
 * @returns {{rows: string[][], bounds: {x: number, y: number, width: number, height: number}} | null}
 */
export function detectTable(items, options = {}) {
  const { minRows = 2, minCols = 2 } = options;
  if (!items || items.length < minRows * minCols) return null;

  // Group by Y coordinate (rows)
  const rowGroups = groupByY(items, 3);
  if (rowGroups.length < minRows) return null;

  // Find consistent column positions
  const colPositions = findColumnPositions(rowGroups);
  if (colPositions.length < minCols) return null;

  // Build table grid
  const rows = [];
  for (const row of rowGroups) {
    const cells = new Array(colPositions.length).fill('');
    for (const item of row) {
      const colIdx = findClosestColumn(item.x, colPositions);
      cells[colIdx] = (cells[colIdx] ? cells[colIdx] + ' ' : '') + item.str;
    }
    rows.push(cells.map(c => c.trim()));
  }

  // Verify it looks like a table (consistent column count, not just paragraphs)
  const nonEmptyColCounts = rows.map(r => r.filter(c => c !== '').length);
  const avgCols = nonEmptyColCounts.reduce((a, b) => a + b, 0) / nonEmptyColCounts.length;
  if (avgCols < minCols) return null;

  const bounds = {
    x: Math.min(...items.map(i => i.x)),
    y: Math.min(...items.map(i => i.y)),
    width: Math.max(...items.map(i => i.x + (i.width || 0))) - Math.min(...items.map(i => i.x)),
    height: Math.max(...items.map(i => i.y + (i.height || 0))) - Math.min(...items.map(i => i.y)),
  };

  return { rows, bounds };
}

/**
 * Determine reading order for a set of zones.
 * Western reading order: top-to-bottom, left-to-right within columns.
 * @param {Zone[]} zones
 * @returns {Zone[]} Sorted by reading order
 */
export function sortByReadingOrder(zones) {
  return [...zones].sort((a, b) => {
    // Headers first, footers last
    if (a.type === 'header' && b.type !== 'header') return -1;
    if (a.type !== 'header' && b.type === 'header') return 1;
    if (a.type === 'footer' && b.type !== 'footer') return 1;
    if (a.type !== 'footer' && b.type === 'footer') return -1;

    // Sort by reading order index
    return a.order - b.order;
  });
}

/**
 * Convert table data to HTML table string.
 * @param {string[][]} rows
 * @param {boolean} [hasHeader=true] - Treat first row as header
 * @returns {string}
 */
export function tableToHtml(rows, hasHeader = true) {
  if (!rows || rows.length === 0) return '';

  let html = '<table>\n';
  for (let i = 0; i < rows.length; i++) {
    const tag = hasHeader && i === 0 ? 'th' : 'td';
    const rowTag = hasHeader && i === 0 ? 'thead' : (i === 1 && hasHeader ? 'tbody' : '');

    if (rowTag === 'thead') html += '<thead>\n';
    if (rowTag === 'tbody') html += '<tbody>\n';

    html += '  <tr>';
    for (const cell of rows[i]) {
      html += `<${tag}>${escHtml(cell)}</${tag}>`;
    }
    html += '</tr>\n';

    if (hasHeader && i === 0) html += '</thead>\n';
  }
  if (hasHeader && rows.length > 1) html += '</tbody>\n';
  html += '</table>';
  return html;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function createZone(type, items, pageWidth) {
  const xs = items.map(i => i.x);
  const ys = items.map(i => i.y);
  return {
    type,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs.map((x, idx) => x + (items[idx].width || 0))) - Math.min(...xs),
    height: Math.max(...ys.map((y, idx) => y + (items[idx].height || 0))) - Math.min(...ys),
    items,
    order: 0,
  };
}

function detectColumns(items, pageWidth) {
  if (items.length === 0) return [{ items, startX: 0 }];

  const xStarts = items.map(i => i.x);
  const sorted = [...new Set(xStarts.map(x => Math.round(x / 10) * 10))].sort((a, b) => a - b);

  // Look for gap > 15% of page width
  const minGap = pageWidth * 0.15;
  let splitX = null;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > minGap) {
      splitX = (sorted[i - 1] + sorted[i]) / 2;
      break;
    }
  }

  if (!splitX) return [{ items, startX: 0 }];

  return [
    { items: items.filter(i => i.x < splitX), startX: 0 },
    { items: items.filter(i => i.x >= splitX), startX: splitX },
  ];
}

function segmentIntoBlocks(items) {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y);
  const blocks = [];
  let currentBlock = { items: [sorted[0]] };

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = prev.y - curr.y;
    const lineHeight = (prev.height || prev.fontSize || 12) * 2;

    if (gap > lineHeight) {
      blocks.push(finalizeBlock(currentBlock));
      currentBlock = { items: [curr] };
    } else {
      currentBlock.items.push(curr);
    }
  }
  blocks.push(finalizeBlock(currentBlock));

  return blocks;
}

function finalizeBlock(block) {
  const items = block.items;
  const xs = items.map(i => i.x);
  const ys = items.map(i => i.y);
  return {
    items,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs.map((x, idx) => x + (items[idx].width || 0))) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys) + (items[0].height || items[0].fontSize || 12),
  };
}

function classifyBlock(block, pageWidth) {
  const items = block.items;
  if (items.length === 0) return 'text';

  // Check if it looks like a table (multiple items on same Y with consistent X positions)
  const yGroups = groupByY(items, 3);
  if (yGroups.length >= 2) {
    const colCounts = yGroups.map(g => new Set(g.map(i => Math.round(i.x / 20))).size);
    const avgCols = colCounts.reduce((a, b) => a + b, 0) / colCounts.length;
    if (avgCols >= 2 && colCounts.every(c => Math.abs(c - avgCols) <= 1)) {
      return 'table';
    }
  }

  // Check for sidebar (narrow column at edge)
  if (block.width < pageWidth * 0.25 && (block.x < pageWidth * 0.15 || block.x > pageWidth * 0.75)) {
    return 'sidebar';
  }

  return 'text';
}

function groupByY(items, threshold) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const groups = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - current[0].y) <= threshold) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function findColumnPositions(rowGroups) {
  const xCounts = new Map();
  for (const row of rowGroups) {
    for (const item of row) {
      const rounded = Math.round(item.x / 5) * 5;
      xCounts.set(rounded, (xCounts.get(rounded) || 0) + 1);
    }
  }
  // Keep positions that appear in at least half the rows
  const minCount = Math.ceil(rowGroups.length / 2);
  const positions = [...xCounts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([x]) => x)
    .sort((a, b) => a - b);

  // Merge close positions
  const merged = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - merged[merged.length - 1] > 20) {
      merged.push(positions[i]);
    }
  }
  return merged;
}

function findClosestColumn(x, positions) {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < positions.length; i++) {
    const dist = Math.abs(x - positions[i]);
    if (dist < minDist) {
      minDist = dist;
      idx = i;
    }
  }
  return idx;
}

function assignReadingOrder(zones, columnCount) {
  // Western reading order: top-to-bottom, left-to-right for columns
  const body = zones.filter(z => z.type !== 'header' && z.type !== 'footer');
  body.sort((a, b) => {
    if (columnCount > 1) {
      // Multi-column: left column first
      const colA = a.x < zones[0]?.width / 2 ? 0 : 1;
      const colB = b.x < zones[0]?.width / 2 ? 0 : 1;
      if (colA !== colB) return colA - colB;
    }
    return b.y - a.y; // top to bottom (PDF Y is inverted)
  });

  let order = 1;
  for (const z of zones) {
    if (z.type === 'header') z.order = 0;
    else if (z.type === 'footer') z.order = 999;
  }
  for (const z of body) {
    z.order = order++;
  }
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
