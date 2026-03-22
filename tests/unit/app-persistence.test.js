// ─── Unit Tests: App Persistence ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage before importing the module
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const P = await import('../../app/modules/app-persistence.js');

describe('AppPersistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  // ─── save / load / remove ─────────────────────────────────────────────

  it('saves and loads a value', () => {
    P.save('testKey', { a: 1 });
    assert.deepEqual(P.load('testKey'), { a: 1 });
  });

  it('returns defaultValue for missing key', () => {
    assert.equal(P.load('missing', 42), 42);
  });

  it('returns null for missing key with no default', () => {
    assert.equal(P.load('missing'), null);
  });

  it('removes a key', () => {
    P.save('removeMe', 'value');
    P.remove('removeMe');
    assert.equal(P.load('removeMe'), null);
  });

  it('uses nr3_ prefix for storage keys', () => {
    P.save('myKey', 'val');
    assert.ok(storage.has('nr3_myKey'));
    assert.ok(!storage.has('myKey'));
  });

  // ─── Settings ─────────────────────────────────────────────────────────

  it('loads default settings', () => {
    const settings = P.loadSettings();
    assert.equal(settings.theme, 'dark');
    assert.equal(settings.lang, 'ru');
  });

  it('saves and loads custom settings', () => {
    P.saveSettings({ theme: 'light', lang: 'en' });
    const settings = P.loadSettings();
    assert.equal(settings.theme, 'light');
    assert.equal(settings.lang, 'en');
    // Defaults still present for unspecified keys
    assert.equal(settings.autoOcr, false);
  });

  it('updates a single setting', () => {
    const settings = P.updateSetting('theme', 'sepia');
    assert.equal(settings.theme, 'sepia');
    // Verify persistence
    assert.equal(P.loadSettings().theme, 'sepia');
  });

  // ─── Recent Documents ─────────────────────────────────────────────────

  it('starts with empty recent docs', () => {
    assert.deepEqual(P.getRecentDocs(), []);
  });

  it('adds and retrieves recent docs', () => {
    P.addRecentDoc({ name: 'a.pdf', size: 100 });
    P.addRecentDoc({ name: 'b.pdf', size: 200 });
    const recent = P.getRecentDocs();
    assert.equal(recent.length, 2);
    assert.equal(recent[0].name, 'b.pdf'); // most recent first
    assert.ok(recent[0].openedAt > 0);
  });

  it('deduplicates recent docs by name', () => {
    P.addRecentDoc({ name: 'a.pdf' });
    P.addRecentDoc({ name: 'b.pdf' });
    P.addRecentDoc({ name: 'a.pdf' }); // re-open
    const recent = P.getRecentDocs();
    assert.equal(recent.length, 2);
    assert.equal(recent[0].name, 'a.pdf');
  });

  it('clears recent docs', () => {
    P.addRecentDoc({ name: 'a.pdf' });
    P.clearRecentDocs();
    assert.deepEqual(P.getRecentDocs(), []);
  });

  // ─── Bookmarks ────────────────────────────────────────────────────────

  it('loads empty bookmarks for unknown doc', () => {
    assert.deepEqual(P.loadBookmarks('unknown.pdf'), []);
  });

  it('saves and loads bookmarks', () => {
    P.saveBookmarks('test.pdf', [{ page: 1, label: 'Ch1' }]);
    const bm = P.loadBookmarks('test.pdf');
    assert.equal(bm.length, 1);
    assert.equal(bm[0].label, 'Ch1');
  });

  // ─── Notes ────────────────────────────────────────────────────────────

  it('saves and loads notes', () => {
    P.saveNotes('test.pdf', [{ text: 'My note' }]);
    assert.equal(P.loadNotes('test.pdf')[0].text, 'My note');
  });

  // ─── Reading Progress ─────────────────────────────────────────────────

  it('returns default reading progress', () => {
    const progress = P.loadReadingProgress('unknown.pdf');
    assert.equal(progress.time, 0);
    assert.deepEqual(progress.pagesRead, []);
  });

  it('saves and loads reading progress', () => {
    P.saveReadingProgress('test.pdf', { time: 300, goal: 600, pagesRead: [1, 2, 3] });
    const p = P.loadReadingProgress('test.pdf');
    assert.equal(p.time, 300);
    assert.deepEqual(p.pagesRead, [1, 2, 3]);
  });

  // ─── Strokes / Comments / OCR Text ────────────────────────────────────

  it('saves and loads strokes per page', () => {
    P.saveStrokes('doc.pdf', 1, [{ tool: 'pen', points: [[0,0]] }]);
    const strokes = P.loadStrokes('doc.pdf', 1);
    assert.equal(strokes.length, 1);
    assert.equal(strokes[0].tool, 'pen');
    // Different page is empty
    assert.deepEqual(P.loadStrokes('doc.pdf', 2), []);
  });

  it('saves and loads comments per page', () => {
    P.saveComments('doc.pdf', 1, [{ id: 'c1', text: 'Hello' }]);
    assert.equal(P.loadComments('doc.pdf', 1)[0].text, 'Hello');
  });

  it('saves and loads OCR text per page', () => {
    P.saveOcrText('doc.pdf', 1, 'Recognized text');
    assert.equal(P.loadOcrText('doc.pdf', 1), 'Recognized text');
    assert.equal(P.loadOcrText('doc.pdf', 2), null);
  });

  // ─── Workspace Bundle ─────────────────────────────────────────────────

  it('exports and imports workspace bundle', () => {
    P.saveBookmarks('test.pdf', [{ page: 1 }]);
    P.saveStrokes('test.pdf', 1, [{ tool: 'pen' }]);
    P.saveOcrText('test.pdf', 1, 'OCR output');

    const bundle = P.exportWorkspaceBundle('test.pdf', 2);
    assert.equal(bundle.version, 3);
    assert.equal(bundle.docName, 'test.pdf');
    assert.ok(bundle.bookmarks.length > 0);
    assert.ok(bundle.strokes[1]);
    assert.ok(bundle.ocrText[1]);

    // Clear and reimport
    storage.clear();
    P.importWorkspaceBundle(bundle);
    assert.equal(P.loadBookmarks('test.pdf')[0].page, 1);
    assert.equal(P.loadStrokes('test.pdf', 1)[0].tool, 'pen');
    assert.equal(P.loadOcrText('test.pdf', 1), 'OCR output');
  });

  // ─── clearDocumentData ────────────────────────────────────────────────

  it('clears all data for a document', () => {
    P.saveBookmarks('doc.pdf', [{ page: 1 }]);
    P.saveNotes('doc.pdf', [{ text: 'note' }]);
    P.saveStrokes('doc.pdf', 1, [{ tool: 'pen' }]);
    P.saveOcrText('doc.pdf', 1, 'text');

    P.clearDocumentData('doc.pdf', 2);
    assert.deepEqual(P.loadBookmarks('doc.pdf'), []);
    assert.deepEqual(P.loadNotes('doc.pdf'), []);
    assert.deepEqual(P.loadStrokes('doc.pdf', 1), []);
    assert.equal(P.loadOcrText('doc.pdf', 1), null);
  });
});
