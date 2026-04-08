// ─── Unit Tests: Permissions API ─────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPermissionsSupported,
  queryPermission,
  queryPermissions,
  onPermissionChange,
} from '../../app/modules/permissions.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal PermissionStatus-like mock object. */
function mockPermissionStatus(state) {
  const _listeners = {};
  return {
    state,
    addEventListener(type, fn) {
      if (!_listeners[type]) _listeners[type] = [];
      _listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (_listeners[type]) _listeners[type] = _listeners[type].filter(f => f !== fn);
    },
    _emit(type) {
      for (const fn of (_listeners[type] || [])) fn();
    },
  };
}

// ─── beforeEach / afterEach ───────────────────────────────────────────────────

let savedPermissions;

beforeEach(() => {
  savedPermissions = globalThis.navigator.permissions;
});

afterEach(() => {
  if (savedPermissions !== undefined) {
    globalThis.navigator.permissions = savedPermissions;
  } else {
    delete globalThis.navigator.permissions;
  }
});

// ─── isPermissionsSupported ───────────────────────────────────────────────────

describe('isPermissionsSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isPermissionsSupported(), 'boolean');
  });

  it('returns true when navigator.permissions is present', () => {
    globalThis.navigator.permissions = { query: async () => mockPermissionStatus('granted') };
    assert.equal(isPermissionsSupported(), true);
  });

  it('returns false when navigator.permissions is absent', () => {
    delete globalThis.navigator.permissions;
    assert.equal(isPermissionsSupported(), false);
  });
});

// ─── queryPermission ──────────────────────────────────────────────────────────

describe('queryPermission', () => {
  it('returns "granted" when mock resolves with granted status', async () => {
    globalThis.navigator.permissions = {
      query: async () => mockPermissionStatus('granted'),
    };
    const result = await queryPermission('camera');
    assert.equal(result, 'granted');
  });

  it('returns "denied" when mock resolves with denied status', async () => {
    globalThis.navigator.permissions = {
      query: async () => mockPermissionStatus('denied'),
    };
    const result = await queryPermission('microphone');
    assert.equal(result, 'denied');
  });

  it('returns "prompt" when mock resolves with prompt status', async () => {
    globalThis.navigator.permissions = {
      query: async () => mockPermissionStatus('prompt'),
    };
    const result = await queryPermission('geolocation');
    assert.equal(result, 'prompt');
  });

  it('returns "unknown" when navigator.permissions is absent', async () => {
    delete globalThis.navigator.permissions;
    const result = await queryPermission('notifications');
    assert.equal(result, 'unknown');
  });

  it('returns "unknown" when query throws', async () => {
    globalThis.navigator.permissions = {
      query: async () => { throw new TypeError('not supported'); },
    };
    const result = await queryPermission('push');
    assert.equal(result, 'unknown');
  });

  it('passes the permission name to navigator.permissions.query', async () => {
    let queriedName = null;
    globalThis.navigator.permissions = {
      query: async ({ name }) => {
        queriedName = name;
        return mockPermissionStatus('granted');
      },
    };
    await queryPermission('clipboard-read');
    assert.equal(queriedName, 'clipboard-read');
  });
});

// ─── queryPermissions ─────────────────────────────────────────────────────────

describe('queryPermissions', () => {
  it('returns a Record with correct states for multiple names', async () => {
    globalThis.navigator.permissions = {
      query: async ({ name }) => {
        const states = {
          camera: 'granted',
          microphone: 'denied',
          geolocation: 'prompt',
        };
        return mockPermissionStatus(states[name] ?? 'unknown');
      },
    };
    const result = await queryPermissions(['camera', 'microphone', 'geolocation']);
    assert.equal(result.camera, 'granted');
    assert.equal(result.microphone, 'denied');
    assert.equal(result.geolocation, 'prompt');
  });

  it('returns an empty object for an empty names array', async () => {
    globalThis.navigator.permissions = {
      query: async () => mockPermissionStatus('granted'),
    };
    const result = await queryPermissions([]);
    assert.deepEqual(result, {});
  });

  it('returns "unknown" for each name when API is absent', async () => {
    delete globalThis.navigator.permissions;
    const result = await queryPermissions(['camera', 'microphone']);
    assert.equal(result.camera, 'unknown');
    assert.equal(result.microphone, 'unknown');
  });

  it('handles mixed successes and failures gracefully', async () => {
    globalThis.navigator.permissions = {
      query: async ({ name }) => {
        if (name === 'camera') throw new Error('not supported');
        return mockPermissionStatus('granted');
      },
    };
    const result = await queryPermissions(['camera', 'microphone']);
    assert.equal(result.camera, 'unknown');
    assert.equal(result.microphone, 'granted');
  });
});

// ─── onPermissionChange ───────────────────────────────────────────────────────

describe('onPermissionChange', () => {
  it('returns a function (unsubscribe) when API is supported', async () => {
    const status = mockPermissionStatus('granted');
    globalThis.navigator.permissions = {
      query: async () => status,
    };
    const unsubscribe = await onPermissionChange('camera', () => {});
    assert.equal(typeof unsubscribe, 'function');
    unsubscribe();
  });

  it('is async and returns a promise', () => {
    const status = mockPermissionStatus('prompt');
    globalThis.navigator.permissions = {
      query: async () => status,
    };
    const result = onPermissionChange('geolocation', () => {});
    assert.ok(result instanceof Promise);
    return result.then((unsub) => unsub());
  });

  it('registers a change listener on the permission status', async () => {
    const status = mockPermissionStatus('prompt');
    let listenerRegistered = false;
    const origAdd = status.addEventListener.bind(status);
    status.addEventListener = (type, fn) => {
      if (type === 'change') listenerRegistered = true;
      origAdd(type, fn);
    };
    globalThis.navigator.permissions = {
      query: async () => status,
    };
    const unsubscribe = await onPermissionChange('notifications', () => {});
    assert.equal(listenerRegistered, true);
    unsubscribe();
  });

  it('fires callback with updated state when change event occurs', async () => {
    const status = mockPermissionStatus('prompt');
    const received = [];
    globalThis.navigator.permissions = {
      query: async () => status,
    };
    const unsubscribe = await onPermissionChange('microphone', (s) => received.push(s));

    status.state = 'granted';
    status._emit('change');
    assert.equal(received.length, 1);
    assert.equal(received[0], 'granted');

    status.state = 'denied';
    status._emit('change');
    assert.equal(received.length, 2);
    assert.equal(received[1], 'denied');

    unsubscribe();
  });

  it('does not fire callback after unsubscribe', async () => {
    const status = mockPermissionStatus('prompt');
    let callCount = 0;
    globalThis.navigator.permissions = {
      query: async () => status,
    };
    const unsubscribe = await onPermissionChange('camera', () => { callCount++; });

    status._emit('change');
    assert.equal(callCount, 1);

    unsubscribe();
    status._emit('change');
    assert.equal(callCount, 1);
  });

  it('returns a no-op unsubscribe when API is absent', async () => {
    delete globalThis.navigator.permissions;
    const unsubscribe = await onPermissionChange('camera', () => {});
    assert.equal(typeof unsubscribe, 'function');
    assert.doesNotThrow(() => unsubscribe());
  });

  it('returns a no-op unsubscribe when query throws', async () => {
    globalThis.navigator.permissions = {
      query: async () => { throw new Error('not allowed'); },
    };
    const unsubscribe = await onPermissionChange('push', () => {});
    assert.equal(typeof unsubscribe, 'function');
    assert.doesNotThrow(() => unsubscribe());
  });
});
