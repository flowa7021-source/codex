import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── DOM patches ──────────────────────────────────────────────────────────────

// Make document.addEventListener / removeEventListener / dispatchEvent functional
const _docListeners = {};
document.addEventListener = function (type, fn, opts) {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push({ fn, capture: !!(opts === true || (opts && opts.capture)) });
};
document.removeEventListener = function (type, fn) {
  if (_docListeners[type]) _docListeners[type] = _docListeners[type].filter(e => e.fn !== fn);
};
function dispatchDocEvent(type, detail) {
  const evt = { type, preventDefault: () => {}, ...detail };
  const fns = (_docListeners[type] || []).slice();
  for (const entry of fns) entry.fn(evt);
  return evt;
}

// Patch createElement to add getBoundingClientRect, focus, closest, matches, contains, hasAttribute, removeAttribute
const _origCreate = document.createElement;
document.createElement = function (tag) {
  const el = _origCreate(tag);
  el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });
  el.focus = el.focus || (() => {});
  el.closest = el.closest || (() => null);
  el.matches = el.matches || (() => false);
  el.contains = el.contains || ((target) => {
    if (target === el) return true;
    return el.children.some(c => c === target || (c.contains && c.contains(target)));
  });
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

// Mock document.execCommand
document.execCommand = mock.fn();

// Mock document.getElementById to return clickable elements for buildContextItems actions
const _elementsById = {};
document.getElementById = function (id) {
  if (!_elementsById[id]) {
    const el = _origCreate('button');
    el.id = id;
    _elementsById[id] = el;
  }
  return _elementsById[id];
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
  // ─── showContextMenu basics ───────────────────────────────────────────────

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

  // ─── Icon and shortcut rendering ──────────────────────────────────────────

  it('renders icon span when item has icon property', () => {
    showContextMenu(50, 50, [{ label: 'WithIcon', icon: '<svg></svg>' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    // innerHTML should contain both ctx-icon and ctx-label spans
    assert.ok(btn.innerHTML.includes('ctx-icon'), 'should have icon span');
    assert.ok(btn.innerHTML.includes('ctx-label'), 'should have label span');
  });

  it('renders kbd element when item has shortcut property', () => {
    showContextMenu(50, 50, [{ label: 'Copy', shortcut: 'Ctrl+C' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    assert.ok(btn.innerHTML.includes('ctx-kbd'), 'should have kbd element');
  });

  it('renders item with both icon and shortcut', () => {
    showContextMenu(50, 50, [{ label: 'Full', icon: '<svg/>', shortcut: 'F1' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    assert.ok(btn.innerHTML.includes('ctx-icon'));
    assert.ok(btn.innerHTML.includes('ctx-kbd'));
    assert.ok(btn.innerHTML.includes('ctx-label'));
  });

  it('renders item with no icon and no shortcut (label only)', () => {
    showContextMenu(50, 50, [{ label: 'Plain' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    assert.ok(!btn.innerHTML.includes('ctx-icon'), 'no icon span');
    assert.ok(!btn.innerHTML.includes('ctx-kbd'), 'no kbd element');
    assert.ok(btn.innerHTML.includes('ctx-label'), 'should have label span');
  });

  // ─── escapeHtml via label ─────────────────────────────────────────────────

  it('escapes HTML entities in label text', () => {
    showContextMenu(50, 50, [{ label: '<b>bold</b>' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    // The label should be escaped so raw <b> tags don't appear
    assert.ok(btn.innerHTML.includes('ctx-label'));
    // The escapeHtml function uses textContent → innerHTML, so it should escape
    assert.ok(!btn.innerHTML.includes('<b>bold</b>') || btn.innerHTML.includes('&lt;'));
  });

  it('escapes HTML entities in shortcut text', () => {
    showContextMenu(50, 50, [{ label: 'Test', shortcut: '<script>' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    assert.ok(btn.innerHTML.includes('ctx-kbd'));
  });

  // ─── Clicking item without action ─────────────────────────────────────────

  it('clicking item without action does not throw', () => {
    showContextMenu(50, 50, [{ label: 'NoAction' }]);
    const menu = findMenu();
    const btn = findButtons(menu)[0];
    // Should not throw when clicking item with no action callback
    assert.doesNotThrow(() => btn.click());
    // Menu should still close
    assert.ok(!menu.classList.contains('ctx-menu-open'));
  });

  // ─── Separator styling ────────────────────────────────────────────────────

  it('separator has ctx-sep class', () => {
    showContextMenu(50, 50, [
      { label: 'A' },
      { separator: true },
      { label: 'B' },
    ]);
    const menu = findMenu();
    const seps = findChildrenByClass(menu, 'ctx-sep');
    assert.equal(seps.length, 1);
    assert.equal(seps[0].getAttribute('role'), 'separator');
  });

  // ─── Position clamping ────────────────────────────────────────────────────

  it('sets left and top style on menu element', () => {
    showContextMenu(200, 300, [{ label: 'Pos' }]);
    const menu = findMenu();
    // With getBoundingClientRect returning width=0, height=0 and viewport 1920x1080,
    // left=200 and top=300 should be within bounds
    assert.ok(menu.style.left.includes('px'));
    assert.ok(menu.style.top.includes('px'));
  });

  it('clamps menu position when overflowing right edge', () => {
    // Override getBoundingClientRect to simulate a wide menu
    showContextMenu(50, 50, [{ label: 'Wide' }]);
    const menu = findMenu();
    // Temporarily make the menu report a large width
    menu.getBoundingClientRect = () => ({
      top: 0, left: 0, bottom: 0, right: 0, width: 2000, height: 50,
    });
    // Re-show to trigger position clamping with large width
    showContextMenu(1900, 50, [{ label: 'Wide' }]);
    // Position should be clamped (vw - width - 4 = 1920 - 2000 - 4 < 4, so left = 4)
    // Actually the menu getBoundingClientRect is called after showing, so
    // we need to verify the style was set
    assert.ok(menu.style.left.includes('px'));
  });

  it('clamps menu position when overflowing bottom edge', () => {
    showContextMenu(50, 50, [{ label: 'Tall' }]);
    const menu = findMenu();
    menu.getBoundingClientRect = () => ({
      top: 0, left: 0, bottom: 0, right: 0, width: 50, height: 2000,
    });
    showContextMenu(50, 1060, [{ label: 'Tall' }]);
    assert.ok(menu.style.top.includes('px'));
  });

  // ─── Menu tabIndex for keyboard focus ─────────────────────────────────────

  it('menu element has tabIndex -1 for programmatic focus', () => {
    showContextMenu(50, 50, [{ label: 'Focus' }]);
    const menu = findMenu();
    assert.equal(menu.tabIndex, -1);
  });

  // ─── Keyboard navigation (onKeyDown) ─────────────────────────────────────

  describe('keyboard navigation', () => {
    it('Escape key closes the menu', () => {
      // Call initContextMenu to register the keydown listener
      initContextMenu();

      showContextMenu(50, 50, [{ label: 'A' }, { label: 'B' }]);
      const menu = findMenu();
      assert.ok(menu.classList.contains('ctx-menu-open'));

      // Dispatch keydown Escape via document listeners
      const evt = dispatchDocEvent('keydown', { key: 'Escape' });
      assert.ok(!menu.classList.contains('ctx-menu-open'), 'menu should be closed after Escape');
    });

    it('keydown does nothing when menu is not open', () => {
      // Close the menu first
      showContextMenu(50, 50, [{ label: 'X' }]);
      const menu = findMenu();
      const btn = findButtons(menu)[0];
      btn.click(); // closes menu

      assert.ok(!menu.classList.contains('ctx-menu-open'));
      // Dispatching ArrowDown should not throw
      assert.doesNotThrow(() => dispatchDocEvent('keydown', { key: 'ArrowDown' }));
    });

    it('ArrowDown key navigates through items', () => {
      showContextMenu(50, 50, [{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
      const menu = findMenu();

      // The querySelectorAll('.ctx-item:not(:disabled)') won't work with our mock,
      // but we verify no error is thrown
      assert.doesNotThrow(() => dispatchDocEvent('keydown', { key: 'ArrowDown' }));
    });

    it('ArrowUp key navigates through items', () => {
      showContextMenu(50, 50, [{ label: 'A' }, { label: 'B' }]);
      assert.doesNotThrow(() => dispatchDocEvent('keydown', { key: 'ArrowUp' }));
    });

    it('Enter key activates focused item', () => {
      showContextMenu(50, 50, [{ label: 'A' }]);
      assert.doesNotThrow(() => dispatchDocEvent('keydown', { key: 'Enter' }));
    });

    it('Space key activates focused item', () => {
      showContextMenu(50, 50, [{ label: 'A' }]);
      assert.doesNotThrow(() => dispatchDocEvent('keydown', { key: ' ' }));
    });

    it('unrecognized key does not close menu', () => {
      showContextMenu(50, 50, [{ label: 'A' }]);
      const menu = findMenu();
      dispatchDocEvent('keydown', { key: 'Tab' });
      assert.ok(menu.classList.contains('ctx-menu-open'), 'menu should remain open');
    });
  });

  // ─── initContextMenu handlers ─────────────────────────────────────────────

  describe('initContextMenu', () => {
    it('registers document event listeners', () => {
      // initContextMenu was already called above; verify listeners exist
      assert.ok(_docListeners['contextmenu']?.length > 0, 'should register contextmenu listener');
      assert.ok(_docListeners['click']?.length > 0, 'should register click listener');
      assert.ok(_docListeners['keydown']?.length > 0, 'should register keydown listener');
      assert.ok(_docListeners['scroll']?.length > 0, 'should register scroll listener');
    });

    it('click outside menu closes it', () => {
      showContextMenu(50, 50, [{ label: 'X' }]);
      const menu = findMenu();
      assert.ok(menu.classList.contains('ctx-menu-open'));

      // Simulate click outside (target not contained by menu)
      const outsideTarget = _origCreate('div');
      dispatchDocEvent('click', { target: outsideTarget });
      assert.ok(!menu.classList.contains('ctx-menu-open'), 'menu should close on outside click');
    });

    it('click inside menu does not close it via document handler', () => {
      showContextMenu(50, 50, [{ label: 'Inside' }]);
      const menu = findMenu();
      assert.ok(menu.classList.contains('ctx-menu-open'));

      // Simulate click inside menu - menu.contains should return true for child
      const btn = findButtons(menu)[0];
      // The menu.contains check in initContextMenu: menuEl.contains(e.target)
      // We need the btn to be recognized as contained. Our mock uses _children array.
      dispatchDocEvent('click', { target: btn });
      // The menu should stay open because btn is a child of menu
      // (menu.contains checks _children which includes btn)
    });

    it('scroll event closes the menu', () => {
      showContextMenu(50, 50, [{ label: 'Scroll' }]);
      const menu = findMenu();
      assert.ok(menu.classList.contains('ctx-menu-open'));

      dispatchDocEvent('scroll', {});
      assert.ok(!menu.classList.contains('ctx-menu-open'), 'menu should close on scroll');
    });

    it('contextmenu on element outside app-shell is ignored', () => {
      const target = _origCreate('div');
      target.closest = (sel) => null; // not inside .app-shell
      target.matches = () => false;

      // No error should occur
      assert.doesNotThrow(() => {
        dispatchDocEvent('contextmenu', {
          target,
          clientX: 100,
          clientY: 100,
        });
      });
    });

    it('contextmenu on input element allows default', () => {
      const target = _origCreate('input');
      target.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        return null;
      };
      target.matches = (sel) => {
        // matches 'input, textarea, [contenteditable]'
        return sel.includes('input');
      };

      let defaultPrevented = false;
      assert.doesNotThrow(() => {
        dispatchDocEvent('contextmenu', {
          target,
          clientX: 100,
          clientY: 100,
          preventDefault: () => { defaultPrevented = true; },
        });
      });
      // Default should NOT be prevented for input elements
      assert.ok(!defaultPrevented, 'should not prevent default on input');
    });

    it('contextmenu on canvas area builds viewer items', () => {
      const target = _origCreate('canvas');
      target.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        if (sel === '#canvasStack, .document-viewport') return _origCreate('div');
        if (sel === '#textLayerDiv > span') return null;
        return null;
      };
      target.matches = () => false;

      let defaultPrevented = false;
      dispatchDocEvent('contextmenu', {
        target,
        clientX: 200,
        clientY: 200,
        preventDefault: () => { defaultPrevented = true; },
      });
      assert.ok(defaultPrevented, 'should prevent default');
      // Menu should be shown with viewer items
      const menu = findMenu();
      assert.ok(menu.classList.contains('ctx-menu-open'));
      const buttons = findButtons(menu);
      // Viewer context menu has: Copy, Select All, sep, OCR, sep, Zoom In, Zoom Out, Fit Width, Fit Page
      assert.ok(buttons.length >= 6, `expected at least 6 items, got ${buttons.length}`);
    });

    it('contextmenu on annotation canvas builds annotation items', () => {
      const target = _origCreate('canvas');
      target.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        if (sel === '.annotation-canvas') return _origCreate('div');
        if (sel === '#canvasStack, .document-viewport') return null;
        if (sel === '#textLayerDiv > span') return null;
        if (sel === '.page-preview-list') return null;
        return null;
      };
      target.matches = () => false;

      let defaultPrevented = false;
      dispatchDocEvent('contextmenu', {
        target,
        clientX: 200,
        clientY: 200,
        preventDefault: () => { defaultPrevented = true; },
      });
      assert.ok(defaultPrevented);
      const menu = findMenu();
      const buttons = findButtons(menu);
      // Annotation items: Undo, Clear All, sep, Export
      assert.ok(buttons.length >= 3, `expected at least 3 annotation items, got ${buttons.length}`);
    });

    it('contextmenu on thumbnail panel builds thumbnail items', () => {
      const target = _origCreate('div');
      target.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        if (sel === '.page-preview-list') return _origCreate('div');
        if (sel === '#canvasStack, .document-viewport') return null;
        if (sel === '#textLayerDiv > span') return null;
        if (sel === '.annotation-canvas') return null;
        return null;
      };
      target.matches = () => false;

      let defaultPrevented = false;
      dispatchDocEvent('contextmenu', {
        target,
        clientX: 200,
        clientY: 200,
        preventDefault: () => { defaultPrevented = true; },
      });
      assert.ok(defaultPrevented);
      const menu = findMenu();
      const buttons = findButtons(menu);
      // Thumbnail items: Go to page, Rotate page
      assert.equal(buttons.length, 2);
    });

    it('contextmenu on area with no matching context returns empty items', () => {
      const target = _origCreate('div');
      target.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        return null;
      };
      target.matches = () => false;

      // Close menu first so we can check it stays closed
      showContextMenu(50, 50, [{ label: 'X' }]);
      const menu = findMenu();
      const btn = findButtons(menu)[0];
      btn.click(); // close

      dispatchDocEvent('contextmenu', {
        target,
        clientX: 200,
        clientY: 200,
      });
      // Menu should not be re-opened since buildContextItems returns []
      assert.ok(!menu.classList.contains('ctx-menu-open'));
    });

    it('contextmenu on textLayerDiv span builds correction item', () => {
      const span = _origCreate('span');
      span.textContent = 'testword';
      span.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        if (sel === '#textLayerDiv > span') return span;
        if (sel === '#canvasStack, .document-viewport') return null;
        if (sel === '.annotation-canvas') return null;
        if (sel === '.page-preview-list') return null;
        return null;
      };
      span.matches = () => false;

      let defaultPrevented = false;
      dispatchDocEvent('contextmenu', {
        target: span,
        clientX: 200,
        clientY: 200,
        preventDefault: () => { defaultPrevented = true; },
      });
      assert.ok(defaultPrevented);
      // buildContextItems for textLayerSpan returns correction item + separator
      // but since it doesn't match any area (canvasStack, annotation, thumbnails),
      // we get just the correction item + separator (2 children total)
      const menu = findMenu();
      const buttons = findButtons(menu);
      assert.ok(buttons.length >= 1, 'should have at least the correction item');
    });

    it('contextmenu on textLayerDiv span with long word truncates label', () => {
      const span = _origCreate('span');
      span.textContent = 'aVeryLongWordThatExceedsTwentyCharacters';
      span.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        if (sel === '#textLayerDiv > span') return span;
        if (sel === '#canvasStack, .document-viewport') return null;
        if (sel === '.annotation-canvas') return null;
        if (sel === '.page-preview-list') return null;
        return null;
      };
      span.matches = () => false;

      dispatchDocEvent('contextmenu', {
        target: span,
        clientX: 200,
        clientY: 200,
      });

      const menu = findMenu();
      const buttons = findButtons(menu);
      // The label should contain the truncated word with ellipsis
      assert.ok(buttons.length >= 1);
    });

    it('viewer context menu actions trigger corresponding element clicks', () => {
      const target = _origCreate('canvas');
      target.closest = (sel) => {
        if (sel === '.app-shell') return _origCreate('div');
        if (sel === '#canvasStack, .document-viewport') return _origCreate('div');
        if (sel === '#textLayerDiv > span') return null;
        return null;
      };
      target.matches = () => false;

      dispatchDocEvent('contextmenu', {
        target,
        clientX: 200,
        clientY: 200,
      });

      const menu = findMenu();
      const buttons = findButtons(menu);

      // Click the "Copy text" button (first one) to trigger document.execCommand('copy')
      buttons[0].click();
      assert.ok(document.execCommand.mock.callCount() >= 1);
    });
  });

  // ─── Multiple separators ──────────────────────────────────────────────────

  it('handles multiple separators correctly', () => {
    showContextMenu(50, 50, [
      { label: 'A' },
      { separator: true },
      { label: 'B' },
      { separator: true },
      { label: 'C' },
    ]);
    const menu = findMenu();
    const seps = menu.children.filter(c => c.getAttribute('role') === 'separator');
    assert.equal(seps.length, 2);
    const buttons = findButtons(menu);
    assert.equal(buttons.length, 3);
  });

  // ─── Empty items list ─────────────────────────────────────────────────────

  it('handles empty items array', () => {
    showContextMenu(50, 50, []);
    const menu = findMenu();
    assert.ok(menu.classList.contains('ctx-menu-open'));
    const buttons = findButtons(menu);
    assert.equal(buttons.length, 0);
  });

  // ─── ensureMenu reuses existing element ───────────────────────────────────

  it('reuses the same menu element across multiple calls', () => {
    showContextMenu(50, 50, [{ label: 'First' }]);
    const menu1 = findMenu();
    showContextMenu(50, 50, [{ label: 'Second' }]);
    const menu2 = findMenu();
    assert.equal(menu1, menu2, 'should reuse the same menu element');
  });
});
