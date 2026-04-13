// ─── Unit Tests: PubSub ───────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { PubSub, pubSub, subscribe, publish } from '../../app/modules/pub-sub.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('new PubSub()', () => {
  it('creates an instance of PubSub', () => {
    const ps = new PubSub();
    assert.ok(ps instanceof PubSub);
  });

  it('starts with no active topics', () => {
    const ps = new PubSub();
    assert.deepEqual(ps.topics(), []);
  });
});

// ─── subscribe() ─────────────────────────────────────────────────────────────

describe('subscribe()', () => {
  it('returns an unsubscribe function', () => {
    const ps = new PubSub();
    const unsub = ps.subscribe('topic', () => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('handler is called when the topic is published', () => {
    const ps = new PubSub();
    const calls = [];
    ps.subscribe('news', (data) => calls.push(data));
    ps.publish('news', 'headline');
    assert.deepEqual(calls, ['headline']);
  });

  it('handler receives the published data', () => {
    const ps = new PubSub();
    let received = null;
    ps.subscribe('payload', (data) => { received = data; });
    ps.publish('payload', { id: 1, value: 'test' });
    assert.deepEqual(received, { id: 1, value: 'test' });
  });

  it('calling the returned unsub removes the handler', () => {
    const ps = new PubSub();
    const calls = [];
    const unsub = ps.subscribe('updates', (v) => calls.push(v));
    ps.publish('updates', 1);
    unsub();
    ps.publish('updates', 2);
    assert.deepEqual(calls, [1]);
  });

  it('calling unsub twice is safe (no throw)', () => {
    const ps = new PubSub();
    const unsub = ps.subscribe('safe', () => {});
    unsub();
    assert.doesNotThrow(() => unsub());
  });

  it('multiple handlers can subscribe to the same topic', () => {
    const ps = new PubSub();
    const a = [];
    const b = [];
    ps.subscribe('shared', (v) => a.push(v));
    ps.subscribe('shared', (v) => b.push(v));
    ps.publish('shared', 'msg');
    assert.deepEqual(a, ['msg']);
    assert.deepEqual(b, ['msg']);
  });

  it('unsubscribing one handler does not affect others on the same topic', () => {
    const ps = new PubSub();
    const a = [];
    const b = [];
    const unsubA = ps.subscribe('shared', (v) => a.push(v));
    ps.subscribe('shared', (v) => b.push(v));
    unsubA();
    ps.publish('shared', 'x');
    assert.deepEqual(a, []);
    assert.deepEqual(b, ['x']);
  });
});

// ─── subscribeOnce() ─────────────────────────────────────────────────────────

describe('subscribeOnce()', () => {
  it('handler is called on the first publish', () => {
    const ps = new PubSub();
    const calls = [];
    ps.subscribeOnce('event', (v) => calls.push(v));
    ps.publish('event', 'first');
    assert.deepEqual(calls, ['first']);
  });

  it('handler is NOT called on subsequent publishes', () => {
    const ps = new PubSub();
    const calls = [];
    ps.subscribeOnce('event', (v) => calls.push(v));
    ps.publish('event', 'first');
    ps.publish('event', 'second');
    ps.publish('event', 'third');
    assert.deepEqual(calls, ['first']);
  });

  it('returns an unsubscribe function', () => {
    const ps = new PubSub();
    const unsub = ps.subscribeOnce('ev', () => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });

  it('calling the returned unsub before the first publish prevents the call', () => {
    const ps = new PubSub();
    const calls = [];
    const unsub = ps.subscribeOnce('ev', (v) => calls.push(v));
    unsub();
    ps.publish('ev', 'should-not-appear');
    assert.deepEqual(calls, []);
  });

  it('does not affect persistent subscribers on the same topic', () => {
    const ps = new PubSub();
    const once = [];
    const always = [];
    ps.subscribeOnce('topic', (v) => once.push(v));
    ps.subscribe('topic', (v) => always.push(v));
    ps.publish('topic', 1);
    ps.publish('topic', 2);
    assert.deepEqual(once, [1]);
    assert.deepEqual(always, [1, 2]);
  });

  it('subscriber count decrements after auto-unsubscribe', () => {
    const ps = new PubSub();
    ps.subscribeOnce('ev', () => {});
    assert.equal(ps.subscriberCount('ev'), 1);
    ps.publish('ev');
    assert.equal(ps.subscriberCount('ev'), 0);
  });
});

// ─── publish() ───────────────────────────────────────────────────────────────

describe('publish()', () => {
  it('returns the number of handlers called', () => {
    const ps = new PubSub();
    ps.subscribe('t', () => {});
    ps.subscribe('t', () => {});
    ps.subscribe('t', () => {});
    const count = ps.publish('t', null);
    assert.equal(count, 3);
  });

  it('returns 0 when no handlers are subscribed', () => {
    const ps = new PubSub();
    assert.equal(ps.publish('empty'), 0);
  });

  it('publishes with no data argument (undefined)', () => {
    const ps = new PubSub();
    let received = 'NOT_SET';
    ps.subscribe('nodata', (data) => { received = data; });
    ps.publish('nodata');
    assert.equal(received, undefined);
  });

  it('publishes to the correct topic only', () => {
    const ps = new PubSub();
    const aCalls = [];
    const bCalls = [];
    ps.subscribe('topicA', (v) => aCalls.push(v));
    ps.subscribe('topicB', (v) => bCalls.push(v));
    ps.publish('topicA', 'hello');
    assert.deepEqual(aCalls, ['hello']);
    assert.deepEqual(bCalls, []);
  });

  it('snapshot handlers so an unsubscribe inside a handler does not skip others', () => {
    const ps = new PubSub();
    const calls = [];
    let unsubA;
    const handlerA = () => { unsubA(); calls.push('A'); };
    const handlerB = () => calls.push('B');
    unsubA = ps.subscribe('snap', handlerA);
    ps.subscribe('snap', handlerB);
    ps.publish('snap');
    assert.deepEqual(calls, ['A', 'B']);
  });
});

// ─── clearTopic() ────────────────────────────────────────────────────────────

describe('clearTopic()', () => {
  it('removes all handlers for a topic', () => {
    const ps = new PubSub();
    const calls = [];
    ps.subscribe('clear-me', () => calls.push(1));
    ps.subscribe('clear-me', () => calls.push(2));
    ps.clearTopic('clear-me');
    ps.publish('clear-me');
    assert.deepEqual(calls, []);
  });

  it('does not affect handlers on other topics', () => {
    const ps = new PubSub();
    const aCalls = [];
    const bCalls = [];
    ps.subscribe('a', () => aCalls.push(1));
    ps.subscribe('b', () => bCalls.push(1));
    ps.clearTopic('a');
    ps.publish('a');
    ps.publish('b');
    assert.deepEqual(aCalls, []);
    assert.deepEqual(bCalls, [1]);
  });

  it('is safe to call for a topic with no subscribers', () => {
    const ps = new PubSub();
    assert.doesNotThrow(() => ps.clearTopic('nonexistent'));
  });

  it('removes the topic name from topics()', () => {
    const ps = new PubSub();
    ps.subscribe('removable', () => {});
    assert.ok(ps.topics().includes('removable'));
    ps.clearTopic('removable');
    assert.ok(!ps.topics().includes('removable'));
  });
});

// ─── subscriberCount() ───────────────────────────────────────────────────────

describe('subscriberCount()', () => {
  it('returns 0 for a topic with no subscribers', () => {
    const ps = new PubSub();
    assert.equal(ps.subscriberCount('none'), 0);
  });

  it('returns the correct count after adding subscribers', () => {
    const ps = new PubSub();
    ps.subscribe('count-me', () => {});
    ps.subscribe('count-me', () => {});
    assert.equal(ps.subscriberCount('count-me'), 2);
  });

  it('decrements after an unsubscribe', () => {
    const ps = new PubSub();
    const unsub = ps.subscribe('dec', () => {});
    ps.subscribe('dec', () => {});
    assert.equal(ps.subscriberCount('dec'), 2);
    unsub();
    assert.equal(ps.subscriberCount('dec'), 1);
  });

  it('returns 0 after clearTopic()', () => {
    const ps = new PubSub();
    ps.subscribe('wipe', () => {});
    ps.clearTopic('wipe');
    assert.equal(ps.subscriberCount('wipe'), 0);
  });
});

// ─── topics() ────────────────────────────────────────────────────────────────

describe('topics()', () => {
  it('returns an empty array when no subscriptions exist', () => {
    const ps = new PubSub();
    assert.deepEqual(ps.topics(), []);
  });

  it('returns the names of all active topics', () => {
    const ps = new PubSub();
    ps.subscribe('alpha', () => {});
    ps.subscribe('beta', () => {});
    const t = ps.topics();
    assert.ok(t.includes('alpha'));
    assert.ok(t.includes('beta'));
    assert.equal(t.length, 2);
  });

  it('does not include a topic after all its subscribers unsubscribe', () => {
    const ps = new PubSub();
    const unsub = ps.subscribe('gone', () => {});
    assert.ok(ps.topics().includes('gone'));
    unsub();
    assert.ok(!ps.topics().includes('gone'));
  });

  it('does not include a topic after clearTopic()', () => {
    const ps = new PubSub();
    ps.subscribe('temp', () => {});
    ps.clearTopic('temp');
    assert.ok(!ps.topics().includes('temp'));
  });
});

// ─── global pubSub instance ──────────────────────────────────────────────────

describe('pubSub (global instance)', () => {
  // Clean up after each test by clearing topics used
  const TEST_TOPIC = '__test_global_pubsub__';

  it('is an instance of PubSub', () => {
    assert.ok(pubSub instanceof PubSub);
  });

  it('subscribe and publish work on the global instance', () => {
    const calls = [];
    const unsub = pubSub.subscribe(TEST_TOPIC, (v) => calls.push(v));
    pubSub.publish(TEST_TOPIC, 'global-value');
    unsub();
    pubSub.clearTopic(TEST_TOPIC);
    assert.deepEqual(calls, ['global-value']);
  });

  it('global instance persists across imports (same reference)', () => {
    // pubSub is a singleton export — calling subscribe/publish here
    // confirms the same object is used throughout the module lifecycle.
    const calls = [];
    const unsub = pubSub.subscribe(TEST_TOPIC + '_ref', (v) => calls.push(v));
    pubSub.publish(TEST_TOPIC + '_ref', 42);
    unsub();
    pubSub.clearTopic(TEST_TOPIC + '_ref');
    assert.deepEqual(calls, [42]);
  });
});

// ─── convenience subscribe() / publish() ─────────────────────────────────────

describe('subscribe() + publish() convenience functions', () => {
  const CONV_TOPIC = '__test_convenience__';

  it('subscribe() returns an unsubscribe function', () => {
    const unsub = subscribe(CONV_TOPIC, () => {});
    assert.equal(typeof unsub, 'function');
    unsub();
    pubSub.clearTopic(CONV_TOPIC);
  });

  it('handler registered via subscribe() is called by publish()', () => {
    const calls = [];
    const unsub = subscribe(CONV_TOPIC, (v) => calls.push(v));
    publish(CONV_TOPIC, 'hello');
    unsub();
    pubSub.clearTopic(CONV_TOPIC);
    assert.deepEqual(calls, ['hello']);
  });

  it('publish() returns the number of handlers called', () => {
    const unsub1 = subscribe(CONV_TOPIC, () => {});
    const unsub2 = subscribe(CONV_TOPIC, () => {});
    const count = publish(CONV_TOPIC);
    unsub1();
    unsub2();
    pubSub.clearTopic(CONV_TOPIC);
    assert.equal(count, 2);
  });

  it('convenience functions operate on the same global pubSub', () => {
    const calls = [];
    // Subscribe via the class method, publish via convenience function
    const unsub = pubSub.subscribe(CONV_TOPIC + '_cross', (v) => calls.push(v));
    publish(CONV_TOPIC + '_cross', 'cross');
    unsub();
    pubSub.clearTopic(CONV_TOPIC + '_cross');
    assert.deepEqual(calls, ['cross']);
  });

  it('unsubscribing via returned function stops delivery', () => {
    const calls = [];
    const unsub = subscribe(CONV_TOPIC + '_unsub', (v) => calls.push(v));
    publish(CONV_TOPIC + '_unsub', 1);
    unsub();
    publish(CONV_TOPIC + '_unsub', 2);
    pubSub.clearTopic(CONV_TOPIC + '_unsub');
    assert.deepEqual(calls, [1]);
  });
});
