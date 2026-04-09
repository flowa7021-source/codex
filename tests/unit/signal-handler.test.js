// ─── Unit Tests: signal-handler ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TypedSignal,
  createSignal,
  SignalGroup,
} from '../../app/modules/signal-handler.js';

// ─── TypedSignal – emit / connect ─────────────────────────────────────────────

describe('TypedSignal – emit and connect', () => {
  it('calls a connected slot with the emitted value', () => {
    const sig = new TypedSignal();
    const received = [];
    sig.connect((v) => received.push(v));
    sig.emit(42);
    assert.deepEqual(received, [42]);
  });

  it('calls multiple slots in connection order', () => {
    const sig = new TypedSignal();
    const order = [];
    sig.connect(() => order.push(1));
    sig.connect(() => order.push(2));
    sig.connect(() => order.push(3));
    sig.emit('x');
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('emitting multiple times calls each slot every time', () => {
    const sig = new TypedSignal();
    let count = 0;
    sig.connect(() => count++);
    sig.emit('a');
    sig.emit('b');
    sig.emit('c');
    assert.equal(count, 3);
  });

  it('emitting with no slots does not throw', () => {
    const sig = new TypedSignal();
    assert.doesNotThrow(() => sig.emit(99));
  });

  it('connect returns a working disconnect function', () => {
    const sig = new TypedSignal();
    const values = [];
    const disconnect = sig.connect((v) => values.push(v));
    sig.emit(1);
    disconnect();
    sig.emit(2);
    assert.deepEqual(values, [1]);
  });

  it('calling the disconnect function twice is a no-op', () => {
    const sig = new TypedSignal();
    const values = [];
    const disconnect = sig.connect((v) => values.push(v));
    disconnect();
    disconnect(); // must not throw
    sig.emit(1);
    assert.deepEqual(values, []);
  });

  it('the same function object can be connected once (Set semantics)', () => {
    const sig = new TypedSignal();
    let count = 0;
    const slot = () => count++;
    sig.connect(slot);
    sig.connect(slot); // duplicate — ignored
    sig.emit('x');
    assert.equal(count, 1);
  });

  it('connectionCount reflects the number of connected slots', () => {
    const sig = new TypedSignal();
    assert.equal(sig.connectionCount, 0);
    const d1 = sig.connect(() => {});
    assert.equal(sig.connectionCount, 1);
    const d2 = sig.connect(() => {});
    assert.equal(sig.connectionCount, 2);
    d1();
    assert.equal(sig.connectionCount, 1);
    d2();
    assert.equal(sig.connectionCount, 0);
  });
});

// ─── TypedSignal – disconnect ─────────────────────────────────────────────────

describe('TypedSignal – disconnect', () => {
  it('disconnect removes a specific slot', () => {
    const sig = new TypedSignal();
    const values = [];
    const slotA = (v) => values.push('A' + v);
    const slotB = (v) => values.push('B' + v);
    sig.connect(slotA);
    sig.connect(slotB);
    sig.disconnect(slotA);
    sig.emit(1);
    assert.deepEqual(values, ['B1']);
  });

  it('disconnect of an unconnected slot is a no-op', () => {
    const sig = new TypedSignal();
    const slot = () => {};
    assert.doesNotThrow(() => sig.disconnect(slot));
  });

  it('disconnectAll removes every slot', () => {
    const sig = new TypedSignal();
    let count = 0;
    sig.connect(() => count++);
    sig.connect(() => count++);
    sig.connect(() => count++);
    sig.disconnectAll();
    sig.emit('x');
    assert.equal(count, 0);
    assert.equal(sig.connectionCount, 0);
  });

  it('can connect new slots after disconnectAll', () => {
    const sig = new TypedSignal();
    sig.connect(() => {});
    sig.disconnectAll();
    const values = [];
    sig.connect((v) => values.push(v));
    sig.emit('hello');
    assert.deepEqual(values, ['hello']);
  });

  it('slots added during emission are not called in that emission', () => {
    const sig = new TypedSignal();
    const order = [];
    sig.connect(() => {
      order.push('first');
      // Adding a new slot mid-emit must not be called this cycle
      sig.connect(() => order.push('late'));
    });
    sig.emit('x');
    assert.deepEqual(order, ['first']);
    // On the next emit the late slot is active
    sig.emit('y');
    assert.ok(order.includes('late'));
  });

  it('removing a slot during emission does not affect current snapshot', () => {
    const sig = new TypedSignal();
    const called = [];
    const slotB = () => called.push('B');
    sig.connect(() => {
      called.push('A');
      sig.disconnect(slotB); // try to cancel B mid-emit
    });
    sig.connect(slotB);
    sig.emit('x');
    // B was in the snapshot so it still runs this time
    assert.deepEqual(called, ['A', 'B']);
    // On next emit B is gone
    const called2 = [];
    sig.connect(() => called2.push('A2'));
    sig.emit('y');
    assert.ok(!called2.includes('B'));
  });
});

// ─── TypedSignal – once ───────────────────────────────────────────────────────

describe('TypedSignal – once', () => {
  it('fires the slot exactly once', () => {
    const sig = new TypedSignal();
    let count = 0;
    sig.once(() => count++);
    sig.emit('a');
    sig.emit('b');
    sig.emit('c');
    assert.equal(count, 1);
  });

  it('once slot receives the correct value', () => {
    const sig = new TypedSignal();
    let received;
    sig.once((v) => { received = v; });
    sig.emit('hello');
    assert.equal(received, 'hello');
  });

  it('once disconnect function prevents the slot from ever firing', () => {
    const sig = new TypedSignal();
    let count = 0;
    const cancel = sig.once(() => count++);
    cancel();
    sig.emit('x');
    assert.equal(count, 0);
  });

  it('once does not affect other connected slots', () => {
    const sig = new TypedSignal();
    let onceCount = 0;
    let alwaysCount = 0;
    sig.once(() => onceCount++);
    sig.connect(() => alwaysCount++);
    sig.emit(1);
    sig.emit(2);
    sig.emit(3);
    assert.equal(onceCount, 1);
    assert.equal(alwaysCount, 3);
  });

  it('connectionCount decrements after the once slot fires', () => {
    const sig = new TypedSignal();
    sig.once(() => {});
    assert.equal(sig.connectionCount, 1);
    sig.emit('x');
    assert.equal(sig.connectionCount, 0);
  });

  it('multiple once slots each fire only once', () => {
    const sig = new TypedSignal();
    const counts = [0, 0, 0];
    sig.once(() => counts[0]++);
    sig.once(() => counts[1]++);
    sig.once(() => counts[2]++);
    sig.emit('a');
    sig.emit('b');
    assert.deepEqual(counts, [1, 1, 1]);
  });

  it('once slot called in connection order with regular slots', () => {
    const sig = new TypedSignal();
    const order = [];
    sig.connect(() => order.push('regular'));
    sig.once(() => order.push('once'));
    sig.emit('x');
    assert.deepEqual(order, ['regular', 'once']);
  });

  it('once returns a disconnect function that is a no-op after firing', () => {
    const sig = new TypedSignal();
    let count = 0;
    const cancel = sig.once(() => count++);
    sig.emit('x'); // fires; slot auto-removed
    cancel();      // must not throw
    sig.emit('y');
    assert.equal(count, 1);
  });
});

// ─── TypedSignal – pipe ───────────────────────────────────────────────────────

describe('TypedSignal – pipe', () => {
  it('forwards emissions to the target signal', () => {
    const src = new TypedSignal();
    const dst = new TypedSignal();
    const values = [];
    dst.connect((v) => values.push(v));
    src.pipe(dst);
    src.emit(7);
    src.emit(8);
    assert.deepEqual(values, [7, 8]);
  });

  it('pipe returns a disconnect function that stops forwarding', () => {
    const src = new TypedSignal();
    const dst = new TypedSignal();
    const values = [];
    dst.connect((v) => values.push(v));
    const stopPipe = src.pipe(dst);
    src.emit(1);
    stopPipe();
    src.emit(2);
    assert.deepEqual(values, [1]);
  });

  it('direct listeners on src still fire after pipe is stopped', () => {
    const src = new TypedSignal();
    const dst = new TypedSignal();
    const srcValues = [];
    const dstValues = [];
    src.connect((v) => srcValues.push(v));
    dst.connect((v) => dstValues.push(v));
    const stopPipe = src.pipe(dst);
    src.emit('a');
    stopPipe();
    src.emit('b');
    assert.deepEqual(srcValues, ['a', 'b']);
    assert.deepEqual(dstValues, ['a']);
  });

  it('chaining: A.pipe(B).pipe disconnects only A→B link', () => {
    const a = new TypedSignal();
    const b = new TypedSignal();
    const c = new TypedSignal();
    const cValues = [];
    c.connect((v) => cValues.push(v));
    const stopAB = a.pipe(b);
    b.pipe(c);
    a.emit(1);
    stopAB(); // A no longer forwards to B (or C)
    a.emit(2);
    b.emit(3); // B→C still works
    assert.deepEqual(cValues, [1, 3]);
  });

  it('pipe adds exactly one slot to the source', () => {
    const src = new TypedSignal();
    const dst = new TypedSignal();
    assert.equal(src.connectionCount, 0);
    src.pipe(dst);
    assert.equal(src.connectionCount, 1);
  });

  it('multiple pipes from the same source all forward', () => {
    const src = new TypedSignal();
    const dst1 = new TypedSignal();
    const dst2 = new TypedSignal();
    const v1 = [];
    const v2 = [];
    dst1.connect((v) => v1.push(v));
    dst2.connect((v) => v2.push(v));
    src.pipe(dst1);
    src.pipe(dst2);
    src.emit('hello');
    assert.deepEqual(v1, ['hello']);
    assert.deepEqual(v2, ['hello']);
  });

  it('disconnectAll on src removes pipe forwarding too', () => {
    const src = new TypedSignal();
    const dst = new TypedSignal();
    const values = [];
    dst.connect((v) => values.push(v));
    src.pipe(dst);
    src.emit(1);
    src.disconnectAll();
    src.emit(2);
    assert.deepEqual(values, [1]);
  });
});

// ─── createSignal factory ─────────────────────────────────────────────────────

describe('createSignal – factory', () => {
  it('returns a TypedSignal instance', () => {
    const sig = createSignal();
    assert.ok(sig instanceof TypedSignal);
  });

  it('the created signal is immediately usable', () => {
    const sig = createSignal();
    const values = [];
    sig.connect((v) => values.push(v));
    sig.emit('test');
    assert.deepEqual(values, ['test']);
  });

  it('each call returns a distinct signal', () => {
    const a = createSignal();
    const b = createSignal();
    assert.notEqual(a, b);
  });
});

// ─── SignalGroup ──────────────────────────────────────────────────────────────

describe('SignalGroup – add and disconnectAll', () => {
  it('add returns the same signal for chaining', () => {
    const group = new SignalGroup();
    const sig = new TypedSignal();
    const returned = group.add(sig);
    assert.equal(returned, sig);
  });

  it('disconnectAll removes all slots from every tracked signal', () => {
    const group = new SignalGroup();
    const sigA = new TypedSignal();
    const sigB = new TypedSignal();
    let countA = 0;
    let countB = 0;
    group.add(sigA).connect(() => countA++);
    group.add(sigB).connect(() => countB++);
    group.disconnectAll();
    sigA.emit('x');
    sigB.emit('y');
    assert.equal(countA, 0);
    assert.equal(countB, 0);
  });

  it('disconnectAll on an empty group does not throw', () => {
    const group = new SignalGroup();
    assert.doesNotThrow(() => group.disconnectAll());
  });

  it('signals can still accept new connections after group disconnectAll', () => {
    const group = new SignalGroup();
    const sig = new TypedSignal();
    group.add(sig);
    group.disconnectAll();
    const values = [];
    sig.connect((v) => values.push(v));
    sig.emit('fresh');
    assert.deepEqual(values, ['fresh']);
  });

  it('tracking the same signal twice disconnects it once (clearing all slots)', () => {
    const group = new SignalGroup();
    const sig = new TypedSignal();
    group.add(sig);
    group.add(sig); // duplicate reference
    let count = 0;
    sig.connect(() => count++);
    group.disconnectAll(); // calls disconnectAll twice; second is harmless
    sig.emit('x');
    assert.equal(count, 0);
  });

  it('multiple groups can each track the same signal independently', () => {
    const g1 = new SignalGroup();
    const g2 = new SignalGroup();
    const sig = new TypedSignal();
    g1.add(sig);
    g2.add(sig);
    let count = 0;
    sig.connect(() => count++);
    g1.disconnectAll(); // clears slots
    sig.emit('x');
    assert.equal(count, 0); // g1 cleared
    // g2 is now tracking a signal with no slots — disconnectAll is still safe
    assert.doesNotThrow(() => g2.disconnectAll());
  });

  it('add works with different generic types in the same group', () => {
    const group = new SignalGroup();
    const numSig = new TypedSignal();
    const strSig = new TypedSignal();
    const nums = [];
    const strs = [];
    group.add(numSig).connect((v) => nums.push(v));
    group.add(strSig).connect((v) => strs.push(v));
    numSig.emit(1);
    strSig.emit('a');
    group.disconnectAll();
    numSig.emit(2);
    strSig.emit('b');
    assert.deepEqual(nums, [1]);
    assert.deepEqual(strs, ['a']);
  });

  it('connectionCount is 0 on all group signals after disconnectAll', () => {
    const group = new SignalGroup();
    const s1 = new TypedSignal();
    const s2 = new TypedSignal();
    group.add(s1).connect(() => {});
    group.add(s1).connect(() => {}); // s1 added twice but same Set — 1 slot
    group.add(s2).connect(() => {});
    group.disconnectAll();
    assert.equal(s1.connectionCount, 0);
    assert.equal(s2.connectionCount, 0);
  });
});
