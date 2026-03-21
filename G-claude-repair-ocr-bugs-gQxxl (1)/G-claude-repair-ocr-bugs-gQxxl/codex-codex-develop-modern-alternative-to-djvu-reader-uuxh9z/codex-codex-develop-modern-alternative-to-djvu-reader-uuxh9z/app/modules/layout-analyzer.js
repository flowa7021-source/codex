// ─── Layout Analyzer (Layer 2) ───────────────────────────────────────────────
// Takes ExtractedPage from Layer 1, produces LayoutPage with structured visual
// elements: lines, paragraphs, columns, tables, headers/footers.

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_COLUMN_GAP = 15;       // minimum gap between columns (pt)
const SUPERSCRIPT_Y_THRESHOLD = 0.6;
const SUPERSCRIPT_SIZE_THRESHOLD = 0.8;
const LINE_Y_TOLERANCE = 0.3;    // fraction of avgFontSize
const PARAGRAPH_GAP_FACTOR = 1.5; // gap > lineHeight * this → new paragraph
const INDENT_THRESHOLD = 10;     // pt — significant indent change
const INTERSECTION_TOLERANCE = 2; // pt — for table grid detection
const MIN_TABLE_ROWS = 2;
const MIN_TABLE_COLS = 2;
const TAB_STOP_TOLERANCE = 5;    // pt — for borderless table alignment matching

// ─── Bullet / Number patterns ────────────────────────────────────────────────

const BULLET_PATTERNS = [
  /^[•●○■□▪▸‣◦–—\-]\s/,
  /^[\u2022\u2023\u2043]\s/,
];

const NUMBER_PATTERNS = [
  /^(\d+)[.\)]\s/,
  /^([a-z])[.\)]\s/i,
  /^([ivxlcdm]+)[.\)]\s/i,
  /^(\d+\.\d+)[.\)]\s/,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function averageFontSize(runs) {
  if (!runs || !runs.length) return 12;
  return runs.reduce((s, r) => s + r.fontSize, 0) / runs.length;
}

function mode(values) {
  if (!values.length) return 0;
  const counts = new Map();
  for (const v of values) {
    const rounded = Math.round(v);
    counts.set(rounded, (counts.get(rounded) || 0) + 1);
  }
  let best = 0, bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}

function clusterValues(values, tolerance) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last[last.length - 1] <= tolerance) {
      last.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }
  return clusters.map(c => c.reduce((s, v) => s + v, 0) / c.length);
}

// ─── 1. Line Assembly ────────────────────────────────────────────────────────

function assembleLines(textRuns) {
  if (!textRuns || !textRuns.length) return [];

  // Sort by Y (top-to-bottom), then X (left-to-right)
  const sorted = [...textRuns].sort((a, b) => a.y - b.y || a.x - b.x);

  const lines = [];
  let currentLine = { runs: [sorted[0]], y: sorted[0].y };

  for (let i = 1; i < sorted.length; i++) {
    const run = sorted[i];
    const yDiff = Math.abs(run.y - currentLine.y);
    const avgFS = averageFontSize(currentLine.runs);

    const isSameLine = yDiff < avgFS * LINE_Y_TOLERANCE;
    const isSuperSub = yDiff < avgFS * SUPERSCRIPT_Y_THRESHOLD &&
                       run.fontSize < avgFS * SUPERSCRIPT_SIZE_THRESHOLD;

    if (isSameLine || isSuperSub) {
      currentLine.runs.push(run);
      if (isSuperSub && !isSameLine) {
        run._superSub = run.y < currentLine.y ? 'super' : 'sub';
        run.superscript = run._superSub === 'super';
        run.subscript = run._superSub === 'sub';
      }
      // Update line Y to weighted average
      currentLine.y = currentLine.runs.reduce((s, r) => s + r.y, 0) / currentLine.runs.length;
    } else {
      finalizeLine(currentLine);
      lines.push(currentLine);
      currentLine = { runs: [run], y: run.y };
    }
  }
  finalizeLine(currentLine);
  lines.push(currentLine);

  return lines;
}

function finalizeLine(line) {
  line.runs.sort((a, b) => a.x - b.x);
  if (!line.runs.length) return;
  line.left = line.runs[0].x;
  line.right = line.runs[line.runs.length - 1].x + (line.runs[line.runs.length - 1].width || 0);
  line.top = Math.min(...line.runs.map(r => r.y));
  line.bottom = Math.max(...line.runs.map(r => r.y + r.height));
  line.indent = line.left;
  line.fontSize = averageFontSize(line.runs);
}

// ─── 2. Margin Detection ─────────────────────────────────────────────────────

function detectMargins(lines, pageWidth, pageHeight) {
  if (!lines.length) {
    return { top: 72, bottom: 72, left: 72, right: 72 };
  }

  const leftValues = lines.map(l => l.left);
  const rightValues = lines.map(l => l.right);

  const leftMargin = Math.max(20, Math.min(200, mode(leftValues.map(v => Math.round(v)))));
  const rightMargin = Math.max(20, Math.min(200, pageWidth - mode(rightValues.map(v => Math.round(v)))));
  const topMargin = Math.max(20, Math.min(200, lines[0].top));
  const bottomMargin = Math.max(20, Math.min(200, pageHeight - lines[lines.length - 1].bottom));

  return { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin };
}

// ─── 3. Column Detection ─────────────────────────────────────────────────────

function detectColumns(textRuns, pageWidth, _pageHeight) {
  if (!textRuns || textRuns.length < 10) {
    return [{ left: 0, right: pageWidth, gap: 0 }];
  }

  // Build X-histogram (1pt bins)
  const binCount = Math.ceil(pageWidth);
  const bins = new Float32Array(binCount);

  for (const run of textRuns) {
    const startBin = Math.max(0, Math.floor(run.x));
    const endBin = Math.min(binCount - 1, Math.ceil(run.x + (run.width || 0)));
    for (let b = startBin; b <= endBin; b++) {
      bins[b]++;
    }
  }

  // Find empty vertical bands
  const threshold = textRuns.length * 0.02;
  const gaps = [];
  let gapStart = -1;

  for (let b = 0; b < binCount; b++) {
    if (bins[b] < threshold) {
      if (gapStart === -1) gapStart = b;
    } else {
      if (gapStart !== -1) {
        const gapWidth = b - gapStart;
        if (gapWidth >= MIN_COLUMN_GAP) {
          gaps.push({ left: gapStart, right: b, center: (gapStart + b) / 2, width: gapWidth });
        }
        gapStart = -1;
      }
    }
  }

  // Validate gaps
  const validGaps = gaps.filter(gap => {
    const leftCount = textRuns.filter(r => r.x + (r.width || 0) < gap.center).length;
    const rightCount = textRuns.filter(r => r.x > gap.center).length;
    return leftCount > textRuns.length * 0.15 && rightCount > textRuns.length * 0.15;
  });

  if (!validGaps.length) {
    return [{ left: 0, right: pageWidth, gap: 0 }];
  }

  // Build columns
  const columns = [];
  let prevRight = 0;
  for (const gap of validGaps) {
    columns.push({ left: prevRight, right: gap.left, gap: gap.width });
    prevRight = gap.right;
  }
  columns.push({ left: prevRight, right: pageWidth, gap: 0 });

  return columns;
}

// ─── 4. Paragraph Detection ──────────────────────────────────────────────────

function detectParagraphs(lines, columns, margins) {
  if (!lines.length) return [];

  const paragraphs = [];

  // Assign lines to columns
  for (const line of lines) {
    const colIdx = columns.findIndex(c => line.left >= c.left - 5 && line.left <= c.right + 5);
    line.columnIndex = colIdx >= 0 ? colIdx : 0;
  }

  // Process each column
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const colLines = lines.filter(l => l.columnIndex === colIdx).sort((a, b) => a.y - b.y);
    if (!colLines.length) continue;

    let currentPara = { lines: [colLines[0]], columnIndex: colIdx };

    for (let i = 1; i < colLines.length; i++) {
      const prev = colLines[i - 1];
      const curr = colLines[i];

      const vertGap = curr.top - prev.bottom;
      const expectedLineHeight = prev.fontSize * 1.3;
      const hasBullet = detectBulletOrNumber(curr);
      const fontSizeChange = Math.abs(curr.fontSize - prev.fontSize) > 2;
      const indentChange = Math.abs(curr.indent - prev.indent) > INDENT_THRESHOLD &&
                           Math.abs(curr.indent - currentPara.lines[0].indent) > INDENT_THRESHOLD;

      const isNewParagraph = vertGap > expectedLineHeight * PARAGRAPH_GAP_FACTOR ||
                             hasBullet || fontSizeChange || indentChange;

      if (isNewParagraph) {
        finalizeParagraph(currentPara, columns[colIdx], margins);
        paragraphs.push(currentPara);
        currentPara = { lines: [curr], columnIndex: colIdx };
      } else {
        currentPara.lines.push(curr);
      }
    }
    finalizeParagraph(currentPara, columns[colIdx], margins);
    paragraphs.push(currentPara);
  }

  return paragraphs;
}

function detectBulletOrNumber(line) {
  if (!line.runs.length) return false;
  const text = line.runs[0].text || '';
  return BULLET_PATTERNS.some(p => p.test(text)) || NUMBER_PATTERNS.some(p => p.test(text));
}

function finalizeParagraph(para, column, margins) {
  if (!para.lines.length) return;

  const _allRuns = para.lines.flatMap(l => l.runs);
  const firstLine = para.lines[0];
  const _lastLine = para.lines[para.lines.length - 1];

  // Spacing
  para.spaceBefore = 0;
  para.spaceAfter = 0;

  // Indents
  const bodyLeft = Math.min(...para.lines.map(l => l.left));
  para.firstLineIndent = Math.max(0, firstLine.left - bodyLeft);
  para.leftIndent = bodyLeft;

  // Alignment detection
  const colLeft = column?.left || margins?.left || 0;
  const colRight = column?.right || 500;
  const colWidth = colRight - colLeft;

  const paraLeft = firstLine.left - colLeft;
  const paraRight = colRight - (para.lines.length > 1 ?
    Math.max(...para.lines.slice(0, -1).map(l => l.right)) : firstLine.right);

  if (para.lines.length >= 2) {
    // Check if most lines span full column width (justified)
    const fullLines = para.lines.filter(l => (l.right - l.left) > colWidth * 0.85);
    if (fullLines.length >= para.lines.length * 0.6) {
      para.alignment = 'justified';
    }
  }

  if (!para.alignment) {
    const avgCenter = para.lines.reduce((s, l) => s + (l.left + l.right) / 2, 0) / para.lines.length;
    const colCenter = (colLeft + colRight) / 2;

    if (Math.abs(avgCenter - colCenter) < colWidth * 0.05 &&
        para.lines.every(l => Math.abs((l.left + l.right) / 2 - colCenter) < colWidth * 0.1)) {
      para.alignment = 'center';
    } else if (paraLeft > colWidth * 0.4 && paraRight < colWidth * 0.15) {
      para.alignment = 'right';
    } else {
      para.alignment = 'left';
    }
  }

  // Bullet detection
  para.bullet = null;
  const firstText = firstLine.runs[0]?.text || '';
  for (const pattern of BULLET_PATTERNS) {
    if (pattern.test(firstText)) {
      para.bullet = { type: 'bullet', text: firstText.match(pattern)[0].trim(), level: 0 };
      break;
    }
  }
  if (!para.bullet) {
    for (const pattern of NUMBER_PATTERNS) {
      const match = firstText.match(pattern);
      if (match) {
        para.bullet = { type: 'number', text: match[0].trim(), level: 0 };
        break;
      }
    }
  }
}

// ─── 5. Bordered Table Detection ─────────────────────────────────────────────

function detectBorderedTables(horizontalLines, verticalLines, textRuns) {
  if (horizontalLines.length < 2 || verticalLines.length < 2) return [];

  const tolerance = INTERSECTION_TOLERANCE;

  // Find intersections
  const intersections = [];
  for (const h of horizontalLines) {
    for (const v of verticalLines) {
      // Check if vertical line's x falls within horizontal line's span
      // and horizontal line's y falls within vertical line's span
      const vx = (v.x1 + v.x2) / 2;
      const hy = (h.y1 + h.y2) / 2;

      if (vx >= h.x1 - tolerance && vx <= h.x2 + tolerance &&
          hy >= v.y1 - tolerance && hy <= v.y2 + tolerance) {
        intersections.push({ x: vx, y: hy });
      }
    }
  }

  if (intersections.length < 4) return [];

  // Cluster X and Y values
  const xValues = clusterValues(intersections.map(p => p.x), tolerance);
  const yValues = clusterValues(intersections.map(p => p.y), tolerance);

  if (xValues.length < MIN_TABLE_COLS + 1 || yValues.length < MIN_TABLE_ROWS + 1) return [];

  xValues.sort((a, b) => a - b);
  yValues.sort((a, b) => a - b);

  const rows = yValues.length - 1;
  const cols = xValues.length - 1;

  // Build grid
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const cellX = xValues[c];
      const cellY = yValues[r];
      const cellWidth = xValues[c + 1] - xValues[c];
      const cellHeight = yValues[r + 1] - yValues[r];

      // Find text runs within this cell
      const cellRuns = textRuns.filter(run =>
        run.x >= cellX - tolerance && run.x <= cellX + cellWidth + tolerance &&
        run.y >= cellY - tolerance && run.y <= cellY + cellHeight + tolerance
      );

      // Build paragraphs from cell runs
      const cellLines = assembleLines(cellRuns);
      const content = cellLines.length ? [{
        lines: cellLines,
        alignment: 'left',
        spaceBefore: 0, spaceAfter: 0,
        firstLineIndent: 0, leftIndent: 0,
        bullet: null,
      }] : [];

      row.push({
        row: r, col: c,
        rowSpan: 1, colSpan: 1,
        x: cellX, y: cellY,
        width: cellWidth, height: cellHeight,
        content,
        borders: detectCellBorders(cellX, cellY, cellX + cellWidth, cellY + cellHeight,
                                   horizontalLines, verticalLines, tolerance),
        backgroundColor: null,
      });
    }
    cells.push(row);
  }

  // Detect merged cells
  detectMergedCells(cells, horizontalLines, verticalLines, tolerance);

  const colWidths = [];
  for (let c = 0; c < cols; c++) colWidths.push(xValues[c + 1] - xValues[c]);
  const rowHeights = [];
  for (let r = 0; r < rows; r++) rowHeights.push(yValues[r + 1] - yValues[r]);

  return [{
    cells,
    colWidths,
    rowHeights,
    x: xValues[0],
    y: yValues[0],
  }];
}

function detectCellBorders(x1, y1, x2, y2, hLines, vLines, tolerance) {
  const borders = { top: null, bottom: null, left: null, right: null };

  for (const h of hLines) {
    const hy = (h.y1 + h.y2) / 2;
    if (h.x1 <= x1 + tolerance && h.x2 >= x2 - tolerance) {
      if (Math.abs(hy - y1) < tolerance) {
        borders.top = { width: h.lineWidth || 1, color: h.strokeColor || '#000000', style: 'single' };
      }
      if (Math.abs(hy - y2) < tolerance) {
        borders.bottom = { width: h.lineWidth || 1, color: h.strokeColor || '#000000', style: 'single' };
      }
    }
  }

  for (const v of vLines) {
    const vx = (v.x1 + v.x2) / 2;
    if (v.y1 <= y1 + tolerance && v.y2 >= y2 - tolerance) {
      if (Math.abs(vx - x1) < tolerance) {
        borders.left = { width: v.lineWidth || 1, color: v.strokeColor || '#000000', style: 'single' };
      }
      if (Math.abs(vx - x2) < tolerance) {
        borders.right = { width: v.lineWidth || 1, color: v.strokeColor || '#000000', style: 'single' };
      }
    }
  }

  return borders;
}

function detectMergedCells(cells, hLines, vLines, tolerance) {
  // Check for missing internal borders → merged cells
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      const cell = cells[r][c];
      if (cell._mergedInto) continue;

      // Check horizontal merge (missing right border)
      let colSpan = 1;
      while (c + colSpan < cells[r].length) {
        const nextCell = cells[r][c + colSpan];
        if (nextCell._mergedInto) break;
        const _borderX = cell.x + cell.width * colSpan / cell.colSpan;
        const hasVLine = vLines.some(v =>
          Math.abs((v.x1 + v.x2) / 2 - (cell.x + colSpan * cell.width)) < tolerance &&
          v.y1 <= cell.y + tolerance && v.y2 >= cell.y + cell.height - tolerance
        );
        if (!hasVLine && colSpan < cells[r].length - c) {
          colSpan++;
        } else {
          break;
        }
      }

      // Check vertical merge (missing bottom border)
      let rowSpan = 1;
      while (r + rowSpan < cells.length) {
        const belowCell = cells[r + rowSpan][c];
        if (belowCell._mergedInto) break;
        const hasHLine = hLines.some(h =>
          Math.abs((h.y1 + h.y2) / 2 - (cell.y + rowSpan * cell.height)) < tolerance &&
          h.x1 <= cell.x + tolerance && h.x2 >= cell.x + cell.width - tolerance
        );
        if (!hasHLine && rowSpan < cells.length - r) {
          rowSpan++;
        } else {
          break;
        }
      }

      if (colSpan > 1 || rowSpan > 1) {
        cell.colSpan = colSpan;
        cell.rowSpan = rowSpan;
        // Mark consumed cells
        for (let dr = 0; dr < rowSpan; dr++) {
          for (let dc = 0; dc < colSpan; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (cells[r + dr] && cells[r + dr][c + dc]) {
              cells[r + dr][c + dc]._mergedInto = { row: r, col: c };
            }
          }
        }
      }
    }
  }
}

// ─── 6. Borderless Table Detection ───────────────────────────────────────────

function detectBorderlessTables(lines) {
  if (lines.length < 3) return [];

  const tables = [];

  // For each line, extract tab stop positions
  const lineTabStops = lines.map(line => {
    const stops = [line.runs[0]?.x || 0];
    for (let i = 1; i < line.runs.length; i++) {
      const gap = line.runs[i].x - (line.runs[i - 1].x + (line.runs[i - 1].width || 0));
      if (gap > line.fontSize * 0.5) {
        stops.push(line.runs[i].x);
      }
    }
    return { line, stops };
  });

  // Find groups of consecutive lines with matching tab stops
  let tableStart = -1;

  for (let i = 1; i < lineTabStops.length; i++) {
    const prev = lineTabStops[i - 1];
    const curr = lineTabStops[i];

    const matching = countMatchingStops(prev.stops, curr.stops);

    if (matching >= 2 && prev.stops.length >= 2 && curr.stops.length >= 2) {
      if (tableStart === -1) tableStart = i - 1;
    } else {
      if (tableStart !== -1 && i - tableStart >= 3) {
        tables.push(buildBorderlessTable(lineTabStops.slice(tableStart, i)));
      }
      tableStart = -1;
    }
  }

  if (tableStart !== -1 && lineTabStops.length - tableStart >= 3) {
    tables.push(buildBorderlessTable(lineTabStops.slice(tableStart)));
  }

  return tables;
}

function countMatchingStops(stops1, stops2) {
  let count = 0;
  for (const s1 of stops1) {
    if (stops2.some(s2 => Math.abs(s1 - s2) < TAB_STOP_TOLERANCE)) count++;
  }
  return count;
}

function buildBorderlessTable(lineData) {
  // Collect all tab stops and cluster them
  const allStops = lineData.flatMap(d => d.stops);
  const clustered = clusterValues(allStops, TAB_STOP_TOLERANCE).sort((a, b) => a - b);

  const cols = clustered.length;
  const cells = [];

  for (const { line } of lineData) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const colX = clustered[c];
      const nextColX = c + 1 < cols ? clustered[c + 1] : Infinity;

      const cellRuns = line.runs.filter(r => r.x >= colX - TAB_STOP_TOLERANCE && r.x < nextColX - TAB_STOP_TOLERANCE);
      const text = cellRuns.map(r => r.text).join(' ');

      row.push({
        row: cells.length, col: c,
        rowSpan: 1, colSpan: 1,
        x: colX, y: line.y,
        width: (nextColX === Infinity ? 200 : nextColX - colX),
        height: line.fontSize * 1.3,
        content: text ? [{
          lines: [{ runs: cellRuns, y: line.y, left: colX, right: colX + 100, top: line.top, bottom: line.bottom, fontSize: line.fontSize }],
          alignment: 'left', spaceBefore: 0, spaceAfter: 0,
          firstLineIndent: 0, leftIndent: 0, bullet: null,
        }] : [],
        borders: { top: null, bottom: null, left: null, right: null },
        backgroundColor: null,
      });
    }
    cells.push(row);
  }

  const colWidths = [];
  for (let c = 0; c < cols; c++) {
    colWidths.push(c + 1 < cols ? clustered[c + 1] - clustered[c] : 150);
  }
  const rowHeights = lineData.map(d => d.line.fontSize * 1.3);

  return {
    cells,
    colWidths,
    rowHeights,
    x: clustered[0] || 0,
    y: lineData[0].line.y,
  };
}

// ─── 7. Header/Footer Detection ─────────────────────────────────────────────

function detectHeadersFooters(pages) {
  if (pages.length < 3) return pages;

  const topFraction = 0.1;
  const bottomFraction = 0.1;

  for (const region of ['header', 'footer']) {
    const regionTexts = pages.map(page => {
      const threshold = region === 'header'
        ? page.height * topFraction
        : page.height * (1 - bottomFraction);

      const regionRuns = page.textRuns.filter(r =>
        region === 'header' ? r.y < threshold : r.y > threshold
      );

      return {
        text: regionRuns.map(r => r.text).join(' ').replace(/\d+/g, '#'),
        runs: regionRuns,
      };
    });

    // Find text appearing on ≥60% of pages
    const textCounts = new Map();
    for (const rt of regionTexts) {
      if (rt.text.length < 2) continue;
      textCounts.set(rt.text, (textCounts.get(rt.text) || 0) + 1);
    }

    for (const [text, count] of textCounts) {
      if (count >= pages.length * 0.6) {
        for (let pi = 0; pi < pages.length; pi++) {
          const normalized = regionTexts[pi].text;
          if (normalized === text) {
            if (!pages[pi]._detectedRegions) pages[pi]._detectedRegions = {};
            pages[pi]._detectedRegions[region] = regionTexts[pi].runs;
          }
        }
      }
    }
  }

  return pages;
}

// ─── 8. Reading Order Assembly ───────────────────────────────────────────────

function assembleReadingOrder(paragraphs, tables, images, columns) {
  const regions = [];

  for (const p of paragraphs) {
    regions.push({
      type: 'paragraph',
      content: p,
      y: p.lines[0]?.y || 0,
      columnIndex: p.columnIndex || 0,
    });
  }

  for (const t of tables) {
    const colIdx = columns.findIndex(c => t.x >= c.left - 5 &&
      t.x + t.colWidths.reduce((a, b) => a + b, 0) <= c.right + 5);
    regions.push({
      type: 'table',
      content: t,
      y: t.y,
      columnIndex: colIdx >= 0 ? colIdx : 0,
    });
  }

  for (const img of images) {
    const colIdx = columns.findIndex(c => img.x >= c.left - 5);
    regions.push({
      type: 'image',
      content: img,
      y: img.y,
      columnIndex: colIdx >= 0 ? colIdx : 0,
    });
  }

  // Sort: by column first, then by Y within column
  regions.sort((a, b) => {
    if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
    return a.y - b.y;
  });

  regions.forEach((r, i) => r.order = i);
  return regions;
}

// ─── 9. Main Integration ─────────────────────────────────────────────────────

/**
 * Analyze layout of a single page.
 * @param {ExtractedPage} extractedPage
 * @returns {LayoutPage}
 */
export function analyzeLayout(extractedPage) {
  const { width, height, textRuns, paths, images } = extractedPage;

  if (!textRuns || !textRuns.length) {
    return {
      pageNumber: extractedPage.pageNumber,
      width, height,
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      columns: [{ left: 0, right: width, gap: 0 }],
      body: images?.length ? images.map((img, i) => ({
        type: 'image', content: img, order: i, columnIndex: 0,
      })) : [],
      header: [], footer: [],
    };
  }

  // Detect columns
  const columns = detectColumns(textRuns, width, height);

  // Separate line types from paths
  const hLines = (paths || []).filter(p => p.subtype === 'horizontal');
  const vLines = (paths || []).filter(p => p.subtype === 'vertical');

  // Detect bordered tables
  const borderedTables = detectBorderedTables(hLines, vLines, textRuns);

  // Determine which text runs are inside bordered tables
  const tableRunSet = new Set();
  for (const table of borderedTables) {
    const tx = table.x;
    const ty = table.y;
    const tw = table.colWidths.reduce((a, b) => a + b, 0);
    const th = table.rowHeights.reduce((a, b) => a + b, 0);

    for (const run of textRuns) {
      if (run.x >= tx - 3 && run.x <= tx + tw + 3 &&
          run.y >= ty - 3 && run.y <= ty + th + 3) {
        tableRunSet.add(run);
      }
    }
  }

  // Free text runs (not in tables)
  const freeTextRuns = textRuns.filter(r => !tableRunSet.has(r));

  // Assemble lines and detect margins
  const lines = assembleLines(freeTextRuns);
  const margins = detectMargins(lines, width, height);

  // Detect paragraphs
  const paragraphs = detectParagraphs(lines, columns, margins);

  // Detect borderless tables (from free lines)
  const borderlessTables = detectBorderlessTables(lines);

  // Combine tables
  const allTables = [...borderedTables, ...borderlessTables];

  // Build reading order
  const body = assembleReadingOrder(paragraphs, allTables, images || [], columns);

  return {
    pageNumber: extractedPage.pageNumber,
    width, height,
    margins, columns, body,
    header: [], footer: [],
  };
}

/**
 * Analyze layout of multiple pages with header/footer detection.
 * @param {ExtractedPage[]} extractedPages
 * @returns {LayoutPage[]}
 */
export function analyzeMultiPageLayout(extractedPages) {
  // Detect headers/footers across pages
  detectHeadersFooters(extractedPages);

  const layoutPages = [];
  for (const page of extractedPages) {
    // Remove header/footer runs if detected
    let filteredRuns = page.textRuns;
    const headerRuns = page._detectedRegions?.header || [];
    const footerRuns = page._detectedRegions?.footer || [];
    const excludeSet = new Set([...headerRuns, ...footerRuns]);

    if (excludeSet.size > 0) {
      filteredRuns = page.textRuns.filter(r => !excludeSet.has(r));
    }

    const modifiedPage = { ...page, textRuns: filteredRuns };
    const layoutPage = analyzeLayout(modifiedPage);

    // Add detected header/footer content
    if (headerRuns.length) {
      const headerLines = assembleLines(headerRuns);
      layoutPage.header = headerLines.length ? [{
        lines: headerLines,
        alignment: 'left', spaceBefore: 0, spaceAfter: 0,
        firstLineIndent: 0, leftIndent: 0, bullet: null,
      }] : [];
    }
    if (footerRuns.length) {
      const footerLines = assembleLines(footerRuns);
      layoutPage.footer = footerLines.length ? [{
        lines: footerLines,
        alignment: 'center', spaceBefore: 0, spaceAfter: 0,
        firstLineIndent: 0, leftIndent: 0, bullet: null,
      }] : [];
    }

    layoutPages.push(layoutPage);
  }

  return layoutPages;
}
