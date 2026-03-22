// @ts-check
/**
 * @module reading-mode
 * @description Distraction-free reading mode with text reflow.
 *
 * Features:
 *   • Full-screen overlay with clean typographic layout
 *   • Extracted text is reflowed into a single scrollable column
 *   • Configurable font family, size, line height, theme (light/dark/sepia)
 *   • Page-by-page or continuous scroll modes
 *   • Keyboard navigation (arrows, PgUp/PgDn, Escape to exit)
 *   • Progress indicator (current page / total)
 *
 * Usage:
 *   import { ReadingMode } from './reading-mode.js';
 *
 *   const reader = new ReadingMode({
 *     getPageText:  (pageNum) => extractedText,
 *     getTotalPages: () => totalPages,
 *     getCurrentPage: () => currentPage,
 *     onExit: () => {},
 *   });
 *   reader.enter();
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEMES = {
  light: { bg: '#ffffff', text: '#1a1a1a', accent: '#0078d4', secondary: '#666' },
  dark:  { bg: '#1e1e1e', text: '#d4d4d4', accent: '#569cd6', secondary: '#888' },
  sepia: { bg: '#f4ecd8', text: '#5b4636', accent: '#8b6914', secondary: '#8a7a66' },
};

const DEFAULT_FONT_SIZE   = 18;     // px
const DEFAULT_LINE_HEIGHT = 1.7;
const DEFAULT_MAX_WIDTH   = 680;    // px
const DEFAULT_FONT        = "'Georgia', 'Times New Roman', serif";

// ---------------------------------------------------------------------------
// ReadingMode
// ---------------------------------------------------------------------------

export class ReadingMode {
  /**
   * @param {Object} deps
   * @param {Function} deps.getPageText    - (pageNum: number) => string | Promise<string>
   * @param {Function} deps.getTotalPages  - () => number
   * @param {Function} deps.getCurrentPage - () => number (1-based)
   * @param {Function} [deps.onExit]
   * @param {Function} [deps.onPageChange] - (pageNum: number) => void
   */
  constructor(deps) {
    this._deps = deps;

    this._overlay    = null;
    this._content    = null;
    this._currentPage = deps.getCurrentPage?.() ?? 1;
    this._totalPages  = deps.getTotalPages?.()  ?? 1;

    // User preferences
    this._theme      = 'light';
    this._fontSize   = DEFAULT_FONT_SIZE;
    this._lineHeight = DEFAULT_LINE_HEIGHT;
    this._fontFamily = DEFAULT_FONT;
    this._scrollMode = 'continuous';   // 'page' | 'continuous'

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async enter() {
    if (this._overlay) return;
    this._totalPages = this._deps.getTotalPages?.() ?? 1;
    this._currentPage = this._deps.getCurrentPage?.() ?? 1;
    this._buildOverlay();
    document.addEventListener('keydown', this._onKeyDown);
    await this._loadContent();
  }

  exit() {
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._deps.onExit?.();
  }

  setTheme(theme) {
    if (!THEMES[theme]) return;
    this._theme = theme;
    this._applyTheme();
  }

  setFontSize(px) {
    this._fontSize = Math.max(10, Math.min(40, px));
    if (this._content) this._content.style.fontSize = `${this._fontSize}px`;
  }

  setLineHeight(lh) {
    this._lineHeight = Math.max(1, Math.min(3, lh));
    if (this._content) this._content.style.lineHeight = String(this._lineHeight);
  }

  setFont(family) {
    this._fontFamily = family;
    if (this._content) this._content.style.fontFamily = family;
  }

  async goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this._totalPages) return;
    this._currentPage = pageNum;
    this._deps.onPageChange?.(pageNum);

    if (this._scrollMode === 'page') {
      await this._loadContent();
    } else {
      // Scroll to page anchor
      const anchor = this._overlay?.querySelector(`[data-page="${pageNum}"]`);
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this._updateProgress();
  }

  // ── Build overlay ──────────────────────────────────────────────────────────

  _buildOverlay() {
    const theme = THEMES[this._theme];

    this._overlay = document.createElement('div');
    this._overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10000',
      `background:${theme.bg}`,
      'display:flex', 'flex-direction:column',
      'overflow:hidden',
    ].join(';');

    // Toolbar
    this._toolbar = document.createElement('div');
    this._toolbar.style.cssText = [
      'display:flex', 'align-items:center', 'gap:12px',
      'padding:8px 16px', 'border-bottom:1px solid rgba(128,128,128,0.2)',
      'flex-shrink:0',
    ].join(';');

    // Close button
    const closeBtn = this._makeBtn('✕ Exit', () => this.exit());
    closeBtn.style.marginRight = 'auto';
    this._toolbar.appendChild(closeBtn);

    // Theme selector
    for (const t of Object.keys(THEMES)) {
      const btn = this._makeBtn(t[0].toUpperCase() + t.slice(1), () => this.setTheme(t));
      btn.dataset.theme = t;
      this._toolbar.appendChild(btn);
    }

    // Separator
    this._toolbar.appendChild(this._makeSep());

    // Font size controls
    this._toolbar.appendChild(this._makeBtn('A−', () => this.setFontSize(this._fontSize - 2)));
    this._toolbar.appendChild(this._makeBtn('A+', () => this.setFontSize(this._fontSize + 2)));

    // Separator
    this._toolbar.appendChild(this._makeSep());

    // Progress indicator
    this._progressEl = document.createElement('span');
    this._progressEl.style.cssText = `font-size:13px;color:${theme.secondary};min-width:80px;text-align:right`;
    this._updateProgress();
    this._toolbar.appendChild(this._progressEl);

    this._overlay.appendChild(this._toolbar);

    // Scroll container
    this._scrollContainer = document.createElement('div');
    this._scrollContainer.style.cssText = [
      'flex:1', 'overflow-y:auto', 'overflow-x:hidden',
      'display:flex', 'justify-content:center', 'padding:32px 16px',
    ].join(';');

    // Content column
    this._content = document.createElement('div');
    this._content.style.cssText = [
      `max-width:${DEFAULT_MAX_WIDTH}px`, 'width:100%',
      `font-family:${this._fontFamily}`,
      `font-size:${this._fontSize}px`,
      `line-height:${this._lineHeight}`,
      `color:${theme.text}`,
      'white-space:pre-wrap', 'word-wrap:break-word',
    ].join(';');

    this._scrollContainer.appendChild(this._content);
    this._overlay.appendChild(this._scrollContainer);
    document.body.appendChild(this._overlay);
  }

  // ── Content loading ────────────────────────────────────────────────────────

  async _loadContent() {
    if (!this._content) return;
    this._content.innerHTML = '';

    if (this._scrollMode === 'continuous') {
      // Load all pages
      for (let p = 1; p <= this._totalPages; p++) {
        const text = await this._deps.getPageText(p);
        this._appendPageBlock(p, text);
      }
    } else {
      // Single page
      const text = await this._deps.getPageText(this._currentPage);
      this._appendPageBlock(this._currentPage, text);
    }
  }

  _appendPageBlock(pageNum, text) {
    // Page header
    const header = document.createElement('div');
    header.dataset.page = String(pageNum);
    header.style.cssText = [
      `color:${THEMES[this._theme].secondary}`,
      'font-size:12px', 'margin-bottom:8px', 'padding-bottom:4px',
      'border-bottom:1px solid rgba(128,128,128,0.15)',
      'font-family:sans-serif',
    ].join(';');
    header.textContent = `Page ${pageNum}`;
    this._content.appendChild(header);

    // Text content
    const block = document.createElement('div');
    block.style.cssText = 'margin-bottom:40px';

    // Split into paragraphs
    const paragraphs = (text || '').split(/\n{2,}/);
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      const p = document.createElement('p');
      p.style.cssText = 'margin:0 0 1em;text-align:justify';
      p.textContent = para.trim();
      block.appendChild(p);
    }

    this._content.appendChild(block);
  }

  // ── Theme ──────────────────────────────────────────────────────────────────

  _applyTheme() {
    if (!this._overlay) return;
    const theme = THEMES[this._theme];

    this._overlay.style.background = theme.bg;
    this._content.style.color      = theme.text;
    this._progressEl.style.color   = theme.secondary;

    // Update page headers
    const headers = this._content.querySelectorAll('[data-page]');
    headers.forEach(h => { /** @type {any} */ (h).style.color = theme.secondary; });
  }

  // ── Progress ───────────────────────────────────────────────────────────────

  _updateProgress() {
    if (this._progressEl) {
      this._progressEl.textContent = `${this._currentPage} / ${this._totalPages}`;
    }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  _onKeyDown(e) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.exit();
        break;

      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        if (this._scrollMode === 'page') {
          this.goToPage(this._currentPage + 1);
        }
        break;

      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        if (this._scrollMode === 'page') {
          this.goToPage(this._currentPage - 1);
        }
        break;

      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.setFontSize(this._fontSize + 2);
        }
        break;

      case '-':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.setFontSize(this._fontSize - 2);
        }
        break;
    }
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  _makeBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
      'padding:4px 10px', 'border:1px solid rgba(128,128,128,0.3)',
      'border-radius:3px', 'background:transparent',
      `color:${THEMES[this._theme].text}`,
      'font-size:13px', 'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', onClick);
    return btn;
  }

  _makeSep() {
    const s = document.createElement('div');
    s.style.cssText = 'width:1px;height:20px;background:rgba(128,128,128,0.3)';
    return s;
  }
}
