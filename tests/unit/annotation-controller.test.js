// ─── Unit Tests: AnnotationController ────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  annotationKey,
  commentKey,
  invalidateAnnotationCaches,
  loadStrokes,
  saveStrokes,
  loadComments,
  saveComments,
  normalizePoint,
  denormalizePoint,
  applyStrokeStyle,
  getAnnotationDpr,
  clearDocumentAnnotationStorage,
  clearDocumentCommentStorage,
} from '../../app/modules/annotation-controller.js';
import { state, els } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetState() {
  state.docName = 'test.pdf';
  state.currentPage = 1;
  state.pageCount = 5;
  state.adapter = { type: 'pdf' };
  state.drawEnabled = false;
  localStorage.clear();
  invalidateAnnotationCaches();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('annotationKey / commentKey', () => {
  beforeEach(resetState);

  it('includes docName and page number', () => {
    state.docName = 'myfile.pdf';
    assert.equal(annotationKey(1), 'novareader-annotations:myfile.pdf:1');
    assert.equal(annotationKey(42), 'novareader-annotations:myfile.pdf:42');
  });

  it('commentKey includes docName and page number', () => {
    state.docName = 'myfile.pdf';
    assert.equal(commentKey(1), 'novareader-comments:myfile.pdf:1');
    assert.equal(commentKey(3), 'novareader-comments:myfile.pdf:3');
  });

  it('uses global when docName is null', () => {
    state.docName = null;
    assert.equal(annotationKey(1), 'novareader-annotations:global:1');
    assert.equal(commentKey(1), 'novareader-comments:global:1');
  });
});

describe('loadStrokes / saveStrokes', () => {
  beforeEach(resetState);

  it('returns empty array when no strokes saved', () => {
    const strokes = loadStrokes(1);
    assert.deepEqual(strokes, []);
  });

  it('round-trips strokes through save/load', () => {
    const strokes = [
      { tool: 'pen', color: '#ff0000', size: 2, points: [{ x: 0.1, y: 0.2 }] },
      { tool: 'highlighter', color: '#00ff00', size: 4, points: [{ x: 0.3, y: 0.4 }] },
    ];
    saveStrokes(strokes, 1);
    invalidateAnnotationCaches();
    const loaded = loadStrokes(1);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].tool, 'pen');
    assert.equal(loaded[0].color, '#ff0000');
    assert.equal(loaded[1].tool, 'highlighter');
  });

  it('persists to localStorage', () => {
    const strokes = [{ tool: 'pen', color: '#000', size: 1, points: [] }];
    saveStrokes(strokes, 1);
    const raw = localStorage.getItem(annotationKey(1));
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].tool, 'pen');
  });

  it('caches strokes after first load', () => {
    saveStrokes([{ tool: 'pen', color: '#000', size: 1, points: [] }], 1);
    invalidateAnnotationCaches();
    const first = loadStrokes(1);
    // Modify localStorage directly — cache should return old value
    localStorage.setItem(annotationKey(1), '[]');
    const second = loadStrokes(1);
    assert.equal(second.length, 1); // still cached
  });

  it('invalidateAnnotationCaches clears cache', () => {
    saveStrokes([{ tool: 'pen', color: '#000', size: 1, points: [] }], 1);
    const loaded1 = loadStrokes(1);
    assert.equal(loaded1.length, 1);

    localStorage.setItem(annotationKey(1), '[]');
    invalidateAnnotationCaches();
    const loaded2 = loadStrokes(1);
    assert.equal(loaded2.length, 0);
  });

  it('strokes are stored per page', () => {
    saveStrokes([{ tool: 'pen', color: '#f00', size: 1, points: [] }], 1);
    saveStrokes([{ tool: 'pen', color: '#0f0', size: 2, points: [] }], 2);
    invalidateAnnotationCaches();
    assert.equal(loadStrokes(1)[0].color, '#f00');
    assert.equal(loadStrokes(2)[0].color, '#0f0');
    assert.equal(loadStrokes(3).length, 0);
  });
});

describe('loadComments / saveComments', () => {
  beforeEach(resetState);

  it('returns empty array when no comments saved', () => {
    assert.deepEqual(loadComments(1), []);
  });

  it('round-trips comments', () => {
    const comments = [
      { point: { x: 0.1, y: 0.2 }, text: 'Note A' },
      { point: { x: 0.5, y: 0.6 }, text: 'Note B' },
    ];
    saveComments(comments, 1);
    invalidateAnnotationCaches();
    const loaded = loadComments(1);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].text, 'Note A');
    assert.equal(loaded[1].text, 'Note B');
  });

  it('persists to localStorage', () => {
    saveComments([{ point: { x: 0.5, y: 0.5 }, text: 'hello' }], 2);
    const raw = localStorage.getItem(commentKey(2));
    const parsed = JSON.parse(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].text, 'hello');
  });
});

describe('clearDocumentAnnotationStorage / clearDocumentCommentStorage', () => {
  beforeEach(resetState);

  it('clears all annotation pages from localStorage', () => {
    saveStrokes([{ tool: 'pen', color: '#000', size: 1, points: [] }], 1);
    saveStrokes([{ tool: 'pen', color: '#000', size: 1, points: [] }], 3);
    invalidateAnnotationCaches();

    clearDocumentAnnotationStorage();

    assert.equal(localStorage.getItem(annotationKey(1)), null);
    assert.equal(localStorage.getItem(annotationKey(3)), null);
  });

  it('clears all comment pages from localStorage', () => {
    saveComments([{ point: { x: 0.5, y: 0.5 }, text: 'A' }], 1);
    saveComments([{ point: { x: 0.5, y: 0.5 }, text: 'B' }], 2);
    invalidateAnnotationCaches();

    clearDocumentCommentStorage();

    assert.equal(localStorage.getItem(commentKey(1)), null);
    assert.equal(localStorage.getItem(commentKey(2)), null);
  });

  it('does nothing when pageCount is 0', () => {
    state.pageCount = 0;
    // Should not throw
    clearDocumentAnnotationStorage();
    clearDocumentCommentStorage();
  });
});

describe('normalizePoint / denormalizePoint', () => {
  beforeEach(() => {
    // Provide a mock annotationCanvas with width/height
    els.annotationCanvas = { width: 1000, height: 500, getContext() { return null; }, classList: { toggle() {} } };
  });

  it('normalizes coordinates relative to canvas size', () => {
    const p = normalizePoint(500, 250);
    assert.equal(p.x, 0.5);
    assert.equal(p.y, 0.5);
  });

  it('denormalizes coordinates back', () => {
    const p = denormalizePoint({ x: 0.5, y: 0.5 });
    assert.equal(p.x, 500);
    assert.equal(p.y, 250);
  });

  it('normalize then denormalize is identity', () => {
    els.annotationCanvas = { width: 800, height: 600, getContext() { return null; }, classList: { toggle() {} } };

    const original = { x: 200, y: 150 };
    const normalized = normalizePoint(original.x, original.y);
    const restored = denormalizePoint(normalized);
    assert.ok(Math.abs(restored.x - original.x) < 0.001);
    assert.ok(Math.abs(restored.y - original.y) < 0.001);
  });

  it('handles zero dimensions safely', () => {
    els.annotationCanvas = { width: 0, height: 0, getContext() { return null; }, classList: { toggle() {} } };
    // Should not throw, divides by max(1, 0)
    const p = normalizePoint(100, 200);
    assert.equal(p.x, 100);
    assert.equal(p.y, 200);
  });
});

describe('applyStrokeStyle', () => {
  it('applies pen style', () => {
    const ctx = {
      globalCompositeOperation: '',
      globalAlpha: 0,
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      lineCap: '',
    };
    applyStrokeStyle(ctx, { tool: 'pen', color: '#ff0000', size: 3 });
    assert.equal(ctx.globalCompositeOperation, 'source-over');
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(ctx.strokeStyle, '#ff0000');
    assert.equal(ctx.lineWidth, 3);
    assert.equal(ctx.lineJoin, 'round');
    assert.equal(ctx.lineCap, 'round');
  });

  it('applies highlighter style with transparency', () => {
    const ctx = { globalCompositeOperation: '', globalAlpha: 0, strokeStyle: '', lineWidth: 0, lineJoin: '', lineCap: '' };
    applyStrokeStyle(ctx, { tool: 'highlighter', color: '#ffff00', size: 5 });
    assert.equal(ctx.globalAlpha, 0.25);
    assert.equal(ctx.lineWidth, 10); // size * 2
  });

  it('applies eraser style', () => {
    const ctx = { globalCompositeOperation: '', globalAlpha: 0, strokeStyle: '', lineWidth: 0, lineJoin: '', lineCap: '' };
    applyStrokeStyle(ctx, { tool: 'eraser', color: '#000', size: 4 });
    assert.equal(ctx.globalCompositeOperation, 'destination-out');
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(ctx.lineWidth, 8); // size * 2
  });
});

describe('getAnnotationDpr', () => {
  it('returns at least 1', () => {
    const dpr = getAnnotationDpr();
    assert.ok(dpr >= 1);
  });
});
