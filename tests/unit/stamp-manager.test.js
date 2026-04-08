import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { StampManager } from '../../app/modules/stamp-manager.js';
import { PDFDocument } from 'pdf-lib';

async function makePdfBytes() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return new Uint8Array(await doc.save());
}

describe('StampManager', () => {
  it('predefined stamps: getAllStamps contains standard stamps', () => {
    const mgr = new StampManager();
    const all = mgr.getAllStamps();
    assert.ok(all.length >= 7);
    const names = all.map(s => s.name);
    assert.ok(names.includes('APPROVED'));
    assert.ok(names.includes('REJECTED'));
    assert.ok(names.includes('DRAFT'));
  });

  it('getStampsByCategory returns standard category', () => {
    const mgr = new StampManager();
    const standard = mgr.getStampsByCategory('standard');
    assert.ok(standard.length >= 7);
  });

  it('addCustomStamp adds to custom category and is retrievable', () => {
    const mgr = new StampManager();
    const stamp = mgr.addCustomStamp('TEST STAMP', null);
    assert.ok(stamp.id.startsWith('custom_'));
    assert.equal(stamp.name, 'TEST STAMP');
    const custom = mgr.getStampsByCategory('custom');
    assert.equal(custom.length, 1);
    assert.equal(custom[0].name, 'TEST STAMP');
  });

  it('removeStamp removes a stamp by ID', () => {
    const mgr = new StampManager();
    const stamp = mgr.addCustomStamp('ToRemove', null);
    assert.equal(mgr.getStampsByCategory('custom').length, 1);
    const removed = mgr.removeStamp(stamp.id);
    assert.equal(removed, true);
    assert.equal(mgr.getStampsByCategory('custom').length, 0);
  });

  it('removeStamp returns false for non-existent ID', () => {
    const mgr = new StampManager();
    assert.equal(mgr.removeStamp('nonexistent'), false);
  });

  it('renameStamp changes the stamp name', () => {
    const mgr = new StampManager();
    const stamp = mgr.addCustomStamp('Original', null);
    const renamed = mgr.renameStamp(stamp.id, 'Renamed');
    assert.equal(renamed, true);
    const custom = mgr.getStampsByCategory('custom');
    assert.equal(custom[0].name, 'Renamed');
  });

  it('renameStamp returns false for non-existent ID', () => {
    const mgr = new StampManager();
    assert.equal(mgr.renameStamp('nope', 'X'), false);
  });

  it('exportStamps and importStamps round-trip', async () => {
    const mgr = new StampManager();
    mgr.addCustomStamp('RoundTrip', null);
    const blob = mgr.exportStamps();
    assert.ok(blob instanceof Blob);

    const mgr2 = new StampManager();
    const text = await blob.text();
    const count = await mgr2.importStamps(text);
    // standard stamps already exist so won't be duplicated; custom should import
    assert.ok(count >= 1);
    const custom = mgr2.getStampsByCategory('custom');
    assert.ok(custom.some(s => s.name === 'RoundTrip'));
  });

  it('importStamps avoids duplicates', async () => {
    const mgr = new StampManager();
    mgr.addCustomStamp('Unique', null);
    const blob = mgr.exportStamps();
    const text = await blob.text();

    // import again into same manager
    const count = await mgr.importStamps(text);
    // custom stamp already exists with same id, should not be added again
    assert.equal(count, 0);
  });
});

describe('StampManager – applyStamp (text-based)', () => {
  it('applies a text stamp to a PDF page and returns a blob', async () => {
    const mgr = new StampManager();
    const bytes = await makePdfBytes();
    // 'approved' is a text-based standard stamp (no imageBytes)
    const result = await mgr.applyStamp(bytes, 'approved', 1, { x: 100, y: 400 });
    assert.ok(result && result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
  });

  it('applies stamp with custom width/height/opacity options', async () => {
    const mgr = new StampManager();
    const bytes = await makePdfBytes();
    const result = await mgr.applyStamp(bytes, 'draft', 1, { x: 50, y: 300 }, {
      width: 150,
      height: 50,
      opacity: 0.5,
    });
    assert.ok(result.blob instanceof Blob);
  });

  it('throws when stamp ID not found', async () => {
    const mgr = new StampManager();
    const bytes = await makePdfBytes();
    await assert.rejects(
      () => mgr.applyStamp(bytes, 'nonexistent_id', 1, { x: 0, y: 0 }),
      /Stamp not found/,
    );
  });

  it('clamps pageNum to valid range', async () => {
    const mgr = new StampManager();
    const bytes = await makePdfBytes(); // 1 page only
    // pageNum=99 should clamp to last page (0-indexed 0)
    const result = await mgr.applyStamp(bytes, 'final', 99, { x: 50, y: 200 });
    assert.ok(result.blob instanceof Blob);
  });
});

describe('StampManager – save() and load()', () => {
  let storage;

  beforeEach(() => {
    // Mock localStorage
    storage = {};
    globalThis.localStorage = {
      getItem: (key) => storage[key] ?? null,
      setItem: (key, value) => { storage[key] = value; },
      removeItem: (key) => { delete storage[key]; },
    };
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('save() writes stamps JSON to localStorage', async () => {
    const mgr = new StampManager();
    mgr.addCustomStamp('Saved Stamp', null);
    await mgr.save();
    assert.ok(storage['novareader-stamps']);
    const parsed = JSON.parse(storage['novareader-stamps']);
    assert.ok(parsed.custom);
    assert.ok(parsed.custom.some(s => s.name === 'Saved Stamp'));
  });

  it('load() restores stamps from localStorage', async () => {
    // Pre-populate localStorage with a custom stamp
    const data = { custom: [{ id: 'loaded_test', name: 'Loaded Stamp', imageBytes: null, color: { r: 0, g: 0, b: 1 } }] };
    storage['novareader-stamps'] = JSON.stringify(data);

    const mgr = new StampManager();
    await mgr.load();
    const custom = mgr.getStampsByCategory('custom');
    assert.ok(custom.some(s => s.id === 'loaded_test'));
  });

  it('load() does nothing when localStorage is empty', async () => {
    const mgr = new StampManager();
    await mgr.load(); // should not throw
    assert.equal(mgr.getStampsByCategory('custom').length, 0);
  });

  it('save() handles localStorage errors gracefully', async () => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => {},
    };
    const mgr = new StampManager();
    // Should not throw even when localStorage.setItem fails
    await mgr.save();
  });
});
