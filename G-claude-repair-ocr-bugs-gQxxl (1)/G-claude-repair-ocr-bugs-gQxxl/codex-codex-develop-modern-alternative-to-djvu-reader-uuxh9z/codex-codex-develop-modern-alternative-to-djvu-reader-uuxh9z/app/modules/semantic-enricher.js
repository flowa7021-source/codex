/**
 * Layer 3: Semantic Enricher
 *
 * Takes LayoutPage data from Layer 2 (layout-analyzer) and enriches each
 * region with semantic information (headings, lists, footnotes, formulas,
 * TOC entries, captions).  Finally groups enriched pages into sections.
 *
 * Input:  LayoutPage[]  – each page has .body[] of regions
 *         pdfOutline    – optional PDF bookmark tree
 *
 * Output: SemanticSection[]
 */

// ---------------------------------------------------------------------------
// Constants & patterns
// ---------------------------------------------------------------------------

const HEADING_PATTERNS = [
  /^(глава|chapter|teil|chapitre|capítulo)\s+\d/i,
  /^(раздел|section|abschnitt)\s+\d/i,
  /^(часть|part|partie|parte)\s+[IVXivx\d]/i,
  /^\d+\.\s+[А-ЯA-Z]/,
  /^\d+\.\d+\s+[А-ЯA-Z]/,
  /^(введение|заключение|приложение|содержание|оглавление|предисловие)/i,
  /^(introduction|conclusion|appendix|abstract|summary|preface|foreword|bibliography|references)/i,
  /^(table of contents|index|acknowledgements)/i,
];

const BULLET_PATTERNS = [
  /^[•●○■□▪▸‣◦–—-]\s/,
  /^[\u2022\u2023\u2043]\s/,
];

const NUMBER_PATTERNS = [
  /^(\d+)[.)]\s/,
  /^([a-z])[.)]\s/i,
  /^([ivxlcdm]+)[.)]\s/i,
  /^(\d+\.\d+)[.)]\s/,
];

const MATH_SYMBOLS = /[∑∫∏√∞≤≥≠≈±×÷∂∇∈∉⊂⊃⊆⊇∪∩∧∨¬∀∃]/;
const MATH_FUNCTIONS = /\b(sin|cos|tan|log|ln|lim|min|max|sup|inf|det|dim)\b/;

const TOC_LEADER_PATTERN = /^.{3,}[.\s·]{3,}\d+$/;

const CAPTION_PATTERN =
  /^(рис\.|рисунок|figure|fig\.|table|таблица|табл\.)\s*\d/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Statistical mode of a numeric array.
 * Returns the most frequent value; falls back to the first element.
 */
export function mode(arr) {
  if (!arr || arr.length === 0) {
    return undefined;
  }

  const freq = new Map();
  let bestVal = arr[0];
  let bestCount = 0;

  for (const v of arr) {
    if (v == null) continue;
    const rounded = Math.round(v * 10) / 10; // group to 0.1‑pt buckets
    const count = (freq.get(rounded) || 0) + 1;
    freq.set(rounded, count);
    if (count > bestCount) {
      bestCount = count;
      bestVal = rounded;
    }
  }

  return bestVal;
}

/**
 * Build a map  pageNumber → [{title, level, dest}]  from a PDF outline tree.
 *
 * The outline is expected to be a recursive structure:
 *   { title, dest: { page }, items?: [...children] }
 *
 * Destination pages are 0-based in many PDF libs, so we store both the
 * raw value and a 1-based value to be safe when matching.
 */
export function buildOutlineMap(outline) {
  if (!outline) return null;

  const map = new Map();

  function walk(items, depth) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item) continue;

      const page = resolveOutlinePage(item);
      if (page != null) {
        const entry = {
          title: (item.title || '').trim(),
          level: Math.min(depth, 6),
          dest: item.dest,
        };
        if (!map.has(page)) {
          map.set(page, []);
        }
        map.get(page).push(entry);
      }

      if (item.items) {
        walk(item.items, depth + 1);
      }
      if (item.children) {
        walk(item.children, depth + 1);
      }
    }
  }

  const root = Array.isArray(outline) ? outline : outline.items || outline.children || [];
  walk(root, 1);
  return map;
}

/**
 * Resolve the page number from an outline entry.
 * Supports various common PDF-lib destination formats.
 */
function resolveOutlinePage(item) {
  if (item.page != null) return item.page;
  if (item.dest) {
    if (typeof item.dest === 'number') return item.dest;
    if (typeof item.dest === 'object' && item.dest.page != null) return item.dest.page;
    if (Array.isArray(item.dest) && typeof item.dest[0] === 'number') return item.dest[0];
  }
  return null;
}

/**
 * Fuzzy string match for comparing region text against outline titles.
 * Collapses whitespace, strips punctuation, and does a case-insensitive
 * comparison.  Returns true when the normalised strings are identical or
 * one is a prefix of the other (with ≥80 % overlap).
 */
export function fuzzyMatch(a, b) {
  if (!a || !b) return false;

  const normalise = (s) =>
    s
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim()
      .toLowerCase();

  const na = normalise(a);
  const nb = normalise(b);

  if (na === nb) return true;
  if (na.length === 0 || nb.length === 0) return false;

  // One is a prefix of the other and covers ≥80 % of the longer string
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;

  if (longer.startsWith(shorter) && shorter.length / longer.length >= 0.8) {
    return true;
  }

  return false;
}

/**
 * Collect the full plain-text of a region by concatenating all runs.
 */
function regionText(region) {
  if (region._cachedText != null) return region._cachedText;

  let text = '';
  if (region.content && region.content.lines) {
    for (const line of region.content.lines) {
      if (!line.runs) continue;
      for (const run of line.runs) {
        text += run.text || '';
      }
      text += '\n';
    }
  } else if (region.content && typeof region.content.text === 'string') {
    text = region.content.text;
  } else if (typeof region.text === 'string') {
    text = region.text;
  }

  region._cachedText = text.trim();
  return region._cachedText;
}

/**
 * Average font size of runs in a region.
 */
function avgFontSize(region) {
  const sizes = [];
  if (region.content && region.content.lines) {
    for (const line of region.content.lines) {
      if (!line.runs) continue;
      for (const run of line.runs) {
        if (run.fontSize != null) sizes.push(run.fontSize);
      }
    }
  }
  return sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : null;
}

/**
 * Check whether a region is predominantly bold.
 */
function isBold(region) {
  let boldChars = 0;
  let totalChars = 0;

  if (region.content && region.content.lines) {
    for (const line of region.content.lines) {
      if (!line.runs) continue;
      for (const run of line.runs) {
        const len = (run.text || '').length;
        totalChars += len;
        if (run.bold || run.fontWeight === 'bold' || (run.fontName && /bold/i.test(run.fontName))) {
          boldChars += len;
        }
      }
    }
  }

  return totalChars > 0 && boldChars / totalChars > 0.5;
}

/**
 * Count the number of visual lines in a region.
 */
function lineCount(region) {
  if (region.content && region.content.lines) {
    return region.content.lines.length;
  }
  const text = regionText(region);
  return text.split('\n').length;
}

/**
 * Check whether any run in a region has superscript or subscript.
 */
function hasSuperOrSubscript(region) {
  if (!region.content || !region.content.lines) return false;
  for (const line of region.content.lines) {
    if (!line.runs) continue;
    for (const run of line.runs) {
      if (run.superscript || run.subscript) return true;
    }
  }
  return false;
}

/**
 * Check whether the region text is centred (based on alignment or heuristic).
 */
function isCentered(region) {
  if (region.alignment === 'center') return true;
  if (region.content && region.content.alignment === 'center') return true;
  return false;
}

/**
 * Return the left-indent value of a region (in points).
 */
function leftIndent(region) {
  if (region.indent != null) return region.indent;
  if (region.content && region.content.indent != null) return region.content.indent;
  if (region.bbox) return region.bbox.x || region.bbox[0] || 0;
  if (region.x != null) return region.x;
  return 0;
}

/**
 * Return the Y coordinate of the bottom edge of a region.
 */
function regionBottom(region) {
  if (region.bbox) {
    // bbox may be {x,y,w,h} or [x,y,w,h]
    if (Array.isArray(region.bbox)) return region.bbox[1] + (region.bbox[3] || 0);
    return (region.bbox.y || 0) + (region.bbox.h || region.bbox.height || 0);
  }
  if (region.y != null && region.height != null) return region.y + region.height;
  return 0;
}

/**
 * Return the Y coordinate of the top edge of a region.
 */
function regionTop(region) {
  if (region.bbox) {
    if (Array.isArray(region.bbox)) return region.bbox[1];
    return region.bbox.y || 0;
  }
  return region.y || 0;
}

/**
 * Check whether all characters in a string are upper-case letters
 * (ignoring digits, spaces, punctuation).
 */
function isAllCaps(text) {
  const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

/**
 * Get the first run from the first line of a region's content.
 */
function firstRun(region) {
  if (region.content && region.content.lines && region.content.lines.length > 0) {
    const line = region.content.lines[0];
    if (line.runs && line.runs.length > 0) return line.runs[0];
  }
  return null;
}

/**
 * Get the text of the first run.
 */
function firstRunText(region) {
  const run = firstRun(region);
  return run ? (run.text || '') : regionText(region).split('\n')[0] || '';
}

/**
 * Remove a prefix (by character count) from the first run of a region.
 * Mutates the run in place.  If the run text is entirely consumed, removes
 * the run.
 */
function removeRunPrefix(region, charCount) {
  if (!region.content || !region.content.lines || region.content.lines.length === 0) return;
  const line = region.content.lines[0];
  if (!line.runs || line.runs.length === 0) return;

  let remaining = charCount;
  while (remaining > 0 && line.runs.length > 0) {
    const run = line.runs[0];
    const text = run.text || '';
    if (text.length <= remaining) {
      remaining -= text.length;
      line.runs.shift();
    } else {
      run.text = text.slice(remaining);
      remaining = 0;
    }
  }

  // Invalidate cached text
  delete region._cachedText;
}

/**
 * Compute the base indent that most body paragraphs share (for list-level
 * calculations).  Returns the mode of left-indent values across regions.
 */
function computeBaseIndent(regions) {
  const indents = regions
    .filter((r) => r.type === 'paragraph')
    .map((r) => Math.round(leftIndent(r)));
  return mode(indents) || 0;
}

// ---------------------------------------------------------------------------
// Detection passes
// ---------------------------------------------------------------------------

/**
 * Heading detection (mutates regions in-place).
 *
 * Three methods applied in priority order:
 *   A – PDF outline matching
 *   B – Font-size / bold analysis
 *   C – Semantic pattern matching
 */
export function detectHeadings(regions, bodyFontSize, pdfOutline, pageNumber) {
  if (!regions || regions.length === 0) return;

  bodyFontSize = bodyFontSize || 12;

  // Gather outline entries for this page (try both 0-based and 1-based)
  let outlineEntries = null;
  if (pdfOutline instanceof Map) {
    outlineEntries =
      pdfOutline.get(pageNumber) ||
      pdfOutline.get(pageNumber - 1) ||
      null;
  }

  for (const region of regions) {
    if (region.type !== 'paragraph') continue;

    const text = regionText(region);
    if (text.length === 0) continue;

    // Skip regions already tagged as heading by a prior pass
    if (region._headingDetected) continue;

    // ---- Method A: Outline matching ----
    if (outlineEntries) {
      for (const entry of outlineEntries) {
        if (fuzzyMatch(text, entry.title)) {
          region.type = 'heading';
          region.headingLevel = entry.level;
          region._headingDetected = true;
          break;
        }
      }
      if (region._headingDetected) continue;
    }

    // ---- Method B: Font-size + bold ----
    const size = avgFontSize(region);
    if (
      size != null &&
      size > bodyFontSize * 1.15 &&
      isBold(region) &&
      lineCount(region) <= 3 &&
      !isInsideTable(region)
    ) {
      const ratio = size / bodyFontSize;
      let level;
      if (ratio > 1.6) {
        level = 1;
      } else if (ratio > 1.3) {
        level = 2;
      } else {
        level = 3;
      }
      region.type = 'heading';
      region.headingLevel = level;
      region._headingDetected = true;
      continue;
    }

    // ---- Method C: Semantic patterns ----
    // ALL CAPS + bold + short → H2
    if (isAllCaps(text) && text.length < 80 && isBold(region)) {
      region.type = 'heading';
      region.headingLevel = 2;
      region._headingDetected = true;
      continue;
    }

    // Pattern match + short → H3
    for (const pat of HEADING_PATTERNS) {
      if (pat.test(text) && text.length < 200) {
        region.type = 'heading';
        region.headingLevel = 3;
        region._headingDetected = true;
        break;
      }
    }
  }
}

/**
 * Helper: check whether a region lives inside a table (rough heuristic).
 */
function isInsideTable(region) {
  return region._insideTable === true || region.parentType === 'table';
}

/**
 * List detection (mutates regions in-place).
 */
export function detectLists(regions) {
  if (!regions || regions.length === 0) return;

  const baseIndent = computeBaseIndent(regions);

  for (const region of regions) {
    if (region.type !== 'paragraph') continue;

    const text = firstRunText(region);
    if (text.length === 0) continue;

    // Bullet patterns
    let matched = false;
    for (const pat of BULLET_PATTERNS) {
      const m = text.match(pat);
      if (m) {
        const indent = leftIndent(region);
        const level = Math.max(0, Math.round((indent - baseIndent) / 36));

        region.type = 'list-item';
        region.listInfo = {
          type: 'bullet',
          level,
          marker: m[0].trim(),
          format: 'bullet',
        };
        removeRunPrefix(region, m[0].length);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Numbered patterns
    for (const pat of NUMBER_PATTERNS) {
      const m = text.match(pat);
      if (m) {
        const indent = leftIndent(region);
        const level = Math.max(0, Math.round((indent - baseIndent) / 36));

        let format = 'decimal';
        if (/^[a-z]/i.test(m[1])) {
          format = /^[a-z]/.test(m[1]) ? 'lower-alpha' : 'upper-alpha';
        } else if (/^[ivxlcdm]+$/i.test(m[1])) {
          format = /^[ivxlcdm]+$/.test(m[1]) ? 'lower-roman' : 'upper-roman';
        } else if (/\./.test(m[1])) {
          format = 'decimal-dotted';
        }

        region.type = 'list-item';
        region.listInfo = {
          type: 'ordered',
          level,
          marker: m[1],
          format,
        };
        removeRunPrefix(region, m[0].length);
        break;
      }
    }
  }
}

/**
 * Footnote detection (mutates regions in-place).
 *
 * 1. Find superscript number runs in body text.
 * 2. Find small paragraphs near the page bottom whose text begins with the
 *    same number.
 * 3. Pair them.
 */
export function detectFootnotes(regions, pageHeight, bodyFontSize) {
  if (!regions || regions.length === 0) return;

  pageHeight = pageHeight || 842; // default A4
  bodyFontSize = bodyFontSize || 12;

  // Collect superscript footnote reference numbers from body paragraphs
  const refNumbers = new Set();
  for (const region of regions) {
    if (region.type !== 'paragraph' && region.type !== 'heading') continue;
    if (!region.content || !region.content.lines) continue;

    for (const line of region.content.lines) {
      if (!line.runs) continue;
      for (const run of line.runs) {
        if (run.superscript && /^\d+$/.test((run.text || '').trim())) {
          refNumbers.add((run.text || '').trim());
        }
      }
    }
  }

  if (refNumbers.size === 0) return;

  // Look for footnote bodies at the bottom of the page
  const footnoteSizeThreshold = bodyFontSize * 0.85;
  // "Bottom 20 %" means the region's top-y is at least 80 % of the page
  const bottomThreshold = pageHeight * 0.8;

  for (const region of regions) {
    if (region.type !== 'paragraph') continue;

    const top = regionTop(region);
    const size = avgFontSize(region);

    // Must be near bottom and small font
    if (top < bottomThreshold) continue;
    if (size != null && size > footnoteSizeThreshold) continue;

    const text = regionText(region);
    // Match leading number
    const m = text.match(/^(\d+)\s/);
    if (!m) continue;

    const num = m[1];
    if (!refNumbers.has(num)) continue;

    region.type = 'footnote';
    region.footnoteId = num;
    removeRunPrefix(region, m[0].length);
  }
}

/**
 * Formula detection (mutates regions in-place).
 *
 * Scores each paragraph on math-related signals.
 */
export function detectFormulas(regions) {
  if (!regions || regions.length === 0) return;

  for (const region of regions) {
    if (region.type !== 'paragraph') continue;

    const text = regionText(region);
    if (text.length === 0) continue;

    let score = 0;

    // Math symbols
    const symbolMatches = text.match(new RegExp(MATH_SYMBOLS.source, 'g'));
    if (symbolMatches) {
      score += symbolMatches.length * 3;
    }

    // Superscript / subscript runs
    if (hasSuperOrSubscript(region)) {
      score += 2;
    }

    // Centred alignment
    if (isCentered(region)) {
      score += 2;
    }

    // Math function names
    const fnMatches = text.match(new RegExp(MATH_FUNCTIONS.source, 'g'));
    if (fnMatches) {
      score += fnMatches.length * 2;
    }

    if (score >= 5) {
      region.type = 'formula';
      region.formulaScore = score;
    }
  }
}

/**
 * TOC entry detection (mutates regions in-place).
 *
 * Marks sequences of ≥ 3 consecutive paragraphs that look like table-of-
 * contents entries (text + leader dots + page number).
 */
export function detectTocEntries(regions) {
  if (!regions || regions.length === 0) return;

  // First pass: tag candidates
  const candidates = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    if (region.type !== 'paragraph') {
      candidates.push(false);
      continue;
    }

    const text = regionText(region).replace(/\n/g, ' ').trim();

    // Pattern 1: leader dots
    if (TOC_LEADER_PATTERN.test(text)) {
      candidates.push(true);
      continue;
    }

    // Pattern 2: right-aligned page number (text has trailing number separated
    // by at least 2 spaces or a tab)
    if (/\S\s{2,}\d+$/.test(text) || /\S\t+\d+$/.test(text)) {
      candidates.push(true);
      continue;
    }

    candidates.push(false);
  }

  // Second pass: require ≥ 3 consecutive candidates
  let runStart = -1;
  for (let i = 0; i <= candidates.length; i++) {
    if (i < candidates.length && candidates[i]) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        const runLength = i - runStart;
        if (runLength >= 3) {
          for (let j = runStart; j < i; j++) {
            regions[j].type = 'toc-entry';
          }
        }
        runStart = -1;
      }
    }
  }
}

/**
 * Caption detection (mutates regions in-place).
 *
 * A caption is a short paragraph immediately adjacent to an image or table
 * region that matches a caption pattern.
 */
export function detectCaptions(regions) {
  if (!regions || regions.length === 0) return;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    if (region.type !== 'paragraph') continue;

    const text = regionText(region);
    if (text.length === 0 || text.length > 200) continue;

    if (!CAPTION_PATTERN.test(text)) continue;

    // Check for an adjacent image or table
    const prev = i > 0 ? regions[i - 1] : null;
    const next = i < regions.length - 1 ? regions[i + 1] : null;

    const adjacentToTarget =
      (prev && (prev.type === 'image' || prev.type === 'table')) ||
      (next && (next.type === 'image' || next.type === 'table'));

    if (adjacentToTarget) {
      region.type = 'caption';
    }
  }
}

// ---------------------------------------------------------------------------
// Section detection
// ---------------------------------------------------------------------------

/**
 * Group enriched pages into SemanticSection objects based on page geometry
 * and content flow.
 *
 * A new section starts when:
 *   - Page size changes (width or height differs by > 1pt)
 *   - Orientation changes (portrait ↔ landscape)
 *   - Margin changes significantly (> 10pt)
 *   - Column count changes
 */
export function detectSections(layoutPages) {
  if (!layoutPages || layoutPages.length === 0) return [];

  const sections = [];
  let current = null;

  for (let i = 0; i < layoutPages.length; i++) {
    const page = layoutPages[i];
    const pageNum = page.pageNumber != null ? page.pageNumber : i + 1;

    const width = page.width || page.pageSize?.width || 612;
    const height = page.height || page.pageSize?.height || 792;
    const orientation = width > height ? 'landscape' : 'portrait';
    const columns = page.columns || page.columnCount || 1;
    const margins = page.margins || { top: 72, right: 72, bottom: 72, left: 72 };

    const needsNew = !current || shouldStartNewSection(current, {
      width,
      height,
      orientation,
      columns,
      margins,
    });

    if (needsNew) {
      current = {
        startPage: pageNum,
        endPage: pageNum,
        columns,
        margins: { ...margins },
        orientation,
        pageSize: { width, height },
        header: page.header || null,
        footer: page.footer || null,
        blocks: [],
      };
      sections.push(current);
    } else {
      current.endPage = pageNum;
      // Update header/footer if page provides one and section doesn't yet
      if (!current.header && page.header) current.header = page.header;
      if (!current.footer && page.footer) current.footer = page.footer;
    }

    // Flatten page regions into section blocks, carrying over semantic types
    if (page.body) {
      for (const region of page.body) {
        const block = buildBlock(region, pageNum);
        current.blocks.push(block);
      }
    }

    // Insert a page-break marker between pages (except the last)
    if (i < layoutPages.length - 1) {
      current.blocks.push({
        type: 'page-break',
        pageNumber: pageNum,
      });
    }
  }

  return sections;
}

/**
 * Determine whether a new section should start given current section props
 * and incoming page props.
 */
function shouldStartNewSection(section, pageProps) {
  // Page size change (> 1pt tolerance)
  if (
    Math.abs(section.pageSize.width - pageProps.width) > 1 ||
    Math.abs(section.pageSize.height - pageProps.height) > 1
  ) {
    return true;
  }

  // Orientation change
  if (section.orientation !== pageProps.orientation) {
    return true;
  }

  // Column count change
  if (section.columns !== pageProps.columns) {
    return true;
  }

  // Margin change (> 10pt on any side)
  if (section.margins && pageProps.margins) {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const a = section.margins[side] || 0;
      const b = pageProps.margins[side] || 0;
      if (Math.abs(a - b) > 10) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Convert a region into a SemanticSection block.
 */
function buildBlock(region, pageNumber) {
  const base = {
    type: region.type || 'paragraph',
    pageNumber,
    order: region.order,
    columnIndex: region.columnIndex,
  };

  // Copy content, stripping internal caches
  if (region.content) {
    base.content = region.content;
  }

  // Type-specific properties
  switch (region.type) {
    case 'heading':
      base.headingLevel = region.headingLevel || 1;
      break;

    case 'list-item':
      base.listInfo = region.listInfo || { type: 'bullet', level: 0 };
      break;

    case 'footnote':
      base.footnoteId = region.footnoteId;
      break;

    case 'formula':
      base.formulaScore = region.formulaScore;
      break;

    case 'toc-entry':
      break;

    case 'caption':
      break;

    case 'image':
      base.imageRef = region.imageRef || region.content?.imageRef || null;
      base.altText = region.altText || null;
      break;

    case 'table':
      base.rows = region.rows || region.content?.rows || [];
      base.tableCaption = region.tableCaption || null;
      break;

    default:
      break;
  }

  // Preserve bounding box for downstream use
  if (region.bbox) {
    base.bbox = region.bbox;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Enrich layout pages with semantic information and group into sections.
 *
 * @param {LayoutPage[]} layoutPages - pages from Layer 2
 * @param {Object|null}  pdfOutline  - optional PDF outline/bookmark tree
 * @returns {SemanticSection[]}
 */
export function enrichSemantics(layoutPages, pdfOutline = null) {
  if (!layoutPages || layoutPages.length === 0) return [];

  // ---- Compute global body font size (mode across all paragraph runs) ----
  const allFontSizes = [];
  for (const page of layoutPages) {
    if (!page.body) continue;
    for (const region of page.body) {
      if (region.type !== 'paragraph') continue;
      if (region.content && region.content.lines) {
        for (const line of region.content.lines) {
          if (!line.runs) continue;
          for (const run of line.runs) {
            if (run.fontSize != null) {
              allFontSizes.push(run.fontSize);
            }
          }
        }
      }
    }
  }
  const bodyFontSize = mode(allFontSizes) || 12;

  // ---- Build outline map ----
  const outlineMap = pdfOutline ? buildOutlineMap(pdfOutline) : null;

  // ---- Enrich each page ----
  for (const page of layoutPages) {
    if (!page.body) continue;

    const pageNumber = page.pageNumber != null ? page.pageNumber : 0;
    const pageHeight = page.height || page.pageSize?.height || 842;

    detectHeadings(page.body, bodyFontSize, outlineMap, pageNumber);
    detectLists(page.body);
    detectFootnotes(page.body, pageHeight, bodyFontSize);
    detectFormulas(page.body);
    detectTocEntries(page.body);
    detectCaptions(page.body);
  }

  // ---- Group into sections ----
  return detectSections(layoutPages);
}
