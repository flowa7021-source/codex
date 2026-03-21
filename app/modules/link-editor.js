/**
 * @module link-editor
 * @description Add, edit, and remove hyperlinks in PDF documents.
 *
 * Supports:
 *   • Internal links (go-to-page destinations)
 *   • External URL links
 *   • Link appearance (border, color, highlight)
 *   • Visual link overlay for editing existing links
 *   • Batch link operations (remove all, update domain)
 *
 * Usage:
 *   import { addLink, removeLink, getPageLinks, LinkEditor } from './link-editor.js';
 *
 *   const blob = await addLink(pdfBytes, pageNum, rect, { url: 'https://example.com' });
 */

import { PDFDocument, PDFName, PDFArray, PDFString } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

// ---------------------------------------------------------------------------
// Public API — Add link
// ---------------------------------------------------------------------------

/**
 * Add a hyperlink annotation to a PDF page.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum – 1-based
 * @param {{ x: number, y: number, width: number, height: number }} rect – PDF coords (bottom-left)
 * @param {Object} link
 * @param {string} [link.url]        – external URL
 * @param {number} [link.destPage]   – internal page destination (1-based)
 * @param {{ r:number, g:number, b:number }} [link.color] – border colour
 * @param {number} [link.borderWidth=0]
 * @returns {Promise<Blob>}
 */
export async function addLink(pdfBytes, pageNum, rect, link) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const ctx    = pdfDoc.context;
  const page   = pdfDoc.getPages()[pageNum - 1];
  if (!page) throw new Error(`Page ${pageNum} not found`);

  // Build annotation dict
  const annotDict = ctx.obj({
    Type:    'Annot',
    Subtype: 'Link',
    Rect:    [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border:  [0, 0, link.borderWidth ?? 0],
    F:       4,   // Print flag
  });

  // Set action
  if (link.url) {
    annotDict.set(PDFName.of('A'), ctx.obj({
      Type: 'Action',
      S:    'URI',
      URI:  PDFString.of(link.url),
    }));
  } else if (link.destPage) {
    const destPageRef = pdfDoc.getPages()[link.destPage - 1]?.ref;
    if (destPageRef) {
      annotDict.set(PDFName.of('Dest'), ctx.obj([destPageRef, PDFName.of('Fit')]));
    }
  }

  // Optional color
  if (link.color) {
    annotDict.set(PDFName.of('C'), ctx.obj([link.color.r, link.color.g, link.color.b]));
  }

  const annotRef = ctx.register(annotDict);

  // Add to page's Annots array
  const existingAnnots = page.node.get(PDFName.of('Annots'));
  if (existingAnnots) {
    const arr = ctx.lookup(existingAnnots);
    if (arr instanceof PDFArray) {
      arr.push(annotRef);
    } else {
      page.node.set(PDFName.of('Annots'), ctx.obj([existingAnnots, annotRef]));
    }
  } else {
    page.node.set(PDFName.of('Annots'), ctx.obj([annotRef]));
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Remove link
// ---------------------------------------------------------------------------

/**
 * Remove a link annotation by index from a page.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum – 1-based
 * @param {number} linkIndex – 0-based index among Link annotations on the page
 * @returns {Promise<Blob>}
 */
export async function removeLink(pdfBytes, pageNum, linkIndex) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const ctx    = pdfDoc.context;
  const page   = pdfDoc.getPages()[pageNum - 1];
  if (!page) throw new Error(`Page ${pageNum} not found`);

  const annotsRef = page.node.get(PDFName.of('Annots'));
  if (!annotsRef) return new Blob([data], { type: 'application/pdf' });

  const annots = ctx.lookup(annotsRef);
  if (!(annots instanceof PDFArray)) return new Blob([data], { type: 'application/pdf' });

  // Find Link annotations
  let linkCount = 0;
  const newAnnots = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref  = annots.get(i);
    const dict = ctx.lookup(ref);
    const sub  = dict?.get?.(PDFName.of('Subtype'));
    const isLink = sub && String(sub).includes('Link');

    if (isLink && linkCount === linkIndex) {
      linkCount++;
      continue;   // skip this one (remove it)
    }
    if (isLink) linkCount++;
    newAnnots.push(ref);
  }

  if (newAnnots.length === 0) {
    page.node.delete(PDFName.of('Annots'));
  } else {
    page.node.set(PDFName.of('Annots'), ctx.obj(newAnnots));
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

/**
 * Remove ALL link annotations from the entire document.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<Blob>}
 */
export async function removeAllLinks(pdfBytes) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const ctx    = pdfDoc.context;

  for (const page of pdfDoc.getPages()) {
    const annotsRef = page.node.get(PDFName.of('Annots'));
    if (!annotsRef) continue;

    const annots = ctx.lookup(annotsRef);
    if (!(annots instanceof PDFArray)) continue;

    const kept = [];
    for (let i = 0; i < annots.size(); i++) {
      const ref  = annots.get(i);
      const dict = ctx.lookup(ref);
      const sub  = dict?.get?.(PDFName.of('Subtype'));
      if (sub && String(sub).includes('Link')) continue;
      kept.push(ref);
    }

    if (kept.length === 0) {
      page.node.delete(PDFName.of('Annots'));
    } else {
      page.node.set(PDFName.of('Annots'), ctx.obj(kept));
    }
  }

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Get links
// ---------------------------------------------------------------------------

/**
 * Extract all link annotations from a page.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum – 1-based
 * @returns {Promise<Array<{ rect: Object, url?: string, destPage?: number, index: number }>>}
 */
export async function getPageLinks(pdfBytes, pageNum) {
  const data     = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfJsDoc = await getDocument({ data: data.slice() }).promise;
  const page     = await pdfJsDoc.getPage(pageNum);
  const annots   = await page.getAnnotations();

  const links = [];
  let idx = 0;

  for (const annot of annots) {
    if (annot.subtype !== 'Link') continue;

    const link = {
      index: idx++,
      rect: {
        x:      annot.rect[0],
        y:      annot.rect[1],
        width:  annot.rect[2] - annot.rect[0],
        height: annot.rect[3] - annot.rect[1],
      },
    };

    if (annot.url) {
      link.url = annot.url;
    } else if (annot.dest) {
      link.destPage = typeof annot.dest === 'number' ? annot.dest + 1 : null;
    }

    links.push(link);
  }

  pdfJsDoc.destroy();
  return links;
}

// ---------------------------------------------------------------------------
// LinkEditor — UI controller
// ---------------------------------------------------------------------------

export class LinkEditor {
  /**
   * @param {HTMLElement} container – page container element
   * @param {Object} deps
   * @param {Function} deps.getPdfBytes – () => Uint8Array
   * @param {Function} deps.getPageNum  – () => number (1-based)
   * @param {Function} deps.onApply     – (blob: Blob) => void
   * @param {number}   deps.pageWidthPt
   * @param {number}   deps.pageHeightPt
   * @param {number}   [deps.zoom=1]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._links     = [];
    this._overlay   = null;
  }

  async open() {
    const pdfBytes = this._deps.getPdfBytes();
    const pageNum  = this._deps.getPageNum();
    this._links = await getPageLinks(pdfBytes, pageNum);
    this._buildPanel();
    this._buildOverlay();
  }

  close() {
    if (this._panel)   { this._panel.remove();   this._panel   = null; }
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
  }

  _buildPanel() {
    this._panel = document.createElement('div');
    this._panel.style.cssText = [
      'position:absolute', 'top:20px', 'right:20px',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:16px', 'z-index:9000', 'width:300px', 'max-height:60vh',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
      'display:flex', 'flex-direction:column', 'overflow:hidden',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;margin-bottom:10px';
    const title = document.createElement('h3');
    title.textContent = `Links (${this._links.length})`;
    title.style.cssText = 'margin:0;font-size:14px;font-weight:600;flex:1';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none;background:transparent;color:#888;font-size:16px;cursor:pointer';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    this._panel.appendChild(header);

    // Add link button
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Link';
    addBtn.style.cssText = 'padding:5px 12px;border:1px solid #555;border-radius:3px;background:#3c3c3c;color:#ddd;font-size:12px;cursor:pointer;margin-bottom:8px';
    addBtn.addEventListener('click', () => this._showAddForm());
    this._panel.appendChild(addBtn);

    // Links list
    const list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto';

    for (const link of this._links) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:6px 8px;border-bottom:1px solid #333;display:flex;align-items:center;gap:8px;font-size:12px';

      const info = document.createElement('span');
      info.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      info.textContent = link.url ?? (link.destPage ? `Page ${link.destPage}` : 'Unknown');
      info.style.color = link.url ? '#569cd6' : '#aaa';
      item.appendChild(info);

      const delBtn = document.createElement('span');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'color:#888;cursor:pointer;font-size:11px';
      delBtn.addEventListener('click', async () => {
        const pdfBytes = this._deps.getPdfBytes();
        const blob = await removeLink(pdfBytes, this._deps.getPageNum(), link.index);
        this._deps.onApply(blob);
        this.close();
      });
      item.appendChild(delBtn);

      list.appendChild(item);
    }

    if (this._links.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No links on this page.';
      empty.style.cssText = 'color:#888;font-size:12px;text-align:center;padding:16px';
      list.appendChild(empty);
    }

    this._panel.appendChild(list);
    this._container.appendChild(this._panel);
  }

  _buildOverlay() {
    if (this._links.length === 0) return;

    this._overlay = document.createElement('canvas');
    const zoom = this._deps.zoom ?? 1;
    this._overlay.width  = Math.round(this._deps.pageWidthPt * zoom);
    this._overlay.height = Math.round(this._deps.pageHeightPt * zoom);
    this._overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:40';

    const ctx = this._overlay.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = 'rgba(0, 120, 212, 0.6)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 3]);

    for (const link of this._links) {
      const r = link.rect;
      const x = r.x * zoom;
      const y = (this._deps.pageHeightPt - r.y - r.height) * zoom;  // flip Y
      const w = r.width * zoom;
      const h = r.height * zoom;
      ctx.strokeRect(x, y, w, h);
    }

    this._container.style.position = 'relative';
    this._container.appendChild(this._overlay);
  }

  _showAddForm() {
    // Simple prompt for URL
    const url = prompt('Enter URL:');
    if (!url) return;

    // Default rect: center of page, 200×20pt
    const pw = this._deps.pageWidthPt;
    const ph = this._deps.pageHeightPt;
    const rect = { x: pw / 4, y: ph / 2, width: pw / 2, height: 20 };

    const pdfBytes = this._deps.getPdfBytes();
    addLink(pdfBytes, this._deps.getPageNum(), rect, { url }).then(blob => {
      this._deps.onApply(blob);
      this.close();
    });
  }
}
