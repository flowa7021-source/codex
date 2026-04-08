// ─── Unit Tests: Fullscreen API ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isFullscreenSupported,
  isFullscreen,
  requestFullscreen,
  exitFullscreen,
  toggleFullscreen,
  onFullscreenChange,
} from '../../app/modules/fullscreen.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // Provide a working fullscreen environment by default
  globalThis.document.fullscreenEnabled = true;
  globalThis.document.fullscreenElement = null;
  globalThis.document.exitFullscreen = async () => {
    globalThis.document.fullscreenElement = null;
  };
  globalThis.document.documentElement = {
    requestFullscreen: async () => {
      globalThis.document.fullscreenElement = globalThis.document.documentElement;
    },
  };
});

afterEach(() => {
  delete globalThis.document.fullscreenEnabled;
  delete globalThis.document.fullscreenElement;
  delete globalThis.document.exitFullscreen;
});

// ─── isFullscreenSupported ────────────────────────────────────────────────────

describe('isFullscreenSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isFullscreenSupported(), 'boolean');
  });

  it('returns true when fullscreenEnabled is true on document', () => {
    globalThis.document.fullscreenEnabled = true;
    assert.equal(isFullscreenSupported(), true);
  });

  it('returns false when fullscreenEnabled is false', () => {
    globalThis.document.fullscreenEnabled = false;
    assert.equal(isFullscreenSupported(), false);
  });

  it('returns false when fullscreenEnabled is absent from document', () => {
    delete globalThis.document.fullscreenEnabled;
    assert.equal(isFullscreenSupported(), false);
  });
});

// ─── isFullscreen ─────────────────────────────────────────────────────────────

describe('isFullscreen', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isFullscreen(), 'boolean');
  });

  it('returns false when fullscreenElement is null', () => {
    globalThis.document.fullscreenElement = null;
    assert.equal(isFullscreen(), false);
  });

  it('returns false when fullscreenElement is undefined', () => {
    globalThis.document.fullscreenElement = undefined;
    assert.equal(isFullscreen(), false);
  });

  it('returns true when fullscreenElement is set to an element', () => {
    globalThis.document.fullscreenElement = { tagName: 'DIV' };
    assert.equal(isFullscreen(), true);
  });
});

// ─── requestFullscreen ────────────────────────────────────────────────────────

describe('requestFullscreen', () => {
  it('returns true when element requestFullscreen resolves', async () => {
    const el = {
      requestFullscreen: async () => {
        globalThis.document.fullscreenElement = el;
      },
    };
    const result = await requestFullscreen(el);
    assert.equal(result, true);
  });

  it('returns false when element requestFullscreen rejects', async () => {
    const el = {
      requestFullscreen: async () => { throw new Error('not allowed'); },
    };
    const result = await requestFullscreen(el);
    assert.equal(result, false);
  });

  it('uses document.documentElement when no element is provided', async () => {
    let called = false;
    globalThis.document.documentElement = {
      requestFullscreen: async () => {
        called = true;
        globalThis.document.fullscreenElement = globalThis.document.documentElement;
      },
    };
    const result = await requestFullscreen();
    assert.equal(result, true);
    assert.equal(called, true);
  });

  it('returns false when documentElement.requestFullscreen rejects', async () => {
    globalThis.document.documentElement = {
      requestFullscreen: async () => { throw new Error('denied'); },
    };
    const result = await requestFullscreen();
    assert.equal(result, false);
  });
});

// ─── exitFullscreen ───────────────────────────────────────────────────────────

describe('exitFullscreen', () => {
  it('returns true when document.exitFullscreen resolves', async () => {
    globalThis.document.fullscreenElement = { tagName: 'DIV' };
    globalThis.document.exitFullscreen = async () => {
      globalThis.document.fullscreenElement = null;
    };
    const result = await exitFullscreen();
    assert.equal(result, true);
  });

  it('returns false when document.exitFullscreen rejects', async () => {
    globalThis.document.exitFullscreen = async () => { throw new Error('not in fullscreen'); };
    const result = await exitFullscreen();
    assert.equal(result, false);
  });

  it('clears fullscreenElement after successful exit', async () => {
    globalThis.document.fullscreenElement = { tagName: 'DIV' };
    globalThis.document.exitFullscreen = async () => {
      globalThis.document.fullscreenElement = null;
    };
    await exitFullscreen();
    assert.equal(globalThis.document.fullscreenElement, null);
  });
});

// ─── toggleFullscreen ─────────────────────────────────────────────────────────

describe('toggleFullscreen', () => {
  it('requests fullscreen when not currently in fullscreen', async () => {
    globalThis.document.fullscreenElement = null;
    const el = {
      requestFullscreen: async () => {
        globalThis.document.fullscreenElement = el;
      },
    };
    const result = await toggleFullscreen(el);
    assert.equal(result, true);
  });

  it('exits fullscreen when currently in fullscreen', async () => {
    const el = { tagName: 'DIV' };
    globalThis.document.fullscreenElement = el;
    globalThis.document.exitFullscreen = async () => {
      globalThis.document.fullscreenElement = null;
    };
    const result = await toggleFullscreen(el);
    assert.equal(result, false);
  });

  it('returns true when toggle successfully enters fullscreen', async () => {
    globalThis.document.fullscreenElement = null;
    globalThis.document.documentElement = {
      requestFullscreen: async () => {
        globalThis.document.fullscreenElement = globalThis.document.documentElement;
      },
    };
    const result = await toggleFullscreen();
    assert.equal(result, true);
  });

  it('returns false when toggle successfully exits fullscreen', async () => {
    globalThis.document.fullscreenElement = globalThis.document.documentElement;
    globalThis.document.exitFullscreen = async () => {
      globalThis.document.fullscreenElement = null;
    };
    const result = await toggleFullscreen();
    assert.equal(result, false);
  });
});

// ─── onFullscreenChange ───────────────────────────────────────────────────────

describe('onFullscreenChange', () => {
  it('returns an unsubscribe function', () => {
    const unsubscribe = onFullscreenChange(() => {});
    assert.equal(typeof unsubscribe, 'function');
    unsubscribe();
  });

  it('fires callback with true when fullscreenchange event fires and element is set', () => {
    let received = null;
    const el = { tagName: 'DIV' };
    const unsubscribe = onFullscreenChange((state) => { received = state; });

    globalThis.document.fullscreenElement = el;
    const evt = { type: 'fullscreenchange' };
    // Trigger all fullscreenchange listeners manually
    const listeners = globalThis.document._fullscreenListeners;
    // Use dispatchEvent as defined in setup-dom
    globalThis.document.dispatchEvent(new Event('fullscreenchange'));

    assert.equal(received, true);
    unsubscribe();
  });

  it('fires callback with false when fullscreenchange fires and element is null', () => {
    let received = null;
    const unsubscribe = onFullscreenChange((state) => { received = state; });

    globalThis.document.fullscreenElement = null;
    globalThis.document.dispatchEvent(new Event('fullscreenchange'));

    assert.equal(received, false);
    unsubscribe();
  });

  it('does not fire callback after unsubscribe', () => {
    let callCount = 0;
    const unsubscribe = onFullscreenChange(() => { callCount++; });

    globalThis.document.dispatchEvent(new Event('fullscreenchange'));
    assert.equal(callCount, 1);

    unsubscribe();
    globalThis.document.dispatchEvent(new Event('fullscreenchange'));
    assert.equal(callCount, 1);
  });

  it('supports multiple independent listeners', () => {
    const results = [];
    const el = { tagName: 'BODY' };
    globalThis.document.fullscreenElement = el;

    const unsub1 = onFullscreenChange((s) => results.push({ id: 1, s }));
    const unsub2 = onFullscreenChange((s) => results.push({ id: 2, s }));

    globalThis.document.dispatchEvent(new Event('fullscreenchange'));

    assert.equal(results.length, 2);
    assert.equal(results[0].id, 1);
    assert.equal(results[0].s, true);
    assert.equal(results[1].id, 2);
    assert.equal(results[1].s, true);

    unsub1();
    unsub2();
  });
});
