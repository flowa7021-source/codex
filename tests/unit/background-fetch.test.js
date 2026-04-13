// ─── Unit Tests: Background Fetch API ────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ServiceWorkerRegistration is not available in Node.js — provide a minimal stub
// so tests can add/remove `backgroundFetch` from its prototype.
if (typeof globalThis.ServiceWorkerRegistration === 'undefined') {
  globalThis.ServiceWorkerRegistration = class ServiceWorkerRegistration {};
}

import {
  isBackgroundFetchSupported,
  startBackgroundFetch,
  getBackgroundFetch,
  abortBackgroundFetch,
  listBackgroundFetches,
} from '../../app/modules/background-fetch.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal FetchRegistration-like object. */
function mockRegistration(id, overrides = {}) {
  return {
    id,
    uploadTotal: 0,
    uploaded: 0,
    downloadTotal: 1000,
    downloaded: 0,
    result: '',
    failureReason: '',
    recordsAvailable: true,
    abort: async () => true,
    ...overrides,
  };
}

/** Install a mock serviceWorker on navigator that resolves to swReg. */
function installSwMock(swReg) {
  (navigator).serviceWorker = {
    ready: Promise.resolve(swReg),
  };
}

/** Remove the serviceWorker mock from navigator. */
function removeSwMock() {
  delete (navigator).serviceWorker;
}

// ─── beforeEach: reset navigator state ───────────────────────────────────────

beforeEach(() => {
  removeSwMock();
  delete ServiceWorkerRegistration.prototype.backgroundFetch;
});

// ─── isBackgroundFetchSupported ───────────────────────────────────────────────

describe('isBackgroundFetchSupported', () => {
  it('returns a boolean', () => {
    const result = isBackgroundFetchSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when serviceWorker is absent', () => {
    // navigator.serviceWorker is already removed in beforeEach
    assert.equal(isBackgroundFetchSupported(), false);
  });

  it('returns false when backgroundFetch is absent from SW prototype', () => {
    // navigator.serviceWorker present but backgroundFetch absent
    (navigator).serviceWorker = { ready: Promise.resolve({}) };
    // backgroundFetch is not on the prototype (removed in beforeEach)
    assert.equal(isBackgroundFetchSupported(), false);
    delete (navigator).serviceWorker;
  });

  it('returns true when both serviceWorker and backgroundFetch are present', () => {
    (navigator).serviceWorker = { ready: Promise.resolve({}) };
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    assert.equal(isBackgroundFetchSupported(), true);
    delete (navigator).serviceWorker;
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('does not throw when accessing navigator throws', () => {
    // Overwrite navigator with a getter that throws
    const origNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      get() { throw new Error('no navigator'); },
      configurable: true,
    });
    let result;
    assert.doesNotThrow(() => { result = isBackgroundFetchSupported(); });
    assert.equal(result, false);
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
  });
});

// ─── startBackgroundFetch ─────────────────────────────────────────────────────

describe('startBackgroundFetch', () => {
  it('returns null when API is unsupported', async () => {
    // serviceWorker absent, backgroundFetch absent
    const result = await startBackgroundFetch('fetch-1', ['https://example.com/a.pdf']);
    assert.equal(result, null);
  });

  it('returns null when SW is not registered (ready resolves to null)', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    (navigator).serviceWorker = { ready: Promise.resolve(null) };
    const result = await startBackgroundFetch('fetch-2', ['https://example.com/b.pdf']);
    assert.equal(result, null);
    delete (navigator).serviceWorker;
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('resolves without throwing when API is present and SW ready', async () => {
    const reg = mockRegistration('fetch-3');
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        fetch: async () => reg,
      },
    };
    installSwMock(swReg);
    let result;
    await assert.doesNotReject(async () => {
      result = await startBackgroundFetch('fetch-3', ['https://example.com/c.pdf'], { title: 'Test', downloadTotal: 1000 });
    });
    assert.equal(result.id, 'fetch-3');
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns null when backgroundFetch.fetch rejects', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        fetch: async () => { throw new Error('quota exceeded'); },
      },
    };
    installSwMock(swReg);
    const result = await startBackgroundFetch('fetch-4', ['https://example.com/d.pdf']);
    assert.equal(result, null);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });
});

// ─── getBackgroundFetch ────────────────────────────────────────────────────────

describe('getBackgroundFetch', () => {
  it('returns null when API is unsupported', async () => {
    const result = await getBackgroundFetch('any-id');
    assert.equal(result, null);
  });

  it('returns null when the registration is not found', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        get: async () => null,
      },
    };
    installSwMock(swReg);
    const result = await getBackgroundFetch('missing-id');
    assert.equal(result, null);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns the registration when found', async () => {
    const reg = mockRegistration('found-id');
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        get: async (id) => (id === 'found-id' ? reg : null),
      },
    };
    installSwMock(swReg);
    const result = await getBackgroundFetch('found-id');
    assert.equal(result.id, 'found-id');
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns null on error', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        get: async () => { throw new Error('IPC error'); },
      },
    };
    installSwMock(swReg);
    const result = await getBackgroundFetch('error-id');
    assert.equal(result, null);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });
});

// ─── abortBackgroundFetch ─────────────────────────────────────────────────────

describe('abortBackgroundFetch', () => {
  it('returns false when API is unsupported', async () => {
    const result = await abortBackgroundFetch('any-id');
    assert.equal(result, false);
  });

  it('returns false when the registration is not found', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        get: async () => null,
      },
    };
    installSwMock(swReg);
    const result = await abortBackgroundFetch('missing-id');
    assert.equal(result, false);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns true when abort succeeds', async () => {
    let abortCalled = false;
    const reg = mockRegistration('abort-id', {
      abort: async () => { abortCalled = true; },
    });
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        get: async () => reg,
      },
    };
    installSwMock(swReg);
    const result = await abortBackgroundFetch('abort-id');
    assert.equal(result, true);
    assert.equal(abortCalled, true);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns false when abort throws', async () => {
    const reg = mockRegistration('abort-throw', {
      abort: async () => { throw new Error('abort failed'); },
    });
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        get: async () => reg,
      },
    };
    installSwMock(swReg);
    const result = await abortBackgroundFetch('abort-throw');
    assert.equal(result, false);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });
});

// ─── listBackgroundFetches ────────────────────────────────────────────────────

describe('listBackgroundFetches', () => {
  it('returns [] when API is unsupported', async () => {
    const result = await listBackgroundFetches();
    assert.deepEqual(result, []);
  });

  it('returns [] when SW ready is null', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    (navigator).serviceWorker = { ready: Promise.resolve(null) };
    const result = await listBackgroundFetches();
    assert.deepEqual(result, []);
    delete (navigator).serviceWorker;
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns [] when getIds returns empty array', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        getIds: async () => [],
        get: async () => null,
      },
    };
    installSwMock(swReg);
    const result = await listBackgroundFetches();
    assert.deepEqual(result, []);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns registrations matching the IDs', async () => {
    const reg1 = mockRegistration('id-1');
    const reg2 = mockRegistration('id-2');
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        getIds: async () => ['id-1', 'id-2'],
        get: async (id) => {
          if (id === 'id-1') return reg1;
          if (id === 'id-2') return reg2;
          return null;
        },
      },
    };
    installSwMock(swReg);
    const result = await listBackgroundFetches();
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'id-1');
    assert.equal(result[1].id, 'id-2');
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });

  it('returns [] when getIds throws', async () => {
    ServiceWorkerRegistration.prototype.backgroundFetch = {};
    const swReg = {
      backgroundFetch: {
        getIds: async () => { throw new Error('IPC error'); },
      },
    };
    installSwMock(swReg);
    const result = await listBackgroundFetches();
    assert.deepEqual(result, []);
    removeSwMock();
    delete ServiceWorkerRegistration.prototype.backgroundFetch;
  });
});
