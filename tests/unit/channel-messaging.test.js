// ─── Unit Tests: Channel Messaging ───────────────────────────────────────────
import './setup-dom.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isMessageChannelSupported,
  isBroadcastChannelSupported,
  createMessageChannel,
  pingMessageChannel,
  openBroadcastChannel,
  broadcastMessage,
} from '../../app/modules/channel-messaging.js';

// ─── isMessageChannelSupported ───────────────────────────────────────────────

describe('isMessageChannelSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isMessageChannelSupported(), 'boolean');
  });

  it('returns true in Node.js (MessageChannel is available since v15)', () => {
    assert.equal(isMessageChannelSupported(), true);
  });
});

// ─── isBroadcastChannelSupported ─────────────────────────────────────────────

describe('isBroadcastChannelSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isBroadcastChannelSupported(), 'boolean');
  });

  it('returns true in Node.js (BroadcastChannel is available since v15.4)', () => {
    assert.equal(isBroadcastChannelSupported(), true);
  });
});

// ─── createMessageChannel ────────────────────────────────────────────────────

describe('createMessageChannel', () => {
  it('returns an object (not null)', () => {
    const result = createMessageChannel();
    assert.notEqual(result, null);
  });

  it('returns an object with port1 and port2 properties', () => {
    const result = createMessageChannel();
    assert.ok(result !== null && typeof result === 'object');
    assert.ok('port1' in result);
    assert.ok('port2' in result);
  });

  it('port1 is a MessagePort instance', () => {
    const result = createMessageChannel();
    assert.ok(result !== null);
    assert.ok(result.port1 instanceof MessagePort);
  });

  it('port2 is a MessagePort instance', () => {
    const result = createMessageChannel();
    assert.ok(result !== null);
    assert.ok(result.port2 instanceof MessagePort);
  });

  it('port1 and port2 are distinct objects', () => {
    const result = createMessageChannel();
    assert.ok(result !== null);
    assert.notEqual(result.port1, result.port2);
  });

  it('each call creates a fresh channel pair', () => {
    const a = createMessageChannel();
    const b = createMessageChannel();
    assert.ok(a !== null && b !== null);
    assert.notEqual(a.port1, b.port1);
  });
});

// ─── pingMessageChannel ──────────────────────────────────────────────────────

describe('pingMessageChannel', () => {
  it('resolves with the data sent (string)', async () => {
    const result = await pingMessageChannel('hello');
    assert.equal(result, 'hello');
  });

  it('resolves with the data sent (number)', async () => {
    const result = await pingMessageChannel(42);
    assert.equal(result, 42);
  });

  it('resolves with the data sent (plain object)', async () => {
    const data = { foo: 'bar', n: 1 };
    const result = await pingMessageChannel(data);
    assert.deepEqual(result, data);
  });

  it('resolves with null for null data', async () => {
    const result = await pingMessageChannel(null);
    assert.equal(result, null);
  });

  it('resolves with the data sent (array)', async () => {
    const data = [1, 2, 3];
    const result = await pingMessageChannel(data);
    assert.deepEqual(result, data);
  });
});

// ─── openBroadcastChannel ────────────────────────────────────────────────────

describe('openBroadcastChannel', () => {
  let channel;

  afterEach(() => {
    if (channel) {
      channel.close();
      channel = null;
    }
  });

  it('returns a BroadcastChannel instance', () => {
    channel = openBroadcastChannel('test-open');
    assert.ok(channel instanceof BroadcastChannel);
  });

  it('returned channel has the correct name', () => {
    channel = openBroadcastChannel('my-channel');
    assert.equal(channel.name, 'my-channel');
  });

  it('each call with the same name returns a separate instance', () => {
    const a = openBroadcastChannel('dupe-channel');
    const b = openBroadcastChannel('dupe-channel');
    assert.notEqual(a, b);
    a.close();
    b.close();
    channel = null; // already closed
  });

  it('different names produce channels with different names', () => {
    const a = openBroadcastChannel('chan-a');
    const b = openBroadcastChannel('chan-b');
    assert.equal(a.name, 'chan-a');
    assert.equal(b.name, 'chan-b');
    a.close();
    b.close();
    channel = null; // already closed
  });
});

// ─── broadcastMessage ────────────────────────────────────────────────────────

describe('broadcastMessage', () => {
  it('returns a boolean', () => {
    const result = broadcastMessage('bcast-test', 'ping');
    assert.equal(typeof result, 'boolean');
  });

  it('returns true on success', () => {
    const result = broadcastMessage('bcast-success', { key: 'value' });
    assert.equal(result, true);
  });

  it('does not throw when called with a string payload', () => {
    assert.doesNotThrow(() => {
      broadcastMessage('bcast-string', 'hello world');
    });
  });

  it('does not throw when called with a numeric payload', () => {
    assert.doesNotThrow(() => {
      broadcastMessage('bcast-number', 99);
    });
  });

  it('does not throw when called with a null payload', () => {
    assert.doesNotThrow(() => {
      broadcastMessage('bcast-null', null);
    });
  });

  it('returns true for multiple successive calls on the same channel name', () => {
    const r1 = broadcastMessage('bcast-multi', 1);
    const r2 = broadcastMessage('bcast-multi', 2);
    assert.equal(r1, true);
    assert.equal(r2, true);
  });
});
