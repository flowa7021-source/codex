// ─── Unit Tests: LamportClock ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LamportClock,
  compareLamport,
  createLamportClock,
} from '../../app/modules/lamport-clock.js';

describe('LamportClock – construction', () => {
  it('factory creates a clock starting at time 0', () => {
    const c = createLamportClock('A');
    assert.equal(c.nodeId, 'A');
    assert.equal(c.time, 0);
  });

  it('constructor accepts an explicit initial time', () => {
    const c = new LamportClock('B', 42);
    assert.equal(c.nodeId, 'B');
    assert.equal(c.time, 42);
  });
});

describe('LamportClock – increment', () => {
  it('increment advances time by 1', () => {
    const c = createLamportClock('A').increment();
    assert.equal(c.time, 1);
  });

  it('multiple increments accumulate', () => {
    const c = createLamportClock('A').increment().increment().increment();
    assert.equal(c.time, 3);
  });

  it('increment returns a new instance (immutability)', () => {
    const c1 = createLamportClock('A');
    const c2 = c1.increment();
    assert.notEqual(c1, c2);
    assert.equal(c1.time, 0);
    assert.equal(c2.time, 1);
  });
});

describe('LamportClock – send', () => {
  it('send increments and returns the new timestamp', () => {
    const c = createLamportClock('A');
    const { clock, timestamp } = c.send();
    assert.equal(timestamp, 1);
    assert.equal(clock.time, 1);
    assert.equal(clock.nodeId, 'A');
  });

  it('send preserves immutability of original', () => {
    const c = createLamportClock('A');
    const { clock } = c.send();
    assert.equal(c.time, 0);
    assert.equal(clock.time, 1);
  });
});

describe('LamportClock – receive', () => {
  it('receive sets time to max(local, remote) + 1', () => {
    const c = createLamportClock('B'); // time = 0
    const r = c.receive(5);            // max(0, 5) + 1 = 6
    assert.equal(r.time, 6);
  });

  it('receive when local is higher still advances', () => {
    const c = new LamportClock('B', 10);
    const r = c.receive(3); // max(10, 3) + 1 = 11
    assert.equal(r.time, 11);
  });

  it('receive when remote equals local', () => {
    const c = new LamportClock('B', 5);
    const r = c.receive(5); // max(5, 5) + 1 = 6
    assert.equal(r.time, 6);
  });
});

describe('LamportClock – clone', () => {
  it('clone produces an independent copy', () => {
    const c = new LamportClock('A', 7);
    const copy = c.clone();
    assert.equal(copy.nodeId, 'A');
    assert.equal(copy.time, 7);
    assert.notEqual(copy, c);
  });

  it('incrementing clone does not affect original', () => {
    const c = new LamportClock('A', 3);
    const copy = c.clone().increment();
    assert.equal(c.time, 3);
    assert.equal(copy.time, 4);
  });
});

describe('compareLamport – total ordering', () => {
  it('earlier time sorts first', () => {
    const a = { nodeId: 'A', time: 1 };
    const b = { nodeId: 'B', time: 5 };
    assert.ok(compareLamport(a, b) < 0);
    assert.ok(compareLamport(b, a) > 0);
  });

  it('equal time ties broken by nodeId', () => {
    const a = { nodeId: 'A', time: 3 };
    const b = { nodeId: 'B', time: 3 };
    assert.ok(compareLamport(a, b) < 0); // 'A' < 'B'
    assert.ok(compareLamport(b, a) > 0);
  });

  it('identical timestamps return 0', () => {
    const a = { nodeId: 'X', time: 10 };
    const b = { nodeId: 'X', time: 10 };
    assert.equal(compareLamport(a, b), 0);
  });

  it('can be used to sort an array of timestamps', () => {
    const stamps = [
      { nodeId: 'C', time: 2 },
      { nodeId: 'A', time: 1 },
      { nodeId: 'B', time: 2 },
      { nodeId: 'A', time: 2 },
    ];
    stamps.sort(compareLamport);
    assert.deepEqual(stamps.map((s) => `${s.nodeId}:${s.time}`), [
      'A:1',
      'A:2',
      'B:2',
      'C:2',
    ]);
  });
});

describe('LamportClock – message passing scenario', () => {
  it('two-node message exchange maintains ordering', () => {
    let a = createLamportClock('A');
    let b = createLamportClock('B');

    // A sends to B
    const send1 = a.send();
    a = send1.clock;                  // A: time=1
    b = b.receive(send1.timestamp);   // B: max(0,1)+1 = 2

    // B sends to A
    const send2 = b.send();
    b = send2.clock;                  // B: time=3
    a = a.receive(send2.timestamp);   // A: max(1,3)+1 = 4

    assert.equal(a.time, 4);
    assert.equal(b.time, 3);

    // Total order: B's send (time 3) < A's receive (time 4)
    assert.ok(
      compareLamport(
        { nodeId: b.nodeId, time: send2.timestamp },
        { nodeId: a.nodeId, time: a.time },
      ) < 0,
    );
  });
});
