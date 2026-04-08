// ─── Unit Tests: Document Picture-in-Picture API ─────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isDocumentPiPSupported,
  openPiPWindow,
  closePiPWindow,
  isPiPOpen,
  onPiPEnter,
} from '../../app/modules/document-pip.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let _pipWindow = null;

beforeEach(() => {
  _pipWindow = null;
  globalThis.window.documentPictureInPicture = {
    _listeners: {},
    get window() { return _pipWindow; },
    async requestWindow(opts) {
      _pipWindow = { closed: false, close() { _pipWindow = null; }, document: {} };
      return _pipWindow;
    },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] ?? []).push(fn); },
    removeEventListener(type, fn) { this._listeners[type] = (this._listeners[type] ?? []).filter(f => f !== fn); },
  };
});

afterEach(() => {
  delete globalThis.window.documentPictureInPicture;
  _pipWindow = null;
});

// ─── isDocumentPiPSupported ───────────────────────────────────────────────────

describe('isDocumentPiPSupported', () => {
  it('returns a boolean', () => {
    const result = isDocumentPiPSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when documentPictureInPicture is present', () => {
    assert.equal(isDocumentPiPSupported(), true);
  });

  it('returns false when documentPictureInPicture is absent', () => {
    delete globalThis.window.documentPictureInPicture;
    assert.equal(isDocumentPiPSupported(), false);
  });
});

// ─── openPiPWindow ────────────────────────────────────────────────────────────

describe('openPiPWindow', () => {
  it('returns a PiPHandle when the mock is present', async () => {
    const handle = await openPiPWindow();
    assert.notEqual(handle, null);
  });

  it('handle.window is truthy', async () => {
    const handle = await openPiPWindow();
    assert.ok(handle?.window);
  });

  it('handle.close() closes the PiP window', async () => {
    const handle = await openPiPWindow();
    assert.ok(handle);
    handle.close();
    assert.equal(_pipWindow, null);
  });

  it('accepts options without error', async () => {
    const handle = await openPiPWindow({ width: 400, height: 300 });
    assert.ok(handle);
    assert.ok(handle.window);
  });

  it('returns null when documentPictureInPicture is absent', async () => {
    delete globalThis.window.documentPictureInPicture;
    const handle = await openPiPWindow();
    assert.equal(handle, null);
  });

  it('returns null when requestWindow throws', async () => {
    globalThis.window.documentPictureInPicture.requestWindow = async () => {
      throw new Error('User cancelled');
    };
    const handle = await openPiPWindow();
    assert.equal(handle, null);
  });
});

// ─── closePiPWindow ───────────────────────────────────────────────────────────

describe('closePiPWindow', () => {
  it('closes an open PiP window', async () => {
    await openPiPWindow();
    assert.notEqual(_pipWindow, null);
    closePiPWindow();
    assert.equal(_pipWindow, null);
  });

  it('does not throw when no PiP window is open', () => {
    assert.doesNotThrow(() => closePiPWindow());
  });

  it('does not throw when documentPictureInPicture is absent', () => {
    delete globalThis.window.documentPictureInPicture;
    assert.doesNotThrow(() => closePiPWindow());
  });
});

// ─── isPiPOpen ────────────────────────────────────────────────────────────────

describe('isPiPOpen', () => {
  it('returns true after a PiP window is opened', async () => {
    await openPiPWindow();
    assert.equal(isPiPOpen(), true);
  });

  it('returns false after the PiP window is closed via handle', async () => {
    const handle = await openPiPWindow();
    handle?.close();
    assert.equal(isPiPOpen(), false);
  });

  it('returns false after closePiPWindow()', async () => {
    await openPiPWindow();
    closePiPWindow();
    assert.equal(isPiPOpen(), false);
  });

  it('returns false when documentPictureInPicture is absent', () => {
    delete globalThis.window.documentPictureInPicture;
    assert.equal(isPiPOpen(), false);
  });
});

// ─── onPiPEnter ───────────────────────────────────────────────────────────────

describe('onPiPEnter', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onPiPEnter(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('registers the handler in the mock listeners', () => {
    const handler = () => {};
    onPiPEnter(handler);
    const listeners = globalThis.window.documentPictureInPicture._listeners['enter'];
    assert.ok(Array.isArray(listeners));
    assert.ok(listeners.includes(handler));
  });

  it('unsubscribe removes the handler', () => {
    const handler = () => {};
    const unsub = onPiPEnter(handler);
    unsub();
    const listeners = globalThis.window.documentPictureInPicture._listeners['enter'] ?? [];
    assert.equal(listeners.includes(handler), false);
  });

  it('does not throw when documentPictureInPicture is absent', () => {
    delete globalThis.window.documentPictureInPicture;
    assert.doesNotThrow(() => {
      const unsub = onPiPEnter(() => {});
      unsub();
    });
  });

  it('returned noop unsubscribe does not throw when absent', () => {
    delete globalThis.window.documentPictureInPicture;
    const unsub = onPiPEnter(() => {});
    assert.doesNotThrow(() => unsub());
  });
});
