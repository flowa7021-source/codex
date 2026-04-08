// @ts-check
// ─── ePub Adapter ────────────────────────────────────────────────────────────
// Parses ePub files using the `epubjs` library (v0.3.93) which provides:
//   - Proper OPF/NCX/NAV document parsing (replaces regex)
//   - DOM-based content extraction (replaces stripHtmlTags regex)
//   - Structured text with heading hierarchy, list items, blockquotes
//   - Correct spine ordering and NCX/NAV-based TOC
//
// Public API is identical to the previous implementation so app.js
// wiring requires no changes.

import ePub from 'epubjs';

// ─── DOM-based text extraction ────────────────────────────────────────────────
// Replaces the old regex stripHtmlTags; works on a real DOM Document object.

/**
 * @typedef {Object} TextBlock
 * @property {'h1'|'h2'|'h3'|'p'|'li'|'blockquote'|'code'|'hr'} type
 * @property {string} text
 */

/**
 * Walk a DOM element and extract structured text blocks.
 * Handles headings (h1-h6), paragraphs, lists, blockquotes, pre/code.
 * @param {Element} root
 * @returns {TextBlock[]}
 */
function domToBlocks(root) {
  /** @type {TextBlock[]} */
  const blocks = [];

  /**
   * @param {Element} el
   */
  function walk(el) {
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;

    // Block elements — gather text and emit
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      const type = /** @type {'h1'|'h2'|'h3'} */ (level <= 3 ? `h${level}` : 'h3');
      blocks.push({ type, text: el.textContent?.trim() || '' });
      return;
    }
    if (tag === 'p' || tag === 'div') {
      const text = el.textContent?.trim();
      if (text) blocks.push({ type: 'p', text });
      return;
    }
    if (tag === 'li') {
      const text = el.textContent?.trim();
      if (text) blocks.push({ type: 'li', text });
      return;
    }
    if (tag === 'blockquote') {
      const text = el.textContent?.trim();
      if (text) blocks.push({ type: 'blockquote', text });
      return;
    }
    if (tag === 'pre' || tag === 'code') {
      const text = el.textContent?.trim();
      if (text) blocks.push({ type: 'code', text });
      return;
    }
    if (tag === 'hr') {
      blocks.push({ type: 'hr', text: '' });
      return;
    }

    // Recurse for container elements
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  }

  walk(root);
  return blocks;
}

/**
 * Convert a DOM Document (from epubjs section load) to plain text + blocks.
 * @param {Document} doc
 * @returns {{ text: string, blocks: TextBlock[] }}
 */
function docToTextAndBlocks(doc) {
  const body = doc.body || doc.documentElement;
  const blocks = domToBlocks(body);
  const text = blocks.map(b => b.text).filter(Boolean).join('\n\n');
  return { text, blocks };
}

// ─── parseEpub ───────────────────────────────────────────────────────────────

/**
 * Parse an EPUB ArrayBuffer using epubjs.
 * Returns the same shape as the previous implementation so EpubAdapter
 * can be constructed identically.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{
 *   chapters: Array<{title: string|null, text: string, blocks: TextBlock[], html: string, href: string}>,
 *   toc: Array<{title: string, src: string}>,
 *   bytes: Uint8Array,
 *   css: Array<{href: string, content: string}>,
 *   fonts: Array<{href: string, data: Uint8Array, mime: string, name: string}>,
 *   meta: {title: string, author: string, description: string}
 * }>}
 */
export async function parseEpub(arrayBuffer) {
  const book = ePub(arrayBuffer.slice(0));
  await book.ready;

  // Metadata
  const metadata = await book.loaded.metadata.catch(() => ({}));
  const meta = {
    title: /** @type {any} */ (metadata).title || '',
    author: /** @type {any} */ (metadata).creator || '',
    description: /** @type {any} */ (metadata).description || '',
  };

  // Navigation / TOC
  const navigation = await book.loaded.navigation.catch(() => null);
  const toc = _navItemsToToc(navigation?.toc || []);

  // Spine → chapters
  const chapters = [];
  const spineItems = book.spine?.items || [];

  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    try {
      // Load section as a DOM Document
      const section = book.spine?.get(i);
      if (!section) continue;

      // epubjs section.load() resolves to a Document when a custom resolver is provided
      // We use book.load() which fetches assets from the zip archive
      const doc = await section.load(book.load.bind(book));

      let text = '';
      let blocks = /** @type {TextBlock[]} */ ([]);
      let html = '';
      let title = null;

      if (doc && typeof doc === 'object' && doc.body) {
        ({ text, blocks } = docToTextAndBlocks(/** @type {Document} */ (doc)));
        html = /** @type {Document} */ (doc).documentElement?.outerHTML || '';
        // Attempt to get title from heading or <title>
        const h1 = /** @type {Document} */ (doc).querySelector('h1, h2, h3, title');
        title = h1?.textContent?.trim().slice(0, 100) || null;
      }

      chapters.push({
        title: title || toc[i]?.title || `Chapter ${i + 1}`,
        text,
        blocks,
        html,
        href: item.href || '',
      });

      // Unload to free memory (epubjs keeps DOM in memory otherwise)
      section.unload?.();
    } catch (err) {
      console.warn(`[epub-adapter] failed to load section ${i}:`, err.message);
      chapters.push({ title: `Chapter ${i + 1}`, text: '', blocks: [], html: '', href: '' });
    }
  }

  const bytes = new Uint8Array(arrayBuffer);

  // Destroy epubjs book to release workers/memory
  book.destroy();

  return { chapters, toc, bytes, css: [], fonts: [], meta };
}

/**
 * Convert epubjs navigation toc items to the flat format expected by EpubAdapter.
 * @param {any[]} items
 * @returns {Array<{title: string, src: string}>}
 */
function _navItemsToToc(items) {
  /** @type {Array<{title: string, src: string}>} */
  const result = [];
  for (const item of (items || [])) {
    result.push({ title: item.label?.trim() || item.id || '', src: item.href || '' });
    if (item.subitems?.length) {
      result.push(..._navItemsToToc(item.subitems));
    }
  }
  return result;
}

// ─── Internal helpers (kept for backwards-compat test exports) ───────────────

/** @internal */
export function stripHtmlTags(html) {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body?.textContent?.replace(/\n{3,}/g, '\n\n').trim() || '';
    } catch (_e) { /* fall through to regex */ }
  }
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** @internal — kept for unit tests */
export function parseContainer(containerXml) {
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match ? match[1] : null;
}

/** @internal — kept for unit tests */
export function parseOpf(opfXml, basePath) {
  const items = {};
  const spine = [];
  const manifestMatches = opfXml.matchAll(/<item\s[^>]*?id="([^"]*)"[^>]*?href="([^"]*)"[^>]*?media-type="([^"]*)"[^>]*/g);
  for (const m of manifestMatches) {
    items[m[1]] = { href: basePath + m[2], mediaType: m[3] };
  }
  const spineMatches = opfXml.matchAll(/<itemref\s[^>]*?idref="([^"]*)"/g);
  for (const m of spineMatches) {
    if (items[m[1]]) spine.push(items[m[1]]);
  }
  // Extract NCX toc href
  let tocHref = null;
  const tocMatches = opfXml.matchAll(/<item\s[^>]*?href="([^"]*)"[^>]*?media-type="application\/x-dtbncx\+xml"/g);
  for (const m of tocMatches) { tocHref = basePath + m[1]; break; }
  return { items, spine, tocHref };
}

/** @internal — kept for unit tests */
export function extractChapterTitle(html) {
  const headingMatch = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/is);
  if (headingMatch) return stripHtmlTags(headingMatch[1]).trim().slice(0, 100);
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  if (titleMatch) return stripHtmlTags(titleMatch[1]).trim().slice(0, 100);
  return null;
}

/** @internal — kept for unit tests */
export function parseToc(ncxXml) {
  const items = [];
  const matches = ncxXml.matchAll(/<navPoint[^>]*>[\s\S]*?<text>(.*?)<\/text>[\s\S]*?<content\s+src="([^"]*)"[\s\S]*?<\/navPoint>/g);
  for (const m of matches) {
    items.push({ title: stripHtmlTags(m[1]), src: m[2] });
  }
  return items;
}

// ─── EpubAdapter ─────────────────────────────────────────────────────────────

export const EPUB_READER_DEFAULTS = {
  fontSize: 16,
  lineHeight: 1.6,
  fontFamily: 'serif',
  marginH: 40,
  theme: 'auto',
};

export class EpubAdapter {
  constructor(epubData, fileName) {
    this.fileName = fileName;
    this.type = 'epub';
    this.chapters = epubData.chapters;
    this.toc = epubData.toc;
    this.epubBytes = epubData.bytes;
    this.meta = epubData.meta || {};
    this.css = epubData.css || [];
    this.fonts = epubData.fonts || [];
    this.pageCount = this.chapters.length || 1;
    this.readerSettings = { ...EPUB_READER_DEFAULTS };
    this._fontUrls = [];
  }

  setReaderSettings(settings) {
    Object.assign(this.readerSettings, settings);
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const w = 800 * scale;
    const h = 1100 * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  /**
   * Render a chapter onto a canvas.
   * Uses the structured blocks produced by epubjs + DOM parsing to render
   * headings (bold, larger), paragraphs, list items (with bullet), blockquotes
   * (italic + left bar), code (monospace + bg), and horizontal rules.
   *
   * @param {number} pageNumber  1-based
   * @param {HTMLCanvasElement} canvas
   * @param {{zoom: number, rotation: number}} opts
   */
  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const chapter = this.chapters[pageNumber - 1];
    const rs = this.readerSettings;
    const dpr = Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const baseW = 800;
    const baseH = 1100;
    const w = baseW * zoom;
    const h = baseH * zoom;

    if (rotation % 180 === 0) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = Math.round(h * dpr);
      canvas.height = Math.round(w * dpr);
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    if (rotation !== 0) {
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
    }

    const theme = rs.theme === 'auto' ? this._detectTheme() : rs.theme;
    const colors = this._getThemeColors(theme);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    if (!chapter) {
      ctx.fillStyle = colors.muted;
      ctx.font = `${16 * zoom}px ${rs.fontFamily}`;
      ctx.fillText('Empty chapter', rs.marginH * zoom, 60 * zoom);
      ctx.restore();
      return;
    }

    const margin = Math.round(rs.marginH * zoom);
    const maxWidth = w - margin * 2;
    const bodySize = Math.round(rs.fontSize * zoom);
    const lineH = Math.round(bodySize * rs.lineHeight);

    let y = margin;

    // Chapter title banner (from metadata or heading)
    const titleText = chapter.title || `Chapter ${pageNumber}`;
    const titleSize = Math.round((rs.fontSize + 8) * zoom);
    ctx.fillStyle = colors.title;
    ctx.font = `bold ${titleSize}px ${rs.fontFamily}`;
    y += titleSize;
    this._wrapText(ctx, titleText, margin, y, maxWidth, titleSize * rs.lineHeight, colors.title);
    y += titleSize * rs.lineHeight + lineH * 0.5;

    // Render blocks from the epubjs-parsed document structure
    const blocks = chapter.blocks?.length ? chapter.blocks : this._textToBlocks(chapter.text || '');

    for (const block of blocks) {
      if (y > h - margin) break;

      switch (block.type) {
        case 'h1':
        case 'h2':
        case 'h3': {
          const sizes = { h1: bodySize * 1.6, h2: bodySize * 1.35, h3: bodySize * 1.15 };
          const sz = Math.round(sizes[block.type]);
          y += sz * 0.4;
          ctx.font = `bold ${sz}px ${rs.fontFamily}`;
          y = this._wrapText(ctx, block.text, margin, y, maxWidth, sz * rs.lineHeight, colors.title);
          y += sz * 0.2;
          break;
        }
        case 'blockquote': {
          // Left bar + italic
          ctx.fillStyle = colors.muted;
          ctx.fillRect(margin, y - bodySize * 0.1, 3, lineH);
          ctx.font = `italic ${bodySize}px ${rs.fontFamily}`;
          y = this._wrapText(ctx, block.text, margin + 16, y, maxWidth - 16, lineH, colors.muted);
          y += lineH * 0.2;
          break;
        }
        case 'li': {
          ctx.font = `${bodySize}px ${rs.fontFamily}`;
          ctx.fillStyle = colors.text;
          ctx.fillText('•', margin, y);
          y = this._wrapText(ctx, block.text, margin + 18, y, maxWidth - 18, lineH, colors.text);
          y += lineH * 0.1;
          break;
        }
        case 'code': {
          const codeSize = Math.round(bodySize * 0.9);
          ctx.fillStyle = colors.codeBg;
          ctx.fillRect(margin, y - codeSize * 0.3, maxWidth, lineH * 1.1);
          ctx.fillStyle = colors.code;
          ctx.font = `${codeSize}px "Courier New", monospace`;
          y = this._wrapText(ctx, block.text, margin + 6, y, maxWidth - 12, lineH, colors.code);
          y += lineH * 0.1;
          break;
        }
        case 'hr': {
          ctx.fillStyle = colors.muted;
          ctx.fillRect(margin, y, maxWidth, 1);
          y += lineH * 0.5;
          break;
        }
        default: {
          // paragraph
          ctx.font = `${bodySize}px ${rs.fontFamily}`;
          y = this._wrapText(ctx, block.text, margin, y, maxWidth, lineH, colors.text);
          y += lineH * 0.3;
          break;
        }
      }
    }

    ctx.restore();
  }

  /**
   * Word-wrap text onto the canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {number} maxWidth
   * @param {number} lineHeight
   * @param {string} color
   * @returns {number} Updated y position (bottom of last line)
   */
  _wrapText(ctx, text, x, y, maxWidth, lineHeight, color) {
    ctx.fillStyle = color;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  /**
   * Fallback: convert plain text into minimal block structure.
   * Used for chapters that had no DOM blocks (e.g. empty sections).
   * @param {string} text
   * @returns {TextBlock[]}
   */
  _textToBlocks(text) {
    return text.split('\n\n').filter(Boolean).map(p => ({ type: 'p', text: p.replace(/\n/g, ' ').trim() }));
  }

  _detectTheme() {
    if (typeof document === 'undefined') return 'dark';
    if (document.body.classList.contains('sepia')) return 'sepia';
    if (document.body.classList.contains('light')) return 'light';
    return 'dark';
  }

  _getThemeColors(theme) {
    switch (theme) {
      case 'light': return { bg: '#fffef8', text: '#333', title: '#1a1a1a', muted: '#666', code: '#333', codeBg: '#f3f3f3' };
      case 'sepia': return { bg: '#f5ead0', text: '#3a2e1a', title: '#2a1e0a', muted: '#7a6e5a', code: '#3a2e1a', codeBg: '#e8dbbe' };
      case 'dark': default: return { bg: '#1a1d23', text: '#cbd5e1', title: '#e2e8f0', muted: '#9aa6b8', code: '#94a3b8', codeBg: '#2d3748' };
    }
  }

  async getText(pageNumber) {
    const chapter = this.chapters[pageNumber - 1];
    return chapter?.text || '';
  }

  async getOutline() {
    if (this.toc.length) {
      return this.toc.map((item, idx) => ({
        title: item.title,
        dest: idx + 1,
        items: [],
      }));
    }
    return this.chapters.map((ch, idx) => ({
      title: ch.title || `Chapter ${idx + 1}`,
      dest: idx + 1,
      items: [],
    }));
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (Number.isInteger(n) && n >= 1 && n <= this.pageCount) return n;
    return null;
  }

  destroy() {
    for (const url of this._fontUrls) {
      URL.revokeObjectURL(url);
    }
    this._fontUrls = [];
  }
}
