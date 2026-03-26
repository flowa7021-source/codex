// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Stamp Manager
// Predefined and custom stamp library for PDF annotation
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, rgb } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StampDef
 * @property {string} id
 * @property {string} name
 * @property {Uint8Array|null} [imageBytes]
 * @property {number} [width]
 * @property {number} [height]
 * @property {{r: number, g: number, b: number}} [color]
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'novareader-stamps';

/** @type {StampDef[]} */
const STANDARD_STAMPS = [
  { id: 'approved',      name: 'APPROVED',      imageBytes: null, color: { r: 0, g: 0.6, b: 0 } },
  { id: 'rejected',      name: 'REJECTED',      imageBytes: null, color: { r: 0.8, g: 0, b: 0 } },
  { id: 'draft',         name: 'DRAFT',         imageBytes: null, color: { r: 0.5, g: 0.5, b: 0.5 } },
  { id: 'final',         name: 'FINAL',         imageBytes: null, color: { r: 0, g: 0, b: 0.7 } },
  { id: 'confidential',  name: 'CONFIDENTIAL',  imageBytes: null, color: { r: 0.7, g: 0, b: 0 } },
  { id: 'for_review',    name: 'FOR REVIEW',    imageBytes: null, color: { r: 0.8, g: 0.5, b: 0 } },
  { id: 'void',          name: 'VOID',          imageBytes: null, color: { r: 0.6, g: 0, b: 0 } },
];

// ---------------------------------------------------------------------------
// StampManager class
// ---------------------------------------------------------------------------

export class StampManager {
  constructor() {
    /** @type {Map<string, StampDef[]>} */
    this.stamps = new Map();
    this._initPredefined();
  }

  /** Initialize predefined stamp categories. */
  _initPredefined() {
    this.stamps.set('standard', STANDARD_STAMPS.map(s => ({ ...s })));
    this.stamps.set('dynamic', []);
    this.stamps.set('custom', []);
  }

  /**
   * Add a custom stamp.
   * @param {string} name
   * @param {Uint8Array|null} imageBytes
   * @param {string} [category]
   * @returns {StampDef}
   */
  addCustomStamp(name, imageBytes, category = 'custom') {
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    /** @type {StampDef} */
    const stamp = {
      id,
      name,
      imageBytes: imageBytes || null,
      color: { r: 0, g: 0, b: 0 },
    };

    if (!this.stamps.has(category)) {
      this.stamps.set(category, []);
    }
    this.stamps.get(category)?.push(stamp);
    return stamp;
  }

  /**
   * Remove a stamp by ID.
   * @param {string} id
   * @returns {boolean}
   */
  removeStamp(id) {
    for (const [, stamps] of this.stamps) {
      const idx = stamps.findIndex(s => s.id === id);
      if (idx >= 0) {
        stamps.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Rename a stamp by ID.
   * @param {string} id
   * @param {string} newName
   * @returns {boolean}
   */
  renameStamp(id, newName) {
    const stamp = this._findStamp(id);
    if (stamp) {
      stamp.name = newName;
      return true;
    }
    return false;
  }

  /**
   * Get stamps by category.
   * @param {string} category
   * @returns {StampDef[]}
   */
  getStampsByCategory(category) {
    return this.stamps.get(category) || [];
  }

  /**
   * Get all stamps across all categories.
   * @returns {StampDef[]}
   */
  getAllStamps() {
    const all = [];
    for (const [, stamps] of this.stamps) {
      all.push(...stamps);
    }
    return all;
  }

  /**
   * Apply a stamp to a specific page of a PDF.
   *
   * @param {Uint8Array|ArrayBuffer} pdfBytes
   * @param {string} stampId
   * @param {number} pageNum - 1-based
   * @param {{x: number, y: number}} position
   * @param {object} [options]
   * @param {number} [options.width]
   * @param {number} [options.height]
   * @param {number} [options.rotation]
   * @param {number} [options.opacity]
   * @returns {Promise<{blob: Blob}>}
   */
  async applyStamp(pdfBytes, stampId, pageNum, position, options = {}) {
    const {
      width = 200,
      height = 60,
      rotation = 0,
      opacity = 0.85,
    } = options;

    const stamp = this._findStamp(stampId);
    if (!stamp) {
      throw new Error(`Stamp not found: ${stampId}`);
    }

    const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const pageIdx = Math.max(0, Math.min(pageNum - 1, pages.length - 1));
    const page = pages[pageIdx];

    if (stamp.imageBytes && stamp.imageBytes.length > 0) {
      // Embed custom image stamp
      let img;
      if (stamp.imageBytes[0] === 0x89 && stamp.imageBytes[1] === 0x50) {
        img = await pdfDoc.embedPng(stamp.imageBytes);
      } else {
        img = await pdfDoc.embedJpg(stamp.imageBytes);
      }
      page.drawImage(img, {
        x: position.x,
        y: position.y,
        width,
        height,
        opacity,
        rotate: rotation ? /** @type {any} */ ({ type: 'degrees', angle: rotation }) : undefined,
      });
    } else {
      // Text-based stamp: draw bordered rectangle with text
      const { StandardFonts } = await import('pdf-lib');
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const color = stamp.color || { r: 0.8, g: 0, b: 0 };

      // Draw border rectangle
      page.drawRectangle({
        x: position.x,
        y: position.y,
        width,
        height,
        borderColor: rgb(color.r, color.g, color.b),
        borderWidth: 2,
        opacity: opacity * 0.15,
        color: rgb(color.r, color.g, color.b),
      });

      // Draw stamp text centered
      const fontSize = Math.min(height * 0.5, width / stamp.name.length * 1.5);
      const textWidth = font.widthOfTextAtSize(stamp.name, fontSize);
      const textX = position.x + (width - textWidth) / 2;
      const textY = position.y + (height - fontSize) / 2;

      page.drawText(stamp.name, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
      });
    }

    const bytes = await pdfDoc.save();
    return { blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }) };
  }

  /**
   * Export all custom stamps as a JSON blob.
   * @returns {Blob}
   */
  exportStamps() {
    const data = {};
    for (const [category, stamps] of this.stamps) {
      data[category] = stamps.map(s => ({
        id: s.id,
        name: s.name,
        imageBytes: s.imageBytes ? Array.from(s.imageBytes) : null,
        color: s.color,
      }));
    }
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }

  /**
   * Import stamps from a JSON blob.
   * @param {Blob|string} input
   * @returns {Promise<number>} number of stamps imported
   */
  async importStamps(input) {
    const text = typeof input === 'string' ? input : await input.text();
    const data = JSON.parse(text);
    let count = 0;

    for (const [category, stamps] of Object.entries(data)) {
      if (!Array.isArray(stamps)) continue;
      if (!this.stamps.has(category)) {
        this.stamps.set(category, []);
      }
      const categoryStamps = this.stamps.get(category);
      for (const s of stamps) {
        // Avoid duplicates
        if (categoryStamps?.find(existing => existing.id === s.id)) continue;
        categoryStamps?.push({
          id: s.id,
          name: s.name,
          imageBytes: s.imageBytes ? new Uint8Array(s.imageBytes) : null,
          color: s.color || { r: 0, g: 0, b: 0 },
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Save stamps to localStorage.
   * @returns {Promise<void>}
   */
  async save() {
    try {
      const blob = this.exportStamps();
      const text = await blob.text();
      localStorage.setItem(STORAGE_KEY, text);
    } catch (_e) { /* localStorage may not be available */ }
  }

  /**
   * Load stamps from localStorage.
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text) {
        await this.importStamps(text);
      }
    } catch (_e) { /* localStorage may not be available */ }
  }

  /**
   * Find a stamp by ID across all categories.
   * @param {string} id
   * @returns {StampDef|undefined}
   */
  _findStamp(id) {
    for (const [, stamps] of this.stamps) {
      const found = stamps.find(s => s.id === id);
      if (found) return found;
    }
    return undefined;
  }
}

export const stampManager = new StampManager();
