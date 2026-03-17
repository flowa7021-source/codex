// ─── Progressive Loading Module ──────────────────────────────────────────────
// Handles streaming/chunked loading for large files (>500MB)

export class ProgressiveLoader {
  constructor() {
    this.abortController = null;
    this.loadedBytes = 0;
    this.totalBytes = 0;
    this.isLoading = false;
    this.listeners = [];
    this.chunkSize = 2 * 1024 * 1024; // 2MB chunks
    this.largeFileThreshold = 50 * 1024 * 1024; // 50MB threshold for progressive mode
  }

  isLargeFile(file) {
    return file && file.size > this.largeFileThreshold;
  }

  async loadFileProgressive(file, onProgress) {
    this.abortController = new AbortController();
    this.loadedBytes = 0;
    this.totalBytes = file.size;
    this.isLoading = true;
    this._notify('start', { totalBytes: this.totalBytes, fileName: file.name });

    try {
      // For File API, use slice-based progressive reading
      const chunks = [];
      let offset = 0;

      while (offset < file.size) {
        if (this.abortController.signal.aborted) {
          throw new Error('Loading cancelled');
        }

        const end = Math.min(offset + this.chunkSize, file.size);
        const slice = file.slice(offset, end);
        const chunk = await slice.arrayBuffer();
        chunks.push(new Uint8Array(chunk));

        this.loadedBytes = end;
        const percent = Math.round((end / file.size) * 100);
        this._notify('progress', { loadedBytes: end, totalBytes: file.size, percent });
        if (onProgress) onProgress(percent, end, file.size);

        // Yield to main thread between chunks
        await new Promise((r) => setTimeout(r, 0));

        offset = end;
      }

      // Combine chunks
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let pos = 0;
      for (const chunk of chunks) {
        combined.set(chunk, pos);
        pos += chunk.length;
      }

      this.isLoading = false;
      this._notify('complete', { totalBytes: file.size });
      return combined.buffer;
    } catch (error) {
      this.isLoading = false;
      this._notify('error', { message: error.message });
      throw error;
    }
  }

  async loadPdfProgressive(file, pdfjsLib, onProgress) {
    if (!pdfjsLib) throw new Error('PDF.js not available');

    this.abortController = new AbortController();
    this.loadedBytes = 0;
    this.totalBytes = file.size;
    this.isLoading = true;
    this._notify('start', { totalBytes: this.totalBytes, fileName: file.name });

    try {
      // Use PDF.js streaming for large PDFs
      const fileReader = file.stream();
      const reader = fileReader.getReader();
      const chunks = [];
      let loaded = 0;

      while (true) {
        if (this.abortController.signal.aborted) {
          reader.cancel();
          throw new Error('Loading cancelled');
        }

        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;
        this.loadedBytes = loaded;

        const percent = Math.round((loaded / file.size) * 100);
        this._notify('progress', { loadedBytes: loaded, totalBytes: file.size, percent });
        if (onProgress) onProgress(percent, loaded, file.size);
      }

      // Combine and load PDF
      const totalLength = chunks.reduce((s, c) => s + c.length, 0);
      const data = new Uint8Array(totalLength);
      let pos = 0;
      for (const chunk of chunks) {
        data.set(chunk, pos);
        pos += chunk.length;
      }

      const loadingTask = pdfjsLib.getDocument({ data });

      loadingTask.onProgress = (p) => {
        if (p.total > 0) {
          const percent = Math.round((p.loaded / p.total) * 100);
          this._notify('pdf-parse', { percent });
        }
      };

      const pdfDoc = await loadingTask.promise;
      this.isLoading = false;
      this._notify('complete', { totalBytes: file.size, pages: pdfDoc.numPages });
      return pdfDoc;
    } catch (error) {
      this.isLoading = false;
      this._notify('error', { message: error.message });
      throw error;
    }
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isLoading = false;
    this._notify('cancel');
  }

  getProgress() {
    return {
      isLoading: this.isLoading,
      loadedBytes: this.loadedBytes,
      totalBytes: this.totalBytes,
      percent: this.totalBytes > 0 ? Math.round((this.loadedBytes / this.totalBytes) * 100) : 0,
    };
  }

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  onEvent(fn) {
    this.listeners.push(fn);
  }

  _notify(event, data = {}) {
    for (const fn of this.listeners) fn(event, data);
  }
}

export const progressiveLoader = new ProgressiveLoader();
