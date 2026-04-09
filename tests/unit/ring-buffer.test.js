// ─── Unit Tests: RingBuffer ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RingBuffer,
  createRingBuffer,
} from '../../app/modules/ring-buffer.js';

describe('RingBuffer – construction', () => {
  it('creates an empty buffer with given capacity', () => {
    const rb = new RingBuffer(8);
    assert.equal(rb.capacity, 8);
    assert.equal(rb.available, 0);
    assert.equal(rb.free, 8);
    assert.equal(rb.isEmpty, true);
    assert.equal(rb.isFull, false);
  });

  it('throws on non-positive capacity', () => {
    assert.throws(() => new RingBuffer(0), RangeError);
    assert.throws(() => new RingBuffer(-1), RangeError);
    assert.throws(() => new RingBuffer(1.5), RangeError);
  });
});

describe('RingBuffer – write', () => {
  it('writes values from a number array', () => {
    const rb = new RingBuffer(4);
    const written = rb.write([1, 2, 3]);
    assert.equal(written, 3);
    assert.equal(rb.available, 3);
    assert.equal(rb.free, 1);
  });

  it('writes values from a Float64Array', () => {
    const rb = new RingBuffer(4);
    const written = rb.write(new Float64Array([10, 20]));
    assert.equal(written, 2);
    assert.equal(rb.available, 2);
  });

  it('only writes up to free space', () => {
    const rb = new RingBuffer(3);
    rb.write([1, 2]);
    const written = rb.write([3, 4, 5]);
    assert.equal(written, 1); // only 1 free slot
    assert.equal(rb.available, 3);
    assert.equal(rb.isFull, true);
  });

  it('returns 0 when buffer is full', () => {
    const rb = new RingBuffer(2);
    rb.write([1, 2]);
    assert.equal(rb.write([3]), 0);
  });

  it('returns 0 for empty input', () => {
    const rb = new RingBuffer(4);
    assert.equal(rb.write([]), 0);
    assert.equal(rb.write(new Float64Array(0)), 0);
  });
});

describe('RingBuffer – read', () => {
  it('reads and removes samples', () => {
    const rb = new RingBuffer(4);
    rb.write([10, 20, 30]);
    const out = rb.read(2);
    assert.deepEqual([...out], [10, 20]);
    assert.equal(rb.available, 1);
  });

  it('reads fewer than count when not enough available', () => {
    const rb = new RingBuffer(4);
    rb.write([5, 6]);
    const out = rb.read(10);
    assert.equal(out.length, 2);
    assert.deepEqual([...out], [5, 6]);
    assert.equal(rb.isEmpty, true);
  });

  it('returns Float64Array', () => {
    const rb = new RingBuffer(4);
    rb.write([1]);
    const out = rb.read(1);
    assert.ok(out instanceof Float64Array);
  });
});

describe('RingBuffer – peek', () => {
  it('peeks without removing', () => {
    const rb = new RingBuffer(4);
    rb.write([1, 2, 3]);
    const peeked = rb.peek(2);
    assert.deepEqual([...peeked], [1, 2]);
    assert.equal(rb.available, 3); // unchanged
  });

  it('peek then read returns same data', () => {
    const rb = new RingBuffer(4);
    rb.write([7, 8, 9]);
    const peeked = rb.peek(3);
    const read = rb.read(3);
    assert.deepEqual([...peeked], [...read]);
  });
});

describe('RingBuffer – wrap-around', () => {
  it('handles write wrap-around correctly', () => {
    const rb = new RingBuffer(4);
    rb.write([1, 2, 3]);
    rb.read(2);              // consume 1, 2 → head=2, available=1
    rb.write([4, 5, 6]);     // writes at indices 3, 0, 1 (wraps)
    assert.equal(rb.available, 4);
    assert.equal(rb.isFull, true);
    const out = rb.read(4);
    assert.deepEqual([...out], [3, 4, 5, 6]);
  });

  it('handles read wrap-around correctly', () => {
    const rb = new RingBuffer(3);
    rb.write([1, 2, 3]);
    rb.read(2);            // head=2
    rb.write([4, 5]);      // write at 2(=4) wraps to 0(=5)? No: write at index (2+1)%3=0, ...
    // Actually: head=2, size=1, writeStart=(2+1)%3=0
    // write [4,5]: first at 0, second at 1 → size=3
    const out = rb.read(3);
    assert.deepEqual([...out], [3, 4, 5]);
  });
});

describe('RingBuffer – clear', () => {
  it('resets the buffer to empty', () => {
    const rb = new RingBuffer(4);
    rb.write([1, 2, 3, 4]);
    rb.clear();
    assert.equal(rb.available, 0);
    assert.equal(rb.free, 4);
    assert.equal(rb.isEmpty, true);
    assert.equal(rb.isFull, false);
  });

  it('can write again after clear', () => {
    const rb = new RingBuffer(2);
    rb.write([10, 20]);
    rb.clear();
    rb.write([30]);
    assert.equal(rb.available, 1);
    const out = rb.read(1);
    assert.deepEqual([...out], [30]);
  });
});

describe('RingBuffer – createRingBuffer factory', () => {
  it('returns a RingBuffer instance', () => {
    const rb = createRingBuffer(16);
    assert.ok(rb instanceof RingBuffer);
    assert.equal(rb.capacity, 16);
    assert.equal(rb.isEmpty, true);
  });
});

describe('RingBuffer – interleaved read/write', () => {
  it('handles alternating read and write', () => {
    const rb = new RingBuffer(4);
    rb.write([1, 2]);
    assert.deepEqual([...rb.read(1)], [1]);
    rb.write([3, 4]);
    assert.deepEqual([...rb.read(2)], [2, 3]);
    rb.write([5, 6]);
    assert.deepEqual([...rb.read(3)], [4, 5, 6]);
    assert.equal(rb.isEmpty, true);
  });
});
