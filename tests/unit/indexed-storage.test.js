// ─── Unit Tests: Indexed Storage (cache operations) ──────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  openDatabase,
  cachePageRender,
  getCachedPageRender,
  cacheOcrResult,
  getCachedOcrResult,
  saveAnnotations,
  loadAnnotations,
  clearAllCache,
  getStorageUsage,
} from '../../app/modules/indexed-storage.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function deleteIdbDatabase(name) {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
  });
}

function makeBlob(size = 100) {
  // The real Blob has a read-only .size getter. Use a plain object that
  // quacks like a Blob for the mock IDB store.
  return { size, type: 'image/png', _mock: true };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('indexed-storage — cache operations', () => {
  beforeEach(async () => {
    await deleteIdbDatabase('novareader-cache');
  });

  describe('openDatabase', () => {
    it('returns a database object', async () => {
      const db = await openDatabase();
      assert.ok(db);
      assert.equal(db.name, 'novareader-cache');
    });

    it('returns the same instance on subsequent calls', async () => {
      const db1 = await openDatabase();
      const db2 = await openDatabase();
      assert.strictEqual(db1, db2);
    });

    it('creates expected object stores', async () => {
      const db = await openDatabase();
      assert.ok(db.objectStoreNames.contains('rendered-pages'));
      assert.ok(db.objectStoreNames.contains('ocr-results'));
      assert.ok(db.objectStoreNames.contains('annotations'));
      assert.ok(db.objectStoreNames.contains('document-meta'));
    });
  });

  describe('cachePageRender / getCachedPageRender', () => {
    it('stores and retrieves a page render', async () => {
      const blob = makeBlob(500);
      await cachePageRender('doc.pdf', 1, blob, { zoom: 1.5 });

      const cached = await getCachedPageRender('doc.pdf', 1);
      assert.ok(cached);
    });

    it('returns null for non-cached page', async () => {
      // Ensure DB is open first
      await openDatabase();
      const cached = await getCachedPageRender('doc.pdf', 99);
      assert.equal(cached, null);
    });

    it('overwrites existing render for same page', async () => {
      const blob1 = makeBlob(100);
      const blob2 = makeBlob(200);

      await cachePageRender('doc.pdf', 1, blob1);
      await cachePageRender('doc.pdf', 1, blob2);

      const cached = await getCachedPageRender('doc.pdf', 1);
      assert.ok(cached);
    });

    it('stores different pages independently', async () => {
      await cachePageRender('doc.pdf', 1, makeBlob(100));
      await cachePageRender('doc.pdf', 2, makeBlob(200));

      const c1 = await getCachedPageRender('doc.pdf', 1);
      const c2 = await getCachedPageRender('doc.pdf', 2);
      assert.ok(c1);
      assert.ok(c2);
    });
  });

  describe('cacheOcrResult / getCachedOcrResult', () => {
    it('stores and retrieves OCR result', async () => {
      const ocrResult = { text: 'Hello', confidence: 0.95, language: 'eng' };
      await cacheOcrResult('doc.pdf', 1, ocrResult);

      const cached = await getCachedOcrResult('doc.pdf', 1);
      assert.ok(cached);
      assert.equal(cached.text, 'Hello');
      assert.equal(cached.confidence, 0.95);
      assert.equal(cached.language, 'eng');
    });

    it('returns null for non-cached OCR', async () => {
      await openDatabase();
      const cached = await getCachedOcrResult('doc.pdf', 99);
      assert.equal(cached, null);
    });
  });

  describe('saveAnnotations / loadAnnotations', () => {
    it('stores and retrieves annotations', async () => {
      const annotations = [
        { type: 'highlight', bounds: { x: 10, y: 20, w: 100, h: 15 }, color: '#ff0' },
      ];
      await saveAnnotations('doc.pdf', 1, annotations);

      const loaded = await loadAnnotations('doc.pdf', 1);
      assert.ok(loaded);
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].type, 'highlight');
    });

    it('returns null for non-saved page', async () => {
      await openDatabase();
      const loaded = await loadAnnotations('doc.pdf', 99);
      assert.equal(loaded, null);
    });
  });

  describe('clearAllCache', () => {
    it('removes all data from all stores', async () => {
      await cachePageRender('doc.pdf', 1, makeBlob(100));
      await cacheOcrResult('doc.pdf', 1, { text: 'hi', confidence: 1 });
      await saveAnnotations('doc.pdf', 1, [{ type: 'highlight' }]);

      await clearAllCache();

      const page = await getCachedPageRender('doc.pdf', 1);
      const ocr = await getCachedOcrResult('doc.pdf', 1);
      const annot = await loadAnnotations('doc.pdf', 1);

      assert.equal(page, null);
      assert.equal(ocr, null);
      assert.equal(annot, null);
    });

    it('does not throw on empty cache', async () => {
      await openDatabase();
      await clearAllCache();
    });
  });

  describe('getStorageUsage', () => {
    it('returns zero counts for empty database', async () => {
      await openDatabase();
      const usage = await getStorageUsage();
      assert.equal(usage.total, 0);
      assert.equal(usage.pages, 0);
      assert.equal(usage.ocr, 0);
      assert.equal(usage.annotations, 0);
    });

    it('returns counts after storing data', async () => {
      await cachePageRender('doc.pdf', 1, makeBlob(100));
      await cachePageRender('doc.pdf', 2, makeBlob(100));
      await cacheOcrResult('doc.pdf', 1, { text: 'hi', confidence: 1 });

      const usage = await getStorageUsage();
      assert.equal(usage.pages, 2);
      assert.equal(usage.ocr, 1);
      assert.equal(usage.annotations, 0);
      assert.equal(usage.total, 3);
    });
  });
});
