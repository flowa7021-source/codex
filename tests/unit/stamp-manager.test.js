import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StampManager } from '../../app/modules/stamp-manager.js';

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
