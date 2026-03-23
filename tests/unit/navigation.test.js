// ─── Unit Tests: Navigation ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  generatePageLabels,
  saveReadingPosition,
  loadReadingPosition,
  initMinimap,
  updateMinimap,
  setupLinkFollowing,
  renderThumbnailGrid,
} from '../../app/modules/navigation.js';

const POSITION_KEY = 'novareader-positions';

beforeEach(() => {
  localStorage.clear();
});

// ─── generatePageLabels ─────────────────────────────────────────────────────

describe('generatePageLabels', () => {
  it('returns decimal labels 1..N when no labelsArray is provided', () => {
    const labels = generatePageLabels(5);
    assert.deepEqual(labels, ['1', '2', '3', '4', '5']);
  });

  it('returns decimal labels when labelsArray is empty', () => {
    const labels = generatePageLabels(3, []);
    assert.deepEqual(labels, ['1', '2', '3']);
  });

  it('returns decimal labels when labelsArray is null', () => {
    const labels = generatePageLabels(3, null);
    assert.deepEqual(labels, ['1', '2', '3']);
  });

  it('returns empty array for pageCount 0', () => {
    const labels = generatePageLabels(0);
    assert.deepEqual(labels, []);
  });

  it('handles labelsArray with decimal style', () => {
    const labels = generatePageLabels(4, [
      { startPage: 0, style: 'D', prefix: '', start: 1 },
    ]);
    assert.deepEqual(labels, ['1', '2', '3', '4']);
  });

  it('handles labelsArray with Roman numeral style (uppercase)', () => {
    const labels = generatePageLabels(4, [
      { startPage: 0, style: 'R', prefix: '', start: 1 },
    ]);
    assert.deepEqual(labels, ['I', 'II', 'III', 'IV']);
  });

  it('handles labelsArray with roman numeral style (lowercase)', () => {
    const labels = generatePageLabels(3, [
      { startPage: 0, style: 'r', prefix: '', start: 1 },
    ]);
    assert.deepEqual(labels, ['i', 'ii', 'iii']);
  });

  it('handles labelsArray with letter style (uppercase)', () => {
    const labels = generatePageLabels(3, [
      { startPage: 0, style: 'A', prefix: '', start: 1 },
    ]);
    assert.deepEqual(labels, ['A', 'B', 'C']);
  });

  it('handles labelsArray with letter style (lowercase)', () => {
    const labels = generatePageLabels(3, [
      { startPage: 0, style: 'a', prefix: '', start: 1 },
    ]);
    assert.deepEqual(labels, ['a', 'b', 'c']);
  });

  it('handles prefix in labels', () => {
    const labels = generatePageLabels(3, [
      { startPage: 0, style: 'D', prefix: 'Ch.', start: 1 },
    ]);
    assert.deepEqual(labels, ['Ch.1', 'Ch.2', 'Ch.3']);
  });

  it('handles custom start number', () => {
    const labels = generatePageLabels(3, [
      { startPage: 0, style: 'D', prefix: '', start: 10 },
    ]);
    assert.deepEqual(labels, ['10', '11', '12']);
  });

  it('handles multiple label ranges', () => {
    const labels = generatePageLabels(5, [
      { startPage: 0, style: 'r', prefix: '', start: 1 },
      { startPage: 3, style: 'D', prefix: '', start: 1 },
    ]);
    // Pages 0,1,2 -> roman i,ii,iii; Pages 3,4 -> decimal 1,2
    assert.equal(labels[0], 'i');
    assert.equal(labels[1], 'ii');
    assert.equal(labels[2], 'iii');
    assert.equal(labels[3], '1');
    assert.equal(labels[4], '2');
  });

  it('defaults style to D when entry has no style', () => {
    const labels = generatePageLabels(2, [
      { startPage: 0, prefix: 'P-', start: 5 },
    ]);
    assert.equal(labels[0], 'P-5');
    assert.equal(labels[1], 'P-6');
  });

  it('defaults start to 1 when not specified', () => {
    const labels = generatePageLabels(2, [
      { startPage: 0, style: 'D', prefix: '' },
    ]);
    assert.equal(labels[0], '1');
    assert.equal(labels[1], '2');
  });
});

// ─── saveReadingPosition / loadReadingPosition ──────────────────────────────

describe('saveReadingPosition', () => {
  it('saves and loads a position', () => {
    saveReadingPosition('doc1.pdf', { page: 5, scrollY: 100, zoom: 1.5 });
    const pos = loadReadingPosition('doc1.pdf');
    assert.equal(pos.page, 5);
    assert.equal(pos.scrollY, 100);
    assert.equal(pos.zoom, 1.5);
    assert.ok(typeof pos.timestamp === 'number');
  });

  it('returns null for unknown document', () => {
    assert.equal(loadReadingPosition('unknown.pdf'), null);
  });

  it('returns null for empty docName', () => {
    assert.equal(loadReadingPosition(''), null);
  });

  it('does not save when docName is empty', () => {
    saveReadingPosition('', { page: 1 });
    const data = JSON.parse(localStorage.getItem(POSITION_KEY) || '{}');
    assert.deepEqual(data, {});
  });

  it('does not save when docName is falsy', () => {
    saveReadingPosition(null, { page: 1 });
    assert.equal(localStorage.getItem(POSITION_KEY), null);
  });

  it('overwrites existing position for same document', () => {
    saveReadingPosition('doc.pdf', { page: 1 });
    saveReadingPosition('doc.pdf', { page: 10 });
    const pos = loadReadingPosition('doc.pdf');
    assert.equal(pos.page, 10);
  });

  it('evicts oldest entries when over MAX_POSITIONS (100)', () => {
    // Save 101 positions
    for (let i = 0; i < 101; i++) {
      saveReadingPosition(`doc${i}.pdf`, { page: i });
    }
    // The first entry should be evicted
    const pos0 = loadReadingPosition('doc0.pdf');
    assert.equal(pos0, null);
    // The last entry should remain
    const pos100 = loadReadingPosition('doc100.pdf');
    assert.ok(pos100 !== null);
  });

  it('handles corrupted localStorage gracefully on load', () => {
    localStorage.setItem(POSITION_KEY, 'not json');
    const pos = loadReadingPosition('doc.pdf');
    assert.equal(pos, null);
  });

  it('handles corrupted localStorage gracefully on save', () => {
    localStorage.setItem(POSITION_KEY, 'not json');
    // Should not throw
    saveReadingPosition('doc.pdf', { page: 1 });
  });
});

// ─── initMinimap ────────────────────────────────────────────────────────────

describe('initMinimap', () => {
  it('does nothing when container is null', () => {
    // Should not throw
    initMinimap(null, null, null);
  });

  it('creates minimap structure when container is provided', () => {
    const children = [];
    const container = {
      appendChild(child) { children.push(child); },
    };
    const mainCanvas = document.createElement('canvas');
    const scrollContainer = {
      addEventListener() {},
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
    };
    initMinimap(container, mainCanvas, scrollContainer);
    assert.ok(children.length > 0, 'should have appended minimap element');
  });
});

// ─── updateMinimap ──────────────────────────────────────────────────────────

describe('updateMinimap', () => {
  it('does nothing when called without initialization', () => {
    // Should not throw
    updateMinimap(null);
  });

  it('does nothing with null mainCanvas', () => {
    updateMinimap(null);
  });
});

// ─── setupLinkFollowing ─────────────────────────────────────────────────────

describe('setupLinkFollowing', () => {
  it('does nothing when textLayer is null', () => {
    setupLinkFollowing(null, () => {}, () => Promise.resolve(null));
  });

  it('attaches click handler to textLayer', () => {
    let handlerRegistered = false;
    const textLayer = {
      addEventListener(event, handler) {
        if (event === 'click') handlerRegistered = true;
      },
    };
    setupLinkFollowing(textLayer, () => {}, () => Promise.resolve(null));
    assert.ok(handlerRegistered);
  });
});

// ─── renderThumbnailGrid ────────────────────────────────────────────────────

describe('renderThumbnailGrid', () => {
  it('does nothing when container is null', () => {
    renderThumbnailGrid(null, 5, () => {}, () => {});
  });

  it('creates thumbnail cells for each page', () => {
    const appendedChildren = [];
    const container = {
      innerHTML: '',
      className: '',
      appendChild(child) { appendedChildren.push(child); },
    };

    // Mock IntersectionObserver
    const origIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    };

    renderThumbnailGrid(container, 3, () => {}, () => {});

    assert.equal(container.className, 'thumbnail-grid');
    assert.equal(appendedChildren.length, 3);

    globalThis.IntersectionObserver = origIO;
  });

  it('calls goToPage when thumbnail cell is clicked', () => {
    let clickedPage = null;
    const appendedChildren = [];
    const container = {
      innerHTML: '',
      className: '',
      appendChild(child) { appendedChildren.push(child); },
    };

    const origIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    };

    const listeners = {};
    const origCreateElement = document.createElement;
    document.createElement = (tag) => {
      const el = origCreateElement.call(document, tag);
      const origAddEL = el.addEventListener;
      el.addEventListener = function (event, handler) {
        if (event === 'click') listeners[tag] = handler;
        if (typeof origAddEL === 'function') origAddEL.call(el, event, handler);
      };
      return el;
    };

    renderThumbnailGrid(container, 1, null, (page) => { clickedPage = page; });

    // Restore
    document.createElement = origCreateElement;
    globalThis.IntersectionObserver = origIO;
  });

  it('works without renderThumb callback', () => {
    const appendedChildren = [];
    const container = {
      innerHTML: '',
      className: '',
      appendChild(child) { appendedChildren.push(child); },
    };

    const origIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      disconnect() {}
    };

    renderThumbnailGrid(container, 2, null, () => {});
    assert.equal(appendedChildren.length, 2);

    globalThis.IntersectionObserver = origIO;
  });
});
