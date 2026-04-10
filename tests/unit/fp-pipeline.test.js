// ─── Unit Tests: fp-pipeline ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  pipe,
  compose,
  curry,
  partial,
  memoize,
  applyN,
  transduce,
} from '../../app/modules/fp-pipeline.js';

// ─── pipe ─────────────────────────────────────────────────────────────────────

describe('pipe()', () => {
  it('returns the value unchanged with no functions', () => {
    assert.equal(pipe(42), 42);
  });

  it('applies a single function', () => {
    assert.equal(pipe(5, (n) => n * 2), 10);
  });

  it('applies two functions left to right', () => {
    // addOne then double: (3+1)*2 = 8
    assert.equal(pipe(3, (n) => n + 1, (n) => n * 2), 8);
  });

  it('applies three functions left to right', () => {
    assert.equal(
      pipe(
        2,
        (n) => n + 1, // 3
        (n) => n * 3, // 9
        (n) => n - 1, // 8
      ),
      8,
    );
  });

  it('applies ten functions', () => {
    const inc = (n) => n + 1;
    assert.equal(pipe(0, inc, inc, inc, inc, inc, inc, inc, inc, inc, inc), 10);
  });

  it('threads string transforms', () => {
    const result = pipe(
      '  Hello World  ',
      (s) => s.trim(),
      (s) => s.toLowerCase(),
      (s) => s.replace(' ', '_'),
    );
    assert.equal(result, 'hello_world');
  });

  it('pipes left-to-right (not right-to-left)', () => {
    const order = [];
    pipe(
      0,
      (n) => { order.push('a'); return n; },
      (n) => { order.push('b'); return n; },
      (n) => { order.push('c'); return n; },
    );
    assert.deepEqual(order, ['a', 'b', 'c']);
  });
});

// ─── compose ──────────────────────────────────────────────────────────────────

describe('compose()', () => {
  it('composes two functions right to left', () => {
    // compose(double, addOne)(3) = double(addOne(3)) = double(4) = 8
    const fn = compose((n) => n * 2, (n) => n + 1);
    assert.equal(fn(3), 8);
  });

  it('composes three functions right to left', () => {
    // compose(addOne, double, square)(3) = addOne(double(9)) = addOne(18) = 19
    const fn = compose((n) => n + 1, (n) => n * 2, (n) => n * n);
    assert.equal(fn(3), 19);
  });

  it('returns identity-like behaviour with a single function', () => {
    assert.equal(compose((n) => n * 3)(4), 12);
  });

  it('applies functions in right-to-left order', () => {
    const order = [];
    const a = (n) => { order.push('a'); return n; };
    const b = (n) => { order.push('b'); return n; };
    const c = (n) => { order.push('c'); return n; };
    compose(a, b, c)(0);
    assert.deepEqual(order, ['c', 'b', 'a']);
  });

  it('works with string transforms', () => {
    const fn = compose(
      (s) => s.toUpperCase(),
      (s) => s.trim(),
    );
    assert.equal(fn('  hello  '), 'HELLO');
  });
});

// ─── curry ────────────────────────────────────────────────────────────────────

describe('curry()', () => {
  it('curries a two-argument function', () => {
    const add = curry((a, b) => a + b);
    assert.equal(add(1)(2), 3);
  });

  it('accepts all arguments at once', () => {
    const add = curry((a, b) => a + b);
    assert.equal(add(3, 4), 7);
  });

  it('curries a three-argument function', () => {
    const sum3 = curry((a, b, c) => a + b + c);
    assert.equal(sum3(1)(2)(3), 6);
    assert.equal(sum3(1, 2)(3), 6);
    assert.equal(sum3(1)(2, 3), 6);
    assert.equal(sum3(1, 2, 3), 6);
  });

  it('returns a function when partially applied', () => {
    const mul = curry((a, b) => a * b);
    const triple = mul(3);
    assert.equal(typeof triple, 'function');
    assert.equal(triple(5), 15);
    assert.equal(triple(10), 30);
  });
});

// ─── partial ──────────────────────────────────────────────────────────────────

describe('partial()', () => {
  it('partially applies a function', () => {
    const add = (a, b) => a + b;
    const add10 = partial(add, 10);
    assert.equal(add10(5), 15);
  });

  it('partially applies multiple arguments', () => {
    const sum = (a, b, c) => a + b + c;
    const sum10and20 = partial(sum, 10, 20);
    assert.equal(sum10and20(5), 35);
  });

  it('works with a single-argument function (all args bound)', () => {
    const greet = (name) => `Hello, ${name}!`;
    const greetAlice = partial(greet, 'Alice');
    assert.equal(greetAlice(), 'Hello, Alice!');
  });

  it('passes remaining args in order', () => {
    const concat = (a, b, c) => `${a}-${b}-${c}`;
    const startWith = partial(concat, 'x');
    assert.equal(startWith('y', 'z'), 'x-y-z');
  });
});

// ─── memoize ──────────────────────────────────────────────────────────────────

describe('memoize()', () => {
  it('returns the same result for the same arguments', () => {
    const fn = memoize((n) => n * 2);
    assert.equal(fn(5), 10);
    assert.equal(fn(5), 10);
  });

  it('only calls the underlying function once per unique args', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n * 2; });
    fn(3);
    fn(3);
    fn(3);
    assert.equal(calls, 1);
  });

  it('calls the function again for different arguments', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n * 2; });
    fn(1);
    fn(2);
    fn(1);
    assert.equal(calls, 2);
  });

  it('works with multiple arguments', () => {
    let calls = 0;
    const fn = memoize((a, b) => { calls++; return a + b; });
    assert.equal(fn(1, 2), 3);
    assert.equal(fn(1, 2), 3);
    assert.equal(fn(2, 1), 3);
    assert.equal(calls, 2); // (1,2) and (2,1) are distinct keys
  });
});

// ─── applyN ───────────────────────────────────────────────────────────────────

describe('applyN()', () => {
  it('applies the function n times', () => {
    assert.equal(applyN((n) => n + 1, 5, 0), 5);
  });

  it('returns the initial value when n = 0', () => {
    assert.equal(applyN((n) => n * 100, 0, 7), 7);
  });

  it('doubles a value three times', () => {
    assert.equal(applyN((n) => n * 2, 3, 1), 8);
  });

  it('works with strings', () => {
    assert.equal(applyN((s) => s + '!', 3, 'hi'), 'hi!!!');
  });

  it('applies once when n = 1', () => {
    assert.equal(applyN((n) => n + 10, 1, 5), 15);
  });
});

// ─── transduce ────────────────────────────────────────────────────────────────

describe('transduce()', () => {
  // Helpers for building transducers
  const mapTransducer = (fn) => (reducer) => (acc, item) => reducer(acc, fn(item));
  const filterTransducer = (pred) => (reducer) => (acc, item) =>
    pred(item) ? reducer(acc, item) : acc;

  it('returns a copy of the array with no transformers', () => {
    assert.deepEqual(transduce([1, 2, 3]), [1, 2, 3]);
  });

  it('applies a single map transducer', () => {
    const result = transduce([1, 2, 3], mapTransducer((n) => n * 2));
    assert.deepEqual(result, [2, 4, 6]);
  });

  it('applies a single filter transducer', () => {
    const result = transduce([1, 2, 3, 4, 5], filterTransducer((n) => n % 2 === 0));
    assert.deepEqual(result, [2, 4]);
  });

  it('composes map then filter left-to-right', () => {
    // First double, then keep evens (all doubled values are even, so keep those > 4)
    const result = transduce(
      [1, 2, 3, 4, 5],
      mapTransducer((n) => n * 2),   // [2, 4, 6, 8, 10]
      filterTransducer((n) => n > 4), // [6, 8, 10]
    );
    assert.deepEqual(result, [6, 8, 10]);
  });

  it('composes filter then map left-to-right', () => {
    // First keep evens, then double
    const result = transduce(
      [1, 2, 3, 4, 5],
      filterTransducer((n) => n % 2 === 0), // [2, 4]
      mapTransducer((n) => n * 10),          // [20, 40]
    );
    assert.deepEqual(result, [20, 40]);
  });

  it('handles an empty input array', () => {
    assert.deepEqual(transduce([], mapTransducer((n) => n * 2)), []);
  });
});
