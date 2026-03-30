// @ts-check
// ─── DOCX Structure Detector ─── Extracted from docx-converter.js

import { AlignmentType, HeadingLevel } from 'docx';

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

function isUnderlineFont(fontName) {
  return /underline/i.test(fontName || '');
}

function isStrikethroughFont(fontName) {
  return /strikethrough|strikeout|strike/i.test(fontName || '');
}

// ─── Text quality helpers ───────────────────────────────────────────────────

// Merge adjacent items on the same line that are very close (continuation of same word/phrase)
function mergeAdjacentItems(items, _avgFontSize) {
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
    } else if (gap >= 0 && gap < prev.fontSize * 0.6 &&
               prev.fontName === curr.fontName && Math.abs(prev.fontSize - curr.fontSize) < 1) {
      // Small gap, same font — add space between
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

  // Justified: both margins close to page edges and line is wide
  if (lineWidth > pageWidth * 0.8 && leftIndent < pageWidth * 0.08 && rightMargin < pageWidth * 0.08) {
    return AlignmentType.JUSTIFIED;
  }
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
  const _ends = lines.map(l => Math.max(...l.map(i => i.x + i.width)));

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

// ─── Extract embedded images from a PDF page via operator list ───────────────
async function extractPageImages(page, viewport) {
  const images = [];
  try {
    const ops = await page.getOperatorList();
    const OPS = {
      paintImageXObject: 85,
      paintInlineImageXObject: 86,
      paintImageXObjectRepeat: 87,
    };
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    // Track CTM (Current Transform Matrix) for image positioning
    // PDF.js operator list includes setTransform, translate, etc.
    const OPS_TRANSFORM = { setTransform: 12, transform: 13 };
    const ctmStack = [[1, 0, 0, 1, 0, 0]]; // identity

    for (let i = 0; i < ops.fnArray.length; i++) {
      // Track transform matrix changes for image position
      if (ops.fnArray[i] === 10) { // save
        ctmStack.push([...ctmStack[ctmStack.length - 1]]);
      } else if (ops.fnArray[i] === 11) { // restore
        if (ctmStack.length > 1) ctmStack.pop();
      } else if (ops.fnArray[i] === OPS_TRANSFORM.setTransform || ops.fnArray[i] === OPS_TRANSFORM.transform) {
        const args = ops.argsArray[i];
        if (args && args.length >= 6) ctmStack[ctmStack.length - 1] = [args[0], args[1], args[2], args[3], args[4], args[5]];
      }

      if (ops.fnArray[i] === OPS.paintImageXObject ||
          ops.fnArray[i] === OPS.paintInlineImageXObject) {
        const imgName = ops.argsArray[i]?.[0];
        if (!imgName) continue;

        try {
          // Try page-level objects first, then common (shared) objects
          let imgData = null;
          try { imgData = page.objs.get(imgName); } catch (err) { console.warn('[docx-structure-detector] error:', err?.message); }
          if (!imgData) {
            try { imgData = page.commonObjs.get(imgName); } catch (err) { console.warn('[docx-structure-detector] error:', err?.message); }
          }
          if (!imgData || !imgData.data) continue;

          // Convert raw image data to PNG via canvas
          const w = imgData.width;
          const h = imgData.height;
          if (w < 20 || h < 20) continue; // Skip tiny images (icons, dots)

          const canvas = typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(w, h)
            : document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          const idata = ctx.createImageData(w, h);

          // imgData.data can be Uint8ClampedArray (RGBA) or Uint8Array (RGB/RGBA)
          if (imgData.data.length === w * h * 4) {
            idata.data.set(imgData.data);
          } else if (imgData.data.length === w * h * 3) {
            // RGB → RGBA
            for (let px = 0, di = 0; px < imgData.data.length; px += 3, di += 4) {
              idata.data[di] = imgData.data[px];
              idata.data[di + 1] = imgData.data[px + 1];
              idata.data[di + 2] = imgData.data[px + 2];
              idata.data[di + 3] = 255;
            }
          } else {
            continue; // Unknown format
          }

          ctx.putImageData(idata, 0, 0);

          let pngBlob;
          if (typeof /** @type {any} */ (canvas).convertToBlob === 'function') {
            pngBlob = await /** @type {any} */ (canvas).convertToBlob({ type: 'image/png' });
          } else {
            pngBlob = await new Promise(resolve => /** @type {any} */ (canvas).toBlob(resolve, 'image/png'));
          }
          if (!pngBlob) continue;

          const pngData = new Uint8Array(await pngBlob.arrayBuffer());

          // Compute position from current transform matrix
          const ctm = ctmStack[ctmStack.length - 1];
          const imgX = ctm[4] || 0;
          const imgYpdf = ctm[5] || 0;
          // Convert from PDF coords (bottom-up) to top-down
          const imgY = pageHeight - imgYpdf;
          const scaleW = Math.abs(ctm[0]) || 1;
          const scaleH = Math.abs(ctm[3]) || 1;
          const displayW = Math.min(Math.max(scaleW, w), pageWidth * 0.95);
          const displayH = (scaleH > 1 ? scaleH : h) * (displayW / Math.max(1, scaleW > 1 ? scaleW : w));

          images.push({
            data: pngData,
            width: Math.round(displayW),
            height: Math.round(displayH),
            originalWidth: w,
            originalHeight: h,
            x: Math.round(imgX),
            y: Math.round(imgY),
          });
        } catch (err) {
          console.warn('[docx-structure-detector] error:', err?.message);
          // Skip this image on any error
        }
      }
    }
  } catch (err) {
    console.warn('[docx-structure-detector] error:', err?.message);
    // getOperatorList may fail on some pages
  }
  return images;
}

// ─── Extract structured text content from PDF page via PDF.js ───────────────
// ─── Operator-list text style extraction ─────────────────────────────────────
// Parses PDF.js operator list to extract text color, underline, strikethrough,
// and bold-via-font-descriptor — data that getTextContent() doesn't provide.

const _OPS = {
  save: 10, restore: 11,
  setFont: 37, setTextRenderingMode: 38, setTextMatrix: 42,
  showText: 44, showSpacedText: 45,
  nextLineShowText: 46, nextLineSetSpacingShowText: 47,
  setFillRGBColor: 95, setFillGray: 97, setFillCMYKColor: 99,
  lineTo: 14, rectangle: 19, stroke: 20, closeStroke: 21,
  moveTo: 13,
};

/**
 * Build a spatial index of text colors, underlines, and font info
 * from the PDF.js operator list.
 */
async function _extractTextStylesFromOps(page, pageHeight) {
  /** @type {Array<{x: number, y: number, color: string, bold: boolean, renderMode: number}>} */
  const textPoints = [];
  /** @type {Array<{x1: number, y: number, x2: number, thickness: number}>} */
  const hLines = [];

  try {
    const ops = await page.getOperatorList();

    // Graphics state stack
    let fillColor = '#000000';
    let renderMode = 0;
    let currentFontBold = false;
    const stateStack = [];
    let pathX = 0, pathY = 0;

    // Font bold detection from font descriptor
    const fontBoldCache = new Map();
    function isFontBold(fontName) {
      if (fontBoldCache.has(fontName)) return fontBoldCache.get(fontName);
      let bold = false;
      try {
        const fd = page.commonObjs.get(fontName);
        if (fd?.data) {
          bold = !!fd.data.bold || (fd.data.stemV && fd.data.stemV > 80);
        }
      } catch (_e) { /* font not found */ }
      if (!bold) bold = /bold|black|heavy|demi/i.test(fontName);
      fontBoldCache.set(fontName, bold);
      return bold;
    }

    for (let i = 0; i < ops.fnArray.length; i++) {
      const op = ops.fnArray[i];
      const args = ops.argsArray[i];

      switch (op) {
        case _OPS.save:
          stateStack.push({ fillColor, renderMode, currentFontBold });
          break;
        case _OPS.restore:
          if (stateStack.length) {
            const s = stateStack.pop();
            fillColor = s.fillColor;
            renderMode = s.renderMode;
            currentFontBold = s.currentFontBold;
          }
          break;
        case _OPS.setFillRGBColor:
          if (args?.length >= 3) {
            const r = Math.round(args[0] * 255);
            const g = Math.round(args[1] * 255);
            const b = Math.round(args[2] * 255);
            fillColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
          break;
        case _OPS.setFillGray:
          if (args?.length >= 1) {
            const g = Math.round(args[0] * 255);
            fillColor = `#${g.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}`;
          }
          break;
        case _OPS.setFillCMYKColor:
          if (args?.length >= 4) {
            const r = Math.round(255 * (1 - args[0]) * (1 - args[3]));
            const g = Math.round(255 * (1 - args[1]) * (1 - args[3]));
            const b = Math.round(255 * (1 - args[2]) * (1 - args[3]));
            fillColor = `#${Math.max(0, r).toString(16).padStart(2, '0')}${Math.max(0, g).toString(16).padStart(2, '0')}${Math.max(0, b).toString(16).padStart(2, '0')}`;
          }
          break;
        case _OPS.setTextRenderingMode:
          renderMode = args?.[0] ?? 0;
          break;
        case _OPS.setFont:
          if (args?.[0]) currentFontBold = isFontBold(args[0]);
          break;
        case _OPS.showText:
        case _OPS.showSpacedText:
        case _OPS.nextLineShowText:
        case _OPS.nextLineSetSpacingShowText:
          // Record text point with current fill color and bold state
          // Position comes from text matrix — we'll match by proximity later
          textPoints.push({ x: 0, y: 0, color: fillColor, bold: currentFontBold || renderMode === 2, renderMode });
          break;
        // Track horizontal lines for underline/strikethrough detection
        case _OPS.moveTo:
          if (args?.length >= 2) { pathX = args[0]; pathY = args[1]; }
          break;
        case _OPS.lineTo:
          if (args?.length >= 2) {
            const lx = args[0], ly = args[1];
            // Horizontal line?
            if (Math.abs(ly - pathY) < 1.5 && Math.abs(lx - pathX) > 10) {
              hLines.push({ x1: Math.min(pathX, lx), y: pathY, x2: Math.max(pathX, lx), thickness: 1 });
            }
            pathX = lx; pathY = ly;
          }
          break;
        case _OPS.rectangle:
          if (args?.length >= 4 && args[3] < 3 && args[2] > 10) {
            // Thin horizontal rectangle = underline/strikethrough
            hLines.push({ x1: args[0], y: args[1], x2: args[0] + args[2], thickness: args[3] });
          }
          break;
      }
    }
  } catch (_e) { /* operator list unavailable */ }

  // Build spatial lookup
  let textIdx = 0;
  return {
    /**
     * Get style at a given PDF coordinate position.
     * @param {number} x @param {number} pdfY @param {number} fontSize
     */
    getStyleAt(x, pdfY, fontSize) {
      // Match text color: use sequential matching (operator list order matches text order)
      const color = (textIdx < textPoints.length) ? textPoints[textIdx++].color : '#000000';
      const bold = (textIdx > 0 && textIdx <= textPoints.length) ? textPoints[textIdx - 1].bold : false;

      // Check for underline: horizontal line within 2pt below text baseline
      let underline = false;
      let strikethrough = false;
      for (const line of hLines) {
        if (x >= line.x1 - 2 && x <= line.x2 + 2) {
          const lineYtd = pageHeight - line.y; // convert to top-down
          const textYtd = pageHeight - pdfY;
          const belowText = lineYtd - textYtd;
          if (belowText > 0 && belowText < fontSize * 0.3) underline = true;
          if (belowText > fontSize * 0.3 && belowText < fontSize * 0.7) strikethrough = true;
        }
      }

      return { color, bold, underline, strikethrough };
    },
  };
}

async function extractStructuredContent(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent({ includeMarkedContent: false });
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  // ── Extract text styling from operator list (color, underline, bold) ──
  const textStyles = await _extractTextStylesFromOps(page, pageHeight);

  // Extract link annotations from the page
  let linkAnnotations = [];
  try {
    const annotations = await page.getAnnotations({ intent: 'display' });
    linkAnnotations = annotations.filter(a => a.subtype === 'Link' && a.url).map(a => ({
      url: a.url,
      // PDF annotation rects are [x1, y1, x2, y2] in bottom-up coords
      rect: a.rect ? {
        x1: a.rect[0], y1: pageHeight - a.rect[3],
        x2: a.rect[2], y2: pageHeight - a.rect[1],
      } : null,
    }));
  } catch (err) { console.warn('[docx-structure-detector] error:', err?.message); }

  // Extract embedded images from this page
  const images = await extractPageImages(page, viewport);

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

      // Check if this text item overlaps any link annotation
      let url = null;
      for (const link of linkAnnotations) {
        if (link.rect && x >= link.rect.x1 - 2 && x <= link.rect.x2 + 2 &&
            y >= link.rect.y1 - 2 && y <= link.rect.y2 + 2) {
          url = link.url;
          break;
        }
      }

      // Match against operator-list styles by position
      const style = textStyles.getStyleAt(x, pageHeight - tx[5], fontSize);

      return {
        text: item.str,
        x, y,
        width: item.width || 0,
        height: item.height || fontSize,
        fontSize,
        fontName: item.fontName || '',
        url,
        color: style.color,
        underline: style.underline,
        strikethrough: style.strikethrough,
        boldFromDescriptor: style.bold,
      };
    })
    .sort((a, b) => {
      const dy = a.y - b.y;
      // Use font-size-aware threshold for same-line detection during sort
      const threshold = Math.max(2, Math.min(a.fontSize, b.fontSize) * 0.35);
      return Math.abs(dy) < threshold ? a.x - b.x : dy;
    });

  if (!items.length) return { blocks: [], pageWidth, pageHeight, images, links: linkAnnotations, margins: {}, bodyFontSize: 12, columnInfo: null };

  // Group into lines (items with similar Y, using running average Y)
  const lines = [];
  let currentLine = [items[0]];
  let currentLineY = items[0].y;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    // Use the average font size of the current line for the threshold
    const lineAvgFs = currentLine.reduce((s, it) => s + it.fontSize, 0) / currentLine.length;
    // Tighter tolerance prevents merging subscripts/superscripts onto main line
    const threshold = Math.min(Math.max(3, lineAvgFs * 0.35), 6);
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
      const colBlocks = processLinesToBlocks(columns[ci], bodyFontSize, avgFontSize, leftMargin, pageWidth, pageHeight);
      allBlocks.push(...colBlocks);
      // Add column separator between columns (except after last)
      if (ci < columns.length - 1 && colBlocks.length > 0) {
        allBlocks.push({ type: 'columnBreak' });
      }
    }
  } else {
    allBlocks = processLinesToBlocks(lines, bodyFontSize, avgFontSize, leftMargin, pageWidth, pageHeight);
  }

  // Compute page margins
  const rightEdge = Math.max(...items.map(i => i.x + (i.width || 0)));
  const topMargin = Math.min(...items.map(i => i.y));
  const bottomEdge = Math.max(...items.map(i => i.y + (i.height || i.fontSize)));

  return {
    blocks: allBlocks, pageWidth, pageHeight, images,
    links: linkAnnotations,
    margins: { left: leftMargin, right: pageWidth - rightEdge, top: topMargin, bottom: pageHeight - bottomEdge },
    bodyFontSize,
    columnInfo,
  };
}

// ─── Footnote detection helpers ──────────────────────────────────────────────
const FOOTNOTE_MARKER_RE = /^(\d{1,3})[.)]\s|^(\*{1,3})\s|^(†|‡|§|¶)\s/;

function _isFootnoteCandidate(lineAvgFontSize, bodyFontSize, lineY, pageHeight) {
  // Footnotes are typically smaller text in the bottom 25% of the page
  const isSmall = lineAvgFontSize < bodyFontSize * 0.85;
  const isBottom = lineY > pageHeight * 0.75;
  return isSmall && isBottom;
}

// ─── Improved table detection: check column alignment consistency ────────────
function _validateTableCandidate(rows) {
  // A valid table should have consistent column count (or close) and
  // column x-positions should roughly align across rows
  if (rows.length < 2) return false;
  const colCounts = rows.map(r => r.cellData.length);
  const modeCount = colCounts.sort((a, b) => a - b)[Math.floor(colCounts.length / 2)];
  // At least 60% of rows should have similar column count (within +/-1)
  const consistent = colCounts.filter(c => Math.abs(c - modeCount) <= 1).length;
  return consistent >= rows.length * 0.6;
}

// Process a set of lines (from one column or the whole page) into blocks
function processLinesToBlocks(lines, bodyFontSize, avgFontSize, leftMargin, pageWidth, pageHeight) {
  const blocks = [];
  let tableCandidate = [];
  let prevLineBottom = 0;
  let consecutiveParagraphs = []; // For merging continuation paragraphs
  const _pageH = pageHeight || 842; // Default A4 height in points

  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li];
    const line = mergeAdjacentItems(rawLine, avgFontSize);
    const lineTop = Math.min(...line.map(i => i.y));
    const lineBottom = Math.max(...line.map(i => i.y + i.height));
    const lineAvgFontSize = line.reduce((s, i) => s + i.fontSize, 0) / line.length;
    const gap = li === 0 ? 0 : lineTop - prevLineBottom;

    // Flush table if gap is large
    if (tableCandidate.length && gap > lineAvgFontSize * 1.5) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      if (_validateTableCandidate(tableCandidate)) {
        flushTable(tableCandidate, blocks, avgFontSize, leftMargin);
      } else {
        // Not a real table — emit as regular paragraphs
        tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc.line, avgFontSize, leftMargin)));
      }
      tableCandidate = [];
    }

    // Build line text
    const lineText = line.map(i => i.text).join(' ').trim();
    if (!lineText) { prevLineBottom = lineBottom; continue; }

    // Check if line looks like a table row: multiple items with large x-gaps
    const xPositions = line.map(i => i.x);
    const xSpan = Math.max(...xPositions) - Math.min(...xPositions);
    const hasMultipleColumns = line.length >= 2 && xSpan > pageWidth * 0.25;
    // Compute average character width from this line's items for accurate gap detection
    const lineCharCount = line.reduce((s, it) => s + (it.text?.length || 0), 0);
    const lineTextWidth = line.reduce((s, it) => s + (it.width || 0), 0);
    const avgCharW = lineCharCount > 0 && lineTextWidth > 0 ? lineTextWidth / lineCharCount : avgFontSize * 0.5;
    const hasLargeGap = line.some((item, idx) => idx > 0 &&
      item.x - (rawLine[idx-1].x + (rawLine[idx-1].width || 0)) > avgCharW * 6);
    const tabSeparated = lineText.includes('\t');

    // Additional table heuristic: check if items form distinct aligned columns
    const _lineItemXPositions = line.map(i => i.x);
    const _uniqueXRegions = _lineItemXPositions.filter((x, idx) =>
      idx === 0 || x - _lineItemXPositions[idx - 1] > avgFontSize * 2);
    const hasAlignedColumns = _uniqueXRegions.length >= 2;

    if ((hasMultipleColumns && (hasLargeGap || hasAlignedColumns)) || tabSeparated) {
      const columnItems = clusterByXGap(rawLine, avgFontSize * 2);
      if (columnItems.length >= 2) {
        // Flush pending paragraphs before table
        flushParagraphGroup(consecutiveParagraphs, blocks);
        consecutiveParagraphs = [];
        tableCandidate.push({ cellData: columnItems, line: rawLine });
        prevLineBottom = lineBottom;
        continue;
      }
    }

    // Flush pending table with validation
    if (tableCandidate.length) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      if (_validateTableCandidate(tableCandidate)) {
        flushTable(tableCandidate, blocks, avgFontSize, leftMargin);
      } else {
        tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc.line, avgFontSize, leftMargin)));
      }
      tableCandidate = [];
    }

    // Footnote detection: small text at bottom of page with marker
    if (_isFootnoteCandidate(lineAvgFontSize, bodyFontSize, lineTop, _pageH) &&
        FOOTNOTE_MARKER_RE.test(lineText.trim())) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      blocks.push({
        type: 'footnote',
        text: lineText,
        runs: buildRuns(line),
        y: lineTop,
      });
      prevLineBottom = lineBottom;
      continue;
    }

    // Detect list items (more precise: require indent or clear bullet/number prefix)
    const trimmedText = lineText.trimStart();
    const listMatch = trimmedText.match(
      /^([\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣\-–—]\s)|^(\d{1,3}[.)]\s)|^([a-zA-Zа-яА-Я][.)]\s(?=[A-ZА-Я]))/
    );
    const lineIndent = line[0].x - leftMargin;
    const isIndentedList = listMatch && lineIndent > avgFontSize * 0.5;
    const isClearList = listMatch && (trimmedText.match(/^[\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣\-–—]/) ||
      trimmedText.match(/^\d{1,3}[.)]\s/));

    if (isIndentedList || isClearList) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      const indent = Math.max(0, Math.round(lineIndent / avgFontSize));
      const cleanText = trimmedText
        .replace(/^[\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣\-–—]\s*/, '')
        .replace(/^\d{1,3}[.)]\s/, '')
        .replace(/^[a-zA-Zа-яА-Я][.)]\s/, '')
        .trim();
      blocks.push({
        type: 'list',
        text: cleanText,
        bullet: !trimmedText.match(/^\d/),
        level: Math.min(indent, 3),
        runs: buildRuns(line),
        y: lineTop,
      });
      prevLineBottom = lineBottom;
      continue;
    }

    // Detect heading by font size, semantic patterns, bold + short, or all-caps
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
    else if (isBold && isShortLine && sizeRatio >= 1.0 && lineText.length < 60) headingLevel = HeadingLevel.HEADING_3;

    if (headingLevel) {
      flushParagraphGroup(consecutiveParagraphs, blocks);
      consecutiveParagraphs = [];
      blocks.push({
        type: 'heading',
        level: headingLevel,
        text: lineText,
        runs: buildRuns(line),
        alignment: detectAlignment(line, pageWidth, leftMargin),
        y: lineTop,
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
        y: lineTop,
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
    if (_validateTableCandidate(tableCandidate)) {
      flushTable(tableCandidate, blocks, avgFontSize, leftMargin);
    } else {
      tableCandidate.forEach(tc => blocks.push(buildParagraphBlock(tc.line, avgFontSize, leftMargin)));
    }
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
  // Compute line average Y for super/subscript detection
  const lineAvgY = lineItems.reduce((s, i) => s + i.y, 0) / lineItems.length;
  const lineAvgFontSize = lineItems.reduce((s, i) => s + i.fontSize, 0) / lineItems.length;

  // Merge adjacent items with same formatting into single runs
  const raw = lineItems.map(item => {
    // Detect superscript/subscript from Y-offset relative to line average
    const yOffset = item.y - lineAvgY;
    const sizeRatio = item.fontSize / lineAvgFontSize;
    const superscript = sizeRatio < 0.8 && yOffset < -lineAvgFontSize * 0.15;
    const subscript = sizeRatio < 0.8 && yOffset > lineAvgFontSize * 0.15;

    return {
      text: item.text,
      bold: item.boldFromDescriptor || isBoldFont(item.fontName),
      italic: isItalicFont(item.fontName),
      underline: item.underline || isUnderlineFont(item.fontName),
      strikethrough: item.strikethrough || isStrikethroughFont(item.fontName),
      superscript,
      subscript,
      monospace: isMonospaceFont(item.fontName),
      fontFamily: mapPdfFont(item.fontName),
      fontSize: item.fontSize,
      color: (item.color && item.color !== '#000000') ? item.color : null,
      url: item.url || null,
    };
  });

  if (raw.length <= 1) return raw;

  const merged = [{ ...raw[0] }];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = raw[i];
    if (prev.bold === curr.bold && prev.italic === curr.italic &&
        prev.underline === curr.underline && prev.strikethrough === curr.strikethrough &&
        prev.superscript === curr.superscript && prev.subscript === curr.subscript &&
        prev.fontFamily === curr.fontFamily &&
        prev.color === curr.color && prev.url === curr.url &&
        Math.abs(prev.fontSize - curr.fontSize) < 0.5) {
      prev.text += ' ' + curr.text;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

function buildParagraphBlock(line, avgFontSize, _leftMargin) {
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
  // Return cell objects with both text and formatted runs
  return clusters.map(c => ({
    text: c.map(i => i.text).join(' ').trim(),
    runs: buildRuns(c),
  }));
}

function buildTableBlock(rows) {
  const maxCols = Math.max(...rows.map(r => r.cellData.length));
  const tableRows = rows.map(r => {
    const cells = [];
    for (let c = 0; c < maxCols; c++) {
      cells.push(r.cellData[c] || { text: '', runs: [] });
    }
    return { cells };
  });
  return { type: 'table', rows: tableRows, maxCols };
}

export { extractStructuredContent, mapPdfFont, isBoldFont, isItalicFont, isMonospaceFont, isUnderlineFont, isStrikethroughFont };
