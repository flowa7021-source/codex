// ─── Unit Tests: OCR Storage (IndexedDB paths) ──────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  saveOcrData,
  loadOcrData,
  savePageOcrText,
  getPageOcrText,
  deleteOcrData,
  listOcrDocuments,
  getOcrStorageSize,
  isIndexedDbAvailable,
} from '../../app/modules/ocr-storage.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function deleteIdbDatabase(name) {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ocr-storage — IndexedDB paths', () => {
  beforeEach(async () => {
    localStorage.clear();
    await deleteIdbDatabase('novareader-ocr');
  });

  describe('isIndexedDbAvailable', () => {
    it('returns true when indexedDB global exists', () => {
      assert.equal(isIndexedDbAvailable(), true);
    });
  });

  describe('saveOcrData / loadOcrData', () => {
    it('stores and retrieves OCR data via IDB', async () => {
      const data = {
        pagesText: ['Page 1 text', 'Page 2 text'],
        source: 'tesseract',
        scannedPages: 2,
        totalPages: 5,
      };

      await saveOcrData('test-doc.pdf', data);
      const loaded = await loadOcrData('test-doc.pdf');

      assert.ok(loaded);
      assert.deepEqual(loaded.pagesText, ['Page 1 text', 'Page 2 text']);
      assert.equal(loaded.source, 'tesseract');
      assert.equal(loaded.scannedPages, 2);
      assert.equal(loaded.totalPages, 5);
      assert.equal(loaded.docName, 'test-doc.pdf');
    });

    it('returns null for non-existent document', async () => {
      const result = await loadOcrData('nonexistent.pdf');
      assert.equal(result, null);
    });

    it('overwrites existing data for the same document', async () => {
      await saveOcrData('doc.pdf', {
        pagesText: ['old text'],
        source: 'manual',
        scannedPages: 1,
        totalPages: 1,
      });

      await saveOcrData('doc.pdf', {
        pagesText: ['new text', 'page 2'],
        source: 'tesseract',
        scannedPages: 2,
        totalPages: 3,
      });

      const loaded = await loadOcrData('doc.pdf');
      assert.ok(loaded);
      assert.deepEqual(loaded.pagesText, ['new text', 'page 2']);
      assert.equal(loaded.scannedPages, 2);
    });

    it('uses defaults for missing fields', async () => {
      await saveOcrData('minimal.pdf', {});
      const loaded = await loadOcrData('minimal.pdf');

      assert.ok(loaded);
      assert.deepEqual(loaded.pagesText, []);
      assert.equal(loaded.source, 'manual');
      assert.equal(loaded.scannedPages, 0);
      assert.equal(loaded.totalPages, 0);
    });
  });

  describe('savePageOcrText / getPageOcrText', () => {
    it('saves and retrieves text for a single page', async () => {
      const docName = 'page-single.pdf';
      await savePageOcrText(docName, 1, 'Hello World');
      const text = await getPageOcrText(docName, 1);
      assert.equal(text, 'Hello World');
    });

    it('returns empty string for unsaved page', async () => {
      const docName = 'page-unsaved.pdf';
      const text = await getPageOcrText(docName, 5);
      assert.equal(text, '');
    });

    it('pads pagesText array for non-sequential page saves', async () => {
      const docName = 'page-pad.pdf';
      await savePageOcrText(docName, 3, 'Page 3 text');
      const loaded = await loadOcrData(docName);
      assert.ok(loaded);
      assert.equal(loaded.pagesText.length, 3);
      assert.equal(loaded.pagesText[0], '');
      assert.equal(loaded.pagesText[1], '');
      assert.equal(loaded.pagesText[2], 'Page 3 text');
    });

    it('preserves existing pages when adding a new one', async () => {
      const docName = 'page-preserve.pdf';
      await savePageOcrText(docName, 1, 'First');
      await savePageOcrText(docName, 2, 'Second');
      const t1 = await getPageOcrText(docName, 1);
      const t2 = await getPageOcrText(docName, 2);
      assert.equal(t1, 'First');
      assert.equal(t2, 'Second');
    });

    it('updates scannedPages count', async () => {
      const docName = 'page-count.pdf';
      await savePageOcrText(docName, 1, 'text1');
      await savePageOcrText(docName, 3, 'text3');
      const loaded = await loadOcrData(docName);
      assert.ok(loaded);
      assert.equal(loaded.scannedPages, 2); // pages 1 and 3 have text
    });
  });

  describe('deleteOcrData', () => {
    it('removes OCR data from IDB', async () => {
      await saveOcrData('doc.pdf', { pagesText: ['text'], source: 'manual', scannedPages: 1, totalPages: 1 });
      await deleteOcrData('doc.pdf');
      const loaded = await loadOcrData('doc.pdf');
      assert.equal(loaded, null);
    });

    it('also removes from localStorage', async () => {
      localStorage.setItem('novareader-ocr-text:doc.pdf', '{"pagesText":["text"]}');
      await deleteOcrData('doc.pdf');
      assert.equal(localStorage.getItem('novareader-ocr-text:doc.pdf'), null);
    });

    it('does not throw for non-existent document', async () => {
      await deleteOcrData('nonexistent.pdf');
    });
  });

  describe('listOcrDocuments', () => {
    it('returns doc names that include newly saved documents', async () => {
      const before = await listOcrDocuments();
      const uniqueDoc = `list-test-${Date.now()}.pdf`;
      await saveOcrData(uniqueDoc, { pagesText: ['a'], source: 'manual', scannedPages: 1, totalPages: 1 });

      const after = await listOcrDocuments();
      assert.equal(after.length, before.length + 1);
      assert.ok(after.includes(uniqueDoc));
    });

    it('returns multiple document names', async () => {
      const doc1 = `list-multi-1-${Date.now()}.pdf`;
      const doc2 = `list-multi-2-${Date.now()}.pdf`;
      await saveOcrData(doc1, { pagesText: ['a'], source: 'manual', scannedPages: 1, totalPages: 1 });
      await saveOcrData(doc2, { pagesText: ['b'], source: 'manual', scannedPages: 1, totalPages: 1 });

      const docs = await listOcrDocuments();
      assert.ok(docs.includes(doc1));
      assert.ok(docs.includes(doc2));
    });
  });

  describe('getOcrStorageSize', () => {
    it('returns a non-negative number', async () => {
      const size = await getOcrStorageSize();
      assert.ok(size >= 0, `Expected size >= 0, got ${size}`);
    });

    it('returns positive size after storing data', async () => {
      const uniqueDoc = `size-test-${Date.now()}.pdf`;
      await saveOcrData(uniqueDoc, { pagesText: ['Hello world page text'], source: 'tesseract', scannedPages: 1, totalPages: 1 });
      const size = await getOcrStorageSize();
      assert.ok(size > 0, `Expected size > 0, got ${size}`);
    });

    it('size increases with more data', async () => {
      const sizeBefore = await getOcrStorageSize();
      const uniqueDoc = `size-grow-${Date.now()}.pdf`;
      await saveOcrData(uniqueDoc, { pagesText: ['A much longer piece of OCR text that spans multiple words and sentences for size testing'], source: 'tesseract', scannedPages: 1, totalPages: 1 });
      const sizeAfter = await getOcrStorageSize();

      assert.ok(sizeAfter > sizeBefore, `Expected sizeAfter (${sizeAfter}) > sizeBefore (${sizeBefore})`);
    });
  });
});
