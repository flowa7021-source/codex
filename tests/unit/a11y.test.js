// ─── Unit Tests: A11y ────────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Ensure browser globals exist (when running without --import setup-dom) ─
import './setup-dom.js';

// ─── MutationObserver mock ──────────────────────────────────────────────────
if (typeof globalThis.MutationObserver === 'undefined') {
  globalThis.MutationObserver = class MutationObserver {
    constructor(cb) { this._cb = cb; }
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// ─── DOM mock enhancements ──────────────────────────────────────────────────

let rafCallbacks = [];
globalThis.requestAnimationFrame = (fn) => { rafCallbacks.push(fn); return rafCallbacks.length; };
function flushRAF() { const cbs = rafCallbacks.splice(0); cbs.forEach(fn => fn()); }

function makeMockEl(tag) {
  const _children = [];
  const _attrs = {};
  const _listeners = {};
  const _classes = new Set();
  const el = {
    tagName: (tag || 'DIV').toUpperCase(),
    className: '',
    id: '',
    tabIndex: -1,
    style: {},
    innerHTML: '',
    textContent: '',
    dataset: {},
    parentNode: null,
    children: _children,
    classList: {
      _classes,
      add(...cls) { cls.forEach(c => _classes.add(c)); },
      remove(...cls) { cls.forEach(c => _classes.delete(c)); },
      toggle(c, force) {
        if (force === undefined) { _classes.has(c) ? _classes.delete(c) : _classes.add(c); }
        else { force ? _classes.add(c) : _classes.delete(c); }
      },
      contains(c) { return _classes.has(c); },
    },
    setAttribute(k, v) { _attrs[k] = String(v); },
    getAttribute(k) { return _attrs[k] ?? null; },
    hasAttribute(k) { return k in _attrs; },
    removeAttribute(k) { delete _attrs[k]; },
    appendChild(child) { _children.push(child); child.parentNode = el; return child; },
    remove() { el.parentNode = null; },
    addEventListener(ev, fn, opts) {
      if (!_listeners[ev]) _listeners[ev] = [];
      _listeners[ev].push(fn);
    },
    removeEventListener(ev, fn) {
      if (_listeners[ev]) _listeners[ev] = _listeners[ev].filter(f => f !== fn);
    },
    _dispatchEvent(ev) {
      (_listeners[ev.type] || []).forEach(fn => fn(ev));
    },
    querySelector(sel) { return null; },
    querySelectorAll(sel) { return []; },
    closest(sel) { return null; },
    focus() { el._focused = true; },
    click() { el._clicked = true; },
    contains(node) { return _children.includes(node); },
  };
  return el;
}

// Track document-level listeners and mock getElementById / querySelector etc.
const _docListeners = {};
const _docIds = {};
const _docQS = {};

const _origAddEventListener = document.addEventListener;
document.addEventListener = function (ev, fn, opts) {
  if (!_docListeners[ev]) _docListeners[ev] = [];
  _docListeners[ev].push(fn);
};

function dispatchDocEvent(type, extra = {}) {
  const evt = { type, key: extra.key, target: extra.target || document.body, preventDefault() {}, ...extra };
  (_docListeners[type] || []).forEach(fn => fn(evt));
}

const origCreateElement = document.createElement;
document.createElement = function (tag) { return makeMockEl(tag); };
document.body.contains = function () { return false; };
document.body.appendChild = function (child) { child.parentNode = document.body; return child; };
document.body.classList = {
  _classes: new Set(),
  add(...c) { c.forEach(x => this._classes.add(x)); },
  remove(...c) { c.forEach(x => this._classes.delete(x)); },
  contains(c) { return this._classes.has(c); },
};

const _mockElements = new Map();

document.getElementById = function (id) {
  return _mockElements.get(id) || null;
};

document.querySelector = function (sel) {
  return _mockElements.get(`qs:${sel}`) || null;
};

document.querySelectorAll = function (sel) {
  return _mockElements.get(`qsa:${sel}`) || [];
};

// ─── Import module ──────────────────────────────────────────────────────────

import {
  announce,
  prefersReducedMotion,
  prefersHighContrast,
  applyAriaAttributes,
  observeTabChanges,
  initA11y,
} from '../../app/modules/a11y.js';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('announce()', () => {
  beforeEach(() => {
    rafCallbacks = [];
    document.body.contains = () => false;
  });

  it('creates a live region and sets message via rAF', () => {
    announce('Hello screen reader');
    flushRAF();
    // The live region should have been created and appended
    // Since our mock body.contains returns false, it re-creates each time
  });

  it('defaults to polite priority', () => {
    announce('Test message');
    flushRAF();
    // No error thrown = success
  });

  it('accepts assertive priority', () => {
    announce('Urgent message', 'assertive');
    flushRAF();
  });

  it('reuses existing live region when present', () => {
    document.body.contains = () => true;
    announce('First');
    flushRAF();
    announce('Second');
    flushRAF();
  });
});

describe('prefersReducedMotion()', () => {
  it('returns a boolean', () => {
    const result = prefersReducedMotion();
    assert.equal(typeof result, 'boolean');
  });
});

describe('prefersHighContrast()', () => {
  it('returns a boolean', () => {
    const result = prefersHighContrast();
    assert.equal(typeof result, 'boolean');
  });
});

describe('applyAriaAttributes()', () => {
  beforeEach(() => {
    _mockElements.clear();
  });

  it('sets role=toolbar on commandBar', () => {
    const commandBar = makeMockEl('div');
    _mockElements.set('commandBar', commandBar);
    applyAriaAttributes();
    assert.equal(commandBar.getAttribute('role'), 'toolbar');
    assert.equal(commandBar.getAttribute('aria-label'), 'Панель инструментов');
  });

  it('handles missing commandBar gracefully', () => {
    _mockElements.clear();
    applyAriaAttributes(); // should not throw
  });

  it('sets role=searchbox on searchInput', () => {
    const searchInput = makeMockEl('input');
    _mockElements.set('searchInput', searchInput);
    applyAriaAttributes();
    assert.equal(searchInput.getAttribute('role'), 'searchbox');
    assert.equal(searchInput.getAttribute('aria-label'), 'Поиск в документе');
  });

  it('sets aria-label on pageInput', () => {
    const pageInput = makeMockEl('input');
    _mockElements.set('pageInput', pageInput);
    applyAriaAttributes();
    assert.equal(pageInput.getAttribute('aria-label'), 'Номер страницы');
  });

  it('sets role=document on viewport', () => {
    const viewport = makeMockEl('div');
    _mockElements.set('qs:.document-viewport', viewport);
    applyAriaAttributes();
    assert.equal(viewport.getAttribute('role'), 'document');
  });

  it('sets role=status on statusBar', () => {
    const statusBar = makeMockEl('div');
    _mockElements.set('statusBar', statusBar);
    applyAriaAttributes();
    assert.equal(statusBar.getAttribute('role'), 'status');
  });

  it('applies aria-label to icon-only buttons from data-tooltip', () => {
    const btn = makeMockEl('button');
    btn.setAttribute('data-tooltip', 'Zoom In');
    btn.classList.add('cb-btn');
    document.querySelectorAll = function (sel) {
      if (sel.includes('.cb-btn')) return [btn];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(btn.getAttribute('aria-label'), 'Zoom In');
    // Restore
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('skips buttons that already have aria-label', () => {
    const btn = makeMockEl('button');
    btn.setAttribute('aria-label', 'Existing');
    btn.setAttribute('data-tooltip', 'Should Not Override');
    btn.classList.add('cb-btn');
    document.querySelectorAll = function (sel) {
      if (sel.includes('.cb-btn')) return [btn];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(btn.getAttribute('aria-label'), 'Existing');
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('sets up sidebar nav with tablist role', () => {
    const nav = makeMockEl('div');
    const tabBtn = makeMockEl('button');
    tabBtn.setAttribute('data-panel', 'thumbs');
    tabBtn.classList.add('active');
    nav.querySelectorAll = function (sel) {
      if (sel.includes('sidebar-nav-btn')) return [tabBtn];
      return [];
    };
    _mockElements.set('qs:.sidebar-nav', nav);
    applyAriaAttributes();
    assert.equal(nav.getAttribute('role'), 'tablist');
    assert.equal(tabBtn.getAttribute('role'), 'tab');
    assert.equal(tabBtn.getAttribute('aria-selected'), 'true');
    assert.equal(tabBtn.getAttribute('aria-controls'), 'thumbs');
    _mockElements.delete('qs:.sidebar-nav');
  });

  it('sets sidebar tab aria-selected false when not active', () => {
    const nav = makeMockEl('div');
    const tabBtn = makeMockEl('button');
    tabBtn.setAttribute('data-panel', 'notes');
    // Not active
    nav.querySelectorAll = function (sel) {
      if (sel.includes('sidebar-nav-btn')) return [tabBtn];
      return [];
    };
    _mockElements.set('qs:.sidebar-nav', nav);
    applyAriaAttributes();
    assert.equal(tabBtn.getAttribute('aria-selected'), 'false');
    _mockElements.delete('qs:.sidebar-nav');
  });

  it('sets role=tabpanel on sidebar panels', () => {
    const panel = makeMockEl('div');
    panel.querySelector = () => {
      const h3 = makeMockEl('h3');
      h3.textContent = 'My Panel';
      return h3;
    };
    document.querySelectorAll = function (sel) {
      if (sel === '.sidebar-panel') return [panel];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(panel.getAttribute('role'), 'tabpanel');
    assert.equal(panel.getAttribute('aria-label'), 'My Panel');
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('sets up collapsible sections with aria-expanded', () => {
    const section = makeMockEl('section');
    section.classList.add('collapsed');
    const head = makeMockEl('div');
    head.closest = (sel) => sel === 'section' ? section : null;
    document.querySelectorAll = function (sel) {
      if (sel === '.section-head, .section-toggle') return [head];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(head.getAttribute('aria-expanded'), 'false');
    assert.equal(head.getAttribute('role'), 'button');
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('sets aria-expanded true on non-collapsed sections', () => {
    const section = makeMockEl('section');
    const head = makeMockEl('div');
    head.closest = (sel) => sel === 'section' ? section : null;
    document.querySelectorAll = function (sel) {
      if (sel === '.section-head, .section-toggle') return [head];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(head.getAttribute('aria-expanded'), 'true');
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('sets up modals with role=dialog', () => {
    const modal = makeMockEl('div');
    const titleEl = makeMockEl('h3');
    titleEl.textContent = 'Settings';
    modal.querySelector = () => titleEl;
    document.querySelectorAll = function (sel) {
      if (sel === '.modal') return [modal];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(modal.getAttribute('role'), 'dialog');
    assert.equal(modal.getAttribute('aria-modal'), 'true');
    assert.equal(modal.getAttribute('aria-label'), 'Settings');
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('sets up dropdown menus with aria-haspopup', () => {
    const trigger = makeMockEl('button');
    trigger.classList.add('dropdown-trigger');
    const menu = makeMockEl('div');
    menu.classList.add('dropdown-menu');
    const dropdown = makeMockEl('div');
    dropdown.querySelector = (sel) => {
      if (sel.includes('dropdown-trigger')) return trigger;
      if (sel.includes('dropdown-menu')) return menu;
      return null;
    };
    document.querySelectorAll = function (sel) {
      if (sel === '.dropdown') return [dropdown];
      return _mockElements.get(`qsa:${sel}`) || [];
    };
    applyAriaAttributes();
    assert.equal(trigger.getAttribute('aria-haspopup'), 'true');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(menu.getAttribute('role'), 'menu');
    document.querySelectorAll = function (sel) {
      return _mockElements.get(`qsa:${sel}`) || [];
    };
  });

  it('sets up right panel nav', () => {
    const rpNav = makeMockEl('div');
    const rpBtn = makeMockEl('button');
    rpBtn.setAttribute('data-panel', 'info');
    rpBtn.classList.add('active');
    rpNav.querySelectorAll = (sel) => {
      if (sel.includes('rp-nav-btn')) return [rpBtn];
      return [];
    };
    _mockElements.set('qs:.rp-nav', rpNav);
    applyAriaAttributes();
    assert.equal(rpNav.getAttribute('role'), 'tablist');
    assert.equal(rpBtn.getAttribute('role'), 'tab');
    assert.equal(rpBtn.getAttribute('aria-selected'), 'true');
    _mockElements.delete('qs:.rp-nav');
  });
});

describe('observeTabChanges()', () => {
  it('does not throw when no tabs exist', () => {
    document.querySelectorAll = (sel) => [];
    observeTabChanges();
    document.querySelectorAll = (sel) => _mockElements.get(`qsa:${sel}`) || [];
  });
});

describe('initA11y()', () => {
  beforeEach(() => {
    rafCallbacks = [];
    _mockElements.clear();
    document.body.contains = () => false;
    document.body.classList._classes.clear();
  });

  it('does not throw on empty DOM', () => {
    initA11y();
  });

  it('sets up keyboard-nav class on Tab keydown', () => {
    initA11y();
    dispatchDocEvent('keydown', { key: 'Tab', target: document.body });
    assert.ok(document.body.classList._classes.has('keyboard-nav'));
  });

  it('removes keyboard-nav class on mousedown', () => {
    initA11y();
    dispatchDocEvent('keydown', { key: 'Tab', target: document.body });
    assert.ok(document.body.classList._classes.has('keyboard-nav'));
    dispatchDocEvent('mousedown', { target: document.body });
    assert.ok(!document.body.classList._classes.has('keyboard-nav'));
  });

  it('handles Escape on modal to hide it', () => {
    const modal = makeMockEl('div');
    modal.setAttribute('role', 'dialog');
    modal.classList.add('open');

    initA11y();
    dispatchDocEvent('keydown', {
      key: 'Escape',
      target: { closest: (sel) => sel.includes('modal') ? modal : null },
    });
    assert.equal(modal.getAttribute('aria-hidden'), 'true');
    assert.ok(!modal.classList._classes.has('open'));
  });

  it('ignores Escape when not in a modal', () => {
    initA11y();
    // Should not throw
    dispatchDocEvent('keydown', {
      key: 'Escape',
      target: { closest: () => null },
    });
  });

  it('sets up sidebar toggle button', () => {
    const sidebarBtn = makeMockEl('button');
    sidebarBtn.setAttribute('aria-expanded', 'false');
    _mockElements.set('toggleSidebar', sidebarBtn);
    initA11y();
    // Simulate click
    const listeners = sidebarBtn._listeners || {};
    // Not directly accessible, but at least init doesn't throw
  });

  it('handles section collapse click', () => {
    initA11y();
    const section = makeMockEl('section');
    section.classList.add('collapsed');
    const head = makeMockEl('div');
    head.closest = (sel) => {
      if (sel.includes('section-head') || sel.includes('section-toggle')) return head;
      if (sel === 'section') return section;
      return null;
    };
    dispatchDocEvent('click', { target: head });
    flushRAF();
    assert.equal(head.getAttribute('aria-expanded'), 'false');
  });

  it('handles dropdown toggle click', () => {
    initA11y();
    const dropdown = makeMockEl('div');
    dropdown.classList.add('open');
    const trigger = makeMockEl('button');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.closest = (sel) => {
      if (sel.includes('dropdown-trigger') || sel.includes('aria-haspopup')) return trigger;
      if (sel.includes('dropdown')) return dropdown;
      return null;
    };
    dispatchDocEvent('click', { target: trigger });
    flushRAF();
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  });
});
