// ─── Unit Tests: View Transitions API ───────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isViewTransitionsSupported,
  withViewTransition,
  navigateToPage,
  crossfade,
  slideLeft,
  slideRight,
} from '../../app/modules/view-transitions.js';

// Ensure documentElement has classList for class-name tests
const _classes = new Set();
if (!document.documentElement.classList) {
  document.documentElement.classList = {
    add(...cls) { cls.forEach(c => _classes.add(c)); },
    remove(...cls) { cls.forEach(c => _classes.delete(c)); },
    contains(c) { return _classes.has(c); },
  };
}

describe('isViewTransitionsSupported', () => {
  /** @type {any} */
  let saved;

  beforeEach(() => {
    saved = document.startViewTransition;
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
  });

  afterEach(() => {
    if (saved !== undefined) {
      document.startViewTransition = saved;
    } else {
      delete document.startViewTransition;
    }
  });

  it('returns true when startViewTransition exists', () => {
    assert.equal(isViewTransitionsSupported(), true);
  });

  it('returns false when startViewTransition is not available', () => {
    delete document.startViewTransition;
    assert.equal(isViewTransitionsSupported(), false);
  });
});

describe('withViewTransition', () => {
  /** @type {any} */
  let saved;

  beforeEach(() => {
    saved = document.startViewTransition;
    _classes.clear();
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
  });

  afterEach(() => {
    if (saved !== undefined) {
      document.startViewTransition = saved;
    } else {
      delete document.startViewTransition;
    }
  });

  it('calls the update callback', async () => {
    let called = false;
    await withViewTransition(() => { called = true; });
    assert.equal(called, true);
  });

  it('resolves its promise', async () => {
    const result = withViewTransition(() => {});
    assert.ok(result instanceof Promise);
    await result; // should not throw
  });

  it('works without the API (fallback)', async () => {
    delete document.startViewTransition;
    let called = false;
    await withViewTransition(() => { called = true; });
    assert.equal(called, true);
  });

  it('adds and removes classNames during transition', async () => {
    await withViewTransition(() => {}, { classNames: ['test-class'] });
    // After transition completes, classNames should be removed
    assert.equal(_classes.has('test-class'), false);
  });

  it('handles callback errors gracefully', async () => {
    const error = new Error('callback failure');
    document.startViewTransition = (cb) => {
      try { cb(); } catch (_) { /* swallow */ }
      const finished = Promise.reject(error);
      // Prevent unhandled rejection for the extra promise references
      finished.catch(() => {});
      return {
        ready: Promise.resolve(),
        finished,
        updateCallbackDone: finished,
      };
    };
    await assert.rejects(() => withViewTransition(() => { throw error; }), {
      message: 'callback failure',
    });
  });

  it('removes classNames even when transition fails', async () => {
    const error = new Error('transition error');
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.reject(error),
        updateCallbackDone: Promise.resolve(),
      };
    };
    try {
      await withViewTransition(() => {}, { classNames: ['fail-class'] });
    } catch (_) { /* expected */ }
    assert.equal(_classes.has('fail-class'), false);
  });
});

describe('navigateToPage', () => {
  /** @type {any} */
  let saved;

  beforeEach(() => {
    saved = document.startViewTransition;
    _classes.clear();
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
  });

  afterEach(() => {
    if (saved !== undefined) {
      document.startViewTransition = saved;
    } else {
      delete document.startViewTransition;
    }
  });

  it('calls the callback', async () => {
    let called = false;
    await navigateToPage(() => { called = true; });
    assert.equal(called, true);
  });
});

describe('crossfade', () => {
  /** @type {any} */
  let saved;

  beforeEach(() => {
    saved = document.startViewTransition;
    _classes.clear();
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
  });

  afterEach(() => {
    if (saved !== undefined) {
      document.startViewTransition = saved;
    } else {
      delete document.startViewTransition;
    }
  });

  it('calls the callback', async () => {
    let called = false;
    await crossfade(() => { called = true; });
    assert.equal(called, true);
  });
});

describe('slideLeft', () => {
  /** @type {any} */
  let saved;

  beforeEach(() => {
    saved = document.startViewTransition;
    _classes.clear();
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
  });

  afterEach(() => {
    if (saved !== undefined) {
      document.startViewTransition = saved;
    } else {
      delete document.startViewTransition;
    }
  });

  it('calls the callback', async () => {
    let called = false;
    await slideLeft(() => { called = true; });
    assert.equal(called, true);
  });
});

describe('slideRight', () => {
  /** @type {any} */
  let saved;

  beforeEach(() => {
    saved = document.startViewTransition;
    _classes.clear();
    document.startViewTransition = (cb) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    };
  });

  afterEach(() => {
    if (saved !== undefined) {
      document.startViewTransition = saved;
    } else {
      delete document.startViewTransition;
    }
  });

  it('calls the callback', async () => {
    let called = false;
    await slideRight(() => { called = true; });
    assert.equal(called, true);
  });
});
