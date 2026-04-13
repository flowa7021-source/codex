// ─── Unit Tests: dom-utils ────────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createElement,
  qs,
  qsAll,
  addListeners,
  isVisible,
  setStyles,
  copyAttributes,
  toggleAttr,
} from '../../app/modules/dom-utils.js';

// ─── createElement ────────────────────────────────────────────────────────────

describe('createElement', () => {
  it('creates an element with the correct tagName', () => {
    const el = createElement('div');
    assert.equal(el.tagName, 'DIV');
  });

  it('creates a span element', () => {
    const el = createElement('span');
    assert.equal(el.tagName, 'SPAN');
  });

  it('sets string attributes', () => {
    const el = createElement('input', { type: 'text', id: 'my-input' });
    assert.equal(el.getAttribute('type'), 'text');
    assert.equal(el.getAttribute('id'), 'my-input');
  });

  it('sets numeric attributes as strings', () => {
    const el = createElement('input', { tabindex: 3 });
    assert.equal(el.getAttribute('tabindex'), '3');
  });

  it('sets boolean true attribute as empty string', () => {
    const el = createElement('input', { disabled: true });
    assert.equal(el.getAttribute('disabled'), '');
  });

  it('removes boolean false attribute', () => {
    const el = createElement('input', { disabled: false });
    assert.equal(el.getAttribute('disabled'), null);
  });

  it('appends string children as text nodes (textContent)', () => {
    const el = createElement('p', {}, 'Hello');
    assert.equal(el.textContent, 'Hello');
  });

  it('appends Element children', () => {
    const child = document.createElement('span');
    const el = createElement('div', {}, child);
    assert.equal(el.children.length, 1);
    assert.equal(el.children[0], child);
  });

  it('skips null and undefined children', () => {
    const el = createElement('div', {}, null, undefined);
    assert.equal(el.children.length, 0);
  });

  it('appends multiple children in order', () => {
    const a = document.createElement('span');
    const b = document.createElement('em');
    const el = createElement('div', {}, a, b);
    assert.equal(el.children[0], a);
    assert.equal(el.children[1], b);
  });
});

// ─── qs ──────────────────────────────────────────────────────────────────────

describe('qs', () => {
  it('returns null when selector does not match anything', () => {
    assert.equal(qs('#does-not-exist'), null);
  });

  it('returns null for an invalid selector without throwing', () => {
    // Passes an invalid CSS selector; should return null, not throw
    const result = qs('!!!invalid!!!');
    assert.equal(result, null);
  });

  it('returns the element when it exists in the provided root', () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    child.setAttribute('id', 'target');
    root.appendChild(child);
    const found = qs('#target', root);
    assert.equal(found, child);
  });

  it('returns null when root does not contain the selector', () => {
    const root = document.createElement('div');
    const result = qs('span', root);
    assert.equal(result, null);
  });
});

// ─── qsAll ───────────────────────────────────────────────────────────────────

describe('qsAll', () => {
  it('returns an empty array when nothing matches', () => {
    const result = qsAll('.no-such-class');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('returns an Array (not NodeList)', () => {
    const result = qsAll('div');
    assert.ok(Array.isArray(result));
  });

  it('returns all matching elements within a root', () => {
    const root = document.createElement('div');
    const a = document.createElement('span');
    const b = document.createElement('span');
    root.appendChild(a);
    root.appendChild(b);
    const result = qsAll('span', root);
    assert.equal(result.length, 2);
    assert.ok(result.includes(a));
    assert.ok(result.includes(b));
  });

  it('returns one element when only one matches', () => {
    const root = document.createElement('section');
    const p = document.createElement('p');
    root.appendChild(p);
    const result = qsAll('p', root);
    assert.equal(result.length, 1);
    assert.equal(result[0], p);
  });
});

// ─── addListeners ─────────────────────────────────────────────────────────────

describe('addListeners', () => {
  it('registers event listeners that fire', () => {
    const el = document.createElement('button');
    let clicked = 0;
    addListeners(el, { click: () => { clicked++; } });
    el.dispatchEvent(new Event('click'));
    assert.equal(clicked, 1);
  });

  it('registers multiple listeners in one call', () => {
    const el = document.createElement('div');
    let clicks = 0;
    let focuses = 0;
    addListeners(el, {
      click: () => { clicks++; },
      focus: () => { focuses++; },
    });
    el.dispatchEvent(new Event('click'));
    el.dispatchEvent(new Event('focus'));
    assert.equal(clicks, 1);
    assert.equal(focuses, 1);
  });

  it('returns a cleanup function that removes all listeners', () => {
    const el = document.createElement('div');
    let count = 0;
    const cleanup = addListeners(el, { click: () => { count++; } });
    el.dispatchEvent(new Event('click'));
    assert.equal(count, 1);
    cleanup();
    el.dispatchEvent(new Event('click'));
    assert.equal(count, 1); // no additional calls after cleanup
  });

  it('cleanup removes all registered events', () => {
    const el = document.createElement('div');
    let a = 0;
    let b = 0;
    const cleanup = addListeners(el, {
      mouseenter: () => { a++; },
      mouseleave: () => { b++; },
    });
    cleanup();
    el.dispatchEvent(new Event('mouseenter'));
    el.dispatchEvent(new Event('mouseleave'));
    assert.equal(a, 0);
    assert.equal(b, 0);
  });

  it('works with window as the target', () => {
    let fired = 0;
    const cleanup = addListeners(globalThis.window, { resize: () => { fired++; } });
    globalThis.window.dispatchEvent(new Event('resize'));
    assert.equal(fired, 1);
    cleanup();
  });
});

// ─── isVisible ────────────────────────────────────────────────────────────────

describe('isVisible', () => {
  let originalGetComputedStyle;

  beforeEach(() => {
    originalGetComputedStyle = globalThis.getComputedStyle;
  });

  afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle;
  });

  it('returns false when display is none', () => {
    const el = document.createElement('div');
    // offsetParent is null in jsdom/mock, so isVisible is false regardless.
    // We mock getComputedStyle to return display:none explicitly.
    globalThis.getComputedStyle = () => ({ display: 'none' });
    assert.equal(isVisible(el), false);
  });

  it('returns false when display is block but offsetParent is null', () => {
    const el = document.createElement('div');
    globalThis.getComputedStyle = () => ({ display: 'block' });
    // offsetParent is null on a detached element in the mock
    assert.equal(isVisible(el), false);
  });

  it('returns true when display is not none and offsetParent is not null', () => {
    const el = document.createElement('div');
    globalThis.getComputedStyle = () => ({ display: 'block' });
    // Simulate offsetParent being set (visible in DOM)
    Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
    assert.equal(isVisible(el), true);
  });
});

// ─── setStyles ────────────────────────────────────────────────────────────────

describe('setStyles', () => {
  it('sets a single style property', () => {
    const el = document.createElement('div');
    setStyles(el, { color: 'red' });
    assert.equal(el.style.color, 'red');
  });

  it('sets multiple style properties at once', () => {
    const el = document.createElement('div');
    setStyles(el, { color: 'blue', backgroundColor: 'yellow' });
    assert.equal(el.style.color, 'blue');
    assert.equal(el.style.backgroundColor, 'yellow');
  });

  it('does not throw on empty styles object', () => {
    const el = document.createElement('div');
    assert.doesNotThrow(() => setStyles(el, {}));
  });

  it('overwrites an existing style property', () => {
    const el = document.createElement('div');
    el.style.color = 'red';
    setStyles(el, { color: 'green' });
    assert.equal(el.style.color, 'green');
  });
});

// ─── copyAttributes ───────────────────────────────────────────────────────────

describe('copyAttributes', () => {
  it('copies attributes from source to target', () => {
    const source = document.createElement('div');
    source.setAttribute('data-value', '42');
    source.setAttribute('aria-label', 'test');
    const target = document.createElement('div');
    copyAttributes(source, target);
    assert.equal(target.getAttribute('data-value'), '42');
    assert.equal(target.getAttribute('aria-label'), 'test');
  });

  it('does not throw when source has no attributes', () => {
    const source = document.createElement('div');
    const target = document.createElement('div');
    assert.doesNotThrow(() => copyAttributes(source, target));
  });

  it('overwrites existing attributes on target', () => {
    const source = document.createElement('div');
    source.setAttribute('id', 'new-id');
    const target = document.createElement('div');
    target.setAttribute('id', 'old-id');
    copyAttributes(source, target);
    assert.equal(target.getAttribute('id'), 'new-id');
  });

  it('copies a single attribute', () => {
    const source = document.createElement('button');
    source.setAttribute('type', 'submit');
    const target = document.createElement('button');
    copyAttributes(source, target);
    assert.equal(target.getAttribute('type'), 'submit');
  });
});

// ─── toggleAttr ───────────────────────────────────────────────────────────────

describe('toggleAttr', () => {
  it('adds an attribute when it is absent', () => {
    const el = document.createElement('div');
    toggleAttr(el, 'aria-expanded');
    assert.notEqual(el.getAttribute('aria-expanded'), null);
  });

  it('removes an attribute when it is present', () => {
    const el = document.createElement('div');
    el.setAttribute('aria-expanded', 'true');
    toggleAttr(el, 'aria-expanded');
    assert.equal(el.getAttribute('aria-expanded'), null);
  });

  it('uses the provided value when adding the attribute', () => {
    const el = document.createElement('div');
    toggleAttr(el, 'data-state', 'open');
    assert.equal(el.getAttribute('data-state'), 'open');
  });

  it('uses empty string as default value when adding', () => {
    const el = document.createElement('div');
    toggleAttr(el, 'hidden');
    assert.equal(el.getAttribute('hidden'), '');
  });

  it('toggle twice results in no attribute', () => {
    const el = document.createElement('div');
    toggleAttr(el, 'hidden');
    toggleAttr(el, 'hidden');
    assert.equal(el.getAttribute('hidden'), null);
  });

  it('toggle three times results in the attribute being present', () => {
    const el = document.createElement('div');
    toggleAttr(el, 'disabled');
    toggleAttr(el, 'disabled');
    toggleAttr(el, 'disabled');
    assert.notEqual(el.getAttribute('disabled'), null);
  });
});
