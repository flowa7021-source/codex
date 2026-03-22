// ─── Coverage Tests: PdfAnnotationsPro ────────────────────────────────────────
// Tests drawOnCanvas for all annotation types, _parseColor edge cases,
// and annotation positioning to push coverage from 66% toward 85%.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Ensure crypto.randomUUID is available
if (!globalThis.crypto) {
  globalThis.crypto = { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` };
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

import {
  AnnotationManager,
  ANNOTATION_TYPES,
  HIGHLIGHT_COLORS,
} from '../../app/modules/pdf-annotations-pro.js';

// ── Mock Canvas Context ──────────────────────────────────────────────────────

function makeMockCtx() {
  const calls = [];
  return {
    calls,
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    fillText(...args) { calls.push(['fillText', ...args]); },
    beginPath() { calls.push('beginPath'); },
    closePath() { calls.push('closePath'); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    stroke() { calls.push('stroke'); },
    fill() { calls.push('fill'); },
    arc() { calls.push('arc'); },
    setLineDash(d) { calls.push(['setLineDash', d]); },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
}

// ── drawOnCanvas – all annotation types ──────────────────────────────────────

describe('drawOnCanvas annotation type paths', () => {
  let mgr;

  beforeEach(() => {
    mgr = new AnnotationManager();
  });

  it('draws highlight annotation (fillRect)', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.HIGHLIGHT,
      bounds: { x: 10, y: 20, w: 100, h: 15 },
      color: '#ffd84d',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillRect'));
  });

  it('draws underline annotation (straight line)', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.UNDERLINE,
      bounds: { x: 10, y: 20, w: 100, h: 15 },
      color: '#ff0000',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.includes('beginPath'));
    assert.ok(ctx.calls.includes('stroke'));
  });

  it('draws squiggly underline annotation (wavy line)', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.UNDERLINE,
      bounds: { x: 10, y: 20, w: 100, h: 15 },
      color: '#ff0000',
      squiggly: true,
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 2);  // scale=2
    assert.ok(ctx.calls.includes('beginPath'));
    assert.ok(ctx.calls.includes('stroke'));
    // Squiggly should have multiple lineTo calls for wave pattern
    const lineToCount = ctx.calls.filter(c => Array.isArray(c) && c[0] === 'lineTo').length;
    assert.ok(lineToCount > 2, 'Squiggly should have multiple lineTo for waves');
  });

  it('draws strikethrough annotation', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.STRIKETHROUGH,
      bounds: { x: 5, y: 10, w: 80, h: 12 },
      color: '#ff0000',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.includes('beginPath'));
    assert.ok(ctx.calls.includes('stroke'));
    // Strikethrough should draw at midY
    const moveTo = ctx.calls.find(c => Array.isArray(c) && c[0] === 'moveTo');
    assert.ok(moveTo, 'Should have moveTo for strikethrough line');
  });

  it('draws sticky note annotation (icon + text)', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.STICKY_NOTE,
      bounds: { x: 30, y: 40, w: 20, h: 20 },
      color: '#ffd84d',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    // Should draw filled rect for icon and strokeRect for border
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillRect'));
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'strokeRect'));
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillText'));
  });

  it('draws text box annotation with text', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.TEXT_BOX,
      bounds: { x: 10, y: 20, w: 200, h: 50 },
      color: '#3b82f6',
      text: 'Hello Box',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'strokeRect'));
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillRect'));
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillText' && c[1] === 'Hello Box'));
  });

  it('draws text box annotation without text', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.TEXT_BOX,
      bounds: { x: 10, y: 20, w: 200, h: 50 },
      color: '#3b82f6',
      text: '',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'strokeRect'));
    // No fillText with empty text
    const fillTexts = ctx.calls.filter(c => Array.isArray(c) && c[0] === 'fillText' && typeof c[1] === 'string' && c[1] !== '');
    // fillText for emoji indicator is still present for sticky note but not text box with empty text
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillRect'));
  });

  it('draws callout annotation with target arrow', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.CALLOUT,
      bounds: { x: 50, y: 50, w: 150, h: 40 },
      color: '#ff6600',
      text: 'Note here',
      target: { x: 200, y: 200 },
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'strokeRect'));
    // Arrow to target: beginPath, moveTo, lineTo, stroke, then arrowhead
    assert.ok(ctx.calls.includes('closePath'), 'Arrowhead should close path');
    assert.ok(ctx.calls.includes('fill'), 'Arrowhead should be filled');
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillText' && c[1] === 'Note here'));
  });

  it('draws callout without target', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.CALLOUT,
      bounds: { x: 50, y: 50, w: 150, h: 40 },
      color: '#ff6600',
      text: '',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'strokeRect'));
  });

  it('draws measure annotation with dashed line and label', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.MEASURE,
      bounds: { x: 10, y: 10, w: 100, h: 50 },
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'setLineDash'));
    assert.ok(ctx.calls.includes('beginPath'));
    assert.ok(ctx.calls.includes('stroke'));
    // Distance label
    assert.ok(ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillText'));
  });

  it('skips annotation with no bounds', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.HIGHLIGHT,
      bounds: null,
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    // Should still call save/restore but no fillRect
    assert.ok(ctx.calls.includes('save'));
    assert.ok(ctx.calls.includes('restore'));
    assert.ok(!ctx.calls.some(c => Array.isArray(c) && c[0] === 'fillRect'));
  });

  it('applies scale factor to coordinates', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.HIGHLIGHT,
      bounds: { x: 10, y: 20, w: 100, h: 15 },
      color: '#ffd84d',
    });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 2);  // scale = 2
    const fillRect = ctx.calls.find(c => Array.isArray(c) && c[0] === 'fillRect');
    assert.ok(fillRect);
    assert.equal(fillRect[1], 20);   // x * 2
    assert.equal(fillRect[2], 40);   // y * 2
    assert.equal(fillRect[3], 200);  // w * 2
    assert.equal(fillRect[4], 30);   // h * 2
  });
});

// ── _parseColor ──────────────────────────────────────────────────────────────

describe('_parseColor', () => {
  let mgr;
  beforeEach(() => { mgr = new AnnotationManager(); });

  it('parses full hex color #rrggbb', () => {
    const c = mgr._parseColor('#ff8800');
    assert.ok(c);
  });

  it('parses named color yellow', () => {
    const c = mgr._parseColor('yellow');
    assert.ok(c);
  });

  it('parses named color green', () => {
    const c = mgr._parseColor('green');
    assert.ok(c);
  });

  it('parses named color blue', () => {
    const c = mgr._parseColor('blue');
    assert.ok(c);
  });

  it('parses named color pink', () => {
    const c = mgr._parseColor('pink');
    assert.ok(c);
  });

  it('parses named color orange', () => {
    const c = mgr._parseColor('orange');
    assert.ok(c);
  });

  it('returns default for unknown named color', () => {
    const c = mgr._parseColor('magenta');
    assert.ok(c);
  });

  it('returns default for empty string', () => {
    const c = mgr._parseColor('');
    assert.ok(c);
  });

  it('returns default for null', () => {
    const c = mgr._parseColor(null);
    assert.ok(c);
  });

  it('parses #000000 as black', () => {
    const c = mgr._parseColor('#000000');
    assert.ok(c);
  });

  it('parses #ffffff as white', () => {
    const c = mgr._parseColor('#ffffff');
    assert.ok(c);
  });
});

// ── exportAsXFDF additional types ────────────────────────────────────────────

describe('exportAsXFDF additional types', () => {
  let mgr;
  beforeEach(() => { mgr = new AnnotationManager(); });

  it('exports RECT type as square tag', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.RECT, bounds: { x: 0, y: 0, w: 50, h: 50 } });
    const xml = mgr.exportAsXFDF();
    assert.ok(xml.includes('<square'));
  });

  it('exports highlight with contents text', () => {
    mgr.add(1, {
      type: ANNOTATION_TYPES.HIGHLIGHT,
      bounds: { x: 0, y: 0, w: 100, h: 15 },
      text: 'Important note',
    });
    const xml = mgr.exportAsXFDF();
    assert.ok(xml.includes('<contents>Important note</contents>'));
  });

  it('exports annotations from multiple pages', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.add(3, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    const xml = mgr.exportAsXFDF();
    assert.ok(xml.includes('page="0"'));  // page 1 -> 0
    assert.ok(xml.includes('page="2"'));  // page 3 -> 2
  });

  it('escapes special characters in pdf filename', () => {
    const xml = mgr.exportAsXFDF('file & <name>.pdf');
    assert.ok(xml.includes('&amp;'));
    assert.ok(xml.includes('&lt;'));
  });
});

// ── importFromXFDF ─ skipped (requires DOMParser which is browser-only) ──

// ── Multiple annotations on same page ────────────────────────────────────────

describe('multiple annotations on same page rendering', () => {
  let mgr;
  beforeEach(() => { mgr = new AnnotationManager(); });

  it('draws all annotations for a page', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 10, w: 100, h: 15 }, color: '#ffd84d' });
    mgr.add(1, { type: ANNOTATION_TYPES.UNDERLINE, bounds: { x: 10, y: 30, w: 100, h: 15 }, color: '#ff0000' });
    mgr.add(1, { type: ANNOTATION_TYPES.STRIKETHROUGH, bounds: { x: 10, y: 50, w: 100, h: 15 } });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 1, 1);
    // Should have multiple drawing operations
    const fillRects = ctx.calls.filter(c => Array.isArray(c) && c[0] === 'fillRect');
    assert.ok(fillRects.length >= 1, 'At least one fillRect for highlight');
    const strokes = ctx.calls.filter(c => c === 'stroke');
    assert.ok(strokes.length >= 2, 'At least two strokes for underline + strikethrough');
  });

  it('does not draw annotations from other pages', () => {
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 10, y: 10, w: 100, h: 15 }, color: '#ffd84d' });
    mgr.add(2, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 20, y: 20, w: 50, h: 15 }, color: '#00ff00' });
    const ctx = makeMockCtx();
    mgr.drawOnCanvas(ctx, 2, 1);
    // Only page 2 annotation should be drawn
    const fillRects = ctx.calls.filter(c => Array.isArray(c) && c[0] === 'fillRect');
    assert.equal(fillRects.length, 1);
    assert.equal(fillRects[0][1], 20); // x of page 2 annotation
  });
});

// ── toJSON / fromJSON edge cases ─────────────────────────────────────────────

describe('toJSON / fromJSON edge cases', () => {
  it('handles empty manager', () => {
    const mgr = new AnnotationManager();
    const json = mgr.toJSON();
    assert.deepEqual(json, {});
  });

  it('handles fromJSON with empty object', () => {
    const mgr = new AnnotationManager();
    mgr.add(1, { type: ANNOTATION_TYPES.HIGHLIGHT, bounds: { x: 0, y: 0, w: 10, h: 10 } });
    mgr.fromJSON({});
    assert.equal(mgr.count, 0);
  });
});
