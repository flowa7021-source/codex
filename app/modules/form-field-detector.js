// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Form Field Detector
// Automatically detect and create fillable form fields in PDFs
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument } from 'pdf-lib';

/**
 * @typedef {Object} DetectedField
 * @property {string} type     - 'text'|'checkbox'|'radio'|'dropdown'|'signature'|'date'
 * @property {string} label    - detected label text
 * @property {string} name     - generated field name
 * @property {number} pageNum  - 1-based
 * @property {{x: number, y: number, width: number, height: number}} bounds
 * @property {number} confidence
 * @property {string[]} [options] - for dropdown/radio
 */

// ---------------------------------------------------------------------------
// Detection heuristics
// ---------------------------------------------------------------------------

/** Common form label patterns */
const LABEL_PATTERNS = {
  text: /(?:name|address|city|state|zip|phone|email|fax|title|company|street|apt|suite|department|occupation|employer)/i,
  date: /(?:date|dob|birth|expir|issued|effective|start|end)\b/i,
  checkbox: /(?:yes|no|agree|accept|check|select|opt-in|subscribe)/i,
  signature: /(?:signature|sign here|authorized|signed|witness)/i,
  dropdown: /(?:select one|choose|pick|option|country|state|province|gender|status|type|category)/i,
};

/** Common line/box patterns that suggest input fields */
const MIN_FIELD_WIDTH = 50;
const MIN_FIELD_HEIGHT = 12;
const _MAX_FIELD_HEIGHT = 80;

/**
 * Detect underline patterns (horizontal lines) that suggest text input fields.
 * @param {ImageData} imageData
 * @param {number} pageNum
 * @returns {DetectedField[]}
 */
function detectLineFields(imageData, pageNum) {
  const { width, height, data } = imageData;
  /** @type {DetectedField[]} */
  const fields = [];

  // Scan for horizontal dark lines (potential underlines)
  for (let y = 10; y < height - 10; y++) {
    let lineStart = -1;
    let lineLength = 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const isDark = brightness < 100;

      if (isDark) {
        if (lineStart === -1) lineStart = x;
        lineLength++;
      } else {
        if (lineLength >= MIN_FIELD_WIDTH) {
          // Check if this is a thin line (not thick text)
          const aboveBrightness = y > 2
            ? (data[((y - 3) * width + lineStart + lineLength / 2) * 4] +
               data[((y - 3) * width + lineStart + lineLength / 2) * 4 + 1] +
               data[((y - 3) * width + lineStart + lineLength / 2) * 4 + 2]) / 3
            : 255;

          if (aboveBrightness > 150) {
            fields.push({
              type: 'text',
              label: '',
              name: `field_${pageNum}_${y}_${lineStart}`,
              pageNum,
              bounds: { x: lineStart, y, width: lineLength, height: 20 },
              confidence: 0.6,
            });
          }
        }
        lineStart = -1;
        lineLength = 0;
      }
    }
  }

  return fields;
}

/**
 * Detect form fields from text content analysis.
 * @param {{str: string, transform: number[], width: number, height: number}[]} textItems
 * @param {number} pageNum
 * @param {number} _pageHeight
 * @returns {DetectedField[]}
 */
function detectFieldsFromText(textItems, pageNum, _pageHeight) {
  /** @type {DetectedField[]} */
  const fields = [];

  for (let i = 0; i < textItems.length; i++) {
    const item = textItems[i];
    const text = item.str.trim();
    if (!text) continue;

    // Check if this text matches a label pattern
    let fieldType = 'text';
    let confidence = 0.5;

    if (LABEL_PATTERNS.signature.test(text)) {
      fieldType = 'signature';
      confidence = 0.8;
    } else if (LABEL_PATTERNS.date.test(text)) {
      fieldType = 'date';
      confidence = 0.75;
    } else if (LABEL_PATTERNS.dropdown.test(text)) {
      fieldType = 'dropdown';
      confidence = 0.65;
    } else if (LABEL_PATTERNS.checkbox.test(text)) {
      fieldType = 'checkbox';
      confidence = 0.7;
    } else if (LABEL_PATTERNS.text.test(text)) {
      fieldType = 'text';
      confidence = 0.7;
    } else if (text.endsWith(':') || text.endsWith('_')) {
      fieldType = 'text';
      confidence = 0.55;
    } else {
      continue; // Not a label
    }

    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const fontSize = Math.abs(item.transform?.[0] ?? 12);

    // Field is positioned to the right of the label or below it
    const fieldX = x + (item.width || text.length * fontSize * 0.5) + 10;
    const fieldY = y - 2;
    const fieldWidth = Math.max(MIN_FIELD_WIDTH, 200);
    const fieldHeight = fieldType === 'checkbox' ? 14 : Math.max(MIN_FIELD_HEIGHT, fontSize + 8);

    const cleanName = text.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);

    fields.push({
      type: fieldType,
      label: text.replace(/:$/, '').trim(),
      name: `${cleanName}_${pageNum}`,
      pageNum,
      bounds: { x: fieldX, y: fieldY, width: fieldWidth, height: fieldHeight },
      confidence,
      options: fieldType === 'dropdown' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
    });
  }

  return fields;
}

/**
 * Merge overlapping field detections.
 * @param {DetectedField[]} fields
 * @returns {DetectedField[]}
 */
function mergeOverlapping(fields) {
  if (fields.length <= 1) return fields;

  // Sort by page, then y, then x
  fields.sort((a, b) => {
    if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
    if (Math.abs(a.bounds.y - b.bounds.y) > 10) return a.bounds.y - b.bounds.y;
    return a.bounds.x - b.bounds.x;
  });

  /** @type {DetectedField[]} */
  const merged = [fields[0]];

  for (let i = 1; i < fields.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = fields[i];

    // Check overlap
    const overlapX = prev.bounds.x < curr.bounds.x + curr.bounds.width &&
                     prev.bounds.x + prev.bounds.width > curr.bounds.x;
    const overlapY = Math.abs(prev.bounds.y - curr.bounds.y) < 15;

    if (overlapX && overlapY && prev.pageNum === curr.pageNum) {
      // Keep the one with higher confidence
      if (curr.confidence > prev.confidence) {
        merged[merged.length - 1] = curr;
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect potential form fields in a PDF page.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum - 1-based
 * @param {object} [options]
 * @param {boolean} [options.useVisualDetection] - also analyze rendered image
 * @param {number} [options.minConfidence]
 * @returns {Promise<DetectedField[]>}
 */
export async function detectFormFields(pdfBytes, pageNum, options = {}) {
  const { useVisualDetection = false, minConfidence = 0.5 } = options;

  const { getDocument } = await import('pdfjs-dist/build/pdf.mjs');
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await getDocument({ data: data.slice() }).promise;

  const page = await pdfDoc.getPage(pageNum);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });

  // Text-based detection
  const textItems = content.items.map(/** @param {any} item */ item => ({
    str: item.str ?? '',
    transform: item.transform ?? [12, 0, 0, 12, 0, 0],
    width: item.width ?? 0,
    height: item.height ?? 0,
  }));

  let fields = detectFieldsFromText(textItems, pageNum, viewport.height);

  // Visual detection (optional, slower)
  if (useVisualDetection) {
    try {
      const scale = 2.0;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const visualFields = detectLineFields(imageData, pageNum);
        fields = [...fields, ...visualFields];
      }
    } catch (_e) { /* skip visual detection */ }
  }

  pdfDoc.destroy();

  // Merge overlapping and filter by confidence
  fields = mergeOverlapping(fields);
  return fields.filter(f => f.confidence >= minConfidence);
}

/**
 * Automatically create fillable form fields based on detected fields.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {DetectedField[]} detectedFields
 * @returns {Promise<{blob: Blob, fieldCount: number}>}
 */
export async function autoCreateForm(pdfBytes, detectedFields) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  let fieldCount = 0;

  for (const field of detectedFields) {
    const pageIdx = Math.max(0, Math.min(field.pageNum - 1, pdfDoc.getPageCount() - 1));
    const page = pdfDoc.getPage(pageIdx);

    try {
      switch (field.type) {
        case 'text':
        case 'date': {
          const tf = form.createTextField(field.name);
          tf.addToPage(page, {
            x: field.bounds.x,
            y: field.bounds.y,
            width: field.bounds.width,
            height: field.bounds.height,
          });
          fieldCount++;
          break;
        }

        case 'checkbox': {
          const cb = form.createCheckBox(field.name);
          cb.addToPage(page, {
            x: field.bounds.x,
            y: field.bounds.y,
            width: 14,
            height: 14,
          });
          fieldCount++;
          break;
        }

        case 'dropdown': {
          const dd = form.createDropdown(field.name);
          dd.addOptions(field.options || ['Option 1', 'Option 2']);
          dd.addToPage(page, {
            x: field.bounds.x,
            y: field.bounds.y,
            width: field.bounds.width,
            height: field.bounds.height,
          });
          fieldCount++;
          break;
        }

        case 'signature': {
          // Signature fields are not directly supported by pdf-lib
          // Create a text field placeholder
          const sf = form.createTextField(field.name);
          sf.addToPage(page, {
            x: field.bounds.x,
            y: field.bounds.y,
            width: field.bounds.width,
            height: field.bounds.height,
          });
          fieldCount++;
          break;
        }

        default:
          break;
      }
    } catch (_e) {
      // Skip fields that fail (e.g. duplicate names)
    }
  }

  const bytes = await pdfDoc.save();
  return {
    blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }),
    fieldCount,
  };
}

// Exported for testing
export { detectFieldsFromText, mergeOverlapping, LABEL_PATTERNS, detectLineFields };
