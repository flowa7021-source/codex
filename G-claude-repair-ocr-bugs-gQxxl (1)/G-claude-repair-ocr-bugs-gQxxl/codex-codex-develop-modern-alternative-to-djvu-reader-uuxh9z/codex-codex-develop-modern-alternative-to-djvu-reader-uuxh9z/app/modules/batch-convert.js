// ─── Batch Conversion System ────────────────────────────────────────────────
// Multi-file conversion queue with progress tracking and ZIP output.

/**
 * @typedef {object} ConversionJob
 * @property {File} file
 * @property {'docx'|'html'|'txt'|'png'} format
 * @property {'pending'|'running'|'done'|'error'} status
 * @property {number} progress - 0-100
 * @property {Blob} [result]
 * @property {string} [error]
 */

export class BatchConverter {
  constructor() {
    /** @type {ConversionJob[]} */
    this.queue = [];
    this.isRunning = false;
    this._listeners = [];
    this._cancelled = false;
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  }

  _notify() {
    const state = this.getState();
    for (const fn of this._listeners) {
      try { fn(state); } catch {}
    }
  }

  /**
   * Add files to the conversion queue.
   * @param {File[]} files
   * @param {string} format - Target format
   */
  addFiles(files, format) {
    for (const file of files) {
      this.queue.push({
        file,
        format,
        status: 'pending',
        progress: 0,
        result: null,
        error: null,
      });
    }
    this._notify();
  }

  /** Remove a job from the queue by index */
  removeJob(index) {
    this.queue.splice(index, 1);
    this._notify();
  }

  /** Clear all completed/errored jobs */
  clearCompleted() {
    this.queue = this.queue.filter(j => j.status === 'pending' || j.status === 'running');
    this._notify();
  }

  /** Get current queue state */
  getState() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(j => j.status === 'pending').length,
      running: this.queue.filter(j => j.status === 'running').length,
      done: this.queue.filter(j => j.status === 'done').length,
      errors: this.queue.filter(j => j.status === 'error').length,
      isRunning: this.isRunning,
      overallProgress: this._calcOverallProgress(),
    };
  }

  _calcOverallProgress() {
    if (this.queue.length === 0) return 0;
    const total = this.queue.reduce((sum, j) => sum + j.progress, 0);
    return Math.round(total / this.queue.length);
  }

  /**
   * Start processing the queue.
   * @param {Function} convertFn - (file, format, onProgress) => Promise<Blob>
   */
  async start(convertFn) {
    if (this.isRunning) return;
    this.isRunning = true;
    this._cancelled = false;
    this._notify();

    for (const job of this.queue) {
      if (this._cancelled) break;
      if (job.status !== 'pending') continue;

      job.status = 'running';
      job.progress = 0;
      this._notify();

      try {
        job.result = await convertFn(job.file, job.format, (p) => {
          job.progress = p;
          this._notify();
        });
        job.status = 'done';
        job.progress = 100;
      } catch (err) {
        job.status = 'error';
        job.error = err?.message || 'Ошибка конвертации';
      }

      this._notify();
    }

    this.isRunning = false;
    this._notify();
  }

  /** Cancel running conversion */
  cancel() {
    this._cancelled = true;
  }

  /**
   * Download all completed results as a ZIP file.
   * Uses the same minimal ZIP builder as app.js.
   */
  async downloadAsZip(zipFilename = 'converted.zip') {
    const completed = this.queue.filter(j => j.status === 'done' && j.result);
    if (completed.length === 0) return;

    const files = [];
    for (const job of completed) {
      const ext = job.format;
      const baseName = job.file.name.replace(/\.[^.]+$/, '');
      const name = `${baseName}.${ext}`;
      const data = new Uint8Array(await job.result.arrayBuffer());
      files.push({ name, data });
    }

    const zipBlob = buildZipBlob(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

// ─── Minimal ZIP builder (no compression, store only) ───────────────────────

function buildZipBlob(files) {
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    // Local file header
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // compression (store)
    view.setUint16(10, 0, true); // mod time
    view.setUint16(12, 0, true); // mod date
    view.setUint32(14, crc32(data), true);
    view.setUint32(18, data.length, true); // compressed
    view.setUint32(22, data.length, true); // uncompressed
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // extra length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader, data);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdEntry.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, crc32(data), true);
    cdView.setUint32(20, data.length, true);
    cdView.setUint32(24, data.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0x20, true);
    cdView.setUint32(42, offset, true);
    cdEntry.set(nameBytes, 46);
    centralDir.push(cdEntry);

    offset += localHeader.length + data.length;
  }

  // End of central directory
  const cdStart = offset;
  let cdSize = 0;
  for (const entry of centralDir) {
    parts.push(entry);
    cdSize += entry.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdStart, true);
  eocdView.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export const batchConverter = new BatchConverter();
