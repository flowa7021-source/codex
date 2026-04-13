// ─── Unit Tests: Channel ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Channel, select, pipe, fanOut } from '../../app/modules/channel.js';

// ---------------------------------------------------------------------------
// Constructor / basic properties
// ---------------------------------------------------------------------------
describe('Channel – constructor', () => {
  it('creates an unbuffered channel by default', () => {
    const ch = new Channel();
    assert.equal(ch.capacity, 0);
    assert.equal(ch.buffered, 0);
    assert.equal(ch.closed, false);
  });

  it('creates a buffered channel', () => {
    const ch = new Channel(4);
    assert.equal(ch.capacity, 4);
    assert.equal(ch.buffered, 0);
  });

  it('throws for negative buffer size', () => {
    assert.throws(() => new Channel(-1), /bufferSize must be/);
  });
});

// ---------------------------------------------------------------------------
// Buffered send / receive
// ---------------------------------------------------------------------------
describe('Channel – buffered send/receive', () => {
  it('trySend returns true while buffer has space', () => {
    const ch = new Channel(3);
    assert.equal(ch.trySend(1), true);
    assert.equal(ch.trySend(2), true);
    assert.equal(ch.trySend(3), true);
    assert.equal(ch.buffered, 3);
    assert.equal(ch.trySend(4), false); // full
  });

  it('tryReceive drains buffer in FIFO order', () => {
    const ch = new Channel(3);
    ch.trySend(10);
    ch.trySend(20);
    ch.trySend(30);

    assert.equal(ch.tryReceive(), 10);
    assert.equal(ch.tryReceive(), 20);
    assert.equal(ch.tryReceive(), 30);
    assert.equal(ch.tryReceive(), undefined);
  });

  it('send resolves immediately when buffer has space', async () => {
    const ch = new Channel(2);
    await ch.send(1);
    await ch.send(2);
    assert.equal(ch.buffered, 2);
  });

  it('receive resolves buffered values in order', async () => {
    const ch = new Channel(3);
    await ch.send('a');
    await ch.send('b');
    await ch.send('c');

    assert.equal(await ch.receive(), 'a');
    assert.equal(await ch.receive(), 'b');
    assert.equal(await ch.receive(), 'c');
  });

  it('send blocks when buffer is full and unblocks on receive', async () => {
    const ch = new Channel(1);
    await ch.send('first');

    let secondSent = false;
    const sendPromise = ch.send('second').then(() => {
      secondSent = true;
    });

    // second send is blocked
    assert.equal(secondSent, false);

    // drain first value
    const val = await ch.receive();
    assert.equal(val, 'first');

    await sendPromise;
    assert.equal(secondSent, true);
    assert.equal(ch.buffered, 1);
  });
});

// ---------------------------------------------------------------------------
// Unbuffered channel
// ---------------------------------------------------------------------------
describe('Channel – unbuffered', () => {
  it('send blocks until receiver is ready', async () => {
    const ch = new Channel(0); // unbuffered
    let received;

    const recvPromise = ch.receive().then((v) => {
      received = v;
    });

    // nothing received yet
    assert.equal(received, undefined);

    await ch.send(42);
    await recvPromise;
    assert.equal(received, 42);
  });

  it('receive blocks until sender sends', async () => {
    const ch = new Channel(0);
    let sent = false;

    const recvPromise = ch.receive();

    // send after a tick
    const sendPromise = Promise.resolve().then(async () => {
      await ch.send(99);
      sent = true;
    });

    const val = await recvPromise;
    assert.equal(val, 99);
    // Wait for the sender side-effect to complete before asserting `sent`
    await sendPromise;
    assert.equal(sent, true);
  });

  it('trySend returns false on unbuffered channel with no receiver', () => {
    const ch = new Channel(0);
    assert.equal(ch.trySend('x'), false);
  });

  it('trySend succeeds on unbuffered channel when receiver is waiting', async () => {
    const ch = new Channel(0);
    const recvPromise = ch.receive();
    assert.equal(ch.trySend('hello'), true);
    assert.equal(await recvPromise, 'hello');
  });
});

// ---------------------------------------------------------------------------
// Close behaviour
// ---------------------------------------------------------------------------
describe('Channel – close', () => {
  it('closed getter reflects close()', () => {
    const ch = new Channel(2);
    assert.equal(ch.closed, false);
    ch.close();
    assert.equal(ch.closed, true);
  });

  it('close is idempotent', () => {
    const ch = new Channel(1);
    ch.close();
    ch.close(); // no throw
    assert.equal(ch.closed, true);
  });

  it('send on closed channel rejects', async () => {
    const ch = new Channel(2);
    ch.close();
    await assert.rejects(() => ch.send(1), /closed/);
  });

  it('trySend on closed channel returns false', () => {
    const ch = new Channel(2);
    ch.close();
    assert.equal(ch.trySend(1), false);
  });

  it('buffered values can still be received after close', async () => {
    const ch = new Channel(3);
    ch.trySend(1);
    ch.trySend(2);
    ch.close();

    assert.equal(await ch.receive(), 1);
    assert.equal(await ch.receive(), 2);
    // now empty and closed
    await assert.rejects(() => ch.receive(), /closed/);
  });

  it('pending sender is rejected when channel is closed', async () => {
    const ch = new Channel(0); // unbuffered, no receiver
    const sendPromise = ch.send('x');
    ch.close();
    await assert.rejects(() => sendPromise, /closed/);
  });

  it('pending receiver is rejected when channel is closed', async () => {
    const ch = new Channel(0);
    const recvPromise = ch.receive();
    ch.close();
    await assert.rejects(() => recvPromise, /closed/);
  });
});

// ---------------------------------------------------------------------------
// select
// ---------------------------------------------------------------------------
describe('select', () => {
  it('returns null for empty channel list', async () => {
    const result = await select([]);
    assert.equal(result, null);
  });

  it('picks the ready channel immediately', async () => {
    const ch1 = new Channel(1);
    const ch2 = new Channel(1);
    ch2.trySend('ready');

    const result = await select([ch1, ch2]);
    assert.ok(result !== null);
    assert.equal(result.value, 'ready');
    assert.equal(result.index, 1);
  });

  it('waits for first available channel', async () => {
    const ch1 = new Channel(1);
    const ch2 = new Channel(1);

    // Send to ch1 asynchronously
    Promise.resolve().then(() => ch1.trySend('from-ch1'));

    const result = await select([ch1, ch2]);
    assert.ok(result !== null);
    assert.equal(result.value, 'from-ch1');
    assert.equal(result.index, 0);
  });

  it('returns null on timeout when no channel ready', async () => {
    const ch1 = new Channel(0);
    const result = await select([ch1], 20);
    assert.equal(result, null);
  });

  it('resolves before timeout if channel becomes ready', async () => {
    const ch = new Channel(0);
    setTimeout(() => ch.trySend('hi'), 10);
    const result = await select([ch], 200);
    assert.ok(result !== null);
    assert.equal(result.value, 'hi');
  });
});

// ---------------------------------------------------------------------------
// pipe
// ---------------------------------------------------------------------------
describe('pipe', () => {
  it('transfers all buffered values from source to destination', async () => {
    const src = new Channel(4);
    const dst = new Channel(4);

    src.trySend(1);
    src.trySend(2);
    src.trySend(3);
    src.close();

    await pipe(src, dst);

    assert.equal(dst.tryReceive(), 1);
    assert.equal(dst.tryReceive(), 2);
    assert.equal(dst.tryReceive(), 3);
    assert.equal(dst.tryReceive(), undefined);
  });

  it('pipe stops when source closes', async () => {
    const src = new Channel(2);
    const dst = new Channel(2);

    src.trySend('x');
    src.trySend('y');
    src.close();

    await pipe(src, dst);
    assert.equal(dst.buffered, 2);
  });
});

// ---------------------------------------------------------------------------
// fanOut
// ---------------------------------------------------------------------------
describe('fanOut', () => {
  it('sends each value to all destinations', async () => {
    const src = new Channel(3);
    const d1 = new Channel(3);
    const d2 = new Channel(3);

    src.trySend('a');
    src.trySend('b');
    src.close();

    await fanOut(src, d1, d2);

    assert.equal(d1.tryReceive(), 'a');
    assert.equal(d1.tryReceive(), 'b');
    assert.equal(d2.tryReceive(), 'a');
    assert.equal(d2.tryReceive(), 'b');
  });

  it('fanOut with zero destinations just drains source', async () => {
    const src = new Channel(2);
    src.trySend(1);
    src.trySend(2);
    src.close();

    await fanOut(src); // no destinations
    assert.equal(src.buffered, 0);
    assert.ok(true);
  });
});
