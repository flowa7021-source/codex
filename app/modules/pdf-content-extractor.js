// ─── PDF Content Extractor (Layer 1) ─────────────────────────────────────────
// Hybrid extraction: getTextContent() for text + getOperatorList() for vector
// paths and images.  Produces ExtractedPage objects consumed by layout-analyzer.

// pdf.js OPS numeric constants (from pdfjs-dist/lib/shared/util.js)
const OPS = {
  setLineWidth: 2, setLineCap: 3, setLineJoin: 4, setMiterLimit: 5,
  setDash: 6, setGState: 9, save: 10, restore: 11, transform: 12,
  moveTo: 13, lineTo: 14, curveTo: 15, curveTo2: 16, curveTo3: 17,
  closePath: 18, rectangle: 19, stroke: 20, closeStroke: 21,
  fill: 22, eoFill: 23, fillStroke: 24, eoFillStroke: 25,
  closeFillStroke: 26, closeEoFillStroke: 27, endPath: 28,
  clip: 29, eoClip: 30,
  beginText: 31, endText: 32, setCharSpacing: 33, setWordSpacing: 34,
  setHScale: 35, setLeading: 36, setFont: 37, setTextRenderingMode: 38,
  setTextRise: 39, moveText: 40, setLeadingMoveText: 41,
  setTextMatrix: 42, nextLine: 43, showText: 44, showSpacedText: 45,
  nextLineShowText: 46, nextLineSetSpacingShowText: 47,
  paintJpegXObject: 82, paintImageXObject: 85,
  paintInlineImageXObject: 86, paintImageXObjectRepeat: 87,
  paintImageMaskXObject: 88,
  constructPath: 91, setStrokeTransparent: 92, setFillTransparent: 93,
  setStrokeRGBColor: 94, setFillRGBColor: 95,
  setStrokeGray: 96, setFillGray: 97,
  setStrokeCMYKColor: 98, setFillCMYKColor: 99,
};

// ─── Font name alias map ────────────────────────────────────────────────────
const FONT_ALIAS = {
  'ArialMT': 'Arial', 'Arial-BoldMT': 'Arial', 'Arial-ItalicMT': 'Arial',
  'Arial-BoldItalicMT': 'Arial', 'Helvetica': 'Arial', 'HelveticaNeue': 'Arial',
  'TimesNewRomanPSMT': 'Times New Roman', 'TimesNewRomanPS-BoldMT': 'Times New Roman',
  'TimesNewRomanPS-ItalicMT': 'Times New Roman',
  'TimesNewRomanPS-BoldItalicMT': 'Times New Roman',
  'CourierNewPSMT': 'Courier New', 'CourierNew': 'Courier New',
  'Courier': 'Courier New',
  'CambriaMath': 'Cambria Math', 'Calibri': 'Calibri', 'Cambria': 'Cambria',
  'Georgia': 'Georgia', 'Verdana': 'Verdana', 'Tahoma': 'Tahoma',
  'Consolas': 'Consolas', 'LucidaConsole': 'Lucida Console',
  'SegoeUI': 'Segoe UI', 'TrebuchetMS': 'Trebuchet MS',
  'Garamond': 'Garamond', 'Palatino': 'Palatino Linotype',
  'BookAntiqua': 'Book Antiqua', 'Century': 'Century',
  'CenturyGothic': 'Century Gothic', 'Impact': 'Impact',
  'ComicSansMS': 'Comic Sans MS', 'LucidaSans': 'Lucida Sans',
  'PTSans': 'PT Sans', 'PTSerif': 'PT Serif', 'PTMono': 'PT Mono',
  'Roboto': 'Roboto', 'OpenSans': 'Open Sans', 'Lato': 'Lato',
  'Montserrat': 'Montserrat', 'SourceSansPro': 'Source Sans Pro',
  'Noto': 'Noto Sans', 'NotoSans': 'Noto Sans', 'NotoSerif': 'Noto Serif',
  'SimSun': 'SimSun', 'SimHei': 'SimHei', 'MSMincho': 'MS Mincho',
  'MSGothic': 'MS Gothic', 'MalgunGothic': 'Malgun Gothic',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map(c => c.toString(16).padStart(2, '0')).join('');
}

function grayToHex(g) { return rgbToHex(g, g, g); }

function cmykToHex(c, m, y, k) {
  const r = (1 - c) * (1 - k);
  const g = (1 - m) * (1 - k);
  const b = (1 - y) * (1 - k);
  return rgbToHex(r, g, b);
}

/** Strip subset prefix (e.g. "BCDFEE+ArialMT" → "ArialMT") and style suffixes. */
export function normalizeFontName(pdfName) {
  if (!pdfName) return 'Arial';
  const name = pdfName.replace(/^[A-Z]{6}\+/, '');
  // Try alias map first (before stripping suffixes)
  if (FONT_ALIAS[name]) return FONT_ALIAS[name];
  // Strip style suffixes
  const base = name
    .replace(/[-,](Bold|Italic|Oblique|Regular|Roman|Light|Medium|Thin|Heavy|Black|Demi|Semi|Condensed|Narrow|Wide|BoldItalic|BoldOblique|MT|PS).*/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  if (FONT_ALIAS[base]) return FONT_ALIAS[base];
  if (FONT_ALIAS[base.replace(/\s/g, '')]) return FONT_ALIAS[base.replace(/\s/g, '')];
  // Pattern fallback
  const lower = name.toLowerCase();
  if (/times|tnr/i.test(lower)) return 'Times New Roman';
  if (/arial|helvetica|helv/i.test(lower)) return 'Arial';
  if (/courier|mono|consola/i.test(lower)) return 'Courier New';
  if (/georgia/i.test(lower)) return 'Georgia';
  if (/verdana/i.test(lower)) return 'Verdana';
  if (/calibri/i.test(lower)) return 'Calibri';
  if (/cambria/i.test(lower)) return 'Cambria';
  if (/tahoma/i.test(lower)) return 'Tahoma';
  if (/segoe/i.test(lower)) return 'Segoe UI';
  if (/trebuchet/i.test(lower)) return 'Trebuchet MS';
  if (/palatino/i.test(lower)) return 'Palatino Linotype';
  if (/garamond/i.test(lower)) return 'Garamond';
  return base || 'Arial';
}

function isBoldFromName(name) {
  return /bold|black|heavy|demi(?!.*italic)/i.test(name || '');
}

function isItalicFromName(name) {
  return /italic|oblique|slant/i.test(name || '');
}

function classifyFontFamily(name) {
  if (!name) return 'sans-serif';
  const lower = name.toLowerCase();
  if (/courier|mono|consola|fixed|code|menlo|source\s?code/i.test(lower)) return 'monospace';
  if (/times|roman|garamond|palatino|georgia|serif|cambria|bodoni|caslon|century|baskerville|minion|book\s?antiqua/i.test(lower)) return 'serif';
  return 'sans-serif';
}

// ─── Transform matrix helpers ────────────────────────────────────────────────

function multiplyMatrices(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function transformPoint(x, y, matrix) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

// ─── Text extraction from getTextContent ─────────────────────────────────────

function processTextItems(items, styles, viewport) {
  const textRuns = [];
  const scale = viewport.scale;
  const pageHeight = viewport.height;

  for (const item of items) {
    if (!item.str && item.str !== '') continue;
    if (item.str === '' && !item.hasEOL) continue;
    if (!item.transform) continue;

    const tx = item.transform;
    // Font size from transform matrix
    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    if (fontSize < 0.5) continue;

    // Position in PDF coords (origin bottom-left)
    const x = tx[4];
    const y = tx[5];

    // Convert to top-left origin
    const topY = pageHeight / scale - y;

    // Font info from styles
    const styleName = item.fontName || '';
    const styleInfo = styles?.[styleName] || {};
    const rawFontFamily = styleInfo.fontFamily || styleName;

    const run = {
      text: item.str,
      x: x,
      y: topY,
      width: item.width || 0,
      height: Math.abs(item.height || fontSize),
      fontFamily: rawFontFamily,
      fontSize: Math.round(fontSize * 100) / 100,
      bold: isBoldFromName(styleName) || isBoldFromName(rawFontFamily),
      italic: isItalicFromName(styleName) || isItalicFromName(rawFontFamily),
      color: '#000000',
      charSpacing: 0,
      wordSpacing: 0,
      underline: false,
      strikethrough: false,
      superscript: false,
      subscript: false,
      _fontName: styleName, // internal: raw pdf font name
    };

    // Handle direction
    if (item.dir === 'rtl') {
      run._rtl = true;
    }

    textRuns.push(run);
  }

  return textRuns;
}

// ─── Vector path extraction from getOperatorList ─────────────────────────────

async function processOperatorList(opList, pdfPage, viewport) {
  const paths = [];
  const images = [];
  const pageHeight = viewport.height;
  const scale = viewport.scale;

  // Graphics state tracking
  const stateStack = [];
  let ctm = [scale, 0, 0, -scale, 0, pageHeight]; // PDF→screen transform
  let strokeColor = '#000000';
  let fillColor = '#000000';
  let lineWidth = 1;

  // Current path buffer
  let currentPath = [];

  function saveState() {
    stateStack.push({ ctm: [...ctm], strokeColor, fillColor, lineWidth });
  }

  function restoreState() {
    if (stateStack.length) {
      const s = stateStack.pop();
      ctm = s.ctm;
      strokeColor = s.strokeColor;
      fillColor = s.fillColor;
      lineWidth = s.lineWidth;
    }
  }

  function tp(x, y) {
    return transformPoint(x, y, ctm);
  }

  function flushPath(isStroke, isFill) {
    if (currentPath.length < 2) { currentPath = []; return; }

    for (let i = 0; i < currentPath.length - 1; i++) {
      const seg = currentPath[i];
      const next = currentPath[i + 1];

      if (seg.op === 'moveTo' && next.op === 'lineTo') {
        const p1 = tp(seg.x, seg.y);
        const p2 = tp(next.x, next.y);
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const effectiveWidth = lineWidth * Math.abs(ctm[0]);

        let subtype = null;
        if (dy < 1.5) subtype = 'horizontal';
        else if (dx < 1.5) subtype = 'vertical';

        if (subtype || (dx > 2 || dy > 2)) {
          paths.push({
            type: 'line',
            subtype,
            x1: Math.min(p1.x, p2.x), y1: Math.min(p1.y, p2.y),
            x2: Math.max(p1.x, p2.x), y2: Math.max(p1.y, p2.y),
            lineWidth: effectiveWidth,
            strokeColor: isStroke ? strokeColor : null,
            fillColor: isFill ? fillColor : null,
          });
        }
      }
    }

    // Check for rectangles (4-segment closed paths)
    if (currentPath.length >= 5) {
      const first = currentPath[0];
      const last = currentPath[currentPath.length - 1];
      if (first.op === 'moveTo' && last.op === 'closePath') {
        // Potential rectangle — extract bounding box
        const pts = currentPath.filter(s => s.x != null).map(s => tp(s.x, s.y));
        if (pts.length >= 4) {
          const xs = pts.map(p => p.x);
          const ys = pts.map(p => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const w = maxX - minX, h = maxY - minY;
          if (w > 2 && h > 2) {
            paths.push({
              type: 'rect', subtype: null,
              x1: minX, y1: minY, x2: maxX, y2: maxY,
              width: w, height: h,
              lineWidth: lineWidth * Math.abs(ctm[0]),
              strokeColor: isStroke ? strokeColor : null,
              fillColor: isFill ? fillColor : null,
            });
          }
        }
      }
    }

    currentPath = [];
  }

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (fn) {
      case OPS.save: saveState(); break;
      case OPS.restore: restoreState(); break;

      case OPS.transform:
        ctm = multiplyMatrices(ctm, args);
        break;

      case OPS.setLineWidth:
        lineWidth = args[0] || 1;
        break;

      case OPS.setStrokeRGBColor:
        strokeColor = rgbToHex(args[0], args[1], args[2]);
        break;
      case OPS.setFillRGBColor:
        fillColor = rgbToHex(args[0], args[1], args[2]);
        break;
      case OPS.setStrokeGray:
        strokeColor = grayToHex(args[0]);
        break;
      case OPS.setFillGray:
        fillColor = grayToHex(args[0]);
        break;
      case OPS.setStrokeCMYKColor:
        strokeColor = cmykToHex(args[0], args[1], args[2], args[3]);
        break;
      case OPS.setFillCMYKColor:
        fillColor = cmykToHex(args[0], args[1], args[2], args[3]);
        break;

      case OPS.moveTo:
        currentPath.push({ op: 'moveTo', x: args[0], y: args[1] });
        break;
      case OPS.lineTo:
        currentPath.push({ op: 'lineTo', x: args[0], y: args[1] });
        break;
      case OPS.curveTo:
        currentPath.push({ op: 'curveTo', x: args[4], y: args[5] });
        break;
      case OPS.curveTo2:
        currentPath.push({ op: 'curveTo2', x: args[2], y: args[3] });
        break;
      case OPS.curveTo3:
        currentPath.push({ op: 'curveTo3', x: args[2], y: args[3] });
        break;
      case OPS.closePath:
        currentPath.push({ op: 'closePath' });
        break;

      case OPS.rectangle: {
        const [rx, ry, rw, rh] = args;
        const p1 = tp(rx, ry);
        const p2 = tp(rx + rw, ry);
        const p3 = tp(rx + rw, ry + rh);
        const p4 = tp(rx, ry + rh);
        const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
        const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
        const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
        const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
        const w = maxX - minX, h = maxY - minY;

        // Generate line segments for each edge
        if (w > 1) {
          paths.push({ type: 'line', subtype: 'horizontal', x1: minX, y1: minY, x2: maxX, y2: minY, lineWidth: lineWidth * Math.abs(ctm[0]), strokeColor, fillColor: null });
          paths.push({ type: 'line', subtype: 'horizontal', x1: minX, y1: maxY, x2: maxX, y2: maxY, lineWidth: lineWidth * Math.abs(ctm[0]), strokeColor, fillColor: null });
        }
        if (h > 1) {
          paths.push({ type: 'line', subtype: 'vertical', x1: minX, y1: minY, x2: minX, y2: maxY, lineWidth: lineWidth * Math.abs(ctm[0]), strokeColor, fillColor: null });
          paths.push({ type: 'line', subtype: 'vertical', x1: maxX, y1: minY, x2: maxX, y2: maxY, lineWidth: lineWidth * Math.abs(ctm[0]), strokeColor, fillColor: null });
        }
        if (w > 2 && h > 2) {
          paths.push({ type: 'rect', subtype: null, x1: minX, y1: minY, x2: maxX, y2: maxY, width: w, height: h, lineWidth: lineWidth * Math.abs(ctm[0]), strokeColor, fillColor });
        }
        break;
      }

      case OPS.stroke:
      case OPS.closeStroke:
        flushPath(true, false);
        break;
      case OPS.fill:
      case OPS.eoFill:
        flushPath(false, true);
        break;
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEoFillStroke:
        flushPath(true, true);
        break;
      case OPS.endPath:
        currentPath = [];
        break;

      // Handle constructPath (pdf.js bundles path operations)
      case OPS.constructPath: {
        const ops = args[0];
        const pathArgs = args[1];
        let argIdx = 0;
        for (const op of ops) {
          switch (op) {
            case OPS.moveTo:
              currentPath.push({ op: 'moveTo', x: pathArgs[argIdx++], y: pathArgs[argIdx++] });
              break;
            case OPS.lineTo:
              currentPath.push({ op: 'lineTo', x: pathArgs[argIdx++], y: pathArgs[argIdx++] });
              break;
            case OPS.curveTo:
              argIdx += 4; // skip control points
              currentPath.push({ op: 'curveTo', x: pathArgs[argIdx++], y: pathArgs[argIdx++] });
              break;
            case OPS.rectangle: {
              const rx = pathArgs[argIdx++], ry = pathArgs[argIdx++];
              const rw = pathArgs[argIdx++], rh = pathArgs[argIdx++];
              currentPath.push({ op: 'moveTo', x: rx, y: ry });
              currentPath.push({ op: 'lineTo', x: rx + rw, y: ry });
              currentPath.push({ op: 'lineTo', x: rx + rw, y: ry + rh });
              currentPath.push({ op: 'lineTo', x: rx, y: ry + rh });
              currentPath.push({ op: 'closePath' });
              break;
            }
            case OPS.closePath:
              currentPath.push({ op: 'closePath' });
              break;
          }
        }
        break;
      }

      // ─── Image extraction ──────────────────────────────────────────────
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintJpegXObject: {
        const imgName = args?.[0];
        if (!imgName) break;

        try {
          let imgData = null;
          try { imgData = pdfPage.objs.get(imgName); } catch (_) { /* skip */ }
          if (!imgData) {
            try { imgData = pdfPage.commonObjs.get(imgName); } catch (_) { /* skip */ }
          }
          if (!imgData || !imgData.data) break;

          const w = imgData.width;
          const h = imgData.height;
          if (w < 20 || h < 20) break; // Skip tiny images

          // Image position from CTM
          const imgPos = tp(0, 0);
          const imgEnd = tp(1, 1);
          const imgWidth = Math.abs(imgEnd.x - imgPos.x);
          const imgHeight = Math.abs(imgEnd.y - imgPos.y);

          // Convert raw pixel data to PNG via canvas
          const canvas = typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(w, h)
            : document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          const idata = ctx.createImageData(w, h);

          // Handle both RGB and RGBA data
          const srcData = imgData.data;
          if (srcData.length === w * h * 4) {
            idata.data.set(srcData);
          } else if (srcData.length === w * h * 3) {
            for (let p = 0, s = 0; p < idata.data.length; p += 4, s += 3) {
              idata.data[p] = srcData[s];
              idata.data[p + 1] = srcData[s + 1];
              idata.data[p + 2] = srcData[s + 2];
              idata.data[p + 3] = 255;
            }
          } else {
            // Grayscale or other format — try copying as-is
            for (let p = 0; p < idata.data.length; p += 4) {
              const v = srcData[p / 4] || 0;
              idata.data[p] = idata.data[p + 1] = idata.data[p + 2] = v;
              idata.data[p + 3] = 255;
            }
          }
          ctx.putImageData(idata, 0, 0);

          let pngData;
          if (typeof canvas.convertToBlob === 'function') {
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            pngData = new Uint8Array(await blob.arrayBuffer());
          } else if (canvas.toBlob) {
            pngData = await new Promise(resolve => {
              canvas.toBlob(blob => {
                blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
              }, 'image/png');
            });
          }

          if (pngData && pngData.length > 100) {
            images.push({
              data: pngData,
              mimeType: 'image/png',
              x: Math.min(imgPos.x, imgEnd.x),
              y: Math.min(imgPos.y, imgEnd.y),
              width: imgWidth || w,
              height: imgHeight || h,
              altText: null,
            });
          }
        } catch (err) {
          console.warn('[pdf-content-extractor] image extraction error:', err?.message);
        }
        break;
      }
    }
  }

  return { paths, images };
}

// ─── Font information extraction ─────────────────────────────────────────────

function extractFontInfo(styles) {
  const fonts = new Map();

  if (!styles) return fonts;

  for (const [name, style] of Object.entries(styles)) {
    const rawName = style.fontFamily || name;
    fonts.set(name, {
      pdfName: name,
      baseName: normalizeFontName(rawName),
      family: classifyFontFamily(rawName),
      weight: isBoldFromName(rawName) || isBoldFromName(name) ? 700 : 400,
      style: isItalicFromName(rawName) || isItalicFromName(name) ? 'italic' : 'normal',
      isEmbedded: false,
      widths: null,
      descent: style.descent || -0.2,
      ascent: style.ascent || 0.8,
    });
  }

  return fonts;
}

// ─── Annotation extraction ───────────────────────────────────────────────────

async function extractAnnotations(pdfPage) {
  const annotations = [];
  try {
    const annots = await pdfPage.getAnnotations();
    for (const ann of annots) {
      if (ann.subtype === 'Link' && ann.url) {
        annotations.push({
          type: 'link',
          url: ann.url,
          rect: ann.rect, // [x1, y1, x2, y2] in PDF coords
        });
      }
    }
  } catch (_) { /* annotations not critical */ }
  return annotations;
}

// ─── Main extraction function ────────────────────────────────────────────────

/**
 * Extract all content from a PDF page using hybrid approach:
 * - Text via getTextContent() (reliable text extraction with font encoding)
 * - Vector paths and images via getOperatorList()
 *
 * @param {Object} pdfPage - pdf.js PDFPageProxy
 * @returns {Promise<ExtractedPage>}
 */
export async function extractPageContent(pdfPage) {
  const viewport = pdfPage.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;
  const rotation = pdfPage.rotate || 0;

  // Parallel extraction: text content + operator list + annotations
  const [textContent, opList, annotations] = await Promise.all([
    pdfPage.getTextContent({ includeMarkedContent: false }),
    pdfPage.getOperatorList(),
    extractAnnotations(pdfPage),
  ]);

  // Process text items
  const textRuns = processTextItems(textContent.items, textContent.styles, viewport);

  // Process operator list for paths and images
  const { paths, images } = await processOperatorList(opList, pdfPage, viewport);

  // Extract font info
  const fonts = extractFontInfo(textContent.styles);

  // Apply link annotations to text runs
  if (annotations.length) {
    for (const ann of annotations) {
      if (ann.type !== 'link' || !ann.rect) continue;
      const [ax1, ay1, ax2, ay2] = ann.rect;
      // Convert annotation rect to top-left origin
      const aTop = pageHeight - ay2;
      const aBottom = pageHeight - ay1;
      const aLeft = ax1;
      const aRight = ax2;

      for (const run of textRuns) {
        if (run.x >= aLeft - 2 && run.x + run.width <= aRight + 2 &&
            run.y >= aTop - 2 && run.y <= aBottom + 2) {
          run.url = ann.url;
        }
      }
    }
  }

  // Deduplicate near-identical paths (PDF sometimes renders same line twice)
  const dedupedPaths = deduplicatePaths(paths);

  return {
    pageNumber: pdfPage.pageNumber || pdfPage._pageIndex + 1,
    width: pageWidth,
    height: pageHeight,
    rotation,
    textRuns,
    paths: dedupedPaths,
    images,
    fonts,
    annotations,
  };
}

/** Remove near-duplicate paths (same position within 1pt tolerance). */
function deduplicatePaths(paths) {
  const result = [];
  const seen = new Set();

  for (const p of paths) {
    const key = `${p.type}:${Math.round(p.x1)}:${Math.round(p.y1)}:${Math.round(p.x2)}:${Math.round(p.y2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

/**
 * Extract font information from the entire PDF document.
 * @param {Object} pdfDoc - pdf.js PDFDocumentProxy
 * @returns {Promise<Map<string, Object>>}
 */
export async function extractDocumentFonts(pdfDoc) {
  const allFonts = new Map();
  const pageCount = pdfDoc.numPages;

  // Sample first 5 pages for font info (sufficient for most documents)
  const sampled = Math.min(pageCount, 5);
  for (let i = 1; i <= sampled; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent({ includeMarkedContent: false });
    const pageFonts = extractFontInfo(textContent.styles);
    for (const [name, info] of pageFonts) {
      if (!allFonts.has(name)) {
        allFonts.set(name, info);
      }
    }
  }

  return allFonts;
}
