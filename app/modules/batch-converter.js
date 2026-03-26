// @ts-check
// ─── Batch Converter ─────────────────────────────────────────────────────────
// Queues multiple files for conversion to various output formats and processes
// them sequentially with progress reporting and cancellation support.

/**
 * @typedef {'docx'|'xlsx'|'pptx'|'rtf'|'html'|'txt'|'png'|'jpg'|'tiff'|'svg'|'csv'|'pdfa'} OutputFormat
 */

/**
 * @typedef {Object} QueueItem
 * @property {File} file
 * @property {OutputFormat} outputFormat
 * @property {Record<string, any>} [options]
 */

/**
 * @typedef {Object} ConvertResult
 * @property {string} filename
 * @property {'ok'|'error'} status
 * @property {Blob} [blob]
 * @property {string} [error]
 */

/**
 * @callback ProgressCallback
 * @param {number} current - 1-based index of the file being processed
 * @param {number} total - Total number of files in the queue
 * @param {string} filename - Name of the current file
 * @returns {void}
 */

export class BatchConverter {
  constructor() {
    /** @type {QueueItem[]} */
    this.queue = [];
    /** @type {ConvertResult[]} */
    this.results = [];
    /** @type {boolean} */
    this._cancelled = false;
  }

  /**
   * Add a file to the conversion queue.
   * @param {File} file
   * @param {OutputFormat} outputFormat
   * @param {Record<string, any>} [options]
   * @returns {this}
   */
  addFile(file, outputFormat, options) {
    this.queue.push({ file, outputFormat, options });
    return this;
  }

  /**
   * Process all queued files sequentially.
   * @param {ProgressCallback} [onProgress]
   * @returns {Promise<ConvertResult[]>}
   */
  async run(onProgress) {
    this._cancelled = false;
    this.results = [];

    for (let i = 0; i < this.queue.length; i++) {
      if (this._cancelled) break;

      const item = this.queue[i];
      if (onProgress) onProgress(i + 1, this.queue.length, item.file.name);

      try {
        const blob = await this._convert(item);
        this.results.push({ filename: item.file.name, status: 'ok', blob });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.results.push({ filename: item.file.name, status: 'error', error: message });
      }
    }

    return this.results;
  }

  /**
   * Cancel the current batch run. The current file conversion will still
   * complete, but no further files will be processed.
   */
  cancel() {
    this._cancelled = true;
  }

  /**
   * Get the results from the last run.
   * @returns {ConvertResult[]}
   */
  getResults() {
    return this.results;
  }

  /**
   * Convert a single queue item using the appropriate converter.
   * @param {QueueItem} item
   * @returns {Promise<Blob>}
   */
  async _convert(item) {
    const bytes = new Uint8Array(await item.file.arrayBuffer());

    switch (item.outputFormat) {
      case 'xlsx': {
        const m = await import('./pdf-to-xlsx.js');
        const result = await m.convertPdfToXlsx(bytes, item.options);
        return result.blob;
      }

      case 'pptx': {
        const m = await import('./pdf-to-pptx.js');
        const result = await m.convertPdfToPptx(bytes, item.options);
        return result.blob;
      }

      case 'rtf': {
        const m = await import('./pdf-to-rtf.js');
        const result = await m.convertPdfToRtf(bytes);
        return result.blob;
      }

      case 'csv': {
        const m = await import('./pdf-to-csv.js');
        const result = await m.convertPdfToCsv(bytes, item.options);
        return new Blob([result.csv], { type: 'text/csv' });
      }

      case 'svg': {
        // SVG export requires a PDF.js document; load it here
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        const m = await import('./pdf-to-svg.js');
        const svgStr = await m.convertPdfPageToSvg(pdfDoc, 1);
        return new Blob([svgStr], { type: 'image/svg+xml' });
      }

      case 'txt': {
        // Extract plain text from all pages
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        const textParts = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          const pageText = content.items
            .filter((/** @type {any} */ it) => 'str' in it)
            .map((/** @type {any} */ it) => it.str)
            .join(' ');
          textParts.push(pageText);
          page.cleanup();
        }
        return new Blob([textParts.join('\n\n')], { type: 'text/plain' });
      }

      case 'html': {
        // Simple HTML wrapper around extracted text
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted PDF</title></head><body>\n';
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          const pageText = content.items
            .filter((/** @type {any} */ it) => 'str' in it)
            .map((/** @type {any} */ it) => it.str)
            .join(' ');
          html += `<div class="page" data-page="${p}"><p>${pageText.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p></div>\n`;
          page.cleanup();
        }
        html += '</body></html>';
        return new Blob([html], { type: 'text/html' });
      }

      case 'tiff': {
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        const pageNums = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
        const m = await import('./image-export-extended.js');
        const tiffBytes = await m.exportPagesToTiff(pdfDoc, pageNums, item.options?.dpi ?? 300);
        return new Blob([/** @type {any} */ (tiffBytes)], { type: 'image/tiff' });
      }

      case 'png':
      case 'jpg': {
        // Render first page to image
        const pdfjs = await import('pdfjs-dist');
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        const page = await pdfDoc.getPage(1);
        const scale = (item.options?.dpi ?? 150) / 72;
        const viewport = page.getViewport({ scale });

        /** @type {any} */
        let canvas;
        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        } else if (typeof document !== 'undefined') {
          canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
        } else {
          throw new Error('Canvas not available for image export');
        }

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();

        const mimeType = item.outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        if (typeof canvas.convertToBlob === 'function') {
          return canvas.convertToBlob({ type: mimeType });
        }
        // HTMLCanvasElement path
        return new Promise((resolve) => {
          canvas.toBlob((/** @type {Blob} */ b) => resolve(b), mimeType);
        });
      }

      case 'docx':
      case 'pdfa':
      default:
        throw new Error(`Unsupported format: ${item.outputFormat}`);
    }
  }
}
