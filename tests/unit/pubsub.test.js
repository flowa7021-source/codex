// ─── Unit Tests: PubSub Broker ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PubSubBroker, createPubSub } from '../../app/modules/pubsub.js';

describe('PubSubBroker – publish/subscribe', () => {
  it('subscriber receives published message', () => {
    const bus = new PubSubBroker();
    const log = [];
    bus.subscribe('click', msg => log.push(msg));
    bus.publish('click', { x: 1, y: 2 });
    assert.deepEqual(log, [{ x: 1, y: 2 }]);
  });

  it('publish returns subscriber count', () => {
    const bus = new PubSubBroker();
    bus.subscribe('ev', () => {});
    bus.subscribe('ev', () => {});
    assert.equal(bus.publish('ev', 'msg'), 2);
  });

  it('unsubscribe stops receiving messages', () => {
    const bus = new PubSubBroker();
    const log = [];
    const unsub = bus.subscribe('ev', v => log.push(v));
    bus.publish('ev', 1);
    unsub();
    bus.publish('ev', 2);
    assert.deepEqual(log, [1]);
  });

  it('multiple subscribers all receive message', () => {
    const bus = new PubSubBroker();
    const a = [], b = [];
    bus.subscribe('ev', v => a.push(v));
    bus.subscribe('ev', v => b.push(v));
    bus.publish('ev', 42);
    assert.deepEqual(a, [42]);
    assert.deepEqual(b, [42]);
  });
});

describe('PubSubBroker – subscribeOnce', () => {
  it('fires only once', () => {
    const bus = new PubSubBroker();
    const log = [];
    bus.subscribeOnce('ev', v => log.push(v));
    bus.publish('ev', 1);
    bus.publish('ev', 2);
    assert.deepEqual(log, [1]);
  });
});

describe('PubSubBroker – subscriberCount & topics', () => {
  it('subscriberCount returns correct count', () => {
    const bus = new PubSubBroker();
    bus.subscribe('a', () => {});
    bus.subscribe('a', () => {});
    assert.equal(bus.subscriberCount('a'), 2);
  });

  it('topics returns only topics with subscribers', () => {
    const bus = new PubSubBroker();
    bus.subscribe('x', () => {});
    bus.subscribe('y', () => {});
    const topics = bus.topics();
    assert.ok(topics.includes('x'));
    assert.ok(topics.includes('y'));
  });

  it('unsubscribeAll removes all handlers for a topic', () => {
    const bus = new PubSubBroker();
    bus.subscribe('ev', () => {});
    bus.subscribe('ev', () => {});
    bus.unsubscribeAll('ev');
    assert.equal(bus.subscriberCount('ev'), 0);
  });
});

describe('createPubSub factory', () => {
  it('creates a PubSubBroker', () => {
    const bus = createPubSub();
    const log = [];
    bus.subscribe('test', v => log.push(v));
    bus.publish('test', 'hello');
    assert.deepEqual(log, ['hello']);
  });
});
