import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Track body children
const _bodyChildren = [];
const _origAppend = document.body.appendChild;
document.body.appendChild = function (child) {
  _bodyChildren.push(child);
  if (child) child.parentNode = document.body;
  return child;
};
document.body.contains = function (el) {
  return _bodyChildren.includes(el);
};

// Patch createElement to add missing methods
const _origCreate = document.createElement;
document.createElement = function (tag) {
  const el = _origCreate(tag);
  el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });
  el.focus = el.focus || (() => {});
  el.remove = () => {
    const idx = _bodyChildren.indexOf(el);
    if (idx !== -1) _bodyChildren.splice(idx, 1);
  };
  return el;
};

// Provide AbortController if missing
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
}

// Make document.addEventListener track listeners for test
const _docListeners = {};
document.addEventListener = function (type, fn, opts) {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push(fn);
};
document.removeEventListener = function (type, fn) {
  if (_docListeners[type]) _docListeners[type] = _docListeners[type].filter(f => f !== fn);
};

// Mock querySelectorAll for initTooltips
document.querySelectorAll = () => [];

const { initTooltips, destroyTooltips } = await import('../../app/modules/tooltip.js');

describe('tooltip', () => {
  beforeEach(() => {
    destroyTooltips();
    _bodyChildren.length = 0;
  });

  it('initTooltips is a function', () => {
    assert.equal(typeof initTooltips, 'function');
  });

  it('destroyTooltips is a function', () => {
    assert.equal(typeof destroyTooltips, 'function');
  });

  it('initTooltips can be called without errors', () => {
    assert.doesNotThrow(() => initTooltips());
  });

  it('destroyTooltips can be called without errors', () => {
    initTooltips();
    assert.doesNotThrow(() => destroyTooltips());
  });

  it('initTooltips converts title attributes to data-tooltip', () => {
    const el = document.createElement('button');
    el.setAttribute('title', 'Hello');
    el.hasAttribute = (k) => el.getAttribute(k) != null && el.getAttribute(k) !== undefined;
    el.removeAttribute = (k) => el.setAttribute(k, undefined);
    document.querySelectorAll = (sel) => {
      if (sel === '[title]') return [el];
      return [];
    };
    initTooltips();
    assert.equal(el.getAttribute('data-tooltip'), 'Hello');
    // Restore
    document.querySelectorAll = () => [];
  });

  it('destroyTooltips removes tooltip element from DOM', () => {
    initTooltips();
    // Calling destroyTooltips should clean up
    destroyTooltips();
    const tooltip = _bodyChildren.find(c => c.className && c.className.includes('nr-tooltip'));
    assert.equal(tooltip, undefined);
  });

  it('multiple initTooltips calls do not throw', () => {
    assert.doesNotThrow(() => {
      initTooltips();
      initTooltips();
    });
  });

  it('destroyTooltips is safe to call multiple times', () => {
    assert.doesNotThrow(() => {
      destroyTooltips();
      destroyTooltips();
    });
  });
});
