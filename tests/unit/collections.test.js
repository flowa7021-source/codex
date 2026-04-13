// ─── Unit Tests: Specialized Data Structures ────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Stack, Queue, Deque, Multiset, BiMap,
  createStack, createQueue, createDeque, createMultiset, createBiMap,
} from '../../app/modules/collections.js';

// ─── Stack ───────────────────────────────────────────────────────────────────

describe('Stack', () => {
  it('starts empty', () => {
    const s = new Stack();
    assert.equal(s.size, 0);
    assert.ok(s.isEmpty());
  });

  it('push increases size', () => {
    const s = new Stack();
    s.push(1);
    assert.equal(s.size, 1);
    s.push(2);
    assert.equal(s.size, 2);
  });

  it('pop returns items LIFO', () => {
    const s = new Stack();
    s.push('a');
    s.push('b');
    s.push('c');
    assert.equal(s.pop(), 'c');
    assert.equal(s.pop(), 'b');
    assert.equal(s.pop(), 'a');
  });

  it('pop on empty stack returns undefined', () => {
    const s = new Stack();
    assert.equal(s.pop(), undefined);
  });

  it('peek returns top without removing', () => {
    const s = new Stack();
    s.push(10);
    s.push(20);
    assert.equal(s.peek(), 20);
    assert.equal(s.size, 2);
  });

  it('peek on empty stack returns undefined', () => {
    const s = new Stack();
    assert.equal(s.peek(), undefined);
  });

  it('isEmpty becomes false after push', () => {
    const s = new Stack();
    s.push(42);
    assert.ok(!s.isEmpty());
  });

  it('isEmpty becomes true after all items popped', () => {
    const s = new Stack();
    s.push(1);
    s.pop();
    assert.ok(s.isEmpty());
  });

  it('clear removes all items', () => {
    const s = new Stack();
    s.push(1);
    s.push(2);
    s.push(3);
    s.clear();
    assert.equal(s.size, 0);
    assert.ok(s.isEmpty());
  });

  it('toArray returns items top-first', () => {
    const s = new Stack();
    s.push(1);
    s.push(2);
    s.push(3);
    assert.deepEqual(s.toArray(), [3, 2, 1]);
  });

  it('toArray on empty stack returns []', () => {
    const s = new Stack();
    assert.deepEqual(s.toArray(), []);
  });

  it('toArray does not mutate the stack', () => {
    const s = new Stack();
    s.push(1);
    s.push(2);
    s.toArray();
    assert.equal(s.size, 2);
  });

  it('Symbol.iterator yields items top-first', () => {
    const s = new Stack();
    s.push('x');
    s.push('y');
    s.push('z');
    assert.deepEqual([...s], ['z', 'y', 'x']);
  });

  it('Symbol.iterator on empty stack yields nothing', () => {
    const s = new Stack();
    assert.deepEqual([...s], []);
  });

  it('works with multiple types (strings)', () => {
    const s = new Stack();
    s.push('hello');
    assert.equal(s.peek(), 'hello');
    assert.equal(s.pop(), 'hello');
  });

  it('createStack factory returns a Stack instance', () => {
    const s = createStack();
    assert.ok(s instanceof Stack);
    assert.ok(s.isEmpty());
  });

  it('size updates correctly after interleaved push/pop', () => {
    const s = new Stack();
    s.push(1);
    s.push(2);
    s.pop();
    s.push(3);
    assert.equal(s.size, 2);
    assert.equal(s.peek(), 3);
  });
});

// ─── Queue ───────────────────────────────────────────────────────────────────

describe('Queue', () => {
  it('starts empty', () => {
    const q = new Queue();
    assert.equal(q.size, 0);
    assert.ok(q.isEmpty());
  });

  it('enqueue increases size', () => {
    const q = new Queue();
    q.enqueue('a');
    assert.equal(q.size, 1);
    q.enqueue('b');
    assert.equal(q.size, 2);
  });

  it('dequeue returns items FIFO', () => {
    const q = new Queue();
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    assert.equal(q.dequeue(), 1);
    assert.equal(q.dequeue(), 2);
    assert.equal(q.dequeue(), 3);
  });

  it('dequeue on empty queue returns undefined', () => {
    const q = new Queue();
    assert.equal(q.dequeue(), undefined);
  });

  it('front returns front item without removing', () => {
    const q = new Queue();
    q.enqueue('first');
    q.enqueue('second');
    assert.equal(q.front(), 'first');
    assert.equal(q.size, 2);
  });

  it('front on empty queue returns undefined', () => {
    const q = new Queue();
    assert.equal(q.front(), undefined);
  });

  it('isEmpty becomes true after all dequeues', () => {
    const q = new Queue();
    q.enqueue(1);
    q.dequeue();
    assert.ok(q.isEmpty());
  });

  it('clear removes all items', () => {
    const q = new Queue();
    q.enqueue(1);
    q.enqueue(2);
    q.clear();
    assert.equal(q.size, 0);
    assert.ok(q.isEmpty());
  });

  it('toArray returns items front-first', () => {
    const q = new Queue();
    q.enqueue(10);
    q.enqueue(20);
    q.enqueue(30);
    assert.deepEqual(q.toArray(), [10, 20, 30]);
  });

  it('toArray does not mutate the queue', () => {
    const q = new Queue();
    q.enqueue(1);
    q.toArray();
    assert.equal(q.size, 1);
  });

  it('Symbol.iterator yields items front-first', () => {
    const q = new Queue();
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    assert.deepEqual([...q], ['a', 'b', 'c']);
  });

  it('Symbol.iterator on empty queue yields nothing', () => {
    const q = new Queue();
    assert.deepEqual([...q], []);
  });

  it('createQueue factory returns a Queue instance', () => {
    const q = createQueue();
    assert.ok(q instanceof Queue);
    assert.ok(q.isEmpty());
  });

  it('size updates correctly after interleaved enqueue/dequeue', () => {
    const q = new Queue();
    q.enqueue(1);
    q.enqueue(2);
    q.dequeue();
    q.enqueue(3);
    assert.equal(q.size, 2);
    assert.equal(q.front(), 2);
  });
});

// ─── Deque ────────────────────────────────────────────────────────────────────

describe('Deque', () => {
  it('starts empty', () => {
    const d = new Deque();
    assert.equal(d.size, 0);
    assert.ok(d.isEmpty());
  });

  it('pushBack then popFront gives FIFO behaviour', () => {
    const d = new Deque();
    d.pushBack(1);
    d.pushBack(2);
    d.pushBack(3);
    assert.equal(d.popFront(), 1);
    assert.equal(d.popFront(), 2);
    assert.equal(d.popFront(), 3);
  });

  it('pushFront then popFront gives LIFO behaviour', () => {
    const d = new Deque();
    d.pushFront(1);
    d.pushFront(2);
    d.pushFront(3);
    assert.equal(d.popFront(), 3);
    assert.equal(d.popFront(), 2);
    assert.equal(d.popFront(), 1);
  });

  it('pushBack then popBack gives LIFO behaviour', () => {
    const d = new Deque();
    d.pushBack('a');
    d.pushBack('b');
    d.pushBack('c');
    assert.equal(d.popBack(), 'c');
    assert.equal(d.popBack(), 'b');
    assert.equal(d.popBack(), 'a');
  });

  it('popFront on empty returns undefined', () => {
    const d = new Deque();
    assert.equal(d.popFront(), undefined);
  });

  it('popBack on empty returns undefined', () => {
    const d = new Deque();
    assert.equal(d.popBack(), undefined);
  });

  it('peekFront does not remove item', () => {
    const d = new Deque();
    d.pushBack(42);
    assert.equal(d.peekFront(), 42);
    assert.equal(d.size, 1);
  });

  it('peekBack does not remove item', () => {
    const d = new Deque();
    d.pushBack(1);
    d.pushBack(2);
    assert.equal(d.peekBack(), 2);
    assert.equal(d.size, 2);
  });

  it('peekFront on empty returns undefined', () => {
    const d = new Deque();
    assert.equal(d.peekFront(), undefined);
  });

  it('peekBack on empty returns undefined', () => {
    const d = new Deque();
    assert.equal(d.peekBack(), undefined);
  });

  it('clear removes all items', () => {
    const d = new Deque();
    d.pushBack(1);
    d.pushFront(2);
    d.clear();
    assert.equal(d.size, 0);
    assert.ok(d.isEmpty());
  });

  it('toArray returns items front to back', () => {
    const d = new Deque();
    d.pushBack(1);
    d.pushBack(2);
    d.pushFront(0);
    assert.deepEqual(d.toArray(), [0, 1, 2]);
  });

  it('toArray on empty deque returns []', () => {
    const d = new Deque();
    assert.deepEqual(d.toArray(), []);
  });

  it('createDeque factory returns a Deque instance', () => {
    const d = createDeque();
    assert.ok(d instanceof Deque);
    assert.ok(d.isEmpty());
  });

  it('mixed front/back operations keep correct order', () => {
    const d = new Deque();
    d.pushBack(2);
    d.pushFront(1);
    d.pushBack(3);
    assert.deepEqual(d.toArray(), [1, 2, 3]);
    assert.equal(d.popBack(), 3);
    assert.equal(d.popFront(), 1);
    assert.deepEqual(d.toArray(), [2]);
  });
});

// ─── Multiset ─────────────────────────────────────────────────────────────────

describe('Multiset', () => {
  it('starts empty', () => {
    const m = new Multiset();
    assert.equal(m.size, 0);
    assert.equal(m.uniqueSize, 0);
  });

  it('add increases size and count', () => {
    const m = new Multiset();
    m.add('a');
    assert.equal(m.size, 1);
    assert.equal(m.count('a'), 1);
  });

  it('add same item twice increments count', () => {
    const m = new Multiset();
    m.add('x');
    m.add('x');
    assert.equal(m.count('x'), 2);
    assert.equal(m.size, 2);
    assert.equal(m.uniqueSize, 1);
  });

  it('add different items increments uniqueSize', () => {
    const m = new Multiset();
    m.add(1);
    m.add(2);
    m.add(2);
    assert.equal(m.uniqueSize, 2);
    assert.equal(m.size, 3);
  });

  it('has returns true for present item', () => {
    const m = new Multiset();
    m.add('hi');
    assert.ok(m.has('hi'));
  });

  it('has returns false for absent item', () => {
    const m = new Multiset();
    assert.ok(!m.has('missing'));
  });

  it('count returns 0 for absent item', () => {
    const m = new Multiset();
    assert.equal(m.count('nope'), 0);
  });

  it('delete removes one occurrence', () => {
    const m = new Multiset();
    m.add('a');
    m.add('a');
    const result = m.delete('a');
    assert.ok(result);
    assert.equal(m.count('a'), 1);
    assert.equal(m.size, 1);
  });

  it('delete last occurrence removes item entirely', () => {
    const m = new Multiset();
    m.add('z');
    m.delete('z');
    assert.ok(!m.has('z'));
    assert.equal(m.uniqueSize, 0);
  });

  it('delete on absent item returns false', () => {
    const m = new Multiset();
    assert.ok(!m.delete('ghost'));
  });

  it('deleteAll removes all occurrences', () => {
    const m = new Multiset();
    m.add('b');
    m.add('b');
    m.add('b');
    const result = m.deleteAll('b');
    assert.ok(result);
    assert.equal(m.count('b'), 0);
    assert.ok(!m.has('b'));
    assert.equal(m.size, 0);
  });

  it('deleteAll on absent item returns false', () => {
    const m = new Multiset();
    assert.ok(!m.deleteAll('missing'));
  });

  it('deleteAll only removes the targeted item', () => {
    const m = new Multiset();
    m.add('a');
    m.add('b');
    m.add('b');
    m.deleteAll('b');
    assert.equal(m.count('a'), 1);
    assert.equal(m.size, 1);
  });

  it('entries returns [item, count] pairs', () => {
    const m = new Multiset();
    m.add('x');
    m.add('x');
    m.add('y');
    const ents = m.entries();
    const map = Object.fromEntries(ents);
    assert.equal(map['x'], 2);
    assert.equal(map['y'], 1);
  });

  it('toArray returns each item repeated count times', () => {
    const m = new Multiset();
    m.add('a');
    m.add('a');
    m.add('b');
    const arr = m.toArray().sort();
    assert.deepEqual(arr, ['a', 'a', 'b']);
  });

  it('clear resets size and uniqueSize', () => {
    const m = new Multiset();
    m.add(1);
    m.add(1);
    m.add(2);
    m.clear();
    assert.equal(m.size, 0);
    assert.equal(m.uniqueSize, 0);
  });

  it('createMultiset factory returns a Multiset instance', () => {
    const m = createMultiset();
    assert.ok(m instanceof Multiset);
    assert.equal(m.size, 0);
  });
});

// ─── BiMap ────────────────────────────────────────────────────────────────────

describe('BiMap', () => {
  it('starts empty', () => {
    const bm = new BiMap();
    assert.equal(bm.size, 0);
  });

  it('set and getByKey', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    assert.equal(bm.getByKey('a'), 1);
  });

  it('set and getByValue', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    assert.equal(bm.getByValue(1), 'a');
  });

  it('size increases with each new pair', () => {
    const bm = new BiMap();
    bm.set('x', 10);
    bm.set('y', 20);
    assert.equal(bm.size, 2);
  });

  it('hasKey returns true for present key', () => {
    const bm = new BiMap();
    bm.set('k', 'v');
    assert.ok(bm.hasKey('k'));
  });

  it('hasKey returns false for absent key', () => {
    const bm = new BiMap();
    assert.ok(!bm.hasKey('missing'));
  });

  it('hasValue returns true for present value', () => {
    const bm = new BiMap();
    bm.set('k', 'v');
    assert.ok(bm.hasValue('v'));
  });

  it('hasValue returns false for absent value', () => {
    const bm = new BiMap();
    assert.ok(!bm.hasValue('missing'));
  });

  it('getByKey returns undefined for absent key', () => {
    const bm = new BiMap();
    assert.equal(bm.getByKey('nope'), undefined);
  });

  it('getByValue returns undefined for absent value', () => {
    const bm = new BiMap();
    assert.equal(bm.getByValue('nope'), undefined);
  });

  it('re-setting same key replaces value', () => {
    const bm = new BiMap();
    bm.set('k', 'old');
    bm.set('k', 'new');
    assert.equal(bm.getByKey('k'), 'new');
    assert.equal(bm.size, 1);
    assert.ok(!bm.hasValue('old'));
  });

  it('re-setting same value replaces key', () => {
    const bm = new BiMap();
    bm.set('old', 99);
    bm.set('new', 99);
    assert.equal(bm.getByValue(99), 'new');
    assert.equal(bm.size, 1);
    assert.ok(!bm.hasKey('old'));
  });

  it('deleteByKey removes pair', () => {
    const bm = new BiMap();
    bm.set('k', 'v');
    const result = bm.deleteByKey('k');
    assert.ok(result);
    assert.ok(!bm.hasKey('k'));
    assert.ok(!bm.hasValue('v'));
    assert.equal(bm.size, 0);
  });

  it('deleteByKey on absent key returns false', () => {
    const bm = new BiMap();
    assert.ok(!bm.deleteByKey('ghost'));
  });

  it('deleteByValue removes pair', () => {
    const bm = new BiMap();
    bm.set('k', 'v');
    const result = bm.deleteByValue('v');
    assert.ok(result);
    assert.ok(!bm.hasKey('k'));
    assert.ok(!bm.hasValue('v'));
    assert.equal(bm.size, 0);
  });

  it('deleteByValue on absent value returns false', () => {
    const bm = new BiMap();
    assert.ok(!bm.deleteByValue('ghost'));
  });

  it('keys returns all keys', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    bm.set('b', 2);
    assert.deepEqual(bm.keys().sort(), ['a', 'b']);
  });

  it('values returns all values', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    bm.set('b', 2);
    assert.deepEqual(bm.values().sort((x, y) => x - y), [1, 2]);
  });

  it('clear removes all pairs', () => {
    const bm = new BiMap();
    bm.set('x', 10);
    bm.set('y', 20);
    bm.clear();
    assert.equal(bm.size, 0);
    assert.ok(!bm.hasKey('x'));
    assert.ok(!bm.hasValue(10));
  });

  it('createBiMap factory returns a BiMap instance', () => {
    const bm = createBiMap();
    assert.ok(bm instanceof BiMap);
    assert.equal(bm.size, 0);
  });

  it('overwrites conflicting key without growing size', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    bm.set('b', 2);
    // Re-map 'a' to value 2 — evicts 'b'→2 and updates 'a'→2
    bm.set('a', 2);
    assert.equal(bm.size, 1);
    assert.equal(bm.getByKey('a'), 2);
    assert.equal(bm.getByValue(2), 'a');
    assert.ok(!bm.hasKey('b'));
  });

  it('supports object keys and values', () => {
    const bm = new BiMap();
    const k = { id: 1 };
    const v = { name: 'one' };
    bm.set(k, v);
    assert.equal(bm.getByKey(k), v);
    assert.equal(bm.getByValue(v), k);
  });
});
