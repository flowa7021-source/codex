// ─── Unit Tests: Linked Lists ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LinkedList,
  DoublyLinkedList,
  createLinkedList,
  createDoublyLinkedList,
} from '../../app/modules/linked-list.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LinkedList — prepend / append / size / head / tail
// ═══════════════════════════════════════════════════════════════════════════════

describe('LinkedList – prepend / append / size / head / tail', () => {
  it('starts empty', () => {
    const list = new LinkedList();
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
  });

  it('append increases size', () => {
    const list = new LinkedList();
    list.append(1);
    assert.equal(list.size, 1);
    list.append(2);
    assert.equal(list.size, 2);
  });

  it('append sets head and tail on first insert', () => {
    const list = new LinkedList();
    list.append('a');
    assert.equal(list.head, 'a');
    assert.equal(list.tail, 'a');
  });

  it('append updates tail but keeps head', () => {
    const list = new LinkedList();
    list.append(1);
    list.append(2);
    list.append(3);
    assert.equal(list.head, 1);
    assert.equal(list.tail, 3);
  });

  it('prepend sets head and tail on first insert', () => {
    const list = new LinkedList();
    list.prepend(42);
    assert.equal(list.head, 42);
    assert.equal(list.tail, 42);
  });

  it('prepend updates head but keeps tail', () => {
    const list = new LinkedList();
    list.append(2);
    list.prepend(1);
    assert.equal(list.head, 1);
    assert.equal(list.tail, 2);
    assert.equal(list.size, 2);
  });

  it('mixed prepend/append ordering is correct', () => {
    const list = new LinkedList();
    list.append(2);
    list.prepend(1);
    list.append(3);
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LinkedList — insertAt / removeHead / removeTail / removeAt / removeValue
// ═══════════════════════════════════════════════════════════════════════════════

describe('LinkedList – insertAt', () => {
  it('inserts at index 0 in a non-empty list', () => {
    const list = createLinkedList([1, 2, 3]);
    list.insertAt(0, 0);
    assert.deepEqual(list.toArray(), [0, 1, 2, 3]);
  });

  it('inserts at last index (same as append)', () => {
    const list = createLinkedList([1, 2, 3]);
    list.insertAt(3, 4);
    assert.deepEqual(list.toArray(), [1, 2, 3, 4]);
  });

  it('inserts in the middle', () => {
    const list = createLinkedList([1, 3]);
    list.insertAt(1, 2);
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });

  it('throws RangeError for negative index', () => {
    const list = new LinkedList();
    assert.throws(() => list.insertAt(-1, 'x'), RangeError);
  });

  it('throws RangeError for index beyond size', () => {
    const list = createLinkedList([1, 2]);
    assert.throws(() => list.insertAt(5, 'x'), RangeError);
  });

  it('insertAt 0 on empty list works like prepend', () => {
    const list = new LinkedList();
    list.insertAt(0, 99);
    assert.equal(list.head, 99);
    assert.equal(list.tail, 99);
    assert.equal(list.size, 1);
  });
});

describe('LinkedList – removeHead / removeTail', () => {
  it('removeHead on empty list returns undefined', () => {
    assert.equal(new LinkedList().removeHead(), undefined);
  });

  it('removeTail on empty list returns undefined', () => {
    assert.equal(new LinkedList().removeTail(), undefined);
  });

  it('removeHead returns head value and removes it', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.removeHead(), 1);
    assert.equal(list.size, 2);
    assert.equal(list.head, 2);
  });

  it('removeTail returns tail value and removes it', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.removeTail(), 3);
    assert.equal(list.size, 2);
    assert.equal(list.tail, 2);
  });

  it('removeHead on single-element list clears head and tail', () => {
    const list = createLinkedList([5]);
    list.removeHead();
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
    assert.equal(list.size, 0);
  });

  it('removeTail on single-element list clears head and tail', () => {
    const list = createLinkedList([5]);
    list.removeTail();
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
    assert.equal(list.size, 0);
  });
});

describe('LinkedList – removeAt', () => {
  it('returns undefined for out-of-bounds index', () => {
    const list = createLinkedList([1, 2]);
    assert.equal(list.removeAt(5), undefined);
    assert.equal(list.removeAt(-1), undefined);
  });

  it('removes the first element', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.removeAt(0), 1);
    assert.deepEqual(list.toArray(), [2, 3]);
  });

  it('removes the last element', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.removeAt(2), 3);
    assert.deepEqual(list.toArray(), [1, 2]);
  });

  it('removes a middle element', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.removeAt(1), 2);
    assert.deepEqual(list.toArray(), [1, 3]);
  });
});

describe('LinkedList – removeValue', () => {
  it('returns false when value not found', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.removeValue(99), false);
    assert.equal(list.size, 3);
  });

  it('returns true and removes first occurrence', () => {
    const list = createLinkedList([1, 2, 3, 2]);
    assert.equal(list.removeValue(2), true);
    assert.deepEqual(list.toArray(), [1, 3, 2]);
  });

  it('removes head value', () => {
    const list = createLinkedList([10, 20, 30]);
    assert.equal(list.removeValue(10), true);
    assert.equal(list.head, 20);
  });

  it('removes tail value', () => {
    const list = createLinkedList([10, 20, 30]);
    assert.equal(list.removeValue(30), true);
    assert.equal(list.tail, 20);
  });

  it('returns false on empty list', () => {
    assert.equal(new LinkedList().removeValue(1), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LinkedList — getAt / indexOf / contains
// ═══════════════════════════════════════════════════════════════════════════════

describe('LinkedList – getAt / indexOf / contains', () => {
  it('getAt returns correct value', () => {
    const list = createLinkedList(['a', 'b', 'c']);
    assert.equal(list.getAt(0), 'a');
    assert.equal(list.getAt(1), 'b');
    assert.equal(list.getAt(2), 'c');
  });

  it('getAt returns undefined for out-of-bounds', () => {
    const list = createLinkedList([1, 2]);
    assert.equal(list.getAt(-1), undefined);
    assert.equal(list.getAt(2), undefined);
  });

  it('indexOf returns correct index', () => {
    const list = createLinkedList([10, 20, 30]);
    assert.equal(list.indexOf(10), 0);
    assert.equal(list.indexOf(20), 1);
    assert.equal(list.indexOf(30), 2);
  });

  it('indexOf returns -1 when not found', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.equal(list.indexOf(99), -1);
  });

  it('indexOf returns first occurrence for duplicates', () => {
    const list = createLinkedList([1, 2, 1]);
    assert.equal(list.indexOf(1), 0);
  });

  it('contains returns true when value is present', () => {
    const list = createLinkedList([5, 10, 15]);
    assert.equal(list.contains(10), true);
  });

  it('contains returns false when value is absent', () => {
    const list = createLinkedList([5, 10, 15]);
    assert.equal(list.contains(99), false);
  });

  it('contains returns false on empty list', () => {
    assert.equal(new LinkedList().contains(1), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LinkedList — toArray / fromArray / clear
// ═══════════════════════════════════════════════════════════════════════════════

describe('LinkedList – toArray / fromArray / clear', () => {
  it('toArray returns empty array for empty list', () => {
    assert.deepEqual(new LinkedList().toArray(), []);
  });

  it('toArray returns values in correct order', () => {
    const list = createLinkedList([1, 2, 3, 4]);
    assert.deepEqual(list.toArray(), [1, 2, 3, 4]);
  });

  it('fromArray replaces content', () => {
    const list = createLinkedList([1, 2, 3]);
    list.fromArray([10, 20]);
    assert.deepEqual(list.toArray(), [10, 20]);
    assert.equal(list.size, 2);
  });

  it('fromArray on empty array clears the list', () => {
    const list = createLinkedList([1, 2, 3]);
    list.fromArray([]);
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
  });

  it('clear empties the list', () => {
    const list = createLinkedList([1, 2, 3]);
    list.clear();
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
    assert.deepEqual(list.toArray(), []);
  });

  it('clear on already-empty list is a no-op', () => {
    const list = new LinkedList();
    list.clear();
    assert.equal(list.size, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LinkedList — reverse (in-place)
// ═══════════════════════════════════════════════════════════════════════════════

describe('LinkedList – reverse', () => {
  it('reverses a multi-element list', () => {
    const list = createLinkedList([1, 2, 3, 4, 5]);
    list.reverse();
    assert.deepEqual(list.toArray(), [5, 4, 3, 2, 1]);
  });

  it('updates head and tail after reverse', () => {
    const list = createLinkedList([1, 2, 3]);
    list.reverse();
    assert.equal(list.head, 3);
    assert.equal(list.tail, 1);
  });

  it('reverse of single-element list is a no-op', () => {
    const list = createLinkedList([42]);
    list.reverse();
    assert.deepEqual(list.toArray(), [42]);
  });

  it('reverse of empty list is a no-op', () => {
    const list = new LinkedList();
    list.reverse();
    assert.deepEqual(list.toArray(), []);
  });

  it('double reverse restores original order', () => {
    const list = createLinkedList([1, 2, 3]);
    list.reverse();
    list.reverse();
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LinkedList — iteration (for..of / Symbol.iterator)
// ═══════════════════════════════════════════════════════════════════════════════

describe('LinkedList – iteration', () => {
  it('for..of yields values in order', () => {
    const list = createLinkedList([10, 20, 30]);
    const collected = [];
    for (const v of list) collected.push(v);
    assert.deepEqual(collected, [10, 20, 30]);
  });

  it('for..of on empty list yields nothing', () => {
    const collected = [];
    for (const v of new LinkedList()) collected.push(v);
    assert.deepEqual(collected, []);
  });

  it('spread operator works', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.deepEqual([...list], [1, 2, 3]);
  });

  it('iterator is independent per call', () => {
    const list = createLinkedList([1, 2, 3]);
    const a = [...list];
    const b = [...list];
    assert.deepEqual(a, b);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DoublyLinkedList — prepend / append / size / head / tail
// ═══════════════════════════════════════════════════════════════════════════════

describe('DoublyLinkedList – prepend / append / size / head / tail', () => {
  it('starts empty', () => {
    const list = new DoublyLinkedList();
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
  });

  it('append updates head and tail', () => {
    const list = new DoublyLinkedList();
    list.append(1);
    assert.equal(list.head, 1);
    assert.equal(list.tail, 1);
    list.append(2);
    assert.equal(list.head, 1);
    assert.equal(list.tail, 2);
  });

  it('prepend updates head and tail', () => {
    const list = new DoublyLinkedList();
    list.prepend(2);
    list.prepend(1);
    assert.equal(list.head, 1);
    assert.equal(list.tail, 2);
    assert.equal(list.size, 2);
  });

  it('mixed prepend/append ordering is correct', () => {
    const list = new DoublyLinkedList();
    list.append(2);
    list.prepend(1);
    list.append(3);
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DoublyLinkedList — insertAt / removeHead / removeTail / removeAt / removeValue
// ═══════════════════════════════════════════════════════════════════════════════

describe('DoublyLinkedList – insertAt', () => {
  it('inserts at beginning', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    list.insertAt(0, 0);
    assert.deepEqual(list.toArray(), [0, 1, 2, 3]);
  });

  it('inserts at end', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    list.insertAt(3, 4);
    assert.deepEqual(list.toArray(), [1, 2, 3, 4]);
  });

  it('inserts in the middle', () => {
    const list = createDoublyLinkedList([1, 3]);
    list.insertAt(1, 2);
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });

  it('throws RangeError for negative index', () => {
    assert.throws(() => new DoublyLinkedList().insertAt(-1, 'x'), RangeError);
  });

  it('throws RangeError for index beyond size', () => {
    const list = createDoublyLinkedList([1, 2]);
    assert.throws(() => list.insertAt(5, 'x'), RangeError);
  });
});

describe('DoublyLinkedList – removeHead / removeTail', () => {
  it('removeHead on empty list returns undefined', () => {
    assert.equal(new DoublyLinkedList().removeHead(), undefined);
  });

  it('removeTail on empty list returns undefined', () => {
    assert.equal(new DoublyLinkedList().removeTail(), undefined);
  });

  it('removeHead returns correct value and shrinks list', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    assert.equal(list.removeHead(), 1);
    assert.equal(list.size, 2);
    assert.equal(list.head, 2);
  });

  it('removeTail returns correct value and shrinks list', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    assert.equal(list.removeTail(), 3);
    assert.equal(list.size, 2);
    assert.equal(list.tail, 2);
  });

  it('removeHead on single-element list leaves list empty', () => {
    const list = createDoublyLinkedList([7]);
    list.removeHead();
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
  });

  it('removeTail on single-element list leaves list empty', () => {
    const list = createDoublyLinkedList([7]);
    list.removeTail();
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
  });
});

describe('DoublyLinkedList – removeAt', () => {
  it('returns undefined for out-of-bounds', () => {
    const list = createDoublyLinkedList([1, 2]);
    assert.equal(list.removeAt(-1), undefined);
    assert.equal(list.removeAt(10), undefined);
  });

  it('removes element at index 0', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    assert.equal(list.removeAt(0), 1);
    assert.deepEqual(list.toArray(), [2, 3]);
  });

  it('removes last element', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    assert.equal(list.removeAt(2), 3);
    assert.deepEqual(list.toArray(), [1, 2]);
  });

  it('removes middle element', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    assert.equal(list.removeAt(1), 2);
    assert.deepEqual(list.toArray(), [1, 3]);
  });
});

describe('DoublyLinkedList – removeValue', () => {
  it('returns false when not found', () => {
    assert.equal(createDoublyLinkedList([1, 2]).removeValue(99), false);
  });

  it('removes first occurrence of duplicates', () => {
    const list = createDoublyLinkedList([1, 2, 1]);
    assert.equal(list.removeValue(1), true);
    assert.deepEqual(list.toArray(), [2, 1]);
  });

  it('removes head value', () => {
    const list = createDoublyLinkedList([10, 20]);
    list.removeValue(10);
    assert.equal(list.head, 20);
  });

  it('removes tail value', () => {
    const list = createDoublyLinkedList([10, 20]);
    list.removeValue(20);
    assert.equal(list.tail, 10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DoublyLinkedList — getAt / indexOf / contains
// ═══════════════════════════════════════════════════════════════════════════════

describe('DoublyLinkedList – getAt / indexOf / contains', () => {
  it('getAt returns correct values', () => {
    const list = createDoublyLinkedList(['x', 'y', 'z']);
    assert.equal(list.getAt(0), 'x');
    assert.equal(list.getAt(2), 'z');
  });

  it('getAt returns undefined for out-of-bounds', () => {
    assert.equal(createDoublyLinkedList([1]).getAt(5), undefined);
  });

  it('indexOf returns correct index', () => {
    const list = createDoublyLinkedList([10, 20, 30]);
    assert.equal(list.indexOf(20), 1);
    assert.equal(list.indexOf(99), -1);
  });

  it('contains returns true for present values', () => {
    assert.equal(createDoublyLinkedList([1, 2, 3]).contains(2), true);
  });

  it('contains returns false for absent values', () => {
    assert.equal(createDoublyLinkedList([1, 2, 3]).contains(99), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DoublyLinkedList — toArray / toArrayReverse / clear / reverse
// ═══════════════════════════════════════════════════════════════════════════════

describe('DoublyLinkedList – toArray / toArrayReverse', () => {
  it('toArray returns values head-to-tail', () => {
    assert.deepEqual(createDoublyLinkedList([1, 2, 3]).toArray(), [1, 2, 3]);
  });

  it('toArrayReverse returns values tail-to-head', () => {
    assert.deepEqual(createDoublyLinkedList([1, 2, 3]).toArrayReverse(), [3, 2, 1]);
  });

  it('toArray and toArrayReverse are consistent', () => {
    const list = createDoublyLinkedList([1, 2, 3, 4]);
    assert.deepEqual(list.toArray(), list.toArrayReverse().reverse());
  });

  it('toArrayReverse on empty list returns empty array', () => {
    assert.deepEqual(new DoublyLinkedList().toArrayReverse(), []);
  });
});

describe('DoublyLinkedList – clear', () => {
  it('clear empties the list', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    list.clear();
    assert.equal(list.size, 0);
    assert.equal(list.head, undefined);
    assert.equal(list.tail, undefined);
  });
});

describe('DoublyLinkedList – reverse', () => {
  it('reverses a multi-element list in place', () => {
    const list = createDoublyLinkedList([1, 2, 3, 4]);
    list.reverse();
    assert.deepEqual(list.toArray(), [4, 3, 2, 1]);
  });

  it('updates head and tail after reverse', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    list.reverse();
    assert.equal(list.head, 3);
    assert.equal(list.tail, 1);
  });

  it('toArrayReverse is consistent after reverse', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    list.reverse();
    assert.deepEqual(list.toArrayReverse(), [1, 2, 3]);
  });

  it('double reverse restores original order', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    list.reverse();
    list.reverse();
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });

  it('reverse of single-element is a no-op', () => {
    const list = createDoublyLinkedList([1]);
    list.reverse();
    assert.deepEqual(list.toArray(), [1]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DoublyLinkedList — iteration
// ═══════════════════════════════════════════════════════════════════════════════

describe('DoublyLinkedList – iteration', () => {
  it('for..of yields values in head-to-tail order', () => {
    const list = createDoublyLinkedList([10, 20, 30]);
    const collected = [];
    for (const v of list) collected.push(v);
    assert.deepEqual(collected, [10, 20, 30]);
  });

  it('for..of on empty list yields nothing', () => {
    const collected = [];
    for (const v of new DoublyLinkedList()) collected.push(v);
    assert.deepEqual(collected, []);
  });

  it('spread operator works', () => {
    const list = createDoublyLinkedList([4, 5, 6]);
    assert.deepEqual([...list], [4, 5, 6]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Factory functions
// ═══════════════════════════════════════════════════════════════════════════════

describe('createLinkedList factory', () => {
  it('creates an empty LinkedList when called with no arguments', () => {
    const list = createLinkedList();
    assert.ok(list instanceof LinkedList);
    assert.equal(list.size, 0);
  });

  it('creates a LinkedList pre-populated with items', () => {
    const list = createLinkedList([1, 2, 3]);
    assert.ok(list instanceof LinkedList);
    assert.deepEqual(list.toArray(), [1, 2, 3]);
  });

  it('creates an empty LinkedList when called with empty array', () => {
    const list = createLinkedList([]);
    assert.equal(list.size, 0);
  });
});

describe('createDoublyLinkedList factory', () => {
  it('creates an empty DoublyLinkedList when called with no arguments', () => {
    const list = createDoublyLinkedList();
    assert.ok(list instanceof DoublyLinkedList);
    assert.equal(list.size, 0);
  });

  it('creates a DoublyLinkedList pre-populated with items', () => {
    const list = createDoublyLinkedList([4, 5, 6]);
    assert.ok(list instanceof DoublyLinkedList);
    assert.deepEqual(list.toArray(), [4, 5, 6]);
  });

  it('toArrayReverse matches expected order from factory', () => {
    const list = createDoublyLinkedList([1, 2, 3]);
    assert.deepEqual(list.toArrayReverse(), [3, 2, 1]);
  });
});
