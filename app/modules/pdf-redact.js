// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF Redaction Module
// Permanently remove sensitive information from PDF documents
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Predefined patterns for common PII
const REDACTION_PATTERNS = {
  email: { label: 'Email', regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  phone_ru: { label: 'Телефон (РФ)', regex: /(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g },
  phone_intl: { label: 'Телефон (межд.)', regex: /\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{2,4}/g },
  inn: { label: 'ИНН', regex: /\b\d{10,12}\b/g },
  card_number: { label: 'Номер карты', regex: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g },
  passport_ru: { label: 'Паспорт (РФ)', regex: /\d{2}\s?\d{2}\s?\d{6}/g },
  snils: { label: 'СНИЛС', regex: /\d{3}\-\d{3}\-\d{3}\s?\d{2}/g },
  date: { label: 'Дата', regex: /\b\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}\b/g },
  ssn_us: { label: 'SSN (US)', regex: /\b\d{3}\-\d{2}\-\d{4}\b/g },
};

export class PdfRedactor {
  constructor() {
    this.redactions = new Map(); // pageNum → [{x, y, w, h, type, pattern, text}]
    this.previewColor = { r: 1, g: 0, b: 0 }; // Red for preview
    this.fillColor = { r: 0, g: 0, b: 0 };     // Black for applied
  }

  /** Mark a rectangular area for redaction on a specific page */
  markArea(pageNum, bounds) {
    if (!this.redactions.has(pageNum)) this.redactions.set(pageNum, []);
    this.redactions.get(pageNum).push({
      ...bounds,
      type: 'area',
      id: crypto.randomUUID(),
    });
    return this;
  }

  /** Find and mark text matching a pattern across all pages */
  async markPattern(patternKey, textContentByPage) {
    const pattern = REDACTION_PATTERNS[patternKey];
    if (!pattern) throw new Error(`Unknown pattern: ${patternKey}`);

    let totalFound = 0;
    for (const [pageNum, items] of Object.entries(textContentByPage)) {
      const fullText = items.map(item => item.str).join('');
      const matches = [...fullText.matchAll(new RegExp(pattern.regex))];

      for (const match of matches) {
        // Find bounding boxes for matched text
        const bounds = this._findTextBounds(items, match[0], match.index);
        if (bounds.length) {
          if (!this.redactions.has(Number(pageNum))) this.redactions.set(Number(pageNum), []);
          for (const b of bounds) {
            this.redactions.get(Number(pageNum)).push({
              ...b,
              type: 'pattern',
              pattern: patternKey,
              text: match[0],
              id: crypto.randomUUID(),
            });
          }
          totalFound++;
        }
      }
    }
    return totalFound;
  }

  /** Mark text by custom regex */
  async markRegex(regexStr, flags, textContentByPage) {
    let regex;
    try {
      regex = new RegExp(regexStr, flags || 'g');
    } catch (err) {
      console.warn('[pdf-ops] error:', err?.message);
      throw new Error(`Invalid regex: ${regexStr}`);
    }

    let totalFound = 0;
    for (const [pageNum, items] of Object.entries(textContentByPage)) {
      const fullText = items.map(item => item.str).join('');
      const matches = [...fullText.matchAll(regex)];

      for (const match of matches) {
        const bounds = this._findTextBounds(items, match[0], match.index);
        if (bounds.length) {
          if (!this.redactions.has(Number(pageNum))) this.redactions.set(Number(pageNum), []);
          for (const b of bounds) {
            this.redactions.get(Number(pageNum)).push({
              ...b,
              type: 'regex',
              text: match[0],
              id: crypto.randomUUID(),
            });
          }
          totalFound++;
        }
      }
    }
    return totalFound;
  }

  /** Remove a specific redaction mark by ID */
  removeMark(id) {
    for (const [pageNum, marks] of this.redactions) {
      const idx = marks.findIndex(m => m.id === id);
      if (idx !== -1) {
        marks.splice(idx, 1);
        if (marks.length === 0) this.redactions.delete(pageNum);
        return true;
      }
    }
    return false;
  }

  /** Clear all redaction marks */
  clearAll() {
    this.redactions.clear();
  }

  /** Get all redaction marks */
  getMarks() {
    const result = [];
    for (const [pageNum, marks] of this.redactions) {
      for (const mark of marks) {
        result.push({ pageNum, ...mark });
      }
    }
    return result;
  }

  /** Get count of marks */
  get count() {
    let total = 0;
    for (const marks of this.redactions.values()) total += marks.length;
    return total;
  }

  /**
   * Apply redactions PERMANENTLY to a PDF.
   * This is IRREVERSIBLE — content under redacted areas is removed.
   */
  async applyRedactions(pdfBytes, options = {}) {
    const {
      cleanMetadata = true,
      fillColor = this.fillColor,
      overlayText = '',
    } = options;

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    for (const [pageNum, areas] of this.redactions) {
      const page = pdfDoc.getPage(pageNum - 1);
      if (!page) continue;

      const { height } = page.getSize();

      for (const area of areas) {
        // Draw opaque black rectangle over the area
        page.drawRectangle({
          x: area.x,
          y: height - area.y - area.h,
          width: area.w,
          height: area.h,
          color: rgb(fillColor.r, fillColor.g, fillColor.b),
          opacity: 1,
          borderWidth: 0,
        });

        // Optional overlay text (e.g., "REDACTED")
        if (overlayText) {
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const fontSize = Math.min(area.h * 0.6, 12);
          const textWidth = font.widthOfTextAtSize(overlayText, fontSize);
          if (textWidth < area.w) {
            page.drawText(overlayText, {
              x: area.x + (area.w - textWidth) / 2,
              y: height - area.y - area.h + (area.h - fontSize) / 2,
              size: fontSize,
              font,
              color: rgb(1, 1, 1),
            });
          }
        }
      }
    }

    // Clean metadata if requested
    if (cleanMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('NovaReader');
      pdfDoc.setCreator('NovaReader');
    }

    const savedBytes = await pdfDoc.save();
    return {
      blob: new Blob([/** @type {any} */ (savedBytes)], { type: 'application/pdf' }),
      redactedCount: this.count,
      metadataCleaned: cleanMetadata,
    };
  }

  /** Draw preview markers on a canvas context (red semi-transparent rectangles) */
  drawPreview(ctx, pageNum, scale = 1) {
    const marks = this.redactions.get(pageNum);
    if (!marks || !marks.length) return;

    ctx.save();
    for (const mark of marks) {
      // Semi-transparent red rectangle
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(mark.x * scale, mark.y * scale, mark.w * scale, mark.h * scale);

      // Red border
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mark.x * scale, mark.y * scale, mark.w * scale, mark.h * scale);

      // "REDACTED" label if area is big enough
      if (mark.w * scale > 60 && mark.h * scale > 14) {
        ctx.font = `${Math.min(10, mark.h * scale * 0.5)}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('REDACTED', (mark.x + mark.w / 2) * scale, (mark.y + mark.h / 2) * scale);
      }
    }
    ctx.restore();
  }

  // ── Internal helpers ──

  _findTextBounds(items, searchText, charOffset) {
    const bounds = [];

    // Build a char-to-item mapping: precompute global start offset for each item
    const itemOffsets = [];
    let runningOffset = 0;
    for (const item of items) {
      itemOffsets.push(runningOffset);
      runningOffset += item.str.length;
    }

    const matchStart = charOffset;
    const matchEnd = charOffset + searchText.length;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const itemStart = itemOffsets[idx];
      const itemEnd = itemStart + item.str.length;

      // Check if this item overlaps with the matched region (global positions)
      if (itemEnd > matchStart && itemStart < matchEnd) {
        const tx = item.transform?.[4] || 0;
        const ty = item.transform?.[5] || 0;
        const w = item.width || item.str.length * 6;
        const h = item.height || 12;

        bounds.push({ x: tx, y: ty - h, w, h: h * 1.2 });
      }
    }

    return bounds;
  }
}

export const redactor = new PdfRedactor();
export { REDACTION_PATTERNS };
