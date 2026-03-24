import './setup-dom.js';

// Patch document to support real event dispatching BEFORE hotkeys module
// registers its listeners via initHotkeys().
const _docListeners = {};
document.addEventListener = function (type, fn, opts) {
  if (!_docListeners[type]) _docListeners[type] = [];
  _docListeners[type].push({ fn, capture: !!(opts && opts.capture) });
};
document.removeEventListener = function (type, fn) {
  if (_docListeners[type]) {
    _docListeners[type] = _docListeners[type].filter(e => e.fn !== fn);
  }
};
document.dispatchEvent = function (evt) {
  const fns = _docListeners[evt.type] || [];
  for (const entry of fns) entry.fn(evt);
};

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  onHotkey,
  registerHotkeyHandlers,
  isSpaceHeld,
  getBindings,
  rebindKey,
  getCheatsheet,
  initHotkeys,
} from '../../app/modules/hotkeys.js';

// Call initHotkeys() once — now document.addEventListener is functional,
// so the keydown/keyup handlers will be registered properly.
initHotkeys();

/**
 * Helper: create a minimal KeyboardEvent-like object.
 */
function makeKeyEvent(key, opts = {}) {
  return {
    type: opts.type || 'keydown',
    key,
    code: opts.code || '',
    ctrlKey: !!opts.ctrlKey,
    metaKey: !!opts.metaKey,
    altKey: !!opts.altKey,
    shiftKey: !!opts.shiftKey,
    preventDefault: opts.preventDefault || (() => {}),
    stopPropagation: opts.stopPropagation || (() => {}),
  };
}

function dispatchKey(key, opts = {}) {
  const type = opts.type || 'keydown';
  const evt = makeKeyEvent(key, { ...opts, type });
  document.dispatchEvent(evt);
  return evt;
}

describe('hotkeys', () => {
  describe('getBindings', () => {
    it('returns an array of bindings', () => {
      const bindings = getBindings();
      assert.ok(Array.isArray(bindings));
      assert.ok(bindings.length > 0);
    });

    it('returns a copy (mutations do not affect internal state)', () => {
      const bindings = getBindings();
      const originalLength = bindings.length;
      bindings.push({ key: 'x', action: 'test', description: 'test' });
      assert.equal(getBindings().length, originalLength);
    });

    it('contains expected navigation bindings', () => {
      const bindings = getBindings();
      const actions = bindings.map(b => b.action);
      assert.ok(actions.includes('goToPage'));
      assert.ok(actions.includes('firstPage'));
      assert.ok(actions.includes('lastPage'));
    });
  });

  describe('onHotkey', () => {
    it('registers a handler for an action', () => {
      let called = false;
      onHotkey('testAction', () => { called = true; });
      // Handler is registered internally - verify via getBindings indirectly
      assert.equal(called, false); // not called yet
    });
  });

  describe('registerHotkeyHandlers', () => {
    it('registers multiple handlers at once', () => {
      const handlers = {
        action1: () => {},
        action2: () => {},
      };
      assert.doesNotThrow(() => registerHotkeyHandlers(handlers));
    });
  });

  describe('isSpaceHeld', () => {
    it('returns false by default', () => {
      assert.equal(isSpaceHeld(), false);
    });
  });

  describe('rebindKey', () => {
    it('changes the key for an existing action', () => {
      rebindKey('goToPage', 'ctrl+shift+g');
      const bindings = getBindings();
      const binding = bindings.find(b => b.action === 'goToPage');
      assert.equal(binding.key, 'ctrl+shift+g');
      // Restore
      rebindKey('goToPage', 'ctrl+g');
    });

    it('does nothing for non-existent action', () => {
      assert.doesNotThrow(() => rebindKey('nonExistentAction', 'ctrl+x'));
    });
  });

  describe('getCheatsheet', () => {
    it('returns a formatted string of all bindings', () => {
      const sheet = getCheatsheet();
      assert.ok(typeof sheet === 'string');
      assert.ok(sheet.includes('ctrl+g'));
      assert.ok(sheet.includes('Перейти к странице'));
    });

    it('has one line per binding', () => {
      const sheet = getCheatsheet();
      const lines = sheet.split('\n');
      assert.equal(lines.length, getBindings().length);
    });
  });

  describe('initHotkeys', () => {
    it('can be called without throwing', () => {
      // initHotkeys has a guard against double-init, so this tests idempotency
      assert.doesNotThrow(() => initHotkeys());
    });

    it('does not add bindings on re-init', () => {
      const before = getBindings().length;
      initHotkeys();
      assert.equal(getBindings().length, before);
    });
  });

  describe('handleKeyDown (via dispatch)', () => {
    it('calls handler for a matching ctrl combo (ctrl+g → goToPage)', () => {
      let called = false;
      onHotkey('goToPage', () => { called = true; });
      dispatchKey('g', { ctrlKey: true });
      assert.equal(called, true);
    });

    it('calls preventDefault and stopPropagation when handler matches', () => {
      let pdCalled = false;
      let spCalled = false;
      onHotkey('firstPage', () => {});
      const evt = makeKeyEvent('Home', { type: 'keydown' });
      evt.preventDefault = () => { pdCalled = true; };
      evt.stopPropagation = () => { spCalled = true; };
      document.dispatchEvent(evt);
      assert.equal(pdCalled, true);
      assert.equal(spCalled, true);
    });

    it('does not call handler when no binding matches', () => {
      let called = false;
      onHotkey('goToPage', () => { called = true; });
      // 'q' is not bound to anything
      dispatchKey('q', {});
      assert.equal(called, false);
    });

    it('does not fire single-key shortcut when input is focused', () => {
      let called = false;
      onHotkey('handTool', () => { called = true; });
      // Simulate input focused
      const origActive = document.activeElement;
      const fakeInput = { tagName: 'INPUT', isContentEditable: false };
      document.activeElement = fakeInput;
      dispatchKey('h', {});
      assert.equal(called, false);
      // Restore
      document.activeElement = origActive;
    });

    it('fires global shortcut even when input is focused', () => {
      let called = false;
      onHotkey('search', () => { called = true; });
      const origActive = document.activeElement;
      const fakeInput = { tagName: 'INPUT', isContentEditable: false };
      document.activeElement = fakeInput;
      dispatchKey('f', { ctrlKey: true });
      assert.equal(called, true);
      document.activeElement = origActive;
    });

    it('fires ctrl combo even when input is focused (non-global)', () => {
      let called = false;
      onHotkey('zoomIn', () => { called = true; });
      const origActive = document.activeElement;
      const fakeInput = { tagName: 'TEXTAREA', isContentEditable: false };
      document.activeElement = fakeInput;
      dispatchKey('=', { ctrlKey: true });
      assert.equal(called, true);
      document.activeElement = origActive;
    });

    it('does nothing when binding has no registered handler', () => {
      // 'lineTool' action bound to 'l', but remove handler
      onHotkey('lineTool', null);
      // Register a fresh map entry that is null — actionHandlers.get returns null
      // The code checks `if (handler)` so it should skip
      const pd = mock.fn();
      const evt = makeKeyEvent('l', { type: 'keydown' });
      evt.preventDefault = pd;
      document.dispatchEvent(evt);
      // preventDefault should NOT have been called since handler is falsy
      assert.equal(pd.mock.calls.length, 0);
    });

    it('ignores modifier-only keydown (e.g. pressing Control alone)', () => {
      let called = false;
      onHotkey('goToPage', () => { called = true; });
      dispatchKey('Control', { ctrlKey: true });
      assert.equal(called, false);
    });

    it('ignores Alt modifier key alone', () => {
      const pd = mock.fn();
      const evt = makeKeyEvent('Alt', { type: 'keydown', altKey: true });
      evt.preventDefault = pd;
      document.dispatchEvent(evt);
      assert.equal(pd.mock.calls.length, 0);
    });

    it('ignores Shift modifier key alone', () => {
      const pd = mock.fn();
      const evt = makeKeyEvent('Shift', { type: 'keydown', shiftKey: true });
      evt.preventDefault = pd;
      document.dispatchEvent(evt);
      assert.equal(pd.mock.calls.length, 0);
    });

    it('ignores Meta modifier key alone', () => {
      const pd = mock.fn();
      const evt = makeKeyEvent('Meta', { type: 'keydown', metaKey: true });
      evt.preventDefault = pd;
      document.dispatchEvent(evt);
      assert.equal(pd.mock.calls.length, 0);
    });

    it('handles shift+f3 combo (searchPrev)', () => {
      let called = false;
      onHotkey('searchPrev', () => { called = true; });
      dispatchKey('F3', { shiftKey: true });
      assert.equal(called, true);
    });

    it('handles f3 key (searchNext)', () => {
      let called = false;
      onHotkey('searchNext', () => { called = true; });
      dispatchKey('F3', {});
      assert.equal(called, true);
    });

    it('handles ctrl+shift+p combo (pageOrganizer)', () => {
      let called = false;
      onHotkey('pageOrganizer', () => { called = true; });
      dispatchKey('p', { ctrlKey: true, shiftKey: true });
      assert.equal(called, true);
    });

    it('normalizes + key to = for ctrl+= (zoomIn)', () => {
      let called = false;
      onHotkey('zoomIn', () => { called = true; });
      dispatchKey('+', { ctrlKey: true });
      assert.equal(called, true);
    });

    it('handles metaKey as ctrl equivalent', () => {
      let called = false;
      onHotkey('goToPage', () => { called = true; });
      dispatchKey('g', { metaKey: true });
      assert.equal(called, true);
    });

    it('skips single-key shortcut when select element is focused', () => {
      let called = false;
      onHotkey('handTool', () => { called = true; });
      const origActive = document.activeElement;
      document.activeElement = { tagName: 'SELECT', isContentEditable: false };
      dispatchKey('h', {});
      assert.equal(called, false);
      document.activeElement = origActive;
    });

    it('skips single-key shortcut when contentEditable element is focused', () => {
      let called = false;
      onHotkey('handTool', () => { called = true; });
      const origActive = document.activeElement;
      document.activeElement = { tagName: 'DIV', isContentEditable: true };
      dispatchKey('h', {});
      assert.equal(called, false);
      document.activeElement = origActive;
    });

    it('passes the event to the handler', () => {
      let receivedEvt = null;
      onHotkey('lastPage', (e) => { receivedEvt = e; });
      const evt = makeKeyEvent('End', { type: 'keydown' });
      evt.preventDefault = () => {};
      evt.stopPropagation = () => {};
      document.dispatchEvent(evt);
      assert.equal(receivedEvt, evt);
    });

    it('handles escape key (exitMode)', () => {
      let called = false;
      onHotkey('exitMode', () => { called = true; });
      dispatchKey('Escape', {});
      assert.equal(called, true);
    });

    it('handles f11 key (fullscreen)', () => {
      let called = false;
      onHotkey('fullscreen', () => { called = true; });
      dispatchKey('F11', {});
      assert.equal(called, true);
    });
  });

  describe('Space+drag hand tool', () => {
    it('sets isSpaceHeld to true on space keydown (not in input)', () => {
      const origActive = document.activeElement;
      document.activeElement = null;
      dispatchKey(' ', { code: 'Space' });
      assert.equal(isSpaceHeld(), true);
      // Clean up: release space
      dispatchKey(' ', { code: 'Space', type: 'keyup' });
      document.activeElement = origActive;
    });

    it('adds hand-tool-active class on space keydown', () => {
      const origActive = document.activeElement;
      document.activeElement = null;
      dispatchKey(' ', { code: 'Space' });
      assert.equal(document.body.classList.contains('hand-tool-active'), true);
      // Clean up
      dispatchKey(' ', { code: 'Space', type: 'keyup' });
      document.activeElement = origActive;
    });

    it('clears isSpaceHeld on space keyup', () => {
      const origActive = document.activeElement;
      document.activeElement = null;
      dispatchKey(' ', { code: 'Space' });
      assert.equal(isSpaceHeld(), true);
      dispatchKey(' ', { code: 'Space', type: 'keyup' });
      assert.equal(isSpaceHeld(), false);
      document.activeElement = origActive;
    });

    it('removes hand-tool-active class on space keyup', () => {
      const origActive = document.activeElement;
      document.activeElement = null;
      dispatchKey(' ', { code: 'Space' });
      assert.equal(document.body.classList.contains('hand-tool-active'), true);
      dispatchKey(' ', { code: 'Space', type: 'keyup' });
      assert.equal(document.body.classList.contains('hand-tool-active'), false);
      document.activeElement = origActive;
    });

    it('does not set spaceDown when input is focused', () => {
      const origActive = document.activeElement;
      document.activeElement = { tagName: 'INPUT', isContentEditable: false };
      // Make sure space is not held before
      dispatchKey(' ', { code: 'Space', type: 'keyup' });
      assert.equal(isSpaceHeld(), false);
      dispatchKey(' ', { code: 'Space' });
      // Should still be false because isInputFocused() returns true
      assert.equal(isSpaceHeld(), false);
      document.activeElement = origActive;
    });

    it('calls preventDefault on space keydown when not in input', () => {
      const origActive = document.activeElement;
      document.activeElement = null;
      const pd = mock.fn();
      const evt = makeKeyEvent(' ', { type: 'keydown', code: 'Space' });
      evt.preventDefault = pd;
      document.dispatchEvent(evt);
      assert.equal(pd.mock.calls.length > 0, true);
      // Clean up
      dispatchKey(' ', { code: 'Space', type: 'keyup' });
      document.activeElement = origActive;
    });
  });

  describe('handleKeyUp', () => {
    it('keyup handler does not throw', () => {
      // handleKeyUp is a no-op stub for future use, just confirm no error
      assert.doesNotThrow(() => {
        dispatchKey('a', { type: 'keyup' });
      });
    });
  });

  describe('isInputFocused edge cases', () => {
    it('returns false when activeElement is null', () => {
      const origActive = document.activeElement;
      document.activeElement = null;
      // Trigger a single-key shortcut to exercise isInputFocused returning false
      let called = false;
      onHotkey('selectTool', () => { called = true; });
      dispatchKey('v', {});
      assert.equal(called, true);
      document.activeElement = origActive;
    });

    it('returns false for non-input element (e.g. div)', () => {
      const origActive = document.activeElement;
      document.activeElement = { tagName: 'DIV', isContentEditable: false };
      let called = false;
      onHotkey('textTool', () => { called = true; });
      dispatchKey('t', {});
      assert.equal(called, true);
      document.activeElement = origActive;
    });
  });
});
