// ─── Unit Tests: Loaders (deep coverage) ─────────────────────────────────────
// Tests ensurePdfJs, getPdfjsLib, preloadPdfRuntime, ensureDjVuJs using the
// real pdfjs-dist dynamic import (works in Node.js).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Import a fresh copy by dynamic import so we can test the load sequence.
// The module caches pdfjsLib internally, so we test idempotency.

import {
  ensurePdfJs,
  getPdfjsLib,
  preloadPdfRuntime,
  ensureDjVuJs,
} from '../../app/modules/loaders.js';

// ─── ensurePdfJs ─────────────────────────────────────────────────────────────

describe('ensurePdfJs', () => {
  let lib;

  before(async () => {
    lib = await ensurePdfJs();
  });

  it('returns an object (the pdfjsLib module)', () => {
    assert.ok(lib != null);
    assert.equal(typeof lib, 'object');
  });

  it('has getDocument function', () => {
    assert.equal(typeof lib.getDocument, 'function');
  });

  it('has GlobalWorkerOptions', () => {
    assert.ok(lib.GlobalWorkerOptions != null);
  });

  it('sets workerSrc on GlobalWorkerOptions', () => {
    // workerSrc should be a string URL
    assert.equal(typeof lib.GlobalWorkerOptions.workerSrc, 'string');
    assert.ok(lib.GlobalWorkerOptions.workerSrc.length > 0);
  });
});

// ─── getPdfjsLib (after ensurePdfJs) ─────────────────────────────────────────

describe('getPdfjsLib — after loading', () => {
  it('returns the cached module after ensurePdfJs was called', () => {
    const cached = getPdfjsLib();
    assert.ok(cached != null);
    assert.equal(typeof cached.getDocument, 'function');
  });

  it('returns the same instance each time', () => {
    const a = getPdfjsLib();
    const b = getPdfjsLib();
    assert.strictEqual(a, b);
  });
});

// ─── ensurePdfJs caching ─────────────────────────────────────────────────────

describe('ensurePdfJs — caching', () => {
  it('second call returns the same instance', async () => {
    const first = await ensurePdfJs();
    const second = await ensurePdfJs();
    assert.strictEqual(first, second);
  });

  it('concurrent calls return the same instance', async () => {
    const [a, b, c] = await Promise.all([
      ensurePdfJs(),
      ensurePdfJs(),
      ensurePdfJs(),
    ]);
    assert.strictEqual(a, b);
    assert.strictEqual(b, c);
  });
});

// ─── preloadPdfRuntime ───────────────────────────────────────────────────────

describe('preloadPdfRuntime', () => {
  it('does not throw', () => {
    assert.doesNotThrow(() => preloadPdfRuntime());
  });

  it('multiple calls are safe', () => {
    assert.doesNotThrow(() => {
      preloadPdfRuntime();
      preloadPdfRuntime();
      preloadPdfRuntime();
    });
  });
});

// ─── ensureDjVuJs ────────────────────────────────────────────────────────────
// DjVu.js is loaded via script injection into the DOM. In Node.js the mock DOM
// won't actually load the script, but we can test the error/rejection path and
// verify the function signature.

describe('ensureDjVuJs', () => {
  it('is an async function', () => {
    assert.equal(typeof ensureDjVuJs, 'function');
  });

  it('rejects when DOM script injection fails in Node environment', async () => {
    // Patch createElement to fire onerror so the promise settles (not hangs)
    const origCreateElement = document.createElement;
    document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'script') {
        // Schedule onerror to fire asynchronously so the promise rejects
        const origAppendChild = document.head.appendChild;
        document.head.appendChild = (child) => {
          queueMicrotask(() => {
            if (child.onerror) child.onerror(new Error('mock script error'));
          });
          return child;
        };
        // Restore after one use
        queueMicrotask(() => { document.head.appendChild = origAppendChild; });
      }
      return el;
    };

    try {
      await assert.rejects(
        () => ensureDjVuJs(),
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        },
      );
    } finally {
      document.createElement = origCreateElement;
    }
  });
});
