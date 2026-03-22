// ─── Unit Tests: Loaders (extended) ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ensurePdfJs,
  getPdfjsLib,
  preloadPdfRuntime,
} from '../../app/modules/loaders.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ensurePdfJs — loading and caching', () => {
  it('returns the pdfjsLib module on success', async () => {
    const lib = await ensurePdfJs();
    assert.ok(lib, 'should return a truthy module');
    assert.ok(lib.getDocument, 'should have getDocument function');
    assert.ok(lib.GlobalWorkerOptions, 'should have GlobalWorkerOptions');
  });

  it('returns the same module on subsequent calls (cached)', async () => {
    const lib1 = await ensurePdfJs();
    const lib2 = await ensurePdfJs();
    assert.strictEqual(lib1, lib2, 'should return the same cached reference');
  });

  it('sets the worker source URL', async () => {
    const lib = await ensurePdfJs();
    assert.ok(
      typeof lib.GlobalWorkerOptions.workerSrc === 'string',
      'workerSrc should be a string',
    );
    assert.ok(
      lib.GlobalWorkerOptions.workerSrc.length > 0,
      'workerSrc should be non-empty',
    );
  });

  it('getPdfjsLib returns the loaded module after successful load', async () => {
    await ensurePdfJs();
    const lib = getPdfjsLib();
    assert.ok(lib, 'should not be null after successful load');
    assert.ok(lib.getDocument, 'should have getDocument');
  });
});

describe('preloadPdfRuntime — extended', () => {
  it('schedules ensurePdfJs during idle time without throwing', () => {
    assert.doesNotThrow(() => {
      preloadPdfRuntime();
    });
  });

  it('completes without unhandled rejection', async () => {
    preloadPdfRuntime();
    // Wait for the scheduled idle callback to execute
    await new Promise((r) => setTimeout(r, 100));
    // If we reach here without unhandled rejection, the test passes
    assert.ok(true);
  });

  it('getPdfjsLib returns the module after preload completes', async () => {
    preloadPdfRuntime();
    await new Promise((r) => setTimeout(r, 100));
    const lib = getPdfjsLib();
    assert.ok(lib, 'should be loaded after preload');
  });

  it('can be called concurrently without issues', async () => {
    preloadPdfRuntime();
    preloadPdfRuntime();
    preloadPdfRuntime();
    await new Promise((r) => setTimeout(r, 100));
    const lib = getPdfjsLib();
    assert.ok(lib, 'should still be loaded');
  });

  it('concurrent calls reuse the same load promise', async () => {
    const [a, b] = await Promise.all([ensurePdfJs(), ensurePdfJs()]);
    assert.strictEqual(a, b, 'should return the same module from concurrent calls');
  });
});
