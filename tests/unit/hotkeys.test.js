import './setup-dom.js';
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
});
