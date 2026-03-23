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
  el.removeAttribute = el.removeAttribute || (() => {});
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

// Helper: find the menu element
function findMenu() {
  return _bodyChildren.find(c => c.className && c.className.includes('ctx-menu'));
}

// Helper: find children by className string
function findChildrenByClass(parent, cls) {
  return parent.children.filter(c => c.className && c.className.includes(cls));
}

// Helper: find the Nth button child (buttons have role=menuitem)
function findButtons(menu) {
  return menu.children.filter(c => c.getAttribute('role') === 'menuitem');
}

describe('context-menu', () => {
  it('showContextMenu creates a menu element appended to body', () => {
    showContextMenu(100, 100, [{ label: 'Test' }]);
    assert.ok(findMenu(), 'menu element should be appended to body');
  });

  it('showContextMenu adds ctx-menu-open class', () => {
    showContextMenu(100, 100, [{ label: 'Item' }]);
    const menu = findMenu();
    assert.ok(menu.classList.contains('ctx-menu-open'));
  });

  it('showContextMenu sets role=menu on the element', () => {
    showContextMenu(50, 50, [{ label: 'A' }]);
    const menu = findMenu();
    assert.equal(menu.getAttribute('role'), 'menu');
  });

  it('showContextMenu creates buttons with role=menuitem', () => {
    showContextMenu(50, 50, [
      { label: 'Copy' },
      { label: 'Paste' },
    ]);
    const menu = findMenu();
    const buttons = findButtons(menu);
    assert.equal(buttons.length, 2);
  });

  it('showContextMenu creates separator divs for separator items', () => {
    showContextMenu(50, 50, [
      { label: 'A' },
      { separator: true },
      { label: 'B' },
    ]);
    const menu = findMenu();
    const seps = menu.children.filter(c => c.getAttribute('role') === 'separator');
    assert.equal(seps.length, 1);
  });

  it('showContextMenu sets disabled state on disabled items', () => {
    showContextMenu(50, 50, [
      { label: 'Disabled', disabled: true },
    ]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    assert.equal(btn.disabled, true);
    assert.ok(btn.classList.contains('ctx-disabled'));
  });

  it('clicking an item calls its action', () => {
    const action = mock.fn();
    showContextMenu(50, 50, [{ label: 'Do', action }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    btn.click();
    assert.equal(action.mock.callCount(), 1);
  });

  it('clicking an item closes the menu', () => {
    showContextMenu(50, 50, [{ label: 'Do', action: () => {} }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    btn.click();
    assert.ok(!menu.classList.contains('ctx-menu-open'));
  });

  it('menu items have menuitem role attribute', () => {
    showContextMenu(50, 50, [{ label: 'Action' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    assert.equal(btn.getAttribute('role'), 'menuitem');
  });

  it('showContextMenu clears previous items when called again', () => {
    showContextMenu(50, 50, [{ label: 'A' }, { label: 'B' }]);
    showContextMenu(50, 50, [{ label: 'C' }]);
    const menu = findMenu();
    const buttons = findButtons(menu);
    assert.equal(buttons.length, 1);
  });

  it('initContextMenu is a function', () => {
    assert.equal(typeof initContextMenu, 'function');
  });
});
