import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Track body children
const _bodyChildren = [];
document.body.appendChild = function (child) {
  _bodyChildren.push(child);
  if (child) child.parentNode = document.body;
  return child;
};
document.body.contains = function (el) {
  return _bodyChildren.includes(el);
};

// Ensure AbortController is available
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    }
    abort() { this.signal.aborted = true; }
  };
}

const { initQuickActions, hideQuickActions, addQuickAction } = await import('../../app/modules/quick-actions.js');

describe('quick-actions', () => {
  beforeEach(() => {
    _bodyChildren.length = 0;
  });

  it('initQuickActions is a function', () => {
    assert.equal(typeof initQuickActions, 'function');
  });

  it('hideQuickActions is a function', () => {
    assert.equal(typeof hideQuickActions, 'function');
  });

  it('addQuickAction is a function', () => {
    assert.equal(typeof addQuickAction, 'function');
  });

  it('initQuickActions does nothing without container', () => {
    assert.doesNotThrow(() => initQuickActions({ container: null }));
  });

  it('initQuickActions creates action bar appended to body', () => {
    const container = document.createElement('div');
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    assert.ok(bar, 'action bar should be appended to body');
  });

  it('action bar has role=toolbar', () => {
    const container = document.createElement('div');
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    assert.equal(bar.getAttribute('role'), 'toolbar');
  });

  it('initQuickActions creates buttons for default actions', () => {
    const container = document.createElement('div');
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    // Default actions has 6 items
    const buttons = bar.children.filter(c => c.className?.includes('quick-action-btn'));
    assert.ok(buttons.length > 0, 'should create action buttons');
  });

  it('initQuickActions creates buttons for custom actions', () => {
    const container = document.createElement('div');
    const actions = [
      { id: 'custom1', label: 'Custom 1', icon: 'X', action: () => {} },
      { id: 'custom2', label: 'Custom 2', icon: 'Y', action: () => {} },
    ];
    initQuickActions({ container, actions });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const buttons = bar.children.filter(c => c.className?.includes('quick-action-btn'));
    assert.equal(buttons.length, 2);
  });

  it('hideQuickActions removes visible class from action bar', () => {
    const container = document.createElement('div');
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');
    hideQuickActions();
    assert.ok(!bar.classList.contains('visible'));
  });

  it('addQuickAction adds a button to the bar', () => {
    const container = document.createElement('div');
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const initialCount = bar.children.length;
    addQuickAction({ id: 'extra', label: 'Extra', icon: 'E', action: () => {} });
    assert.equal(bar.children.length, initialCount + 1);
  });

  it('hideQuickActions is safe when no bar exists', () => {
    // Reset actionBar state by not initializing
    assert.doesNotThrow(() => hideQuickActions());
  });
});
