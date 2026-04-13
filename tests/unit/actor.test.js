// ─── Unit Tests: ActorSystem ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createActorSystem } from '../../app/modules/actor.js';

// ---------------------------------------------------------------------------
// Basic spawn / state
// ---------------------------------------------------------------------------
describe('ActorSystem – spawn and state', () => {
  it('starts with zero actors', () => {
    const sys = createActorSystem();
    assert.equal(sys.actorCount, 0);
  });

  it('spawn returns a ref and increments actorCount', () => {
    const sys = createActorSystem();
    const ref = sys.spawn('a', 0, (s) => s);
    assert.equal(typeof ref, 'string');
    assert.equal(sys.actorCount, 1);
  });

  it('getState returns initialState before any messages', () => {
    const sys = createActorSystem();
    sys.spawn('counter', 42, (s) => s);
    assert.equal(sys.getState('counter'), 42);
  });

  it('getState returns undefined for unknown ref', () => {
    const sys = createActorSystem();
    assert.equal(sys.getState('ghost'), undefined);
  });

  it('spawning a duplicate name throws', () => {
    const sys = createActorSystem();
    sys.spawn('dup', 0, (s) => s);
    assert.throws(() => sys.spawn('dup', 0, (s) => s), /already exists/);
  });
});

// ---------------------------------------------------------------------------
// send + drain – synchronous behavior
// ---------------------------------------------------------------------------
describe('ActorSystem – send and drain', () => {
  it('send updates state after drain', async () => {
    const sys = createActorSystem();
    sys.spawn('counter', 0, (state, msg) => {
      if (msg.type === 'inc') return state + 1;
      return state;
    });

    sys.send('counter', 'inc');
    await sys.drain();
    assert.equal(sys.getState('counter'), 1);
  });

  it('multiple sends accumulate', async () => {
    const sys = createActorSystem();
    sys.spawn('counter', 0, (state, msg) => {
      if (msg.type === 'inc') return /** @type {number} */(state) + (msg.payload ?? 1);
      return state;
    });

    sys.send('counter', 'inc', 5);
    sys.send('counter', 'inc', 3);
    sys.send('counter', 'inc', 2);
    await sys.drain();
    assert.equal(sys.getState('counter'), 10);
  });

  it('drain resolves immediately when no pending messages', async () => {
    const sys = createActorSystem();
    sys.spawn('idle', null, (s) => s);
    await sys.drain(); // should not hang
    assert.ok(true);
  });

  it('send to unknown actor is silently dropped', async () => {
    const sys = createActorSystem();
    sys.send('nobody', 'ping'); // no throw
    await sys.drain();
    assert.ok(true);
  });
});

// ---------------------------------------------------------------------------
// Async behavior
// ---------------------------------------------------------------------------
describe('ActorSystem – async behavior', () => {
  it('async behavior resolves state correctly', async () => {
    const sys = createActorSystem();
    sys.spawn('async-actor', [], async (state, msg) => {
      if (msg.type === 'fetch') {
        // Simulate async work
        await Promise.resolve();
        return [.../** @type {unknown[]} */(state), msg.payload];
      }
      return state;
    });

    sys.send('async-actor', 'fetch', 'a');
    sys.send('async-actor', 'fetch', 'b');
    await sys.drain();
    assert.deepEqual(sys.getState('async-actor'), ['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Multiple actors passing messages
// ---------------------------------------------------------------------------
describe('ActorSystem – multiple actors', () => {
  it('two actors can co-exist with independent state', async () => {
    const sys = createActorSystem();
    sys.spawn('a', 0, (s, msg) => msg.type === 'inc' ? /** @type {number} */(s) + 1 : s);
    sys.spawn('b', 100, (s, msg) => msg.type === 'dec' ? /** @type {number} */(s) - 1 : s);

    sys.send('a', 'inc');
    sys.send('a', 'inc');
    sys.send('b', 'dec');
    await sys.drain();

    assert.equal(sys.getState('a'), 2);
    assert.equal(sys.getState('b'), 99);
  });

  it('actors process messages in mailbox order (FIFO)', async () => {
    const sys = createActorSystem();
    const order = [];
    sys.spawn('fifo', [], (state, msg) => {
      order.push(msg.payload);
      return [.../** @type {unknown[]} */(state), msg.payload];
    });

    sys.send('fifo', 'item', 1);
    sys.send('fifo', 'item', 2);
    sys.send('fifo', 'item', 3);
    await sys.drain();

    assert.deepEqual(order, [1, 2, 3]);
  });

  it('multiple drain() calls all resolve after processing', async () => {
    const sys = createActorSystem();
    sys.spawn('worker', 0, (s, msg) => msg.type === 'inc' ? /** @type {number} */(s) + 1 : s);

    sys.send('worker', 'inc');
    const [, ] = await Promise.all([sys.drain(), sys.drain()]);
    assert.equal(sys.getState('worker'), 1);
  });
});

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------
describe('ActorSystem – stop', () => {
  it('stop removes the actor', () => {
    const sys = createActorSystem();
    const ref = sys.spawn('temp', 0, (s) => s);
    assert.equal(sys.actorCount, 1);
    sys.stop(ref);
    assert.equal(sys.actorCount, 0);
    assert.equal(sys.getState(ref), undefined);
  });

  it('stop is idempotent', () => {
    const sys = createActorSystem();
    const ref = sys.spawn('temp2', 0, (s) => s);
    sys.stop(ref);
    sys.stop(ref); // no throw
    assert.equal(sys.actorCount, 0);
  });

  it('stopping an actor drains correctly', async () => {
    const sys = createActorSystem();
    sys.spawn('stoppable', 0, (s) => s);
    sys.send('stoppable', 'noop');
    // Stop immediately — drain should still resolve
    sys.stop('stoppable');
    await sys.drain();
    assert.ok(true);
  });
});

// ---------------------------------------------------------------------------
// Payload forwarding
// ---------------------------------------------------------------------------
describe('ActorSystem – message structure', () => {
  it('behavior receives correct message fields', async () => {
    const sys = createActorSystem();
    /** @type {import('../../app/modules/actor.js').Message | null} */
    let captured = null;
    sys.spawn('inspector', null, (s, msg) => {
      captured = msg;
      return s;
    });

    sys.send('inspector', 'ping', { hello: true });
    await sys.drain();

    assert.ok(captured !== null);
    assert.equal(captured.type, 'ping');
    assert.equal(captured.to, 'inspector');
    assert.deepEqual(captured.payload, { hello: true });
  });
});
