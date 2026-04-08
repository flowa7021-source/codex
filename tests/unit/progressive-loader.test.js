import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { ProgressiveLoader, progressiveLoader } from '../../app/modules/progressive-loader.js';

describe('ProgressiveLoader', () => {
  it('constructor initializes defaults', () => {
    const loader = new ProgressiveLoader();
    assert.equal(loader.isLoading, false);
    assert.equal(loader.loadedBytes, 0);
    assert.equal(loader.totalBytes, 0);
    assert.equal(loader.largeFileThreshold, 50 * 1024 * 1024);
  });

  it('isLargeFile returns true for files above threshold', () => {
    const loader = new ProgressiveLoader();
    assert.equal(loader.isLargeFile({ size: 100 * 1024 * 1024 }), true);
    assert.equal(loader.isLargeFile({ size: 10 * 1024 * 1024 }), false);
    assert.ok(!loader.isLargeFile(null), 'null file should be falsy');
  });

  it('_chunkSizeForFile returns adaptive chunk sizes', () => {
    const loader = new ProgressiveLoader();
    assert.equal(loader._chunkSizeForFile(10 * 1024 * 1024), 2 * 1024 * 1024);
    assert.equal(loader._chunkSizeForFile(100 * 1024 * 1024), 4 * 1024 * 1024);
    assert.equal(loader._chunkSizeForFile(300 * 1024 * 1024), 8 * 1024 * 1024);
    assert.equal(loader._chunkSizeForFile(600 * 1024 * 1024), 16 * 1024 * 1024);
  });

  it('getProgress returns initial state', () => {
    const loader = new ProgressiveLoader();
    const progress = loader.getProgress();
    assert.equal(progress.isLoading, false);
    assert.equal(progress.loadedBytes, 0);
    assert.equal(progress.totalBytes, 0);
    assert.equal(progress.percent, 0);
  });

  it('formatBytes formats correctly', () => {
    const loader = new ProgressiveLoader();
    assert.equal(loader.formatBytes(500), '500 B');
    assert.equal(loader.formatBytes(1024), '1.0 KB');
    assert.equal(loader.formatBytes(1024 * 1024), '1.0 MB');
    assert.equal(loader.formatBytes(2.5 * 1024 * 1024 * 1024), '2.50 GB');
  });

  it('onEvent registers listener and _notify calls it', () => {
    const loader = new ProgressiveLoader();
    const events = [];
    loader.onEvent((evt, data) => events.push({ evt, data }));
    loader._notify('test', { value: 42 });
    assert.equal(events.length, 1);
    assert.equal(events[0].evt, 'test');
    assert.equal(events[0].data.value, 42);
  });

  it('cancel aborts loading and notifies', () => {
    const loader = new ProgressiveLoader();
    loader.abortController = new AbortController();
    loader.isLoading = true;
    const events = [];
    loader.onEvent((evt) => events.push(evt));

    loader.cancel();
    assert.equal(loader.isLoading, false);
    assert.ok(events.includes('cancel'));
  });

  it('progressiveLoader is a singleton instance', () => {
    assert.ok(progressiveLoader instanceof ProgressiveLoader);
  });

  it('loadFileProgressive rejects when cancelled', async () => {
    const loader = new ProgressiveLoader();
    const fakeFile = {
      size: 4 * 1024 * 1024,
      name: 'test.pdf',
      slice: () => ({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }),
    };

    // Start loading and cancel immediately
    const loadPromise = loader.loadFileProgressive(fakeFile, () => {});
    loader.cancel();

    await assert.rejects(loadPromise, /cancelled/i);
  });

  it('loadPdfProgressive throws when pdfjsLib is null', async () => {
    const loader = new ProgressiveLoader();
    const file = { size: 100, name: 'test.pdf', stream: () => ({ getReader: () => {} }) };
    await assert.rejects(
      () => loader.loadPdfProgressive(file, null),
      /PDF.js not available/,
    );
  });

  it('loadPdfProgressive reads file via stream and returns pdfDoc', async () => {
    const loader = new ProgressiveLoader();

    const data = new Uint8Array(1024).fill(42);
    let readCount = 0;
    const mockFile = {
      size: 1024,
      name: 'test.pdf',
      stream: () => ({
        getReader: () => ({
          read: async () => {
            if (readCount === 0) {
              readCount++;
              return { done: false, value: data };
            }
            return { done: true, value: undefined };
          },
          cancel: async () => {},
        }),
      }),
    };

    const mockPdfjs = {
      getDocument: (_opts) => {
        const task = {
          promise: Promise.resolve({ numPages: 3 }),
          onProgress: null,
        };
        return task;
      },
    };

    const events = [];
    loader.onEvent((evt) => events.push(evt));
    const pdfDoc = await loader.loadPdfProgressive(mockFile, mockPdfjs);
    assert.ok(pdfDoc);
    assert.equal(pdfDoc.numPages, 3);
    assert.ok(events.includes('start'));
    assert.ok(events.includes('complete'));
  });

  it('loadPdfProgressive calls onProgress callback', async () => {
    const loader = new ProgressiveLoader();

    const data = new Uint8Array(100).fill(0);
    let readCount = 0;
    const mockFile = {
      size: 100,
      name: 'test.pdf',
      stream: () => ({
        getReader: () => ({
          read: async () => {
            if (readCount === 0) {
              readCount++;
              return { done: false, value: data };
            }
            return { done: true, value: undefined };
          },
          cancel: async () => {},
        }),
      }),
    };

    const mockPdfjs = {
      getDocument: () => ({ promise: Promise.resolve({ numPages: 1 }), onProgress: null }),
    };

    const progressCalls = [];
    await loader.loadPdfProgressive(mockFile, mockPdfjs, (pct) => progressCalls.push(pct));
    assert.ok(progressCalls.length > 0);
    assert.equal(progressCalls[0], 100);
  });

  it('loadPdfProgressive fires pdf-parse progress events via loadingTask.onProgress', async () => {
    const loader = new ProgressiveLoader();

    const data = new Uint8Array(50).fill(0);
    let readCount = 0;
    const mockFile = {
      size: 50,
      name: 'test.pdf',
      stream: () => ({
        getReader: () => ({
          read: async () => {
            if (readCount === 0) { readCount++; return { done: false, value: data }; }
            return { done: true, value: undefined };
          },
          cancel: async () => {},
        }),
      }),
    };

    const events = [];
    loader.onEvent((evt) => events.push(evt));

    let onProgressFn = null;
    const mockPdfjs = {
      getDocument: () => {
        const task = {};
        task.promise = Promise.resolve({ numPages: 1 });
        // Simulate calling onProgress after getDocument
        queueMicrotask(() => {
          if (onProgressFn) onProgressFn({ loaded: 50, total: 100 });
        });
        Object.defineProperty(task, 'onProgress', {
          set(fn) { onProgressFn = fn; },
          get() { return onProgressFn; },
        });
        return task;
      },
    };

    await loader.loadPdfProgressive(mockFile, mockPdfjs);
    assert.ok(events.includes('complete'));
  });
});
