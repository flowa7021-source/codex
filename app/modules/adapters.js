// @ts-check
/**
 * adapters.js — Document adapter classes extracted from app.js
 *
 * Each adapter provides a uniform interface for rendering pages,
 * retrieving text, and navigating document outlines.
 */

import { els as _els } from './state.js';

/** @type {Record<string, any>} */
const els = _els;
import { loadImage } from './utils.js';
import { pushDiagnosticEvent } from './diagnostics.js';

export class PDFAdapter {
  static TEXT_CACHE_MAX = 30;
  constructor(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.type = 'pdf';
    this.pageTextCache = new Map();
    this.pageTextPromises = new Map();
    this._currentRenderTask = null;
  }

  cancelMainRender() {
    if (this._currentRenderTask) {
      try { this._currentRenderTask.cancel(); } catch (_) { /* already finished */ }
      this._currentRenderTask = null;
    }
  }

  _evictTextCache() {
    while (this.pageTextCache.size > PDFAdapter.TEXT_CACHE_MAX) {
      const oldest = this.pageTextCache.keys().next().value;
      this.pageTextCache.delete(oldest);
      this.pageTextPromises.delete(oldest);
    }
  }

  getPageCount() {
    return this.pdfDoc.numPages;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const page = await this.pdfDoc.getPage(pageNumber);
    return page.getViewport({ scale, rotation });
  }

  async renderPage(pageNumber, canvas, { zoom, rotation, dpr: dprOverride }) {
    const page = await this.pdfDoc.getPage(pageNumber);
    const dpr = dprOverride ?? Math.max(1, window.devicePixelRatio || 1);
    // Render at 1.5× device pixel ratio for sharper text on HiDPI screens.
    // The extra resolution is downscaled by the browser via CSS, producing
    // crisp text and smooth image edges.
    const qualityBoost = 1.25;
    const renderScale = zoom * dpr * qualityBoost;
    const viewport = page.getViewport({ scale: renderScale, rotation });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.round(viewport.width / (dpr * qualityBoost))}px`;
    canvas.style.height = `${Math.round(viewport.height / (dpr * qualityBoost))}px`;

    console.info(`[pdf-render] page=${pageNumber} rotation=${rotation} pageRotate=${page.rotate} viewport=${Math.round(viewport.width)}×${Math.round(viewport.height)} css=${canvas.style.width}×${canvas.style.height}`);

    const ctx = canvas.getContext('2d', { alpha: false });
    // High quality image scaling for embedded images in the PDF
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Fill white background before PDF.js renders (prevents flash of black)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cancel any in-flight render on the main canvas. This is intentional for
    // single-canvas design: only one render task should target the primary
    // canvas at a time. Off-screen canvases (e.g. pre-render, thumbnails) are
    // not tracked here, so they won't interfere with the main render.
    const isMainCanvas = canvas === els?.canvas;
    if (isMainCanvas && this._currentRenderTask) {
      try { this._currentRenderTask.cancel(); } catch (err) { console.warn('[adapters] error:', err?.message); }
      this._currentRenderTask = null;
    }

    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
      background: 'rgba(255,255,255,1)',
      // Enable high-quality anti-aliasing for text and vector graphics
      intent: 'display',
    });
    if (isMainCanvas) this._currentRenderTask = renderTask;
    try {
      await renderTask.promise;
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      const msg = String(err?.message || err || '');
      if (/unknown pattern/i.test(msg)) {
        pushDiagnosticEvent('pdf.render.pattern-warning', { page: pageNumber, message: msg });
        return;
      }
      throw err;
    } finally {
      if (isMainCanvas && this._currentRenderTask === renderTask) {
        this._currentRenderTask = null;
      }
    }
  }

  buildTextFromItems(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const lines = [];
    let current = [];
    let currentY = null;
    let prevX = null;

    for (const item of items) {
      const str = String(item?.str || '');
      if (!str) continue;
      const tr = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);
      const h = Math.max(1, Math.abs(Number(item?.height || 0)));
      const lineThreshold = Math.max(2, h * 0.6);

      if (currentY == null || Math.abs(y - currentY) > lineThreshold) {
        if (current.length) lines.push(current.join(''));
        current = [str];
        currentY = y;
        prevX = x + Number(item?.width || str.length * h * 0.42);
        continue;
      }

      const estimatedGap = x - (prevX ?? x);
      const shouldAddSpace = estimatedGap > Math.max(2, h * 0.22);
      current.push((shouldAddSpace ? ' ' : '') + str);
      prevX = x + Number(item?.width || str.length * h * 0.42);
    }

    if (current.length) lines.push(current.join(''));
    return lines
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async getText(pageNumber) {
    if (this.pageTextCache.has(pageNumber)) return this.pageTextCache.get(pageNumber);
    if (this.pageTextPromises.has(pageNumber)) return this.pageTextPromises.get(pageNumber);

    const textPromise = (async () => {
      const page = await this.pdfDoc.getPage(pageNumber);
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const text = this.buildTextFromItems(content?.items || []);
      this.pageTextCache.set(pageNumber, text);
      this._evictTextCache();
      return text;
    })().finally(() => {
      this.pageTextPromises.delete(pageNumber);
    });

    this.pageTextPromises.set(pageNumber, textPromise);
    return textPromise;
  }

  async getOutline() {
    return this.pdfDoc.getOutline();
  }

  async resolveDestToPage(dest) {
    let targetDest = dest;
    if (typeof targetDest === 'string') {
      targetDest = await this.pdfDoc.getDestination(targetDest);
    }

    if (!targetDest || !Array.isArray(targetDest) || targetDest.length === 0) {
      return null;
    }

    const pageRef = targetDest[0];
    const pageIndex = await this.pdfDoc.getPageIndex(pageRef);
    return pageIndex + 1;
  }
}

export class ImageAdapter {
  constructor(imageUrl, imageMeta) {
    this.imageUrl = imageUrl;
    this.imageMeta = imageMeta;
    this.type = 'image';
  }

  getPageCount() {
    return 1;
  }

  async getPageViewport(_pageNumber, scale, rotation) {
    const w = this.imageMeta.width * scale;
    const h = this.imageMeta.height * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(_pageNumber, canvas, { zoom, rotation }) {
    const img = await loadImage(this.imageUrl);
    const rad = (rotation * Math.PI) / 180;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const w = img.width * zoom;
    const h = img.height * zoom;
    const rw = Math.ceil(w * dpr);
    const rh = Math.ceil(h * dpr);

    if (rotation % 180 === 0) {
      canvas.width = rw;
      canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = rh;
      canvas.height = rw;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    if (rotation % 180 === 0) {
      ctx.translate(w / 2, h / 2);
    } else {
      ctx.translate(h / 2, w / 2);
    }
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  async getText() {
    return '';
  }
}

export class DjVuAdapter {
  constructor(fileName, data = null) {
    this.fileName = fileName;
    this.type = 'djvu';
    this.mode = 'compat';
    this.setData(data);
  }

  setData(data) {
    const pagesText = Array.isArray(data?.pagesText)
      ? data.pagesText.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    const pagesImages = Array.isArray(data?.pagesImages)
      ? data.pagesImages.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    const pageSizes = Array.isArray(data?.pageSizes)
      ? data.pageSizes.map((x) => ({
        width: Number(x?.width) > 0 ? Number(x.width) : null,
        height: Number(x?.height) > 0 ? Number(x.height) : null,
      }))
      : [];

    this.pagesText = pagesText;
    this.pagesImages = pagesImages;
    this.pageSizes = pageSizes;
    const inferredCount = Math.max(pagesText.length, pagesImages.length, pageSizes.length, 1);
    this.pageCount = Number.isInteger(data?.pageCount) && data.pageCount > 0
      ? Math.max(data.pageCount, inferredCount)
      : inferredCount;
    this.outline = Array.isArray(data?.outline) ? data.outline : [];
  }

  exportData() {
    return {
      pageCount: this.pageCount,
      pagesText: this.pagesText,
      pagesImages: this.pagesImages,
      pageSizes: this.pageSizes,
      outline: this.outline,
    };
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const size = this.pageSizes[pageNumber - 1] || {};
    const baseW = Number(size.width) > 0 ? Number(size.width) : 1200;
    const baseH = Number(size.height) > 0 ? Number(size.height) : 1600;
    const w = baseW * scale;
    const h = baseH * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const imageUrl = this.pagesImages[pageNumber - 1];
    if (imageUrl) {
      const img = await loadImage(imageUrl);
      const rad = (rotation * Math.PI) / 180;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = img.width * zoom;
      const h = img.height * zoom;
      const rw = Math.ceil(w * dpr);
      const rh = Math.ceil(h * dpr);

      if (rotation % 180 === 0) {
        canvas.width = rw;
        canvas.height = rh;
        canvas.style.width = `${Math.round(w)}px`;
        canvas.style.height = `${Math.round(h)}px`;
      } else {
        canvas.width = rh;
        canvas.height = rw;
        canvas.style.width = `${Math.round(h)}px`;
        canvas.style.height = `${Math.round(w)}px`;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      if (rotation % 180 === 0) {
        ctx.translate(w / 2, h / 2);
      } else {
        ctx.translate(h / 2, w / 2);
      }
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewport = await this.getPageViewport(pageNumber, zoom * dpr, rotation);
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '24px sans-serif';
    ctx.fillText('DjVu документ', 40, 70);
    ctx.fillStyle = '#9aa6b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Файл: ${this.fileName}`, 40, 105);
    ctx.fillText(`Страница: ${pageNumber}/${this.pageCount}`, 40, 132);
    const txt = (this.pagesText[pageNumber - 1] || '').trim();
    ctx.fillText(txt ? 'Текстовый слой: загружен' : 'Текстовый слой: не загружен', 40, 159);
    ctx.fillText('Импортируйте DjVu data JSON для рендера страниц/поиска.', 40, 186);
  }

  async getText(pageNumber) {
    return this.pagesText[pageNumber - 1] || '';
  }

  async getOutline() {
    return this.outline;
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (!Number.isInteger(n) || n < 1 || n > this.pageCount) return null;
    return n;
  }
}


export class DjVuNativeAdapter {
  constructor(doc, fileName) {
    this.doc = doc;
    this.fileName = fileName;
    this.type = 'djvu';
    this.mode = 'native';
    // Get page count first (cheap — reads DIRM header only)
    this.pageCount = Number(doc?.getPagesQuantity?.() || 1);
    // Defer expensive getPagesSizes() — it decompresses every page.
    // We'll lazily populate sizes on first getPageViewport() call.
    this._pageSizesLoaded = false;
    this.pageSizes = [];
  }

  /**
   * Lazily load page sizes. Wraps the synchronous getPagesSizes() call
   * in a microtask yield so it doesn't block the main thread on large files.
   * Returns a promise; callers must await it.
   */
  async _ensurePageSizes() {
    if (this._pageSizesLoaded) return;
    // Yield to the event loop before heavy synchronous decompression
    await new Promise((r) => setTimeout(r, 0));
    try {
      const sizes = this.doc?.getPagesSizes?.();
      this.pageSizes = Array.isArray(sizes) ? sizes : [];
    } catch (err) {
      console.warn('[DjVuNativeAdapter] getPagesSizes failed:', err?.message);
      pushDiagnosticEvent('djvu.getPagesSizes.error', { message: err?.message });
      this.pageSizes = [];
    }
    this._pageSizesLoaded = true;
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    await this._ensurePageSizes();
    const size = this.pageSizes[pageNumber - 1] || {};
    const baseW = Number(size.width) > 0 ? Number(size.width) : 1200;
    const baseH = Number(size.height) > 0 ? Number(size.height) : 1600;
    const w = baseW * scale;
    const h = baseH * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    let page, imageData;
    try {
      page = await this.doc.getPage(pageNumber);
      imageData = page.getImageData(true);
      page.reset?.();
    } catch (err) {
      // If page decompression fails, render a fallback placeholder
      pushDiagnosticEvent('djvu.render.decompress-error', { page: pageNumber, message: err?.message });
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.ceil(1200 * dpr);
      canvas.height = Math.ceil(1600 * dpr);
      canvas.style.width = '1200px';
      canvas.style.height = '1600px';
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#10141b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff8b8b';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Ошибка рендера страницы ${pageNumber}: ${err?.message || 'unknown'}`, 40, 80);
      return;
    }

    // Guard against zero-dimension imageData from corrupted DjVu pages
    if (!imageData || !imageData.width || !imageData.height) {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.ceil(1200 * dpr);
      canvas.height = Math.ceil(1600 * dpr);
      canvas.style.width = '1200px';
      canvas.style.height = '1600px';
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#10141b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff8b8b';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Страница ${pageNumber}: пустые данные изображения`, 40, 80);
      pushDiagnosticEvent('djvu.render.zero-dimension', { page: pageNumber });
      return;
    }

    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d', { alpha: false }).putImageData(imageData, 0, 0);

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rad = (rotation * Math.PI) / 180;
    const w = tmp.width * zoom;
    const h = tmp.height * zoom;
    const rw = Math.ceil(w * dpr);
    const rh = Math.ceil(h * dpr);

    if (rotation % 180 === 0) {
      canvas.width = rw;
      canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = rh;
      canvas.height = rw;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // For significant upscaling (zoom > 2x), use two-pass rendering
    // for sharper results: first scale to 2x, then to final size.
    const effectiveScale = zoom * dpr;
    let source = tmp;
    if (effectiveScale > 2.5 && tmp.width > 0 && tmp.height > 0) {
      const mid = document.createElement('canvas');
      const midScale = Math.sqrt(effectiveScale);
      mid.width = Math.ceil(tmp.width * midScale);
      mid.height = Math.ceil(tmp.height * midScale);
      const midCtx = mid.getContext('2d', { alpha: false });
      midCtx.imageSmoothingEnabled = true;
      midCtx.imageSmoothingQuality = 'high';
      midCtx.drawImage(tmp, 0, 0, mid.width, mid.height);
      // Release tmp early
      tmp.width = 0; tmp.height = 0;
      source = mid;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    if (rotation % 180 === 0) {
      ctx.translate(w / 2, h / 2);
    } else {
      ctx.translate(h / 2, w / 2);
    }
    ctx.rotate(rad);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Release intermediate canvas
    if (source !== tmp) { source.width = 0; source.height = 0; }
    if (tmp.width > 0) { tmp.width = 0; tmp.height = 0; }
  }

  async getText(pageNumber) {
    const page = await this.doc.getPage(pageNumber);
    const text = page.getText() || '';
    page.reset?.();
    return text;
  }

  async getOutline() {
    const raw = this.doc.getContents?.() || [];
    const mapItems = (items) => (Array.isArray(items) ? items.map((item) => {
      const page = item?.url ? this.doc.getPageNumberByUrl(item.url) : null;
      return {
        title: item?.description || '(без названия)',
        dest: Number.isInteger(page) ? page : null,
        items: mapItems(item?.children || []),
      };
    }) : []);
    return mapItems(raw);
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (!Number.isInteger(n) || n < 1 || n > this.pageCount) return null;
    return n;
  }
}

export class UnsupportedAdapter {
  constructor(fileName) {
    this.fileName = fileName;
    this.type = 'unsupported';
  }

  getPageCount() {
    return 1;
  }

  async getPageViewport() {
    return { width: 1200, height: 700 };
  }

  async renderPage(_pageNumber, canvas) {
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '26px sans-serif';
    ctx.fillText('Формат пока не поддержан в MVP', 80, 130);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#9aa6b8';
    ctx.fillText(`Файл: ${this.fileName}`, 80, 180);
    ctx.fillText('Откройте поддерживаемый формат: PDF, DjVu или изображение.', 80, 220);
  }

  async getText() {
    return '';
  }
}
