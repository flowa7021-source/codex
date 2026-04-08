// ─── Unit Tests: CSS Custom Highlight API ─────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isCSSHighlightSupported,
  setHighlight,
  removeHighlight,
  clearHighlights,
  getHighlightNames,
  highlightTextMatches,
} from '../../app/modules/css-highlight.js';

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockHighlights = new Map();

globalThis.Highlight = class Highlight {
  constructor(...ranges) { this.ranges = ranges; }
};

globalThis.CSS = {
  highlights: {
    set(name, h) { mockHighlights.set(name, h); },
    delete(name) { return mockHighlights.delete(name); },
    clear() { mockHighlights.clear(); },
    keys() { return mockHighlights.keys(); },
    has(name) { return mockHighlights.has(name); },
  },
};

// Augment document mock with createRange support
globalThis.document.createRange = () => ({
  setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
  setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
});

// ─── Reset state before each test ────────────────────────────────────────────

beforeEach(() => {
  mockHighlights.clear();
});

// ─── isCSSHighlightSupported ──────────────────────────────────────────────────

describe('isCSSHighlightSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isCSSHighlightSupported(), 'boolean');
  });

  it('returns true when Highlight and CSS.highlights are mocked', () => {
    assert.equal(isCSSHighlightSupported(), true);
  });

  it('returns false when Highlight is absent', () => {
    const originalHighlight = globalThis.Highlight;
    delete globalThis.Highlight;
    assert.equal(isCSSHighlightSupported(), false);
    globalThis.Highlight = originalHighlight;
  });

  it('returns false when CSS.highlights is absent', () => {
    const originalCSS = globalThis.CSS;
    globalThis.CSS = {};
    assert.equal(isCSSHighlightSupported(), false);
    globalThis.CSS = originalCSS;
  });
});

// ─── setHighlight ─────────────────────────────────────────────────────────────

describe('setHighlight', () => {
  it('returns true when highlight is registered successfully', () => {
    const result = setHighlight('test-hl', []);
    assert.equal(result, true);
  });

  it('registers the highlight under the given name', () => {
    setHighlight('my-highlight', []);
    assert.equal(mockHighlights.has('my-highlight'), true);
  });

  it('creates a Highlight instance with the provided ranges', () => {
    const fakeRange = { startContainer: null, endContainer: null };
    setHighlight('range-hl', [fakeRange]);
    const hl = mockHighlights.get('range-hl');
    assert.ok(hl instanceof globalThis.Highlight);
    assert.equal(hl.ranges.length, 1);
  });

  it('returns false when CSS Custom Highlight API is unsupported', () => {
    const originalHighlight = globalThis.Highlight;
    delete globalThis.Highlight;
    const result = setHighlight('hl', []);
    assert.equal(result, false);
    globalThis.Highlight = originalHighlight;
  });

  it('returns false when Highlight constructor throws', () => {
    const originalHighlight = globalThis.Highlight;
    globalThis.Highlight = class { constructor() { throw new Error('fail'); } };
    const result = setHighlight('hl', []);
    assert.equal(result, false);
    globalThis.Highlight = originalHighlight;
  });

  it('overwrites an existing highlight with the same name', () => {
    setHighlight('same-name', []);
    setHighlight('same-name', [{ x: 1 }, { x: 2 }]);
    const hl = mockHighlights.get('same-name');
    assert.equal(hl.ranges.length, 2);
  });
});

// ─── removeHighlight ──────────────────────────────────────────────────────────

describe('removeHighlight', () => {
  it('returns true when highlight is removed', () => {
    setHighlight('to-remove', []);
    const result = removeHighlight('to-remove');
    assert.equal(result, true);
  });

  it('actually removes the highlight from the registry', () => {
    setHighlight('to-remove', []);
    removeHighlight('to-remove');
    assert.equal(mockHighlights.has('to-remove'), false);
  });

  it('returns false when CSS Custom Highlight API is unsupported', () => {
    const originalHighlight = globalThis.Highlight;
    delete globalThis.Highlight;
    const result = removeHighlight('hl');
    assert.equal(result, false);
    globalThis.Highlight = originalHighlight;
  });

  it('does not throw when removing a non-existent highlight', () => {
    assert.doesNotThrow(() => removeHighlight('does-not-exist'));
  });
});

// ─── clearHighlights ──────────────────────────────────────────────────────────

describe('clearHighlights', () => {
  it('removes all registered highlights', () => {
    setHighlight('hl-a', []);
    setHighlight('hl-b', []);
    assert.equal(mockHighlights.size, 2);
    clearHighlights();
    assert.equal(mockHighlights.size, 0);
  });

  it('does not throw when there are no highlights', () => {
    assert.doesNotThrow(() => clearHighlights());
  });

  it('does not throw when API is unsupported', () => {
    const originalHighlight = globalThis.Highlight;
    delete globalThis.Highlight;
    assert.doesNotThrow(() => clearHighlights());
    globalThis.Highlight = originalHighlight;
  });
});

// ─── getHighlightNames ────────────────────────────────────────────────────────

describe('getHighlightNames', () => {
  it('returns an array', () => {
    const names = getHighlightNames();
    assert.ok(Array.isArray(names));
  });

  it('returns the names of all registered highlights', () => {
    setHighlight('alpha', []);
    setHighlight('beta', []);
    const names = getHighlightNames();
    assert.ok(names.includes('alpha'));
    assert.ok(names.includes('beta'));
  });

  it('returns an empty array when no highlights are registered', () => {
    const names = getHighlightNames();
    assert.deepEqual(names, []);
  });

  it('returns an empty array when API is unsupported', () => {
    const originalHighlight = globalThis.Highlight;
    delete globalThis.Highlight;
    const names = getHighlightNames();
    assert.deepEqual(names, []);
    globalThis.Highlight = originalHighlight;
  });
});

// ─── highlightTextMatches ─────────────────────────────────────────────────────

describe('highlightTextMatches', () => {
  function makeTextNode(content) {
    return { textContent: content, nodeType: 3 };
  }

  it('returns the highlight name when matches are found', () => {
    const node = makeTextNode('Hello world, hello again');
    const result = highlightTextMatches(node, 'hello');
    assert.equal(typeof result, 'string');
    assert.ok(result !== null);
  });

  it('uses the default highlight name "search-highlight"', () => {
    const node = makeTextNode('Find me here');
    const result = highlightTextMatches(node, 'me');
    assert.equal(result, 'search-highlight');
  });

  it('uses a custom highlight name when provided', () => {
    const node = makeTextNode('custom highlight test');
    const result = highlightTextMatches(node, 'highlight', 'my-custom-hl');
    assert.equal(result, 'my-custom-hl');
  });

  it('returns null when query is empty string', () => {
    const node = makeTextNode('Some text here');
    const result = highlightTextMatches(node, '');
    assert.equal(result, null);
  });

  it('returns null when no matches found in text', () => {
    const node = makeTextNode('Hello world');
    const result = highlightTextMatches(node, 'xyz-not-found');
    assert.equal(result, null);
  });

  it('returns null when API is unsupported', () => {
    const originalHighlight = globalThis.Highlight;
    delete globalThis.Highlight;
    const node = makeTextNode('Some text here');
    const result = highlightTextMatches(node, 'text');
    assert.equal(result, null);
    globalThis.Highlight = originalHighlight;
  });

  it('registers the highlight in CSS.highlights when matches are found', () => {
    const node = makeTextNode('match this text');
    highlightTextMatches(node, 'match', 'test-match-hl');
    assert.equal(mockHighlights.has('test-match-hl'), true);
  });

  it('performs case-insensitive matching', () => {
    const node = makeTextNode('The Quick Brown Fox');
    const result = highlightTextMatches(node, 'quick');
    assert.notEqual(result, null);
  });

  it('finds multiple non-overlapping matches', () => {
    const createdRanges = [];
    const originalCSS = globalThis.CSS;
    const originalHighlight = globalThis.Highlight;
    globalThis.Highlight = class Highlight {
      constructor(...ranges) { this.ranges = ranges; createdRanges.push(...ranges); }
    };

    const node = makeTextNode('cat dog cat dog cat');
    highlightTextMatches(node, 'cat', 'multi-hl');

    // Three occurrences of 'cat'
    assert.equal(createdRanges.length, 3);
    globalThis.Highlight = originalHighlight;
    globalThis.CSS = originalCSS;
  });
});
