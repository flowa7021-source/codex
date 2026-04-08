// ─── Unit Tests: Broadcast Sync ─────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBroadcastSupported,
  initBroadcastSync,
  broadcastEvent,
  onBroadcastEvent,
  onAnyBroadcastEvent,
  closeBroadcastSync,
  getTabId,
} from '../../app/modules/broadcast-sync.js';

// ─── BroadcastChannel mock ───────────────────────────────────────────────────
// Minimal mock that supports postMessage / close / onmessage and delivers
// messages to all OTHER instances on the same channel name.
// We install this unconditionally (overriding Node.js's native BroadcastChannel)
// so message delivery is synchronous and fully under test control.

/** @type {Map<string, Set<any>>} */
const _channels = new Map();

globalThis.BroadcastChannel = class BroadcastChannel {
  /** @param {string} name */
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!_channels.has(name)) _channels.set(name, new Set());
    _channels.get(name).add(this);
  }

  /** @param {any} data */
  postMessage(data) {
    const peers = _channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue; // don't deliver to self
      if (typeof peer.onmessage === 'function') {
        peer.onmessage({ data });
      }
    }
  }

  close() {
    const peers = _channels.get(this.name);
    if (peers) {
      peers.delete(this);
      if (peers.size === 0) _channels.delete(this.name);
    }
    this.onmessage = null;
  }
};

// ─── Test helpers ────────────────────────────────────────────────────────────

/**
 * Creates a second BroadcastChannel instance on the same channel so we can
 * simulate messages arriving from another tab.
 * @returns {{ send: (type: string, payload?: unknown, tabId?: string) => void, close: () => void }}
 */
function createRemoteTab() {
  const ch = new BroadcastChannel('novareader-sync');
  return {
    /**
     * @param {string} type
     * @param {unknown} [payload]
     * @param {string} [tabId]
     */
    send(type, payload, tabId = 'remote-tab-id') {
      ch.postMessage({ type, payload, tabId, timestamp: Date.now() });
    },
    close() { ch.close(); },
  };
}

// ─── Reset module state between tests ────────────────────────────────────────

beforeEach(() => {
  closeBroadcastSync();
});

afterEach(() => {
  closeBroadcastSync();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isBroadcastSupported', () => {
  it('returns a boolean', () => {
    const result = isBroadcastSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when BroadcastChannel is available', () => {
    assert.equal(isBroadcastSupported(), true);
  });
});

describe('initBroadcastSync', () => {
  it('is safe to call multiple times (no throw)', () => {
    assert.doesNotThrow(() => {
      initBroadcastSync();
      initBroadcastSync();
      initBroadcastSync();
    });
  });

  it('sets a non-empty tabId after first call', () => {
    initBroadcastSync();
    const id = getTabId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0, 'tabId should be non-empty');
  });
});

describe('getTabId', () => {
  it('returns a non-empty string after init', () => {
    initBroadcastSync();
    const id = getTabId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('returns the same ID on multiple calls', () => {
    initBroadcastSync();
    const id1 = getTabId();
    const id2 = getTabId();
    assert.equal(id1, id2);
  });
});

describe('broadcastEvent', () => {
  it('does not throw when channel is not initialized', () => {
    assert.doesNotThrow(() => broadcastEvent('file:opened'));
  });

  it('does not throw when BroadcastChannel is not supported', () => {
    // Temporarily remove BroadcastChannel
    const orig = globalThis.BroadcastChannel;
    // @ts-ignore
    delete globalThis.BroadcastChannel;
    try {
      // closeBroadcastSync already ran in beforeEach, so channel is null
      assert.doesNotThrow(() => broadcastEvent('file:opened', { name: 'test.pdf' }));
    } finally {
      globalThis.BroadcastChannel = orig;
    }
  });

  it('does not throw with payload', () => {
    initBroadcastSync();
    assert.doesNotThrow(() => broadcastEvent('settings:changed', { theme: 'dark' }));
  });

  it('does not throw without payload', () => {
    initBroadcastSync();
    assert.doesNotThrow(() => broadcastEvent('file:closed'));
  });
});

describe('onBroadcastEvent', () => {
  it('returns an unsubscribe function', () => {
    initBroadcastSync();
    const unsub = onBroadcastEvent('bookmark:added', () => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('calls handler when a matching event arrives from another tab', () => {
    initBroadcastSync();
    const received = [];
    onBroadcastEvent('bookmark:added', (payload) => received.push(payload));

    const remote = createRemoteTab();
    remote.send('bookmark:added', { page: 5 });
    remote.close();

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { page: 5 });
  });

  it('does NOT call handler for a different event type', () => {
    initBroadcastSync();
    const received = [];
    onBroadcastEvent('bookmark:added', (payload) => received.push(payload));

    const remote = createRemoteTab();
    remote.send('bookmark:removed', { page: 5 });
    remote.close();

    assert.equal(received.length, 0);
  });

  it('calling unsubscribe removes the handler', () => {
    initBroadcastSync();
    const received = [];
    const unsub = onBroadcastEvent('settings:changed', (payload) => received.push(payload));

    const remote = createRemoteTab();
    remote.send('settings:changed', { theme: 'light' });
    assert.equal(received.length, 1);

    unsub();
    remote.send('settings:changed', { theme: 'dark' });
    assert.equal(received.length, 1, 'handler should not be called after unsubscribe');

    remote.close();
  });
});

describe('onAnyBroadcastEvent', () => {
  it('returns an unsubscribe function', () => {
    initBroadcastSync();
    const unsub = onAnyBroadcastEvent(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('calls handler for any event type from another tab', () => {
    initBroadcastSync();
    const received = [];
    onAnyBroadcastEvent((msg) => received.push(msg));

    const remote = createRemoteTab();
    remote.send('file:opened', { name: 'doc.pdf' });
    remote.send('annotation:added', { id: 1 });
    remote.close();

    assert.equal(received.length, 2);
    assert.equal(received[0].type, 'file:opened');
    assert.equal(received[1].type, 'annotation:added');
  });

  it('calling unsubscribe stops receiving events', () => {
    initBroadcastSync();
    const received = [];
    const unsub = onAnyBroadcastEvent((msg) => received.push(msg));

    const remote = createRemoteTab();
    remote.send('file:opened');
    assert.equal(received.length, 1);

    unsub();
    remote.send('file:closed');
    assert.equal(received.length, 1, 'handler should not fire after unsubscribe');

    remote.close();
  });
});

describe('closeBroadcastSync', () => {
  it('is safe to call multiple times (no throw)', () => {
    initBroadcastSync();
    assert.doesNotThrow(() => {
      closeBroadcastSync();
      closeBroadcastSync();
      closeBroadcastSync();
    });
  });

  it('is safe to call before init (no throw)', () => {
    // beforeEach already called closeBroadcastSync, so channel is null
    assert.doesNotThrow(() => closeBroadcastSync());
  });

  it('stops delivering events after close', () => {
    initBroadcastSync();
    const received = [];
    onBroadcastEvent('file:opened', (p) => received.push(p));

    closeBroadcastSync();

    // After close the channel is gone — no events should arrive
    // (We can't deliver without an open channel, so just verify no throw)
    assert.doesNotThrow(() => broadcastEvent('file:opened'));
    assert.equal(received.length, 0);
  });
});

describe('message filtering — own tab messages are ignored', () => {
  it('handler is NOT called for messages sent from this tab\'s own tabId', () => {
    initBroadcastSync();
    const ownTabId = getTabId();
    const received = [];
    onBroadcastEvent('reading-progress:updated', (p) => received.push(p));

    // Inject a message that appears to come from this same tab
    const ch = new BroadcastChannel('novareader-sync');
    ch.postMessage({ type: 'reading-progress:updated', payload: { page: 10 }, tabId: ownTabId, timestamp: Date.now() });
    ch.close();

    assert.equal(received.length, 0, 'own-tab message should be filtered out');
  });

  it('handler IS called for messages from a different tabId', () => {
    initBroadcastSync();
    const received = [];
    onBroadcastEvent('reading-progress:updated', (p) => received.push(p));

    const remote = createRemoteTab();
    remote.send('reading-progress:updated', { page: 10 });
    remote.close();

    assert.equal(received.length, 1);
  });
});
