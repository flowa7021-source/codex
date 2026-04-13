// ─── Unit Tests: MessageBus ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MessageBus } from '../../app/modules/message-bus.js';

// ─── publish / subscribe ─────────────────────────────────────────────────────

describe('publish / subscribe', () => {
  it('subscriber receives a published message', () => {
    const bus = new MessageBus();
    const received = [];
    bus.subscribe('test', (msg) => received.push(msg.payload));
    bus.publish('test', 'hello');
    assert.deepEqual(received, ['hello']);
  });

  it('multiple subscribers all receive the message', () => {
    const bus = new MessageBus();
    const a = [];
    const b = [];
    bus.subscribe('topic', (msg) => a.push(msg.payload));
    bus.subscribe('topic', (msg) => b.push(msg.payload));
    bus.publish('topic', 42);
    assert.deepEqual(a, [42]);
    assert.deepEqual(b, [42]);
  });

  it('subscribers on different topics receive only their messages', () => {
    const bus = new MessageBus();
    const x = [];
    const y = [];
    bus.subscribe('x', (msg) => x.push(msg.payload));
    bus.subscribe('y', (msg) => y.push(msg.payload));
    bus.publish('x', 1);
    bus.publish('y', 2);
    assert.deepEqual(x, [1]);
    assert.deepEqual(y, [2]);
  });

  it('no error when publishing to a topic with no subscribers', () => {
    const bus = new MessageBus();
    assert.doesNotThrow(() => bus.publish('nobody', 'data'));
  });

  it('publish returns a Message object with correct fields', () => {
    const bus = new MessageBus();
    const before = Date.now();
    const msg = bus.publish('greet', { name: 'Alice' });
    const after = Date.now();

    assert.equal(typeof msg.id, 'string');
    assert.ok(msg.id.length > 0);
    assert.equal(msg.topic, 'greet');
    assert.deepEqual(msg.payload, { name: 'Alice' });
    assert.ok(msg.timestamp >= before && msg.timestamp <= after);
    assert.equal(msg.replyTo, undefined);
  });
});

// ─── subscribeOnce ───────────────────────────────────────────────────────────

describe('subscribeOnce', () => {
  it('handler fires only on the first message', () => {
    const bus = new MessageBus();
    const calls = [];
    bus.subscribeOnce('tick', (msg) => calls.push(msg.payload));
    bus.publish('tick', 1);
    bus.publish('tick', 2);
    bus.publish('tick', 3);
    assert.deepEqual(calls, [1]);
  });

  it('returns a Subscription object', () => {
    const bus = new MessageBus();
    const sub = bus.subscribeOnce('ev', () => {});
    assert.equal(typeof sub.id, 'string');
    assert.equal(sub.topic, 'ev');
    assert.equal(typeof sub.unsubscribe, 'function');
  });

  it('calling unsubscribe before any message prevents handler from firing', () => {
    const bus = new MessageBus();
    const calls = [];
    const sub = bus.subscribeOnce('ev', (msg) => calls.push(msg.payload));
    sub.unsubscribe();
    bus.publish('ev', 'should not arrive');
    assert.deepEqual(calls, []);
  });

  it('auto-removes the subscription after firing so subscriberCount drops to 0', () => {
    const bus = new MessageBus();
    bus.subscribeOnce('ev', () => {});
    assert.equal(bus.subscriberCount('ev'), 1);
    bus.publish('ev', null);
    assert.equal(bus.subscriberCount('ev'), 0);
  });
});

// ─── unsubscribe (individual) ─────────────────────────────────────────────────

describe('subscribe / unsubscribe', () => {
  it('unsubscribe stops handler from receiving future messages', () => {
    const bus = new MessageBus();
    const calls = [];
    const sub = bus.subscribe('ev', (msg) => calls.push(msg.payload));
    bus.publish('ev', 1);
    sub.unsubscribe();
    bus.publish('ev', 2);
    assert.deepEqual(calls, [1]);
  });

  it('unsubscribing one of two subscribers does not affect the other', () => {
    const bus = new MessageBus();
    const a = [];
    const b = [];
    const subA = bus.subscribe('ev', (msg) => a.push(msg.payload));
    bus.subscribe('ev', (msg) => b.push(msg.payload));
    subA.unsubscribe();
    bus.publish('ev', 99);
    assert.deepEqual(a, []);
    assert.deepEqual(b, [99]);
  });

  it('unsubscribing is idempotent (safe to call twice)', () => {
    const bus = new MessageBus();
    const sub = bus.subscribe('ev', () => {});
    sub.unsubscribe();
    assert.doesNotThrow(() => sub.unsubscribe());
  });
});

// ─── unsubscribeAll ───────────────────────────────────────────────────────────

describe('unsubscribeAll', () => {
  it('removes all subscribers for the given topic', () => {
    const bus = new MessageBus();
    const calls = [];
    bus.subscribe('ev', (msg) => calls.push(msg.payload));
    bus.subscribe('ev', (msg) => calls.push(msg.payload));
    bus.unsubscribeAll('ev');
    bus.publish('ev', 1);
    assert.deepEqual(calls, []);
  });

  it('does not affect subscribers on other topics', () => {
    const bus = new MessageBus();
    const a = [];
    const b = [];
    bus.subscribe('a', (msg) => a.push(msg.payload));
    bus.subscribe('b', (msg) => b.push(msg.payload));
    bus.unsubscribeAll('a');
    bus.publish('a', 1);
    bus.publish('b', 2);
    assert.deepEqual(a, []);
    assert.deepEqual(b, [2]);
  });

  it('is safe to call for a topic with no subscribers', () => {
    const bus = new MessageBus();
    assert.doesNotThrow(() => bus.unsubscribeAll('nope'));
  });
});

// ─── subscriberCount ─────────────────────────────────────────────────────────

describe('subscriberCount', () => {
  it('returns 0 for a topic with no subscribers', () => {
    const bus = new MessageBus();
    assert.equal(bus.subscriberCount('unknown'), 0);
  });

  it('returns the correct count after subscribing', () => {
    const bus = new MessageBus();
    bus.subscribe('ev', () => {});
    bus.subscribe('ev', () => {});
    assert.equal(bus.subscriberCount('ev'), 2);
  });

  it('decrements after unsubscribe', () => {
    const bus = new MessageBus();
    const sub = bus.subscribe('ev', () => {});
    bus.subscribe('ev', () => {});
    assert.equal(bus.subscriberCount('ev'), 2);
    sub.unsubscribe();
    assert.equal(bus.subscriberCount('ev'), 1);
  });

  it('returns 0 after unsubscribeAll', () => {
    const bus = new MessageBus();
    bus.subscribe('ev', () => {});
    bus.unsubscribeAll('ev');
    assert.equal(bus.subscriberCount('ev'), 0);
  });
});

// ─── topics ──────────────────────────────────────────────────────────────────

describe('topics', () => {
  it('returns empty array when no subscribers exist', () => {
    const bus = new MessageBus();
    assert.deepEqual(bus.topics(), []);
  });

  it('returns topics that have active subscribers', () => {
    const bus = new MessageBus();
    bus.subscribe('alpha', () => {});
    bus.subscribe('beta', () => {});
    const t = bus.topics();
    assert.ok(t.includes('alpha'));
    assert.ok(t.includes('beta'));
    assert.equal(t.length, 2);
  });

  it('excludes topics after all subscribers are removed', () => {
    const bus = new MessageBus();
    const sub = bus.subscribe('temp', () => {});
    assert.ok(bus.topics().includes('temp'));
    sub.unsubscribe();
    assert.ok(!bus.topics().includes('temp'));
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('removes all subscriptions so no handlers are called', () => {
    const bus = new MessageBus();
    const calls = [];
    bus.subscribe('a', (msg) => calls.push(msg.payload));
    bus.subscribe('b', (msg) => calls.push(msg.payload));
    bus.clear();
    bus.publish('a', 1);
    bus.publish('b', 2);
    assert.deepEqual(calls, []);
  });

  it('topics() is empty after clear', () => {
    const bus = new MessageBus();
    bus.subscribe('x', () => {});
    bus.subscribe('y', () => {});
    bus.clear();
    assert.deepEqual(bus.topics(), []);
  });

  it('is safe to call on an already-empty bus', () => {
    const bus = new MessageBus();
    assert.doesNotThrow(() => bus.clear());
  });
});

// ─── request / reply ─────────────────────────────────────────────────────────

describe('request / reply', () => {
  it('request resolves with the reply payload', async () => {
    const bus = new MessageBus();

    // Responder: echo the payload back uppercased
    bus.subscribe('echo', (msg) => {
      bus.reply(msg, String(msg.payload).toUpperCase());
    });

    const result = await bus.request('echo', 'hello', 500);
    assert.equal(result, 'HELLO');
  });

  it('request rejects if no reply arrives within the timeout', async () => {
    const bus = new MessageBus();
    await assert.rejects(
      () => bus.request('no-responder', 'data', 50),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('timed out'));
        return true;
      },
    );
  });

  it('reply throws if originalMessage has no replyTo', () => {
    const bus = new MessageBus();
    const msg = bus.publish('topic', 'payload');
    assert.throws(
      () => bus.reply(msg, 'response'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('replyTo'));
        return true;
      },
    );
  });

  it('request-reply works with object payloads', async () => {
    const bus = new MessageBus();
    bus.subscribe('math', (msg) => {
      const { a, b } = msg.payload;
      bus.reply(msg, { sum: a + b });
    });

    const result = await bus.request('math', { a: 3, b: 4 }, 500);
    assert.deepEqual(result, { sum: 7 });
  });

  it('concurrent requests on the same topic resolve independently', async () => {
    const bus = new MessageBus();

    bus.subscribe('double', (msg) => {
      bus.reply(msg, msg.payload * 2);
    });

    const [r1, r2, r3] = await Promise.all([
      bus.request('double', 1, 500),
      bus.request('double', 5, 500),
      bus.request('double', 10, 500),
    ]);

    assert.equal(r1, 2);
    assert.equal(r2, 10);
    assert.equal(r3, 20);
  });
});
