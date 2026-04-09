// ─── Unit Tests: type-guards ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNull,
  isUndefined,
  isNullish,
  isObject,
  isArray,
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isPromise,
  isDate,
  isRegExp,
  isError,
  isIterable,
  isFinite,
  isFiniteNumber,
  isInteger,
  isNonEmptyString,
  isNonEmptyArray,
  assertType,
  assertDefined,
} from '../../app/modules/type-guards.js';

// ─── isNull ───────────────────────────────────────────────────────────────────

describe('isNull', () => {
  it('returns true for null', () => {
    assert.equal(isNull(null), true);
  });

  it('returns false for undefined', () => {
    assert.equal(isNull(undefined), false);
  });

  it('returns false for 0', () => {
    assert.equal(isNull(0), false);
  });

  it("returns false for empty string ''", () => {
    assert.equal(isNull(''), false);
  });

  it('returns false for a plain object', () => {
    assert.equal(isNull({}), false);
  });
});

// ─── isUndefined ──────────────────────────────────────────────────────────────

describe('isUndefined', () => {
  it('returns true for undefined', () => {
    assert.equal(isUndefined(undefined), true);
  });

  it('returns false for null', () => {
    assert.equal(isUndefined(null), false);
  });

  it('returns false for 0', () => {
    assert.equal(isUndefined(0), false);
  });

  it("returns false for empty string ''", () => {
    assert.equal(isUndefined(''), false);
  });

  it('returns false for false', () => {
    assert.equal(isUndefined(false), false);
  });
});

// ─── isNullish ────────────────────────────────────────────────────────────────

describe('isNullish', () => {
  it('returns true for null', () => {
    assert.equal(isNullish(null), true);
  });

  it('returns true for undefined', () => {
    assert.equal(isNullish(undefined), true);
  });

  it('returns false for 0', () => {
    assert.equal(isNullish(0), false);
  });

  it('returns false for false', () => {
    assert.equal(isNullish(false), false);
  });

  it("returns false for empty string ''", () => {
    assert.equal(isNullish(''), false);
  });

  it('returns false for an empty object', () => {
    assert.equal(isNullish({}), false);
  });
});

// ─── isObject ─────────────────────────────────────────────────────────────────

describe('isObject', () => {
  it('returns true for a plain object', () => {
    assert.equal(isObject({ a: 1 }), true);
  });

  it('returns true for an empty object', () => {
    assert.equal(isObject({}), true);
  });

  it('returns false for an array', () => {
    assert.equal(isObject([1, 2, 3]), false);
  });

  it('returns false for null', () => {
    assert.equal(isObject(null), false);
  });

  it('returns false for a string', () => {
    assert.equal(isObject('hello'), false);
  });

  it('returns false for a number', () => {
    assert.equal(isObject(42), false);
  });
});

// ─── isArray ──────────────────────────────────────────────────────────────────

describe('isArray', () => {
  it('returns true for an array', () => {
    assert.equal(isArray([1, 2, 3]), true);
  });

  it('returns true for an empty array', () => {
    assert.equal(isArray([]), true);
  });

  it('returns false for a plain object', () => {
    assert.equal(isArray({ length: 3 }), false);
  });

  it('returns false for a string', () => {
    assert.equal(isArray('hello'), false);
  });

  it('returns false for null', () => {
    assert.equal(isArray(null), false);
  });
});

// ─── isString ─────────────────────────────────────────────────────────────────

describe('isString', () => {
  it('returns true for a string literal', () => {
    assert.equal(isString('hello'), true);
  });

  it('returns true for an empty string', () => {
    assert.equal(isString(''), true);
  });

  it('returns false for a number', () => {
    assert.equal(isString(42), false);
  });

  it('returns false for null', () => {
    assert.equal(isString(null), false);
  });

  it('returns false for a String object', () => {
    // eslint-disable-next-line no-new-wrappers
    assert.equal(isString(new String('hi')), false);
  });
});

// ─── isNumber ─────────────────────────────────────────────────────────────────

describe('isNumber', () => {
  it('returns true for a numeric value', () => {
    assert.equal(isNumber(42), true);
  });

  it('returns true for 0', () => {
    assert.equal(isNumber(0), true);
  });

  it('returns true for a negative number', () => {
    assert.equal(isNumber(-3.14), true);
  });

  it('returns false for NaN', () => {
    assert.equal(isNumber(NaN), false);
  });

  it('returns false for a numeric string', () => {
    assert.equal(isNumber('42'), false);
  });

  it('returns false for null', () => {
    assert.equal(isNumber(null), false);
  });
});

// ─── isBoolean ────────────────────────────────────────────────────────────────

describe('isBoolean', () => {
  it('returns true for true', () => {
    assert.equal(isBoolean(true), true);
  });

  it('returns true for false', () => {
    assert.equal(isBoolean(false), true);
  });

  it('returns false for 0', () => {
    assert.equal(isBoolean(0), false);
  });

  it('returns false for 1', () => {
    assert.equal(isBoolean(1), false);
  });

  it("returns false for the string 'true'", () => {
    assert.equal(isBoolean('true'), false);
  });
});

// ─── isFunction ───────────────────────────────────────────────────────────────

describe('isFunction', () => {
  it('returns true for a function declaration', () => {
    assert.equal(isFunction(function () {}), true);
  });

  it('returns true for an arrow function', () => {
    assert.equal(isFunction(() => {}), true);
  });

  it('returns true for a class constructor', () => {
    assert.equal(isFunction(class Foo {}), true);
  });

  it('returns false for a plain object', () => {
    assert.equal(isFunction({}), false);
  });

  it('returns false for null', () => {
    assert.equal(isFunction(null), false);
  });
});

// ─── isPromise ────────────────────────────────────────────────────────────────

describe('isPromise', () => {
  it('returns true for a Promise instance', () => {
    assert.equal(isPromise(Promise.resolve()), true);
  });

  it('returns true for a thenable/catchable object', () => {
    const thenable = { then: () => {}, catch: () => {} };
    assert.equal(isPromise(thenable), true);
  });

  it('returns false for a plain object', () => {
    assert.equal(isPromise({}), false);
  });

  it('returns false for an object with only then (no catch)', () => {
    assert.equal(isPromise({ then: () => {} }), false);
  });

  it('returns false for null', () => {
    assert.equal(isPromise(null), false);
  });

  it('returns false for a string', () => {
    assert.equal(isPromise('promise'), false);
  });
});

// ─── isDate ───────────────────────────────────────────────────────────────────

describe('isDate', () => {
  it('returns true for a Date instance', () => {
    assert.equal(isDate(new Date()), true);
  });

  it('returns false for a date string', () => {
    assert.equal(isDate('2024-01-01'), false);
  });

  it('returns false for a timestamp number', () => {
    assert.equal(isDate(Date.now()), false);
  });

  it('returns false for null', () => {
    assert.equal(isDate(null), false);
  });
});

// ─── isRegExp ─────────────────────────────────────────────────────────────────

describe('isRegExp', () => {
  it('returns true for a RegExp literal', () => {
    assert.equal(isRegExp(/foo/), true);
  });

  it('returns true for a RegExp constructor instance', () => {
    assert.equal(isRegExp(new RegExp('foo')), true);
  });

  it('returns false for a string pattern', () => {
    assert.equal(isRegExp('/foo/'), false);
  });

  it('returns false for null', () => {
    assert.equal(isRegExp(null), false);
  });

  it('returns false for a plain object', () => {
    assert.equal(isRegExp({}), false);
  });
});

// ─── isFinite ─────────────────────────────────────────────────────────────────

describe('isFinite', () => {
  it('returns true for a finite number', () => {
    assert.equal(isFinite(42), true);
  });

  it('returns true for 0', () => {
    assert.equal(isFinite(0), true);
  });

  it('returns true for a negative finite number', () => {
    assert.equal(isFinite(-100), true);
  });

  it('returns false for NaN', () => {
    assert.equal(isFinite(NaN), false);
  });

  it('returns false for Infinity', () => {
    assert.equal(isFinite(Infinity), false);
  });

  it('returns false for -Infinity', () => {
    assert.equal(isFinite(-Infinity), false);
  });

  it('returns false for a string', () => {
    assert.equal(isFinite('42'), false);
  });
});

// ─── isInteger ────────────────────────────────────────────────────────────────

describe('isInteger', () => {
  it('returns true for an integer', () => {
    assert.equal(isInteger(1), true);
  });

  it('returns true for 0', () => {
    assert.equal(isInteger(0), true);
  });

  it('returns true for a negative integer', () => {
    assert.equal(isInteger(-5), true);
  });

  it('returns false for a float', () => {
    assert.equal(isInteger(1.5), false);
  });

  it('returns false for NaN', () => {
    assert.equal(isInteger(NaN), false);
  });

  it('returns false for a string', () => {
    assert.equal(isInteger('1'), false);
  });
});

// ─── isError ──────────────────────────────────────────────────────────────────

describe('isError', () => {
  it('returns true for a plain Error', () => {
    assert.equal(isError(new Error('oops')), true);
  });

  it('returns true for a TypeError', () => {
    assert.equal(isError(new TypeError('bad type')), true);
  });

  it('returns true for a RangeError', () => {
    assert.equal(isError(new RangeError('range')), true);
  });

  it('returns false for a plain string', () => {
    assert.equal(isError('error'), false);
  });

  it('returns false for null', () => {
    assert.equal(isError(null), false);
  });

  it('returns false for a plain object with message field', () => {
    assert.equal(isError({ message: 'err', stack: '' }), false);
  });
});

// ─── isIterable ───────────────────────────────────────────────────────────────

describe('isIterable', () => {
  it('returns true for an array', () => {
    assert.equal(isIterable([1, 2, 3]), true);
  });

  it('returns true for a string', () => {
    assert.equal(isIterable('abc'), true);
  });

  it('returns true for a Map', () => {
    assert.equal(isIterable(new Map()), true);
  });

  it('returns true for a Set', () => {
    assert.equal(isIterable(new Set()), true);
  });

  it('returns true for a generator object', () => {
    function* gen() { yield 1; }
    assert.equal(isIterable(gen()), true);
  });

  it('returns false for a plain object without Symbol.iterator', () => {
    assert.equal(isIterable({}), false);
  });

  it('returns false for null', () => {
    assert.equal(isIterable(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isIterable(undefined), false);
  });

  it('returns false for a number', () => {
    assert.equal(isIterable(42), false);
  });
});

// ─── isFiniteNumber ───────────────────────────────────────────────────────────

describe('isFiniteNumber', () => {
  it('returns true for a finite number', () => {
    assert.equal(isFiniteNumber(42), true);
  });

  it('returns true for 0', () => {
    assert.equal(isFiniteNumber(0), true);
  });

  it('returns true for a float', () => {
    assert.equal(isFiniteNumber(3.14), true);
  });

  it('returns false for Infinity', () => {
    assert.equal(isFiniteNumber(Infinity), false);
  });

  it('returns false for -Infinity', () => {
    assert.equal(isFiniteNumber(-Infinity), false);
  });

  it('returns false for NaN', () => {
    assert.equal(isFiniteNumber(NaN), false);
  });

  it('returns false for a string', () => {
    assert.equal(isFiniteNumber('42'), false);
  });

  it('returns false for null', () => {
    assert.equal(isFiniteNumber(null), false);
  });
});

// ─── isNonEmptyString ─────────────────────────────────────────────────────────

describe('isNonEmptyString', () => {
  it('returns true for a non-empty string', () => {
    assert.equal(isNonEmptyString('hello'), true);
  });

  it('returns true for a whitespace-only string', () => {
    assert.equal(isNonEmptyString('  '), true);
  });

  it('returns false for an empty string', () => {
    assert.equal(isNonEmptyString(''), false);
  });

  it('returns false for a number', () => {
    assert.equal(isNonEmptyString(42), false);
  });

  it('returns false for null', () => {
    assert.equal(isNonEmptyString(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isNonEmptyString(undefined), false);
  });

  it('returns false for an array', () => {
    assert.equal(isNonEmptyString(['a']), false);
  });
});

// ─── isNonEmptyArray ──────────────────────────────────────────────────────────

describe('isNonEmptyArray', () => {
  it('returns true for a non-empty array', () => {
    assert.equal(isNonEmptyArray([1, 2]), true);
  });

  it('returns true for a single-element array', () => {
    assert.equal(isNonEmptyArray([null]), true);
  });

  it('returns false for an empty array', () => {
    assert.equal(isNonEmptyArray([]), false);
  });

  it('returns false for null', () => {
    assert.equal(isNonEmptyArray(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isNonEmptyArray(undefined), false);
  });

  it('returns false for a string', () => {
    assert.equal(isNonEmptyArray('abc'), false);
  });

  it('returns false for an array-like object', () => {
    assert.equal(isNonEmptyArray({ length: 1 }), false);
  });
});

// ─── assertType ───────────────────────────────────────────────────────────────

describe('assertType', () => {
  it('does not throw when the guard passes', () => {
    assert.doesNotThrow(() => assertType('hello', isString));
  });

  it('throws TypeError when the guard fails', () => {
    assert.throws(() => assertType(42, isString), TypeError);
  });

  it('uses a custom message when provided', () => {
    try {
      assertType(null, isNumber, 'must be a number');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof TypeError);
      assert.match(err.message, /must be a number/);
    }
  });

  it('throws with a default message when no custom message provided', () => {
    try {
      assertType(null, isBoolean);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof TypeError);
      assert.ok(err.message.length > 0);
    }
  });

  it('works with isArray guard', () => {
    assert.doesNotThrow(() => assertType([1, 2, 3], isArray));
    assert.throws(() => assertType('not array', isArray), TypeError);
  });

  it('works with isNonEmptyString guard', () => {
    assert.doesNotThrow(() => assertType('hello', isNonEmptyString));
    assert.throws(() => assertType('', isNonEmptyString), TypeError);
  });
});

// ─── assertDefined ────────────────────────────────────────────────────────────

describe('assertDefined', () => {
  it('does not throw for a non-null, non-undefined value', () => {
    assert.doesNotThrow(() => assertDefined(42));
    assert.doesNotThrow(() => assertDefined('hello'));
    assert.doesNotThrow(() => assertDefined(false));
    assert.doesNotThrow(() => assertDefined(0));
    assert.doesNotThrow(() => assertDefined({}));
  });

  it('throws for null', () => {
    assert.throws(() => assertDefined(null), Error);
  });

  it('throws for undefined', () => {
    assert.throws(() => assertDefined(undefined), Error);
  });

  it('throws with a custom message when provided', () => {
    assert.throws(
      () => assertDefined(null, 'custom error'),
      (err) => err instanceof Error && err.message === 'custom error',
    );
  });

  it('throws with a default message when no message is provided', () => {
    assert.throws(
      () => assertDefined(undefined),
      (err) => err instanceof Error && err.message.length > 0,
    );
  });
});
