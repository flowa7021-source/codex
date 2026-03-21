// ─── Progressive Loading Module ──────────────────────────────────────────────
// Handles streaming/chunked loading for large files (>500MB)
// Optimized for minimal peak memory via adaptive chunk sizes and
// single-allocation ArrayBuffer assembly.

export class ProgressiveLoader {
  constructor() {
    this.abortController = null;
    this.loadedBytes = 0;
    this.totalBytes = 0;
    this.isLoading = false;
    this.listeners = [];
    this.largeFileThreshold = 50 * 1024 * 1024; // 50MB threshold for progressive mode
  }

  /**
   * Adaptive chunk size based on file size.
   * Small files: 2MB chunks (low overhead).
   * 50-200MB: 4MB chunks.
   * 200-500MB: 8MB chunks.
   * 500MB+: 16MB chunks (fewer iterations, less GC pressure).
   */
  _chunkSizeForFile(fileSize) {
    if (fileSize > 500 * 1024 * 1024) return 16 * 1024 * 1024;
    if (fileSize > 200 * 1024 * 1024) return 8 * 1024 * 1024;
    if (fileSize > 50 * 1024 * 1024) return 4 * 1024 * 1024;
    return 2 * 1024 * 1024;
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

    const chunkSize = this._chunkSizeForFile(file.size);

    try {
      // Pre-allocate the final buffer to avoid double-memory from chunk array + combine
      const combined = new Uint8Array(file.size);
      let offset = 0;

      // Yield frequency: every N chunks yield to main thread.
      // For huge files we don't need to yield on every single chunk.
      const yieldInterval = file.size > 200 * 1024 * 1024 ? 4 : 1;
      let chunkCount = 0;

      while (offset < file.size) {
        if (this.abortController.signal.aborted) {
          throw new Error('Loading cancelled');
        }

        const end = Math.min(offset + chunkSize, file.size);
        const slice = file.slice(offset, end);
        const chunk = await slice.arrayBuffer();

        // Copy directly into pre-allocated buffer (no intermediate array)
        combined.set(new Uint8Array(chunk), offset);

        this.loadedBytes = end;
        const percent = Math.round((end / file.size) * 100);
        this._notify('progress', { loadedBytes: end, totalBytes: file.size, percent });
        if (onProgress) onProgress(percent, end, file.size);

        chunkCount++;
        // Yield to main thread periodically to keep UI responsive
        if (chunkCount % yieldInterval === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }

        offset = end;
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
      // For large PDFs, use streaming via ReadableStream
      const fileReader = file.stream();
      const reader = fileReader.getReader();

      // Pre-allocate final buffer to avoid chunks array + combine overhead
      const data = new Uint8Array(file.size);
      let loaded = 0;

      while (true) {
        if (this.abortController.signal.aborted) {
          reader.cancel();
          throw new Error('Loading cancelled');
        }

        const { done, value } = await reader.read();
        if (done) break;

        data.set(value, loaded);
        loaded += value.length;
        this.loadedBytes = loaded;

        const percent = Math.round((loaded / file.size) * 100);
        this._notify('progress', { loadedBytes: loaded, totalBytes: file.size, percent });
        if (onProgress) onProgress(percent, loaded, file.size);
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
