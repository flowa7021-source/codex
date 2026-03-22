// ─── Unit Tests: ModalPrompt ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Enhance the DOM mock to support contains, prepend, querySelector with selectors
// needed by modal-prompt.
const createdElements = [];
const originalCreateElement = document.createElement;
document.createElement = function (tag) {
  const el = {
    tagName: tag.toUpperCase(),
    style: { cssText: '' },
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    dataset: {},
    children: [],
    childNodes: [],
    parentNode: null,
    _listeners: {},
    classList: {
      add(c) { el._classes = el._classes || new Set(); el._classes.add(c); },
      remove(c) { el._classes = el._classes || new Set(); el._classes.delete(c); },
      toggle(c) { el._classes = el._classes || new Set(); if (el._classes.has(c)) el._classes.delete(c); else el._classes.add(c); },
      contains(c) { return (el._classes || new Set()).has(c); },
    },
    setAttribute(k, v) { el[`_attr_${k}`] = v; },
    getAttribute(k) { return el[`_attr_${k}`] ?? null; },
    addEventListener(ev, fn, opts) {
      if (!el._listeners[ev]) el._listeners[ev] = [];
      el._listeners[ev].push(fn);
    },
    removeEventListener(ev, fn) {
      if (el._listeners[ev]) el._listeners[ev] = el._listeners[ev].filter(f => f !== fn);
    },
    appendChild(child) {
      el.children.push(child);
      if (child && typeof child === 'object') child.parentNode = el;
    },
    remove() { el.parentNode = null; },
    contains(node) {
      if (node === el) return true;
      return el.children.some(c => c === node || (c.contains && c.contains(node)));
    },
    querySelector(sel) {
      // Minimal selector support for tests
      if (sel.startsWith('#')) {
        const id = sel.slice(1);
        // Search in innerHTML-created elements — return a mock input
        return {
          style: { cssText: '' },
          value: '',
          focus() {},
          select() {},
          addEventListener(ev, fn) {},
        };
      }
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return { style: {}, addEventListener(ev, fn) {}, focus() {} };
      }
      return null;
    },
    querySelectorAll(sel) {
      // Return mock elements with forEach
      if (sel === '.nr-modal-btn') {
        return [
          { style: { cssText: '' }, addEventListener() {} },
          { style: { cssText: '' }, addEventListener() {} },
        ];
      }
      return [];
    },
    prepend(child) { el.children.unshift(child); },
    getContext() {
      return {
        drawImage() {}, fillRect() {}, clearRect() {},
        getImageData: () => ({ data: new Uint8Array(0), width: 0, height: 0 }),
        putImageData() {}, createImageData: () => ({ data: new Uint8Array(0) }),
        measureText: () => ({ width: 0 }), fillText() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
        fill() {}, stroke() {}, save() {}, restore() {},
        canvas: el,
      };
    },
  };
  createdElements.push(el);
  return el;
};

// Enhance document.body for modal-prompt
document.body.contains = (node) => {
  return createdElements.some(el => el === node);
};
document.body.prepend = (child) => {};
document.body.appendChild = (child) => {
  if (child && typeof child === 'object') child.parentNode = document.body;
};
document.getElementById = (id) => {
  return createdElements.find(el => el.id === id) || null;
};

import { nrPrompt, nrConfirm } from '../../app/modules/modal-prompt.js';

describe('nrPrompt', () => {
  it('is a function', () => {
    assert.equal(typeof nrPrompt, 'function');
  });

  it('returns a promise', () => {
    const result = nrPrompt('Enter value');
    assert.ok(result instanceof Promise);
  });

  it('accepts message string', () => {
    // Should not throw
    const p = nrPrompt('Test message');
    assert.ok(p instanceof Promise);
  });

  it('accepts options with okLabel and cancelLabel', () => {
    const p = nrPrompt('Test', '', { okLabel: 'Yes', cancelLabel: 'No' });
    assert.ok(p instanceof Promise);
  });

  it('accepts multiline option', () => {
    const p = nrPrompt('Test', '', { multiline: true });
    assert.ok(p instanceof Promise);
  });

  it('accepts placeholder option', () => {
    const p = nrPrompt('Test', '', { placeholder: 'Type here...' });
    assert.ok(p instanceof Promise);
  });

  it('accepts default value', () => {
    const p = nrPrompt('Test', 'default');
    assert.ok(p instanceof Promise);
  });
});

describe('nrConfirm', () => {
  it('is a function', () => {
    assert.equal(typeof nrConfirm, 'function');
  });

  it('returns a promise', () => {
    const result = nrConfirm('Are you sure?');
    assert.ok(result instanceof Promise);
  });

  it('accepts options with custom labels', () => {
    const p = nrConfirm('Confirm?', { okLabel: 'Yes', cancelLabel: 'No' });
    assert.ok(p instanceof Promise);
  });

  it('accepts message string', () => {
    const p = nrConfirm('Delete this item?');
    assert.ok(p instanceof Promise);
  });
});
