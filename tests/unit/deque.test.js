// ─── Unit Tests: Deque ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Deque, createDeque } from '../../app/modules/deque.js';

describe('Deque – construction', () => {
  it('creates an empty deque by default', () => {
    const dq = new Deque();
    assert.equal(dq.size, 0);
    assert.equal(dq.isEmpty, true);
  });

  it('creates a deque from initial items', () => {
    const dq = new Deque([10, 20, 30]);
    assert.equal(dq.size, 3);
    assert.deepEqual(dq.toArray(), [10, 20, 30]);
  });
});

describe('Deque – pushBack / popFront (queue behavior)', () => {
  it('operates as a FIFO queue', () => {
    const dq = new Deque();
    dq.pushBack('a');
    dq.pushBack('b');
    dq.pushBack('c');
    assert.equal(dq.popFront(), 'a');
    assert.equal(dq.popFront(), 'b');
    assert.equal(dq.popFront(), 'c');
    assert.equal(dq.isEmpty, true);
  });
});

describe('Deque – pushFront / popBack (stack behavior)', () => {
  it('operates as a LIFO stack from the front', () => {
    const dq = new Deque();
    dq.pushFront(1);
    dq.pushFront(2);
    dq.pushFront(3);
    assert.equal(dq.popFront(), 3);
    assert.equal(dq.popFront(), 2);
    assert.equal(dq.popFront(), 1);
  });
});

describe('Deque – pushFront / popFront', () => {
  it('pushFront then popFront returns items in reverse insertion order', () => {
    const dq = new Deque();
    dq.pushFront('x');
    dq.pushFront('y');
    dq.pushFront('z');
    assert.deepEqual(dq.toArray(), ['z', 'y', 'x']);
  });
});

describe('Deque – popBack', () => {
  it('removes and returns the back element', () => {
    const dq = new Deque([1, 2, 3]);
    assert.equal(dq.popBack(), 3);
    assert.equal(dq.popBack(), 2);
    assert.equal(dq.size, 1);
  });

  it('returns undefined on empty deque', () => {
    assert.equal(new Deque().popBack(), undefined);
  });
});

describe('Deque – popFront returns undefined when empty', () => {
  it('returns undefined', () => {
    assert.equal(new Deque().popFront(), undefined);
  });
});

describe('Deque – peekFront / peekBack', () => {
  it('peekFront returns front without removing', () => {
    const dq = new Deque([10, 20]);
    assert.equal(dq.peekFront(), 10);
    assert.equal(dq.size, 2);
  });

  it('peekBack returns back without removing', () => {
    const dq = new Deque([10, 20]);
    assert.equal(dq.peekBack(), 20);
    assert.equal(dq.size, 2);
  });

  it('both return undefined on empty deque', () => {
    const dq = new Deque();
    assert.equal(dq.peekFront(), undefined);
    assert.equal(dq.peekBack(), undefined);
  });
});

describe('Deque – get', () => {
  it('accesses elements by logical index', () => {
    const dq = new Deque(['a', 'b', 'c']);
    assert.equal(dq.get(0), 'a');
    assert.equal(dq.get(1), 'b');
    assert.equal(dq.get(2), 'c');
  });

  it('returns undefined for out-of-range index', () => {
    const dq = new Deque([1]);
    assert.equal(dq.get(-1), undefined);
    assert.equal(dq.get(1), undefined);
  });

  it('correct after pushFront shifts indices', () => {
    const dq = new Deque([2, 3]);
    dq.pushFront(1);
    assert.equal(dq.get(0), 1);
    assert.equal(dq.get(1), 2);
    assert.equal(dq.get(2), 3);
  });
});

describe('Deque – clear', () => {
  it('resets to empty', () => {
    const dq = new Deque([1, 2, 3]);
    dq.clear();
    assert.equal(dq.size, 0);
    assert.equal(dq.isEmpty, true);
    assert.deepEqual(dq.toArray(), []);
  });
});

describe('Deque – toArray', () => {
  it('returns snapshot in front-to-back order', () => {
    const dq = new Deque();
    dq.pushBack(3);
    dq.pushFront(1);
    dq.pushBack(4);
    dq.pushFront(0);
    assert.deepEqual(dq.toArray(), [0, 1, 3, 4]);
  });

  it('returns empty array for empty deque', () => {
    assert.deepEqual(new Deque().toArray(), []);
  });
});

describe('Deque – Symbol.iterator', () => {
  it('iterates front-to-back', () => {
    const dq = new Deque([10, 20, 30]);
    assert.deepEqual([...dq], [10, 20, 30]);
  });

  it('works with for-of', () => {
    const dq = new Deque();
    dq.pushFront(1);
    dq.pushBack(2);
    const result = [];
    for (const v of dq) result.push(v);
    assert.deepEqual(result, [1, 2]);
  });
});

describe('Deque – createDeque factory', () => {
  it('returns a Deque instance without initial items', () => {
    const dq = createDeque();
    assert.ok(dq instanceof Deque);
    assert.equal(dq.size, 0);
  });

  it('returns a Deque instance with initial items', () => {
    const dq = createDeque([5, 6, 7]);
    assert.ok(dq instanceof Deque);
    assert.deepEqual(dq.toArray(), [5, 6, 7]);
  });
});

describe('Deque – internal growth', () => {
  it('grows beyond initial capacity', () => {
    const dq = new Deque();
    for (let i = 0; i < 100; i++) dq.pushBack(i);
    assert.equal(dq.size, 100);
    assert.equal(dq.peekFront(), 0);
    assert.equal(dq.peekBack(), 99);
    for (let i = 0; i < 100; i++) {
      assert.equal(dq.popFront(), i);
    }
    assert.equal(dq.isEmpty, true);
  });

  it('grows correctly with mixed pushFront and pushBack', () => {
    const dq = new Deque();
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) dq.pushFront(i);
      else dq.pushBack(i);
    }
    assert.equal(dq.size, 20);
    // Front elements should be even numbers in reverse, back elements odd in order
    const arr = dq.toArray();
    assert.equal(arr.length, 20);
    assert.equal(arr[0], 18); // last even pushed to front
    assert.equal(arr[arr.length - 1], 19); // last odd pushed to back
  });
});
