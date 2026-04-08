// ─── Unit Tests: Text Selection ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSelectedText,
  getSelectionBounds,
  clearSelection,
  isSelectionIn,
  onSelectionChange,
} from '../../app/modules/text-selection.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let _mockSelection = null;

function setMockSelection(text = '', node = null) {
  _mockSelection = {
    toString() { return text; },
    rangeCount: text ? 1 : 0,
    getRangeAt(i) {
      return {
        getBoundingClientRect() { return { x: 10, y: 20, width: 100, height: 20, top: 20, left: 10, bottom: 40, right: 110 }; },
      };
    },
    removeAllRanges() { _mockSelection = { toString: () => '', rangeCount: 0, getRangeAt: () => null, removeAllRanges() {}, anchorNode: null }; },
    anchorNode: node,
    addRange() {},
    selectAllChildren() {},
  };
}

beforeEach(() => {
  setMockSelection('', null);
  globalThis.window.getSelection = () => _mockSelection;
  document.createRange = () => ({ selectNodeContents() {}, setStart() {}, setEnd() {} });
});

// ─── getSelectedText ──────────────────────────────────────────────────────────

describe('getSelectedText', () => {
  it('returns the selected text when a selection exists', () => {
    setMockSelection('hello world');
    assert.equal(getSelectedText(), 'hello world');
  });

  it('returns empty string when selection is null', () => {
    globalThis.window.getSelection = () => null;
    assert.equal(getSelectedText(), '');
  });

  it('returns empty string when selection toString returns empty', () => {
    setMockSelection('');
    assert.equal(getSelectedText(), '');
  });

  it('returns multi-word selected text verbatim', () => {
    setMockSelection('The quick brown fox');
    assert.equal(getSelectedText(), 'The quick brown fox');
  });
});

// ─── getSelectionBounds ───────────────────────────────────────────────────────

describe('getSelectionBounds', () => {
  it('returns a DOMRect-like object when selection has a range', () => {
    setMockSelection('some text');
    const bounds = getSelectionBounds();
    assert.ok(bounds !== null, 'Expected non-null bounds');
    assert.equal(bounds.x, 10);
    assert.equal(bounds.y, 20);
    assert.equal(bounds.width, 100);
    assert.equal(bounds.height, 20);
  });

  it('returns null when selection is null', () => {
    globalThis.window.getSelection = () => null;
    assert.equal(getSelectionBounds(), null);
  });

  it('returns null when rangeCount is 0', () => {
    setMockSelection('');
    assert.equal(getSelectionBounds(), null);
  });

  it('returns null when getRangeAt throws', () => {
    _mockSelection = {
      toString: () => 'text',
      rangeCount: 1,
      getRangeAt() { throw new Error('no range'); },
      anchorNode: null,
    };
    assert.equal(getSelectionBounds(), null);
  });
});

// ─── clearSelection ───────────────────────────────────────────────────────────

describe('clearSelection', () => {
  it('calls removeAllRanges on the selection', () => {
    setMockSelection('some text');
    let called = false;
    _mockSelection.removeAllRanges = () => { called = true; };
    clearSelection();
    assert.equal(called, true);
  });

  it('does not throw when selection is null', () => {
    globalThis.window.getSelection = () => null;
    assert.doesNotThrow(() => clearSelection());
  });

  it('results in empty text after clearing', () => {
    setMockSelection('hello');
    clearSelection();
    assert.equal(getSelectedText(), '');
  });
});

// ─── isSelectionIn ────────────────────────────────────────────────────────────

describe('isSelectionIn', () => {
  it('returns true when anchorNode is contained in element', () => {
    const anchorNode = document.createElement('span');
    const container = document.createElement('div');
    container.appendChild(anchorNode);
    container.contains = (node) => node === anchorNode;
    setMockSelection('selected', anchorNode);
    assert.equal(isSelectionIn(container), true);
  });

  it('returns false when anchorNode is not in element', () => {
    const anchorNode = document.createElement('span');
    const container = document.createElement('div');
    container.contains = () => false;
    setMockSelection('selected', anchorNode);
    assert.equal(isSelectionIn(container), false);
  });

  it('returns false when selection is null', () => {
    globalThis.window.getSelection = () => null;
    const el = document.createElement('div');
    assert.equal(isSelectionIn(el), false);
  });

  it('returns false when anchorNode is null', () => {
    setMockSelection('', null);
    const el = document.createElement('div');
    el.contains = () => true;
    assert.equal(isSelectionIn(el), false);
  });
});

// ─── onSelectionChange ────────────────────────────────────────────────────────

describe('onSelectionChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onSelectionChange(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('calls callback when selectionchange event fires on document', () => {
    setMockSelection('fired text');
    const received = [];
    const unsub = onSelectionChange((text, hasBounds) => {
      received.push({ text, hasBounds });
    });
    document.dispatchEvent(new Event('selectionchange'));
    unsub();
    assert.equal(received.length, 1);
    assert.equal(received[0].text, 'fired text');
  });

  it('passes hasBounds=true when selection has a range', () => {
    setMockSelection('has range');
    const results = [];
    const unsub = onSelectionChange((text, hasBounds) => {
      results.push(hasBounds);
    });
    document.dispatchEvent(new Event('selectionchange'));
    unsub();
    assert.equal(results[0], true);
  });

  it('passes hasBounds=false when selection has no range', () => {
    setMockSelection('');
    const results = [];
    const unsub = onSelectionChange((text, hasBounds) => {
      results.push(hasBounds);
    });
    document.dispatchEvent(new Event('selectionchange'));
    unsub();
    assert.equal(results[0], false);
  });

  it('does not call callback after unsubscribe', () => {
    setMockSelection('should not fire');
    const received = [];
    const unsub = onSelectionChange((text) => {
      received.push(text);
    });
    unsub();
    document.dispatchEvent(new Event('selectionchange'));
    assert.equal(received.length, 0);
  });

  it('supports multiple independent subscribers', () => {
    setMockSelection('multi');
    const calls1 = [];
    const calls2 = [];
    const unsub1 = onSelectionChange((text) => calls1.push(text));
    const unsub2 = onSelectionChange((text) => calls2.push(text));
    document.dispatchEvent(new Event('selectionchange'));
    unsub1();
    unsub2();
    assert.equal(calls1.length, 1);
    assert.equal(calls2.length, 1);
  });
});
