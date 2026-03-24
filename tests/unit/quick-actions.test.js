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

// Add dispatchEvent to document mock if missing
const _docListeners = {};
const origDocAddEventListener = document.addEventListener;
document.addEventListener = function (type, fn, opts) {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push(fn);
};
document.dispatchEvent = function (evt) {
  const fns = _docListeners[evt.type] || [];
  for (const fn of fns) fn(evt);
};

// Helper: create a container element with contains() support
function createContainer() {
  const container = document.createElement('div');
  const childNodes = [];
  const origAppendChild = container.appendChild.bind(container);
  container.appendChild = function (child) {
    childNodes.push(child);
    return origAppendChild(child);
  };
  container.contains = function (node) {
    if (node === container) return true;
    return childNodes.some(c => c === node);
  };
  return container;
}

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
    const container = createContainer();
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    assert.ok(bar, 'action bar should be appended to body');
  });

  it('action bar has role=toolbar', () => {
    const container = createContainer();
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    assert.equal(bar.getAttribute('role'), 'toolbar');
  });

  it('initQuickActions creates buttons for default actions', () => {
    const container = createContainer();
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const buttons = bar.children.filter(c => c.className?.includes('quick-action-btn'));
    assert.ok(buttons.length > 0, 'should create action buttons');
  });

  it('initQuickActions creates buttons for custom actions', () => {
    const container = createContainer();
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
    const container = createContainer();
    initQuickActions({ container });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');
    hideQuickActions();
    assert.ok(!bar.classList.contains('visible'));
  });

  it('addQuickAction adds a button to the bar', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const initialCount = bar.children.length;
    addQuickAction({ id: 'extra', label: 'Extra', icon: 'E', action: () => {} });
    assert.equal(bar.children.length, initialCount + 1);
  });

  it('hideQuickActions is safe when no bar exists', () => {
    assert.doesNotThrow(() => hideQuickActions());
  });

  // ─── Additional tests for function coverage ───────────────────────────────

  it('button click calls action callback with selected text', () => {
    const container = createContainer();
    const actionFn = mock.fn();
    const actions = [
      { id: 'test', label: 'Test', icon: 'T', action: actionFn },
    ];
    initQuickActions({ container, actions });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const btn = bar.children[0];

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => 'hello world',
      isCollapsed: false,
      anchorNode: container,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 0, top: 100, width: 50, height: 20, bottom: 120 }) }),
    });

    btn.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });

    assert.equal(actionFn.mock.calls.length, 1);
    assert.equal(actionFn.mock.calls[0].arguments[0], 'hello world');

    window.getSelection = origGetSelection;
  });

  it('button click calls onAction callback', () => {
    const container = createContainer();
    const onAction = mock.fn();
    const actions = [
      { id: 'act1', label: 'Act', icon: 'A', action: null },
    ];
    initQuickActions({ container, actions, onAction });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const btn = bar.children[0];

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => 'selected text',
      isCollapsed: false,
      anchorNode: container,
    });

    btn.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });

    assert.equal(onAction.mock.calls.length, 1);
    assert.equal(onAction.mock.calls[0].arguments[0], 'act1');
    assert.equal(onAction.mock.calls[0].arguments[1], 'selected text');

    window.getSelection = origGetSelection;
  });

  it('button click hides the action bar', () => {
    const container = createContainer();
    const actions = [
      { id: 'btn1', label: 'Btn', icon: 'B', action: null },
    ];
    initQuickActions({ container, actions });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({ toString: () => '' });

    const btn = bar.children[0];
    btn.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });

    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden after click');

    window.getSelection = origGetSelection;
  });

  it('mousedown on container hides the bar', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    container.dispatchEvent({ type: 'mousedown' });

    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden on mousedown');
  });

  it('scroll on container hides the bar', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    container.dispatchEvent({ type: 'scroll' });

    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden on scroll');
  });

  it('Escape key hides the bar', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    document.dispatchEvent({ type: 'keydown', key: 'Escape' });

    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden on Escape');
  });

  it('non-Escape key does not hide the bar', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    document.dispatchEvent({ type: 'keydown', key: 'Enter' });

    assert.ok(bar.classList.contains('visible'), 'bar should remain visible on non-Escape key');
  });

  it('mouseup triggers checkSelection and shows bar for valid selection', async () => {
    const container = createContainer();
    _bodyChildren.push(container);

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => 'some text',
      isCollapsed: false,
      anchorNode: container,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 100, top: 200, width: 80, height: 20, bottom: 220 }) }),
    });

    container.dispatchEvent({ type: 'mouseup' });

    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(bar.classList.contains('visible'), 'bar should be visible after valid selection');

    window.getSelection = origGetSelection;
  });

  it('mouseup hides bar when selection is collapsed', async () => {
    const container = createContainer();
    _bodyChildren.push(container);

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => '',
      isCollapsed: true,
      anchorNode: container,
    });

    container.dispatchEvent({ type: 'mouseup' });

    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden when selection is collapsed');

    window.getSelection = origGetSelection;
  });

  it('mouseup hides bar when selection is outside container', async () => {
    const container = createContainer();
    _bodyChildren.push(container);

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    const outsideNode = document.createElement('span');
    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => 'text outside',
      isCollapsed: false,
      anchorNode: outsideNode,
    });

    container.dispatchEvent({ type: 'mouseup' });

    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden when selection is outside container');

    window.getSelection = origGetSelection;
  });

  it('re-initialization aborts previous listeners', () => {
    const container1 = createContainer();
    const container2 = createContainer();

    initQuickActions({ container: container1, actions: [] });
    assert.doesNotThrow(() => initQuickActions({ container: container2, actions: [] }));

    const bars = _bodyChildren.filter(c => c.className?.includes('quick-actions-bar'));
    assert.ok(bars.length >= 2, 'should have created multiple bars on re-init');
  });

  it('addQuickAction does nothing when no bar is initialized', () => {
    assert.doesNotThrow(() => addQuickAction({ id: 'noop', label: 'Noop', icon: 'N', action: null }));
  });

  it('addQuickAction button click calls action and hides bar', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));

    const actionFn = mock.fn();
    addQuickAction({ id: 'added', label: 'Added', icon: '+', action: actionFn });

    bar.classList.add('visible');

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({ toString: () => 'clicked text' });

    const addedBtn = bar.children[bar.children.length - 1];
    addedBtn.dispatchEvent({ type: 'click', preventDefault() {} });

    assert.equal(actionFn.mock.calls.length, 1);
    assert.equal(actionFn.mock.calls[0].arguments[0], 'clicked text');
    assert.ok(!bar.classList.contains('visible'), 'bar should be hidden after addQuickAction button click');

    window.getSelection = origGetSelection;
  });

  it('addQuickAction button sets correct dataset and title', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));

    addQuickAction({ id: 'myAction', label: 'My Action', icon: '*', action: null });

    const addedBtn = bar.children[bar.children.length - 1];
    assert.equal(addedBtn.dataset.actionId, 'myAction');
    assert.equal(addedBtn.title, 'My Action');
  });

  it('showQuickActions positions bar below selection when no room above', async () => {
    const container = createContainer();
    _bodyChildren.push(container);

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));

    const origGetSelection = window.getSelection;
    // top=10, barHeight=36, y = 10 - 36 - 8 = -34 which is < 8, so bar goes below
    window.getSelection = () => ({
      toString: () => 'top text',
      isCollapsed: false,
      anchorNode: container,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 100, top: 10, width: 50, height: 20, bottom: 30 }) }),
    });

    container.dispatchEvent({ type: 'mouseup' });

    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(bar.classList.contains('visible'), 'bar should be visible');
    // y should be rect.bottom + 8 = 30 + 8 = 38
    assert.equal(bar.style.top, '38px');

    window.getSelection = origGetSelection;
  });

  it('mouseup hides bar when selection toString is only whitespace', async () => {
    const container = createContainer();
    _bodyChildren.push(container);

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => '   ',
      isCollapsed: false,
      anchorNode: container,
    });

    container.dispatchEvent({ type: 'mouseup' });
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(!bar.classList.contains('visible'), 'bar should hide for whitespace-only selection');

    window.getSelection = origGetSelection;
  });

  it('mouseup does nothing when container is detached from body', async () => {
    const container = createContainer();
    // Do NOT add container to _bodyChildren so body.contains returns false

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({
      toString: () => 'text',
      isCollapsed: false,
      anchorNode: container,
    });

    container.dispatchEvent({ type: 'mouseup' });
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(!bar.classList.contains('visible'));

    window.getSelection = origGetSelection;
  });

  it('button click with null action only calls onAction', () => {
    const container = createContainer();
    const onAction = mock.fn();
    const actions = [
      { id: 'nullact', label: 'Null', icon: 'N', action: null },
    ];
    initQuickActions({ container, actions, onAction });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    const btn = bar.children[0];

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({ toString: () => 'txt' });

    btn.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });

    assert.equal(onAction.mock.calls.length, 1);
    assert.equal(onAction.mock.calls[0].arguments[0], 'nullact');

    window.getSelection = origGetSelection;
  });

  it('addQuickAction button click with null action does not throw', () => {
    const container = createContainer();
    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));

    addQuickAction({ id: 'nulladd', label: 'NullAdd', icon: '0', action: null });

    const origGetSelection = window.getSelection;
    window.getSelection = () => ({ toString: () => '' });

    const addedBtn = bar.children[bar.children.length - 1];
    assert.doesNotThrow(() => {
      addedBtn.dispatchEvent({ type: 'click', preventDefault() {} });
    });

    window.getSelection = origGetSelection;
  });

  it('mouseup with null getSelection result hides bar', async () => {
    const container = createContainer();
    _bodyChildren.push(container);

    initQuickActions({ container, actions: [] });
    const bar = _bodyChildren.find(c => c.className?.includes('quick-actions-bar'));
    bar.classList.add('visible');

    const origGetSelection = window.getSelection;
    window.getSelection = () => null;

    container.dispatchEvent({ type: 'mouseup' });
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.ok(!bar.classList.contains('visible'), 'bar should hide when getSelection returns null');

    window.getSelection = origGetSelection;
  });
});
