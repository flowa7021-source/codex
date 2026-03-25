// @ts-check
/**
 * @module inline-text-editor
 * @description Phase 6 — Seamless Inline Text Editor.
 *
 * Implements the InlineTextEditor class described in the concept:
 *   • Click on native PDF text  → edit in place, write back to content stream
 *   • Click on OCR text block   → edit in place, redraw on background image
 *
 * The editor positions a styled contenteditable <div> exactly over the
 * target text block on the canvas, hiding the original render while editing.
 *
 * Integration:
 *   const editor = new InlineTextEditor(pageContainer, pageModel, deps);
 *   editor.activate(textBlock, canvasRect);
 *
 * `deps` must provide:
 *   deps.pdfLibDoc          – pdf-lib PDFDocument (for native text write-back)
 *   deps.pageWidthPt        – page width in PDF points
 *   deps.pageHeightPt       – page height in PDF points
 *   deps.zoom               – current zoom factor
 *   deps.getBackgroundCanvas() – Promise<HTMLCanvasElement> for OCR pages
 *   deps.onCommit(textBlock, newText) – async callback after edit committed
 *   deps.onCancel()         – callback when edit is cancelled
 *   deps.hideTextBlock(id)  – hide original text span during edit
 *   deps.showTextBlock(id)  – restore after commit/cancel
 */

import { matchFontFromOcr } from './scan-decomposer.js';

// ---------------------------------------------------------------------------
// InlineTextEditor
// ---------------------------------------------------------------------------

export class InlineTextEditor {
  /**
   * @param {HTMLElement} pageContainer   – positioned parent of the PDF canvas
   * @param {import('./page-model.js').PageModel} pageModel
   * @param {Object} deps
   */
  constructor(pageContainer, pageModel, deps) {
    this.container = pageContainer;
    this.page      = pageModel;
    this.deps      = deps;

    this._editorEl  = null;
    this._block     = null;
    this._origText  = '';

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onBlur    = () => this._commit();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Open the inline editor for `textBlock`.
   *
   * @param {import('./page-model.js').TextBlock} textBlock
   * @param {{x,y,width,height}} canvasRect   Pixel rect on the canvas overlay
   */
  activate(textBlock, canvasRect) {
    if (this._editorEl) this._cancel();

    this._block    = textBlock;
    this._origText = _blockPlainText(textBlock);

    // Build and style the editor
    this._editorEl = document.createElement('div');
    this._editorEl.contentEditable = 'true';
    this._editorEl.spellcheck = false;
    this._editorEl.textContent = this._origText;

    this._applyStyle(textBlock, canvasRect);

    this.container.style.position = 'relative';
    this.container.appendChild(this._editorEl);
    this._editorEl.focus();

    // Select all content
    const range = document.createRange();
    range.selectNodeContents(this._editorEl);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    this._editorEl.addEventListener('blur', this._onBlur);
    document.addEventListener('keydown', this._onKeyDown);

    // Hide original text while editing
    if (this.deps.hideTextBlock) this.deps.hideTextBlock(textBlock.id);
  }

  /** Commit the current edit and close. */
  async commitEdit() {
    await this._commit();
  }

  /** Cancel without saving and close. */
  cancel() {
    this._cancel();
  }

  /** Update zoom — repositions the editor. */
  setZoom(zoom) {
    if (this.deps) this.deps.zoom = zoom;
    if (this._editorEl && this._block) {
      const rect = this._blockToCanvasRect(this._block);
      this._applyPosition(rect);
    }
  }

  // ── Styling ────────────────────────────────────────────────────────────────

  _applyStyle(block, canvasRect) {
    const run   = _firstRun(block);
    const zoom  = this.deps.zoom || 1;
    const fontSize = (run?.fontSize || 12) * zoom;

    // Font: prefer synthesized/matched font for OCR, native font name for native
    let fontFamily = run?.font || 'Arial';
    if (block.source === 'ocr') {
      fontFamily = block.matchedSystemFont || block.synthesizedFont || 'Arial';
    }

    const editorEl = this._editorEl;
    const ocrResult = block.ocrResult || null;

    // Try to match font from OCR data for scanned pages
    if (!run?.font && ocrResult) {
      try {
        const fontMatch = matchFontFromOcr(ocrResult);
        if (fontMatch?.family) {
          editorEl.style.fontFamily = fontMatch.family;
          editorEl.style.fontWeight = String(fontMatch.weight || 400);
          editorEl.style.fontStyle = fontMatch.style || 'normal';
        }
      } catch (_e) { /* fallback to default font */ }
    }

    const color     = run?.color || '#000000';
    const isBold    = run?.bold   ? 'bold'   : 'normal';
    const isItalic  = run?.italic ? 'italic' : 'normal';

    this._editorEl.style.cssText = [
      'position:absolute',
      'z-index:200',
      'outline:2px solid rgba(0,120,255,0.7)',
      'box-shadow:0 2px 12px rgba(0,0,0,0.18)',
      'border-radius:2px',
      'background:rgba(255,255,255,0.92)',
      `font-family:"${fontFamily}",Arial,sans-serif`,
      `font-size:${fontSize}px`,
      `font-weight:${isBold}`,
      `font-style:${isItalic}`,
      `color:${color}`,
      'padding:2px 4px',
      'min-width:40px',
      'min-height:1em',
      'white-space:pre-wrap',
      'word-break:break-word',
      'cursor:text',
      'line-height:1.2',
    ].join(';');

    this._applyPosition(canvasRect);
  }

  _applyPosition(rect) {
    if (!this._editorEl) return;
    this._editorEl.style.left   = `${rect.x}px`;
    this._editorEl.style.top    = `${rect.y}px`;
    this._editorEl.style.width  = `${Math.max(rect.width, 40)}px`;
  }

  _blockToCanvasRect(block) {
    const zoom = this.deps.zoom || 1;
    const ph   = this.deps.pageHeightPt ?? this.page.height;
    return {
      x:      block.boundingBox.x * zoom,
      y:      (ph - block.boundingBox.y - block.boundingBox.height) * zoom,
      width:  block.boundingBox.width  * zoom,
      height: block.boundingBox.height * zoom,
    };
  }

  // ── Keyboard handler ───────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._cancel();
    }
    // Ctrl+Enter or Shift+Enter = commit
    if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      this._commit();
    }
  }

  // ── Commit logic ───────────────────────────────────────────────────────────

  async _commit() {
    if (!this._editorEl) return;
    const newText = this._editorEl.innerText || this._editorEl.textContent || '';

    // Remove editor before async work (prevents double-commit on blur)
    this._cleanup();

    if (newText === this._origText) return;   // nothing changed

    const block = this._block;
    if (!block) return;

    try {
      if (block.source === 'native') {
        await this._writeNativeText(block, newText);
      } else {
        await this._writeOcrText(block, newText);
      }

      if (this.deps.onCommit) await this.deps.onCommit(block, newText);
    } catch (err) {
      console.error('[inline-text-editor] commit failed:', err);
    }

    if (this.deps.showTextBlock) this.deps.showTextBlock(block.id);
  }

  _cancel() {
    const block = this._block;
    this._cleanup();
    if (block && this.deps.showTextBlock) this.deps.showTextBlock(block.id);
    if (this.deps.onCancel) this.deps.onCancel();
  }

  _cleanup() {
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._editorEl) {
      this._editorEl.removeEventListener('blur', this._onBlur);
      this._editorEl.remove();
      this._editorEl = null;
    }
    this._block    = null;
    this._origText = '';
  }

  // ── Write-back: native PDF ─────────────────────────────────────────────────

  /**
   * Overwrite the text in the PDF content stream at the block's position.
   * Strategy: draw a white rectangle covering the old text, then draw new
   * text with pdf-lib at the same position/font/size.
   *
   * @param {import('./page-model.js').TextBlock} block
   * @param {string} newText
   */
  async _writeNativeText(block, newText) {
    if (!this.deps.pdfLibDoc) return;

    const pdfDoc   = this.deps.pdfLibDoc;
    const pageIdx  = this.page.pageNumber - 1;
    const pdfPage  = pdfDoc.getPage(pageIdx);
    const run      = _firstRun(block);
    const bbox     = block.boundingBox;

    // Cover old text with white rect
    pdfPage.drawRectangle({
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
      color: { type: 'RGB', red: 1, green: 1, blue: 1 },
      borderWidth: 0,
    });

    // Draw new text
    const fontSize = run?.fontSize || 12;
    const hexColor = _hexToRgb01(run?.color || '#000000');

    pdfPage.drawText(newText, {
      x: bbox.x,
      y: bbox.y,
      size: fontSize,
      color: { type: 'RGB', ...hexColor },
    });
  }

  // ── Write-back: OCR text ───────────────────────────────────────────────────

  /**
   * Redraw the text on the scanned page's background canvas image and
   * write the modified image back to the PDF.
   *
   * @param {import('./page-model.js').TextBlock} block
   * @param {string} newText
   */
  async _writeOcrText(block, newText) {
    if (!this.deps.getBackgroundCanvas) return;

    const bgCanvas = await this.deps.getBackgroundCanvas();
    if (!bgCanvas) return;

    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;
    const run = _firstRun(block);
    const bbox = block.boundingBox;
    const ph   = this.page.height;

    // Scale pt → image pixels
    const scaleX = bgCanvas.width  / this.page.width;
    const scaleY = bgCanvas.height / ph;

    const imgX = bbox.x * scaleX;
    const imgY = (ph - bbox.y - bbox.height) * scaleY;
    const imgW = bbox.width  * scaleX;
    const imgH = bbox.height * scaleY;

    // Fill old text area with detected background colour
    const { detectBackgroundColor } = await import('./erase-tool.js');
    const bgColor = detectBackgroundColor(ctx, { x: imgX, y: imgY, width: imgW, height: imgH });
    ctx.fillStyle = bgColor;
    ctx.fillRect(imgX, imgY, imgW, imgH);

    // Render new text
    const fontFamily = block.matchedSystemFont || block.synthesizedFont || 'Arial';
    const fontSize   = (run?.fontSize || 12) * scaleY;
    const color      = run?.color || '#000000';
    const bold       = run?.bold   ? 'bold '   : '';
    const italic     = run?.italic ? 'italic ' : '';

    ctx.font      = `${bold}${italic}${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(newText, imgX, imgY);

    // Update the PageModel's background image data
    const bgImage = this.page.backgroundImage;
    if (bgImage) {
      const bytes = await _canvasToBytes(bgCanvas, /** @type {any} */ (bgImage).mimeType);
      /** @type {any} */ (bgImage).data = bytes;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _blockPlainText(block) {
  if (!block.lines) return '';
  return block.lines
    .flatMap(l => (l.runs || []).map(r => r.text))
    .join(' ');
}

function _firstRun(block) {
  return block.lines?.[0]?.runs?.[0] || null;
}

function _hexToRgb01(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { red: r || 0, green: g || 0, blue: b || 0 };
}

function _canvasToBytes(canvas, mimeType) {
  const type = mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
      const reader = new FileReader();
      reader.onload  = () => resolve(new Uint8Array(/** @type {ArrayBuffer} */ (reader.result)));
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    }, type, 0.92);
  });
}
