import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Provide a minimal document.body.contains
const _bodyChildren = [];
const origAppendChild = document.body.appendChild;
document.body.appendChild = function (child) {
  _bodyChildren.push(child);
  if (child) child.parentNode = document.body;
  return child;
};
document.body.contains = function (el) {
  return _bodyChildren.includes(el);
};

// Mock the ocr-user-dictionary dependency
mock.module('../../app/modules/ocr-user-dictionary.js', {
  namedExports: { addWord: mock.fn() },
});

const { showContextMenu, initContextMenu } = await import('../../app/modules/context-menu.js');

describe('context-menu', () => {
  beforeEach(() => {
    _bodyChildren.length = 0;
  });

  it('showContextMenu creates a menu element appended to body', () => {
    showContextMenu(100, 100, [{ label: 'Test' }]);
    const menu = _bodyChildren.find(c => c.className === 'ctx-menu' || c.classList?.contains('ctx-menu'));
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

  it('showContextMenu positions the menu with left and top', () => {
    showContextMenu(200, 300, [{ label: 'Item' }]);
    const menu = _bodyChildren.find(c => c.classList?.contains('ctx-menu'));
    // Position should be set (exact values depend on getBoundingClientRect mock)
    assert.ok(menu.style.left !== undefined);
    assert.ok(menu.style.top !== undefined);
  });

  it('showContextMenu includes shortcut as kbd element in innerHTML', () => {
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
