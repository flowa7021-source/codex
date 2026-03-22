// ─── Unit Tests: TextLayerBuilder ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTextLayer,
  highlightSearchMatches,
  clearSearchHighlights,
  getSelectedText,
} from '../../app/modules/text-layer-builder.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeContainer() {
  const children = [];
  const el = {
    tagName: 'DIV',
    innerHTML: '',
    style: {},
    children,
    childNodes: children,
    setAttribute(k, v) { el[`_attr_${k}`] = v; },
    getAttribute(k) { return el[`_attr_${k}`] ?? null; },
    appendChild(child) { children.push(child); child.parentNode = el; },
    querySelectorAll(sel) {
      if (sel === 'span:not(.search-highlight)') {
        return children.filter(c => c.tagName === 'SPAN' && (!c._classes || !c._classes.has('search-highlight')));
      }
      if (sel === '.search-highlight') {
        const highlights = [];
        for (const child of children) {
          if (child.children) {
            for (const gc of child.children) {
              if (gc._classes && gc._classes.has('search-highlight')) highlights.push(gc);
            }
          }
        }
        return highlights;
      }
      return [];
    },
    contains(node) {
      return children.some(c => c === node);
    },
  };
  return el;
}

function makeSpan(text) {
  const children = [];
  const el = {
    tagName: 'SPAN',
    textContent: text,
    style: {},
    _classes: new Set(),
    children,
    parentNode: null,
    classList: {
      add(c) { el._classes.add(c); },
      remove(c) { el._classes.delete(c); },
      contains(c) { return el._classes.has(c); },
    },
    setAttribute(k, v) { el[`_attr_${k}`] = v; },
    getAttribute(k) { return el[`_attr_${k}`] ?? null; },
    appendChild(child) { children.push(child); child.parentNode = el; },
    matchAll: undefined,
  };
  return el;
}

function makeViewport() {
  return {
    transform: [1, 0, 0, -1, 0, 800],
    width: 595,
    height: 842,
  };
}

function makeTextContent(items) {
  return {
    items: items || [],
    styles: {},
  };
}

// ── buildTextLayer ──────────────────────────────────────────────────────────

describe('buildTextLayer', () => {
  it('does nothing with null container', () => {
    assert.doesNotThrow(() => {
      buildTextLayer({ container: null, textContent: makeTextContent(), viewport: makeViewport() });
    });
  });

  it('does nothing with null textContent', () => {
    const container = makeContainer();
    assert.doesNotThrow(() => {
      buildTextLayer({ container, textContent: null, viewport: makeViewport() });
    });
  });

  it('does nothing with null viewport', () => {
    const container = makeContainer();
    assert.doesNotThrow(() => {
      buildTextLayer({ container, textContent: makeTextContent(), viewport: null });
    });
  });

  it('sets container styles and attributes', () => {
    const container = makeContainer();
    buildTextLayer({
      container,
      textContent: makeTextContent(),
      viewport: makeViewport(),
    });
    assert.equal(container.style.position, 'absolute');
    assert.equal(container.style.overflow, 'hidden');
    assert.equal(container._attr_role, 'textbox');
  });

  it('clears container innerHTML before building', () => {
    const container = makeContainer();
    container.innerHTML = '<span>old content</span>';
    buildTextLayer({
      container,
      textContent: makeTextContent(),
      viewport: makeViewport(),
    });
    assert.equal(container.innerHTML, '');
  });

  it('creates spans for text items', () => {
    const container = makeContainer();
    const items = [{
      str: 'Hello world',
      transform: [12, 0, 0, 12, 72, 700],
      width: 80,
    }];
    buildTextLayer({
      container,
      textContent: makeTextContent(items),
      viewport: makeViewport(),
    });
    assert.ok(container.children.length > 0);
  });

  it('skips items with empty string', () => {
    const container = makeContainer();
    const items = [
      { str: '', transform: [12, 0, 0, 12, 72, 700], width: 80 },
      { str: '   ', transform: [12, 0, 0, 12, 72, 650], width: 40 },
    ];
    buildTextLayer({
      container,
      textContent: makeTextContent(items),
      viewport: makeViewport(),
    });
    assert.equal(container.children.length, 0);
  });

  it('skips items with missing transform', () => {
    const container = makeContainer();
    const items = [
      { str: 'Hello', transform: null },
      { str: 'World', transform: [1] },
    ];
    buildTextLayer({
      container,
      textContent: makeTextContent(items),
      viewport: makeViewport(),
    });
    assert.equal(container.children.length, 0);
  });

  it('handles empty items array', () => {
    const container = makeContainer();
    buildTextLayer({
      container,
      textContent: makeTextContent([]),
      viewport: makeViewport(),
    });
    assert.equal(container.children.length, 0);
  });
});

// ── highlightSearchMatches ──────────────────────────────────────────────────

describe('highlightSearchMatches', () => {
  it('returns 0 for null container', () => {
    assert.equal(highlightSearchMatches(null, 'test'), 0);
  });

  it('returns 0 for null/empty query', () => {
    const container = makeContainer();
    assert.equal(highlightSearchMatches(container, ''), 0);
    assert.equal(highlightSearchMatches(container, null), 0);
  });

  it('is a function that returns a number', () => {
    assert.equal(typeof highlightSearchMatches, 'function');
    const container = makeContainer();
    const result = highlightSearchMatches(container, 'test');
    assert.equal(typeof result, 'number');
  });
});

// ── clearSearchHighlights ───────────────────────────────────────────────────

describe('clearSearchHighlights', () => {
  it('does nothing with null container', () => {
    assert.doesNotThrow(() => {
      clearSearchHighlights(null);
    });
  });

  it('is a function', () => {
    assert.equal(typeof clearSearchHighlights, 'function');
  });
});

// ── getSelectedText ─────────────────────────────────────────────────────────

describe('getSelectedText', () => {
  it('returns empty string when getSelection returns null', () => {
    window.getSelection = () => null;
    const container = makeContainer();
    const result = getSelectedText(container);
    assert.equal(result, '');
  });

  it('returns empty string when rangeCount is 0', () => {
    window.getSelection = () => ({ rangeCount: 0 });
    const container = makeContainer();
    const result = getSelectedText(container);
    assert.equal(result, '');
  });

  it('returns empty string when anchorNode not in container', () => {
    const outsideNode = {};
    window.getSelection = () => ({ rangeCount: 1, anchorNode: outsideNode, toString: () => 'text' });
    const container = makeContainer();
    const result = getSelectedText(container);
    assert.equal(result, '');
  });

  it('is a function', () => {
    assert.equal(typeof getSelectedText, 'function');
  });
});
