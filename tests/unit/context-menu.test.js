import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Patch createElement to add getBoundingClientRect, focus, closest, hasAttribute, removeAttribute
const _origCreate = document.createElement;
document.createElement = function (tag) {
  const el = _origCreate(tag);
  el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });
  el.focus = el.focus || (() => {});
  el.closest = el.closest || (() => null);
  el.hasAttribute = el.hasAttribute || ((k) => el.getAttribute(k) != null);
  el.removeAttribute = el.removeAttribute || ((k) => el.setAttribute(k, undefined));
  return el;
};

// Provide a minimal document.body.contains and track children
const _bodyChildren = [];
document.body.appendChild = function (child) {
  _bodyChildren.push(child);
  if (child) child.parentNode = document.body;
  return child;
};
document.body.contains = function (el) {
  return _bodyChildren.includes(el);
};

const { showContextMenu, initContextMenu } = await import('../../app/modules/context-menu.js');

describe('context-menu', () => {
  beforeEach(() => {
    // Don't clear _bodyChildren since the menu persists across calls
  });

  it('showContextMenu creates a menu element appended to body', () => {
    showContextMenu(100, 100, [{ label: 'Test' }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    assert.ok(menu, 'menu element should be appended to body');
  });

  it('showContextMenu adds ctx-menu-open class', () => {
    showContextMenu(100, 100, [{ label: 'Item' }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    assert.ok(menu.classList.contains('ctx-menu-open'));
  });

  it('showContextMenu sets role=menu on the element', () => {
    showContextMenu(50, 50, [{ label: 'A' }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    assert.equal(menu.getAttribute('role'), 'menu');
  });

  it('showContextMenu creates buttons for non-separator items', () => {
    showContextMenu(50, 50, [
      { label: 'Copy' },
      { label: 'Paste' },
    ]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const buttons = menu.children.filter(c => c.classList?.contains('ctx-item'));
    assert.equal(buttons.length, 2);
  });

  it('showContextMenu creates separator divs for separator items', () => {
    showContextMenu(50, 50, [
      { label: 'A' },
      { separator: true },
      { label: 'B' },
    ]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const seps = menu.children.filter(c => c.classList?.contains('ctx-sep'));
    assert.equal(seps.length, 1);
  });

  it('separator has role=separator attribute', () => {
    showContextMenu(50, 50, [{ separator: true }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const sep = menu.children.find(c => c.classList?.contains('ctx-sep'));
    assert.equal(sep.getAttribute('role'), 'separator');
  });

  it('showContextMenu sets disabled state on disabled items', () => {
    showContextMenu(50, 50, [
      { label: 'Disabled', disabled: true },
    ]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const btn = menu.children.find(c => c.classList?.contains('ctx-item'));
    assert.equal(btn.disabled, true);
    assert.ok(btn.classList.contains('ctx-disabled'));
  });

  it('clicking an item calls its action', () => {
    const action = mock.fn();
    showContextMenu(50, 50, [{ label: 'Do', action }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const btn = menu.children.find(c => c.classList?.contains('ctx-item'));
    btn.click();
    assert.equal(action.mock.callCount(), 1);
  });

  it('clicking an item closes the menu', () => {
    showContextMenu(50, 50, [{ label: 'Do', action: () => {} }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const btn = menu.children.find(c => c.classList?.contains('ctx-item'));
    btn.click();
    assert.ok(!menu.classList.contains('ctx-menu-open'));
  });

  it('showContextMenu positions the menu with left and top styles', () => {
    showContextMenu(200, 300, [{ label: 'Item' }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    assert.ok(menu.style.left !== undefined);
    assert.ok(menu.style.top !== undefined);
  });

  it('showContextMenu includes shortcut as kbd in innerHTML', () => {
    showContextMenu(50, 50, [{ label: 'Copy', shortcut: 'Ctrl+C' }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    const btn = menu.children.find(c => c.classList?.contains('ctx-item'));
    assert.ok(btn.innerHTML.includes('ctx-kbd'));
    assert.ok(btn.innerHTML.includes('Ctrl+C'));
  });

  it('initContextMenu is a function', () => {
    assert.equal(typeof initContextMenu, 'function');
  });
});
