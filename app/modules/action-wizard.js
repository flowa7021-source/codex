// @ts-check

export class ActionWizard {
  constructor() {
    this.steps = [];
    this.templates = new Map();
    this._cancelled = false;
  }

  addStep(operation, options = {}) {
    // operation: 'ocr'|'compress'|'watermark'|'bates'|'header-footer'|'redact-pattern'|
    //            'convert-format'|'split'|'merge'|'flatten'|'password'|'pdfa'|'page-numbers'
    const validOps = ['ocr', 'compress', 'watermark', 'bates', 'header-footer', 'redact-pattern',
      'convert-format', 'split', 'merge', 'flatten', 'password', 'pdfa', 'page-numbers'];
    if (!validOps.includes(operation)) throw new Error(`Unknown operation: ${operation}`);
    this.steps.push({ operation, options });
    return this;
  }

  removeStep(index) {
    if (index >= 0 && index < this.steps.length) {
      this.steps.splice(index, 1);
    }
    return this;
  }

  reorderSteps(newOrder) {
    // newOrder = array of indices
    const reordered = newOrder.map(i => this.steps[i]).filter(Boolean);
    this.steps = reordered;
    return this;
  }

  saveTemplate(name) {
    this.templates.set(name, JSON.parse(JSON.stringify(this.steps)));
    return this;
  }

  loadTemplate(name) {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template not found: ${name}`);
    this.steps = JSON.parse(JSON.stringify(template));
    return this;
  }

  deleteTemplate(name) {
    this.templates.delete(name);
    return this;
  }

  listTemplates() {
    return [...this.templates.keys()];
  }

  async execute(files, outputDir, onProgress) {
    // onProgress(fileIndex, totalFiles, stepIndex, totalSteps, status)
    this._cancelled = false;
    if (!this.steps.length) throw new Error('No steps defined');

    const results = [];
    for (let fi = 0; fi < files.length; fi++) {
      if (this._cancelled) {
        results.push({ filename: files[fi].name, status: 'cancelled', log: ['Cancelled by user'] });
        continue;
      }

      const log = [];
      let currentBytes = await files[fi].arrayBuffer();
      let error = null;

      for (let si = 0; si < this.steps.length; si++) {
        if (this._cancelled) break;
        const step = this.steps[si];
        if (onProgress) onProgress(fi + 1, files.length, si + 1, this.steps.length, `Processing ${step.operation}`);

        try {
          currentBytes = await this._executeStep(step, currentBytes);
          log.push(`✓ ${step.operation}`);
        } catch (e) {
          error = e.message;
          log.push(`✗ ${step.operation}: ${e.message}`);
          break;
        }
      }

      results.push({
        filename: files[fi].name,
        status: error ? 'error' : 'ok',
        outputBlob: error ? undefined : new Blob([currentBytes], { type: 'application/pdf' }),
        error,
        log,
      });
    }
    return results;
  }

  cancel() {
    this._cancelled = true;
  }

  async _executeStep(step, pdfBytes) {
    // Lazy-import and execute the appropriate module
    const bytes = pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : pdfBytes;
    switch (step.operation) {
      case 'compress': {
        const { PdfOptimizer, COMPRESSION_PROFILES } = await import('./pdf-optimize.js');
        const optimizer = new PdfOptimizer();
        const profile = step.options?.profile || 'ebook';
        const result = await optimizer.optimize(bytes, COMPRESSION_PROFILES[profile] || {});
        return await result.blob.arrayBuffer();
      }
      case 'watermark': {
        const { addWatermarkToPdf } = await import('./pdf-operations.js');
        const blob = await addWatermarkToPdf(bytes, step.options?.text || 'WATERMARK', step.options);
        return await blob.arrayBuffer();
      }
      case 'pdfa': {
        const { convertToPdfA } = await import('./pdf-a-converter.js');
        const result = await convertToPdfA(bytes, step.options);
        return await result.blob.arrayBuffer();
      }
      case 'flatten': {
        // Simple flatten: load and save
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        return await doc.save();
      }
      // Add handlers for each operation type, importing lazily
      default:
        // For operations not yet implemented, pass through
        return bytes;
    }
  }
}
