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
});
