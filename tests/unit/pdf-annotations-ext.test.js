// ─── Extended Unit Tests: PDF Annotations Pro Module ─────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { AnnotationManager, ANNOTATION_TYPES, HIGHLIGHT_COLORS } from '../../app/modules/pdf-annotations-pro.js';

describe('ANNOTATION_TYPES', () => {
  it('exports all expected types', () => {
    assert.equal(ANNOTATION_TYPES.HIGHLIGHT, 'highlight');
    assert.equal(ANNOTATION_TYPES.UNDERLINE, 'underline');
    assert.equal(ANNOTATION_TYPES.STRIKETHROUGH, 'strikethrough');
    assert.equal(ANNOTATION_TYPES.STICKY_NOTE, 'sticky-note');
    assert.equal(ANNOTATION_TYPES.TEXT_BOX, 'text-box');
    assert.equal(ANNOTATION_TYPES.CALLOUT, 'callout');
    assert.equal(ANNOTATION_TYPES.MEASURE, 'measure');
    assert.equal(ANNOTATION_TYPES.PEN, 'pen');
    assert.equal(ANNOTATION_TYPES.RECT, 'rect');
  });
});

describe('HIGHLIGHT_COLORS', () => {
  it('has expected colors', () => {
    assert.ok(HIGHLIGHT_COLORS.yellow);
    assert.ok(HIGHLIGHT_COLORS.green);
    assert.ok(HIGHLIGHT_COLORS.blue);
    assert.ok(HIGHLIGHT_COLORS.pink);
    assert.ok(HIGHLIGHT_COLORS.orange);
  });
});

describe('AnnotationManager', () => {
  let mgr;
  beforeEach(() => { mgr = new AnnotationManager(); });

  it('starts empty', () => {
    assert.equal(mgr.count, 0);
  });

  it('add creates annotation with id and defaults', () => {
    const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 20, w: 100, h: 30 } });
    assert.ok(ann.id);
    assert.equal(ann.pageNum, 1);
    assert.equal(ann.color, '#ffd84d');
    assert.equal(ann.opacity, 0.4);
    assert.equal(ann.resolved, false);
    assert.deepEqual(ann.replies, []);
  });

  it('getForPage returns annotations for a page', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    assert.equal(mgr.getForPage(1).length, 2);
    assert.equal(mgr.getForPage(2).length, 1);
    assert.equal(mgr.getForPage(3).length, 0);
  });

  it('getAll returns all annotations', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.add(2, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    assert.equal(mgr.getAll().length, 2);
  });

  it('remove removes an annotation by id', () => {
    const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    const removed = mgr.remove(ann.id);
    assert.ok(removed);
    assert.equal(mgr.count, 0);
  });

  it('remove returns null for non-existent', () => {
    assert.equal(mgr.remove('nope'), null);
  });

  it('addReply adds reply', () => {
    const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    const reply = mgr.addReply(ann.id, 'Nice', 'Bob');
    assert.ok(reply);
    assert.equal(reply.text, 'Nice');
    assert.equal(ann.replies.length, 1);
  });

  it('addReply returns null for bad id', () => {
    assert.equal(mgr.addReply('nope', 'hello'), null);
  });

  it('toggleResolved toggles', () => {
    const ann = mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    assert.equal(mgr.toggleResolved(ann.id), true);
    assert.equal(mgr.toggleResolved(ann.id), false);
    assert.equal(mgr.toggleResolved('nope'), null);
  });

  it('clearAll clears', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.clearAll();
    assert.equal(mgr.count, 0);
  });

  it('onChange subscribe/unsubscribe', () => {
    let count = 0;
    const unsub = mgr.onChange(() => count++);
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    assert.equal(count, 1);
    unsub();
    mgr.add(2, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    assert.equal(count, 1);
  });

  // Canvas drawing - only test types that don't use setLineDash (mock limitation)
  it('drawOnCanvas does not throw for empty page', () => {
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  it('drawOnCanvas draws highlight', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 20, w: 100, h: 30 } });
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  it('drawOnCanvas draws underline', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 10, y: 20, w: 100, h: 30 } });
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  it('drawOnCanvas draws squiggly underline', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 10, y: 20, w: 100, h: 30 }, squiggly: true });
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  it('drawOnCanvas draws strikethrough', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.STRIKETHROUGH, bounds: { x: 10, y: 20, w: 100, h: 30 } });
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  it('drawOnCanvas draws sticky note', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 10, y: 20, w: 20, h: 20 } });
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  it('drawOnCanvas skips annotation without bounds', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT });
    const ctx = document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => mgr.drawOnCanvas(ctx, 1));
  });

  // toJSON / fromJSON
  it('toJSON and fromJSON round-trip', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    const json = mgr.toJSON();
    const mgr2 = new AnnotationManager();
    mgr2.fromJSON(json);
    assert.equal(mgr2.count, 1);
    assert.equal(mgr2.getForPage(1)[0].type, ANNOTATION_TYPES.HIGHLIGHT);
  });

  // XFDF export
  it('exportAsXFDF returns valid XML', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 20, w: 100, h: 30 }, text: 'test' });
    mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.add(1, { type: ANNOTATION_TYPES.STRIKETHROUGH, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.add(1, { type: ANNOTATION_TYPES.STICKY_NOTE, bounds: { x: 0, y: 0, w: 10, h: 10 }, text: 'Note' });
    mgr.add(1, { type: ANNOTATION_TYPES.TEXT_BOX, bounds: { x: 0, y: 0, w: 10, h: 10 }, text: 'Box' });
    mgr.add(1, { type: ANNOTATION_TYPES.RECT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    const xfdf = mgr.exportAsXFDF('test.pdf');
    assert.ok(xfdf.includes('<?xml'));
    assert.ok(xfdf.includes('<xfdf'));
    assert.ok(xfdf.includes('<highlight'));
    assert.ok(xfdf.includes('<underline'));
    assert.ok(xfdf.includes('<strikeout'));
    assert.ok(xfdf.includes('<text'));
    assert.ok(xfdf.includes('<freetext'));
    assert.ok(xfdf.includes('<square'));
  });

  it('exportAsXFDF escapes XML characters', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 }, text: '<b>bold & "quoted"</b>' });
    const xfdf = mgr.exportAsXFDF();
    assert.ok(xfdf.includes('&lt;'));
    assert.ok(xfdf.includes('&amp;'));
  });

  // _parseColor
  it('_parseColor handles hex, named, null', () => {
    assert.ok(mgr._parseColor('#ff0000'));
    assert.ok(mgr._parseColor('yellow'));
    assert.ok(mgr._parseColor(null));
  });
});
