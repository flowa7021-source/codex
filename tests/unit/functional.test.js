// ─── Unit Tests: Functional Programming Utilities ────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compose,
  pipe,
  identity,
  constant,
  curry,
  partial,
  flip,
  Maybe,
  Either,
  memoize,
  trampoline,
} from '../../app/modules/functional.js';

// ─── compose ─────────────────────────────────────────────────────────────────

describe('compose', () => {
  it('applies functions right-to-left', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const f = compose(addOne, double); // addOne(double(x))
    assert.equal(f(3), 7);
  });

  it('works with three functions', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const square = (x) => x * x;
    const f = compose(addOne, double, square); // addOne(double(square(x)))
    assert.equal(f(3), 19); // square(3)=9, double=18, addOne=19
  });

  it('single function returns the behaviour of that function', () => {
    const double = (x) => x * 2;
    assert.equal(compose(double)(5), 10);
  });

  it('no functions returns identity', () => {
    assert.equal(compose()(42), 42);
  });

  it('works with string transformations', () => {
    const trim = (s) => s.trim();
    const upper = (s) => s.toUpperCase();
    const f = compose(upper, trim);
    assert.equal(f('  hello  '), 'HELLO');
  });
});

// ─── pipe ─────────────────────────────────────────────────────────────────────

describe('pipe', () => {
  it('applies functions left-to-right', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const f = pipe(addOne, double); // double(addOne(x))
    assert.equal(f(3), 8);
  });

  it('works with three functions', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const square = (x) => x * x;
    const f = pipe(addOne, double, square); // square(double(addOne(x)))
    assert.equal(f(3), 64); // addOne(3)=4, double=8, square=64
  });

  it('single function returns the behaviour of that function', () => {
    const triple = (x) => x * 3;
    assert.equal(pipe(triple)(5), 15);
  });

  it('no functions returns identity', () => {
    assert.equal(pipe()('hello'), 'hello');
  });

  it('pipe is the inverse ordering of compose', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    assert.equal(pipe(addOne, double)(3), compose(double, addOne)(3));
  });
});

// ─── identity ────────────────────────────────────────────────────────────────

describe('identity', () => {
  it('returns numbers unchanged', () => {
    assert.equal(identity(42), 42);
  });

  it('returns strings unchanged', () => {
    assert.equal(identity('hello'), 'hello');
  });

  it('returns the same object reference', () => {
    const obj = { a: 1 };
    assert.equal(identity(obj), obj);
  });

  it('returns null unchanged', () => {
    assert.equal(identity(null), null);
  });

  it('returns undefined unchanged', () => {
    assert.equal(identity(undefined), undefined);
  });
});

// ─── constant ─────────────────────────────────────────────────────────────────

describe('constant', () => {
  it('always returns the fixed value', () => {
    const alwaysFive = constant(5);
    assert.equal(alwaysFive(), 5);
    assert.equal(alwaysFive(), 5);
  });

  it('ignores any arguments (zero-arg usage)', () => {
    const alwaysHello = constant('hello');
    assert.equal(alwaysHello(), 'hello');
  });

  it('returns the same object reference each call', () => {
    const obj = { x: 1 };
    const fn = constant(obj);
    assert.equal(fn(), obj);
    assert.equal(fn(), obj);
  });

  it('works with boolean false', () => {
    const alwaysFalse = constant(false);
    assert.equal(alwaysFalse(), false);
  });
});

// ─── curry ───────────────────────────────────────────────────────────────────

describe('curry', () => {
  it('returns the result when all args provided at once', () => {
    const add = curry((a, b) => a + b);
    assert.equal(add(2, 3), 5);
  });

  it('partially applies when fewer args than arity', () => {
    const add = curry((a, b) => a + b);
    const add5 = add(5);
    assert.equal(add5(3), 8);
  });

  it('supports arity-3 functions', () => {
    const sum3 = curry((a, b, c) => a + b + c);
    assert.equal(sum3(1)(2)(3), 6);
    assert.equal(sum3(1, 2)(3), 6);
    assert.equal(sum3(1)(2, 3), 6);
    assert.equal(sum3(1, 2, 3), 6);
  });

  it('a curried identity-like function with arity 1 returns immediately', () => {
    const double = curry((x) => x * 2);
    assert.equal(double(7), 14);
  });

  it('preserves this-free pure function semantics', () => {
    const multiply = curry((a, b) => a * b);
    const triple = multiply(3);
    assert.equal([1, 2, 3, 4].map(triple).join(','), '3,6,9,12');
  });
});

// ─── partial ─────────────────────────────────────────────────────────────────

describe('partial', () => {
  it('fixes leading arguments', () => {
    const multiply = (a, b) => a * b;
    const double = partial(multiply, 2);
    assert.equal(double(5), 10);
  });

  it('works with multiple pre-applied args', () => {
    const clamp = (min, max, val) => Math.min(max, Math.max(min, val));
    const clamp0to100 = partial(clamp, 0, 100);
    assert.equal(clamp0to100(150), 100);
    assert.equal(clamp0to100(-10), 0);
    assert.equal(clamp0to100(50), 50);
  });

  it('accepts no leading args, behaving like a copy of the function', () => {
    const noop = (x) => x;
    const copy = partial(noop);
    assert.equal(copy(99), 99);
  });

  it('works with string operations', () => {
    const prepend = (prefix, str) => prefix + str;
    const addHello = partial(prepend, 'Hello, ');
    assert.equal(addHello('world'), 'Hello, world');
  });
});

// ─── flip ─────────────────────────────────────────────────────────────────────

describe('flip', () => {
  it('swaps the two arguments of a binary function', () => {
    const sub = (a, b) => a - b;
    const flippedSub = flip(sub);
    assert.equal(flippedSub(3, 10), 7); // 10 - 3
  });

  it('flip(flip(fn)) behaves like the original fn', () => {
    const div = (a, b) => a / b;
    assert.equal(flip(flip(div))(10, 2), div(10, 2));
  });

  it('works with string concatenation', () => {
    const concat = (a, b) => a + b;
    const flippedConcat = flip(concat);
    assert.equal(flippedConcat('world', 'hello'), 'helloworld');
  });
});

// ─── Maybe ───────────────────────────────────────────────────────────────────

describe('Maybe', () => {
  it('Maybe.of wraps a value into Just', () => {
    const m = Maybe.of(42);
    assert.equal(m.isNothing, false);
    assert.equal(m.value, 42);
  });

  it('Maybe.of(null) produces Nothing', () => {
    const m = Maybe.of(null);
    assert.equal(m.isNothing, true);
    assert.equal(m.value, undefined);
  });

  it('Maybe.of(undefined) produces Nothing', () => {
    const m = Maybe.of(undefined);
    assert.equal(m.isNothing, true);
  });

  it('Maybe.empty() produces Nothing', () => {
    const m = Maybe.empty();
    assert.equal(m.isNothing, true);
  });

  it('map transforms the value inside Just', () => {
    const m = Maybe.of(5).map((x) => x * 2);
    assert.equal(m.value, 10);
  });

  it('map on Nothing returns Nothing', () => {
    const m = Maybe.of(null).map((x) => x * 2);
    assert.equal(m.isNothing, true);
  });

  it('flatMap chains Maybes', () => {
    const safeSqrt = (x) => (x >= 0 ? Maybe.of(Math.sqrt(x)) : Maybe.empty());
    const result = Maybe.of(16).flatMap(safeSqrt);
    assert.equal(result.value, 4);
  });

  it('flatMap on Nothing short-circuits', () => {
    const safeSqrt = (x) => (x >= 0 ? Maybe.of(Math.sqrt(x)) : Maybe.empty());
    const result = Maybe.of(null).flatMap(safeSqrt);
    assert.equal(result.isNothing, true);
  });

  it('getOrElse returns value when Just', () => {
    assert.equal(Maybe.of(7).getOrElse(0), 7);
  });

  it('getOrElse returns default when Nothing', () => {
    assert.equal(Maybe.of(null).getOrElse(99), 99);
  });

  it('filter keeps value when predicate passes', () => {
    const m = Maybe.of(10).filter((x) => x > 5);
    assert.equal(m.value, 10);
  });

  it('filter produces Nothing when predicate fails', () => {
    const m = Maybe.of(3).filter((x) => x > 5);
    assert.equal(m.isNothing, true);
  });

  it('filter on Nothing returns Nothing', () => {
    const m = Maybe.of(null).filter(() => true);
    assert.equal(m.isNothing, true);
  });

  it('toString returns Just(value) for present value', () => {
    assert.equal(Maybe.of(42).toString(), 'Just(42)');
  });

  it('toString returns Nothing for empty Maybe', () => {
    assert.equal(Maybe.empty().toString(), 'Nothing');
  });

  it('chains multiple maps correctly', () => {
    const result = Maybe.of(2)
      .map((x) => x + 3)
      .map((x) => x * 4);
    assert.equal(result.value, 20);
  });
});

// ─── Either ──────────────────────────────────────────────────────────────────

describe('Either', () => {
  it('Either.right creates a Right value', () => {
    const e = Either.right(42);
    assert.equal(e.isRight, true);
    assert.equal(e.isLeft, false);
  });

  it('Either.left creates a Left value', () => {
    const e = Either.left('error');
    assert.equal(e.isLeft, true);
    assert.equal(e.isRight, false);
  });

  it('map transforms the Right value', () => {
    const e = Either.right(5).map((x) => x * 2);
    assert.equal(e.getOrElse(0), 10);
  });

  it('map passes Left through unchanged', () => {
    const e = Either.left('err').map((x) => x * 2);
    assert.equal(e.isLeft, true);
  });

  it('mapLeft transforms the Left value', () => {
    const e = Either.left('error').mapLeft((s) => s.toUpperCase());
    assert.equal(e.fold((l) => l, (r) => r), 'ERROR');
  });

  it('mapLeft passes Right through unchanged', () => {
    const e = Either.right(10).mapLeft((s) => s.toUpperCase());
    assert.equal(e.getOrElse(0), 10);
  });

  it('flatMap chains successful computations', () => {
    const safeDivide = (n, d) =>
      d === 0 ? Either.left('division by zero') : Either.right(n / d);
    const result = Either.right(10).flatMap((x) => safeDivide(x, 2));
    assert.equal(result.getOrElse(0), 5);
  });

  it('flatMap short-circuits on Left', () => {
    const result = Either.left('fail').flatMap((x) => Either.right(x * 2));
    assert.equal(result.isLeft, true);
  });

  it('getOrElse returns Right value when Right', () => {
    assert.equal(Either.right(7).getOrElse(0), 7);
  });

  it('getOrElse returns default when Left', () => {
    assert.equal(Either.left('oops').getOrElse(99), 99);
  });

  it('fold calls onRight for Right', () => {
    const result = Either.right(3).fold(
      () => 'left',
      (x) => `right:${x}`,
    );
    assert.equal(result, 'right:3');
  });

  it('fold calls onLeft for Left', () => {
    const result = Either.left('boom').fold(
      (l) => `error:${l}`,
      () => 'ok',
    );
    assert.equal(result, 'error:boom');
  });

  it('chained maps on Right accumulate transformations', () => {
    const result = Either.right(1)
      .map((x) => x + 1)
      .map((x) => x * 10);
    assert.equal(result.getOrElse(0), 20);
  });
});

// ─── memoize ─────────────────────────────────────────────────────────────────

describe('memoize', () => {
  it('returns the correct result on the first call', () => {
    const double = memoize((x) => x * 2);
    assert.equal(double(5), 10);
  });

  it('returns the cached result on subsequent calls', () => {
    let callCount = 0;
    const expensive = memoize((x) => {
      callCount++;
      return x * x;
    });
    assert.equal(expensive(4), 16);
    assert.equal(expensive(4), 16);
    assert.equal(callCount, 1);
  });

  it('distinguishes different arguments', () => {
    const fn = memoize((x) => x + 1);
    assert.equal(fn(1), 2);
    assert.equal(fn(2), 3);
  });

  it('works with multi-argument functions', () => {
    let callCount = 0;
    const add = memoize((a, b) => {
      callCount++;
      return a + b;
    });
    assert.equal(add(2, 3), 5);
    assert.equal(add(2, 3), 5);
    assert.equal(callCount, 1);
    assert.equal(add(3, 2), 5); // different argument order → separate cache entry
    assert.equal(callCount, 2);
  });

  it('works with string arguments', () => {
    let callCount = 0;
    const greet = memoize((name) => {
      callCount++;
      return `Hello, ${name}`;
    });
    assert.equal(greet('Alice'), 'Hello, Alice');
    assert.equal(greet('Alice'), 'Hello, Alice');
    assert.equal(callCount, 1);
  });
});

// ─── trampoline ──────────────────────────────────────────────────────────────

describe('trampoline', () => {
  it('handles a simple non-recursive function', () => {
    const add = trampoline((a, b) => a + b);
    assert.equal(add(2, 3), 5);
  });

  it('enables stack-safe tail-recursive factorial', () => {
    const factorial = trampoline(function fact(n, acc = 1) {
      if (n <= 1) return acc;
      return () => fact(n - 1, n * acc);
    });
    assert.equal(factorial(5), 120);
    assert.equal(factorial(10), 3628800);
  });

  it('handles large n without stack overflow', () => {
    const factorial = trampoline(function fact(n, acc = BigInt(1)) {
      if (n <= 1) return acc;
      return () => fact(n - 1, BigInt(n) * acc);
    });
    // 1000! would blow the stack without trampoline
    assert.ok(typeof factorial(1000) === 'bigint');
  });

  it('enables stack-safe tail-recursive sum', () => {
    const sum = trampoline(function go(n, acc = 0) {
      if (n === 0) return acc;
      return () => go(n - 1, acc + n);
    });
    assert.equal(sum(100), 5050);
  });

  it('returns immediately for base cases (no thunk)', () => {
    const alwaysTen = trampoline(() => 10);
    assert.equal(alwaysTen(), 10);
  });
});
