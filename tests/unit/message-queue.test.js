// ─── Unit Tests: MessageQueue ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MessageQueue, createMessageQueue } from '../../app/modules/message-queue.js';

// ---------------------------------------------------------------------------
// Factory and construction
// ---------------------------------------------------------------------------
describe('MessageQueue – factory and construction', () => {
  it('createMessageQueue returns a MessageQueue instance', () => {
    const q = createMessageQueue();
    assert.ok(q instanceof MessageQueue);
  });

  it('starts with size 0', () => {
    const q = createMessageQueue();
    assert.equal(q.size(), 0);
  });

  it('peek returns undefined when empty', () => {
    const q = createMessageQueue();
    assert.equal(q.peek(), undefined);
  });

  it('dequeue returns undefined when empty', () => {
    const q = createMessageQueue();
    assert.equal(q.dequeue(), undefined);
  });
});

// ---------------------------------------------------------------------------
// enqueue / size / dequeue / peek
// ---------------------------------------------------------------------------
describe('MessageQueue – enqueue, size, dequeue, peek', () => {
  it('enqueue returns a string id', () => {
    const q = createMessageQueue();
    const id = q.enqueue('hello');
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('size increments after each enqueue', () => {
    const q = createMessageQueue();
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    assert.equal(q.size(), 3);
  });

  it('dequeue removes and returns the first message', () => {
    const q = createMessageQueue();
    q.enqueue('only');
    const msg = q.dequeue();
    assert.ok(msg !== undefined);
    assert.equal(msg.payload, 'only');
    assert.equal(q.size(), 0);
  });

  it('peek returns the front message without removing it', () => {
    const q = createMessageQueue();
    q.enqueue('peek-me', 5);
    const msg = q.peek();
    assert.ok(msg !== undefined);
    assert.equal(msg.payload, 'peek-me');
    assert.equal(q.size(), 1);
  });

  it('enqueued message has correct shape', () => {
    const q = createMessageQueue();
    q.enqueue({ key: 'value' }, 3);
    const msg = q.dequeue();
    assert.ok(msg !== undefined);
    assert.deepEqual(msg.payload, { key: 'value' });
    assert.equal(msg.priority, 3);
    assert.equal(msg.retries, 0);
    assert.equal(typeof msg.id, 'string');
    assert.equal(typeof msg.timestamp, 'number');
  });

  it('each enqueue generates a unique id', () => {
    const q = createMessageQueue();
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      ids.add(q.enqueue(i));
    }
    assert.equal(ids.size, 10);
  });
});

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------
describe('MessageQueue – priority ordering', () => {
  it('higher priority message is dequeued first', () => {
    const q = createMessageQueue();
    q.enqueue('low', 1);
    q.enqueue('high', 10);
    const first = q.dequeue();
    assert.equal(first.payload, 'high');
  });

  it('messages with equal priority maintain FIFO order', () => {
    const q = createMessageQueue();
    q.enqueue('first', 5);
    q.enqueue('second', 5);
    q.enqueue('third', 5);
    assert.equal(q.dequeue().payload, 'first');
    assert.equal(q.dequeue().payload, 'second');
    assert.equal(q.dequeue().payload, 'third');
  });

  it('mixed priorities are dequeued highest-first', () => {
    const q = createMessageQueue();
    q.enqueue('p1', 1);
    q.enqueue('p3', 3);
    q.enqueue('p2', 2);
    q.enqueue('p5', 5);
    q.enqueue('p4', 4);
    const order = [];
    while (q.size() > 0) order.push(q.dequeue().payload);
    assert.deepEqual(order, ['p5', 'p4', 'p3', 'p2', 'p1']);
  });

  it('default priority is 0', () => {
    const q = createMessageQueue();
    q.enqueue('default');
    const msg = q.peek();
    assert.equal(msg.priority, 0);
  });
});

// ---------------------------------------------------------------------------
// maxSize
// ---------------------------------------------------------------------------
describe('MessageQueue – maxSize', () => {
  it('enqueue throws when queue is full', () => {
    const q = createMessageQueue({ maxSize: 2 });
    q.enqueue('a');
    q.enqueue('b');
    assert.throws(() => q.enqueue('c'), /full/i);
  });

  it('after dequeue there is room to enqueue again', () => {
    const q = createMessageQueue({ maxSize: 1 });
    q.enqueue('first');
    q.dequeue();
    assert.doesNotThrow(() => q.enqueue('second'));
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------
describe('MessageQueue – clear', () => {
  it('clear removes all messages', () => {
    const q = createMessageQueue();
    q.enqueue('a');
    q.enqueue('b');
    q.clear();
    assert.equal(q.size(), 0);
    assert.equal(q.peek(), undefined);
  });

  it('clear on empty queue is safe', () => {
    const q = createMessageQueue();
    assert.doesNotThrow(() => q.clear());
    assert.equal(q.size(), 0);
  });
});

// ---------------------------------------------------------------------------
// process
// ---------------------------------------------------------------------------
describe('MessageQueue – process', () => {
  it('process calls handler for each message', async () => {
    const q = createMessageQueue();
    q.enqueue('x');
    q.enqueue('y');
    q.enqueue('z');
    const processed = [];
    await q.process(async (msg) => { processed.push(msg.payload); });
    assert.deepEqual(processed.sort(), ['x', 'y', 'z']);
  });

  it('process drains the queue', async () => {
    const q = createMessageQueue();
    q.enqueue('a');
    q.enqueue('b');
    await q.process(async () => {});
    assert.equal(q.size(), 0);
  });

  it('process on empty queue resolves immediately', async () => {
    const q = createMessageQueue();
    await q.process(async () => { assert.fail('Should not be called'); });
    assert.ok(true);
  });

  it('process delivers messages in priority order', async () => {
    const q = createMessageQueue({ processConcurrency: 1 });
    q.enqueue('low', 1);
    q.enqueue('high', 10);
    q.enqueue('mid', 5);
    const order = [];
    await q.process(async (msg) => { order.push(msg.payload); });
    assert.deepEqual(order, ['high', 'mid', 'low']);
  });
});

// ---------------------------------------------------------------------------
// dead-letter / retry
// ---------------------------------------------------------------------------
describe('MessageQueue – onDeadLetter and retries', () => {
  it('failed messages beyond maxRetries go to dead-letter handler', async () => {
    const q = createMessageQueue({ maxRetries: 0 });
    const dead = [];
    q.onDeadLetter((msg, err) => dead.push({ msg, err }));
    q.enqueue('fail-me');

    // Process repeatedly until dead-lettered
    // First process: failure → retries=1 > maxRetries=0 → dead letter
    await q.process(async () => { throw new Error('oops'); });

    assert.equal(dead.length, 1);
    assert.equal(dead[0].msg.payload, 'fail-me');
    assert.ok(dead[0].err instanceof Error);
    assert.equal(dead[0].err.message, 'oops');
  });

  it('failed message is re-queued if retries <= maxRetries', async () => {
    const q = createMessageQueue({ maxRetries: 2 });
    q.enqueue('retry-me');

    // First attempt fails → retries becomes 1, re-queued
    await q.process(async () => { throw new Error('try again'); });
    assert.equal(q.size(), 1);
    assert.equal(q.peek().retries, 1);
  });

  it('successful messages are not dead-lettered', async () => {
    const q = createMessageQueue({ maxRetries: 1 });
    const dead = [];
    q.onDeadLetter((msg) => dead.push(msg));
    q.enqueue('ok');
    await q.process(async () => { /* success */ });
    assert.equal(dead.length, 0);
  });

  it('onDeadLetter without handler does not throw on failure', async () => {
    const q = createMessageQueue({ maxRetries: 0 });
    q.enqueue('unhandled-fail');
    // No dead-letter handler registered — should not throw
    await q.process(async () => { throw new Error('boom'); });
    assert.ok(true);
  });
});
