// ─── Unit Tests: CircularBuffer ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CircularBuffer,
  createCircularBuffer,
} from '../../app/modules/circular-buffer.js';

describe('CircularBuffer – construction', () => {
  it('creates an empty buffer with given capacity', () => {
    const buf = new CircularBuffer(5);
    assert.equal(buf.capacity, 5);
    assert.equal(buf.size, 0);
    assert.equal(buf.isEmpty, true);
    assert.equal(buf.isFull, false);
  });

  it('throws on non-positive capacity', () => {
    assert.throws(() => new CircularBuffer(0), RangeError);
    assert.throws(() => new CircularBuffer(-1), RangeError);
    assert.throws(() => new CircularBuffer(1.5), RangeError);
  });
});

describe('CircularBuffer – push and size tracking', () => {
  it('tracks size as items are pushed', () => {
    const buf = new CircularBuffer(3);
    buf.push('a');
    assert.equal(buf.size, 1);
    buf.push('b');
    assert.equal(buf.size, 2);
    buf.push('c');
    assert.equal(buf.size, 3);
    assert.equal(buf.isFull, true);
  });

  it('overwrites oldest when full', () => {
    const buf = new CircularBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // overwrites 1
    assert.equal(buf.size, 3);
    assert.deepEqual(buf.toArray(), [2, 3, 4]);
  });

  it('multiple overwrites cycle correctly', () => {
    const buf = new CircularBuffer(2);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    buf.push('d');
    buf.push('e');
    assert.deepEqual(buf.toArray(), ['d', 'e']);
  });
});

describe('CircularBuffer – shift', () => {
  it('removes and returns front element', () => {
    const buf = new CircularBuffer(3);
    buf.push(10);
    buf.push(20);
    assert.equal(buf.shift(), 10);
    assert.equal(buf.size, 1);
    assert.equal(buf.shift(), 20);
    assert.equal(buf.size, 0);
  });

  it('returns undefined on empty buffer', () => {
    const buf = new CircularBuffer(2);
    assert.equal(buf.shift(), undefined);
  });
});

describe('CircularBuffer – peek / peekBack', () => {
  it('peeks at front without removing', () => {
    const buf = new CircularBuffer(3);
    buf.push('x');
    buf.push('y');
    assert.equal(buf.peek(), 'x');
    assert.equal(buf.size, 2);
  });

  it('peekBack returns newest element', () => {
    const buf = new CircularBuffer(3);
    buf.push('x');
    buf.push('y');
    assert.equal(buf.peekBack(), 'y');
  });

  it('peek and peekBack return undefined when empty', () => {
    const buf = new CircularBuffer(1);
    assert.equal(buf.peek(), undefined);
    assert.equal(buf.peekBack(), undefined);
  });
});

describe('CircularBuffer – get', () => {
  it('accesses elements by logical index', () => {
    const buf = new CircularBuffer(4);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    assert.equal(buf.get(0), 'a');
    assert.equal(buf.get(1), 'b');
    assert.equal(buf.get(2), 'c');
  });

  it('returns undefined for out-of-range index', () => {
    const buf = new CircularBuffer(3);
    buf.push(1);
    assert.equal(buf.get(-1), undefined);
    assert.equal(buf.get(1), undefined);
    assert.equal(buf.get(100), undefined);
  });

  it('correct indices after wrap-around', () => {
    const buf = new CircularBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // overwrites 1
    buf.push(5); // overwrites 2
    assert.equal(buf.get(0), 3);
    assert.equal(buf.get(1), 4);
    assert.equal(buf.get(2), 5);
  });
});

describe('CircularBuffer – clear', () => {
  it('resets the buffer to empty', () => {
    const buf = new CircularBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.clear();
    assert.equal(buf.size, 0);
    assert.equal(buf.isEmpty, true);
    assert.equal(buf.peek(), undefined);
    assert.deepEqual(buf.toArray(), []);
  });
});

describe('CircularBuffer – toArray', () => {
  it('returns elements in logical order', () => {
    const buf = new CircularBuffer(5);
    buf.push(10);
    buf.push(20);
    buf.push(30);
    assert.deepEqual(buf.toArray(), [10, 20, 30]);
  });

  it('returns empty array for empty buffer', () => {
    assert.deepEqual(new CircularBuffer(3).toArray(), []);
  });
});

describe('CircularBuffer – Symbol.iterator', () => {
  it('iterates in front-to-back order', () => {
    const buf = new CircularBuffer(4);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    assert.deepEqual([...buf], ['a', 'b', 'c']);
  });

  it('works with for-of after wrap-around', () => {
    const buf = new CircularBuffer(2);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    const result = [];
    for (const v of buf) result.push(v);
    assert.deepEqual(result, [2, 3]);
  });
});

describe('CircularBuffer – createCircularBuffer factory', () => {
  it('returns a CircularBuffer instance', () => {
    const buf = createCircularBuffer(5);
    assert.ok(buf instanceof CircularBuffer);
    assert.equal(buf.capacity, 5);
  });
});

describe('CircularBuffer – mixed push/shift operations', () => {
  it('handles interleaved push and shift', () => {
    const buf = new CircularBuffer(3);
    buf.push(1);
    buf.push(2);
    assert.equal(buf.shift(), 1);
    buf.push(3);
    buf.push(4);
    assert.equal(buf.shift(), 2);
    assert.equal(buf.shift(), 3);
    assert.equal(buf.shift(), 4);
    assert.equal(buf.isEmpty, true);
  });
});
