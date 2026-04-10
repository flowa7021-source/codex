// ─── Unit Tests: fluent-validator ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { v } from '../../app/modules/fluent-validator.js';

// ─── v.string() ───────────────────────────────────────────────────────────────

describe('v.string()', () => {
  it('parses a valid string', () => {
    assert.equal(v.string().parse('hello'), 'hello');
  });

  it('throws for non-string input', () => {
    assert.throws(() => v.string().parse(42));
    assert.throws(() => v.string().parse(null));
  });

  it('min() rejects strings shorter than minimum', () => {
    assert.throws(() => v.string().min(5).parse('hi'));
  });

  it('min() accepts strings at minimum length', () => {
    assert.equal(v.string().min(3).parse('abc'), 'abc');
  });

  it('max() rejects strings longer than maximum', () => {
    assert.throws(() => v.string().max(3).parse('hello'));
  });

  it('max() accepts strings at maximum length', () => {
    assert.equal(v.string().max(5).parse('hello'), 'hello');
  });

  it('email() accepts valid email addresses', () => {
    assert.equal(v.string().email().parse('user@example.com'), 'user@example.com');
  });

  it('email() rejects invalid email addresses', () => {
    assert.throws(() => v.string().email().parse('not-an-email'));
    assert.throws(() => v.string().email().parse('missing@domain'));
  });

  it('url() accepts valid URLs', () => {
    assert.equal(v.string().url().parse('https://example.com'), 'https://example.com');
    assert.equal(v.string().url().parse('http://localhost:3000/path'), 'http://localhost:3000/path');
  });

  it('url() rejects invalid URLs', () => {
    assert.throws(() => v.string().url().parse('not a url'));
    assert.throws(() => v.string().url().parse(''));
  });

  it('regex() accepts strings matching the pattern', () => {
    assert.equal(v.string().regex(/^\d+$/).parse('12345'), '12345');
  });

  it('regex() rejects strings that do not match the pattern', () => {
    assert.throws(() => v.string().regex(/^\d+$/).parse('abc'));
  });

  it('trim() trims whitespace before validation', () => {
    assert.equal(v.string().trim().parse('  hello  '), 'hello');
  });

  it('trim() works with min() on trimmed value', () => {
    // '  a  ' trims to 'a' which is 1 char, should fail min(2)
    assert.throws(() => v.string().trim().min(2).parse('  a  '));
    // '  hi  ' trims to 'hi' which is 2 chars, should pass min(2)
    assert.equal(v.string().trim().min(2).parse('  hi  '), 'hi');
  });

  it('chains multiple validations', () => {
    const schema = v.string().min(3).max(10).email();
    assert.equal(schema.parse('a@b.com'), 'a@b.com');
    assert.throws(() => schema.parse('ab'));
  });
});

// ─── v.number() ───────────────────────────────────────────────────────────────

describe('v.number()', () => {
  it('parses a valid number', () => {
    assert.equal(v.number().parse(42), 42);
    assert.equal(v.number().parse(3.14), 3.14);
  });

  it('throws for non-number input', () => {
    assert.throws(() => v.number().parse('42'));
    assert.throws(() => v.number().parse(null));
  });

  it('throws for NaN', () => {
    assert.throws(() => v.number().parse(NaN));
  });

  it('min() rejects numbers below minimum', () => {
    assert.throws(() => v.number().min(5).parse(4));
  });

  it('min() accepts numbers at minimum', () => {
    assert.equal(v.number().min(5).parse(5), 5);
  });

  it('max() rejects numbers above maximum', () => {
    assert.throws(() => v.number().max(10).parse(11));
  });

  it('max() accepts numbers at maximum', () => {
    assert.equal(v.number().max(10).parse(10), 10);
  });

  it('int() rejects non-integer numbers', () => {
    assert.throws(() => v.number().int().parse(3.14));
  });

  it('int() accepts integers', () => {
    assert.equal(v.number().int().parse(7), 7);
  });

  it('positive() rejects zero and negative numbers', () => {
    assert.throws(() => v.number().positive().parse(0));
    assert.throws(() => v.number().positive().parse(-1));
  });

  it('positive() accepts positive numbers', () => {
    assert.equal(v.number().positive().parse(1), 1);
  });

  it('negative() rejects zero and positive numbers', () => {
    assert.throws(() => v.number().negative().parse(0));
    assert.throws(() => v.number().negative().parse(1));
  });

  it('negative() accepts negative numbers', () => {
    assert.equal(v.number().negative().parse(-5), -5);
  });
});

// ─── v.boolean() ──────────────────────────────────────────────────────────────

describe('v.boolean()', () => {
  it('parses true and false', () => {
    assert.equal(v.boolean().parse(true), true);
    assert.equal(v.boolean().parse(false), false);
  });

  it('throws for non-boolean input', () => {
    assert.throws(() => v.boolean().parse(1));
    assert.throws(() => v.boolean().parse('true'));
    assert.throws(() => v.boolean().parse(null));
  });
});

// ─── v.array() ────────────────────────────────────────────────────────────────

describe('v.array()', () => {
  it('parses a valid array of strings', () => {
    assert.deepEqual(v.array(v.string()).parse(['a', 'b', 'c']), ['a', 'b', 'c']);
  });

  it('parses a valid array of numbers', () => {
    assert.deepEqual(v.array(v.number()).parse([1, 2, 3]), [1, 2, 3]);
  });

  it('parses an empty array', () => {
    assert.deepEqual(v.array(v.string()).parse([]), []);
  });

  it('throws if not an array', () => {
    assert.throws(() => v.array(v.string()).parse('not an array'));
    assert.throws(() => v.array(v.string()).parse(null));
  });

  it('throws if any item fails validation', () => {
    assert.throws(() => v.array(v.number()).parse([1, 'two', 3]));
  });

  it('min() rejects arrays shorter than minimum length', () => {
    assert.throws(() => v.array(v.string()).min(3).parse(['a', 'b']));
  });

  it('min() accepts arrays at minimum length', () => {
    assert.deepEqual(v.array(v.string()).min(2).parse(['a', 'b']), ['a', 'b']);
  });

  it('max() rejects arrays longer than maximum length', () => {
    assert.throws(() => v.array(v.string()).max(2).parse(['a', 'b', 'c']));
  });

  it('max() accepts arrays at maximum length', () => {
    assert.deepEqual(v.array(v.number()).max(3).parse([1, 2, 3]), [1, 2, 3]);
  });
});

// ─── v.object() ───────────────────────────────────────────────────────────────

describe('v.object()', () => {
  it('parses a valid object', () => {
    const schema = v.object({ name: v.string(), age: v.number() });
    const result = schema.parse({ name: 'Alice', age: 30 });
    assert.deepEqual(result, { name: 'Alice', age: 30 });
  });

  it('throws if not an object', () => {
    const schema = v.object({ name: v.string() });
    assert.throws(() => schema.parse(null));
    assert.throws(() => schema.parse('string'));
    assert.throws(() => schema.parse([1, 2]));
  });

  it('throws if a field fails validation', () => {
    const schema = v.object({ name: v.string(), age: v.number() });
    assert.throws(() => schema.parse({ name: 'Alice', age: 'thirty' }));
  });

  it('collects errors from multiple fields', () => {
    const schema = v.object({ name: v.string(), age: v.number() });
    const result = schema.safeParse({ name: 42, age: 'old' });
    assert.equal(result.success, false);
    assert.ok((result.errors?.length ?? 0) >= 2);
  });

  it('includes field path in error messages', () => {
    const schema = v.object({ name: v.string() });
    const result = schema.safeParse({ name: 42 });
    assert.equal(result.success, false);
    assert.ok(result.errors?.some((e) => e.path.includes('name')));
  });

  it('pick() returns a new schema with only the picked keys', () => {
    const schema = v.object({ name: v.string(), age: v.number(), active: v.boolean() });
    const picked = schema.pick('name', 'age');
    const result = picked.parse({ name: 'Bob', age: 25 });
    assert.deepEqual(result, { name: 'Bob', age: 25 });
  });

  it('omit() returns a new schema without the omitted keys', () => {
    const schema = v.object({ name: v.string(), age: v.number(), active: v.boolean() });
    const omitted = schema.omit('active');
    const result = omitted.parse({ name: 'Carol', age: 40 });
    assert.deepEqual(result, { name: 'Carol', age: 40 });
  });
});

// ─── optional / nullable ──────────────────────────────────────────────────────

describe('optional()', () => {
  it('returns undefined for undefined input', () => {
    assert.equal(v.string().optional().parse(undefined), undefined);
  });

  it('parses the inner value when present', () => {
    assert.equal(v.string().optional().parse('hello'), 'hello');
  });

  it('still rejects invalid non-undefined values', () => {
    assert.throws(() => v.string().optional().parse(42));
  });
});

describe('nullable()', () => {
  it('returns null for null input', () => {
    assert.equal(v.string().nullable().parse(null), null);
  });

  it('parses the inner value when not null', () => {
    assert.equal(v.string().nullable().parse('hello'), 'hello');
  });

  it('still rejects invalid non-null values', () => {
    assert.throws(() => v.string().nullable().parse(42));
  });
});

// ─── safeParse ────────────────────────────────────────────────────────────────

describe('safeParse()', () => {
  it('returns { success: true, data } on success', () => {
    const result = v.string().safeParse('hello');
    assert.equal(result.success, true);
    assert.equal(result.data, 'hello');
    assert.equal(result.errors, undefined);
  });

  it('returns { success: false, errors } on failure', () => {
    const result = v.number().safeParse('not a number');
    assert.equal(result.success, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok((result.errors?.length ?? 0) > 0);
    assert.equal(result.data, undefined);
  });

  it('captures validation errors with path info for objects', () => {
    const schema = v.object({ age: v.number().min(0) });
    const result = schema.safeParse({ age: -1 });
    assert.equal(result.success, false);
    assert.ok(result.errors?.some((e) => e.path[0] === 'age'));
  });
});

// ─── v.union() ────────────────────────────────────────────────────────────────

describe('v.union()', () => {
  it('parses a value that matches the first schema', () => {
    const schema = v.union(v.string(), v.number());
    assert.equal(schema.parse('hello'), 'hello');
  });

  it('parses a value that matches the second schema', () => {
    const schema = v.union(v.string(), v.number());
    assert.equal(schema.parse(42), 42);
  });

  it('throws if no schema matches', () => {
    const schema = v.union(v.string(), v.number());
    assert.throws(() => schema.parse(true));
    assert.throws(() => schema.parse(null));
  });

  it('works with more than two schemas', () => {
    const schema = v.union(v.string(), v.number(), v.boolean());
    assert.equal(schema.parse(true), true);
    assert.equal(schema.parse(0), 0);
    assert.equal(schema.parse('x'), 'x');
    assert.throws(() => schema.parse(null));
  });
});

// ─── v.literal() ─────────────────────────────────────────────────────────────

describe('v.literal()', () => {
  it('parses a matching string literal', () => {
    assert.equal(v.literal('active').parse('active'), 'active');
  });

  it('throws for non-matching string', () => {
    assert.throws(() => v.literal('active').parse('inactive'));
  });

  it('parses a matching number literal', () => {
    assert.equal(v.literal(42).parse(42), 42);
  });

  it('throws for non-matching number', () => {
    assert.throws(() => v.literal(42).parse(43));
  });

  it('parses a matching boolean literal', () => {
    assert.equal(v.literal(true).parse(true), true);
  });

  it('throws for non-matching boolean', () => {
    assert.throws(() => v.literal(true).parse(false));
  });
});

// ─── refine ───────────────────────────────────────────────────────────────────

describe('refine()', () => {
  it('accepts values that pass the refinement', () => {
    const even = v.number().refine((n) => n % 2 === 0, 'Must be even');
    assert.equal(even.parse(4), 4);
  });

  it('throws with the custom message for values that fail the refinement', () => {
    const even = v.number().refine((n) => n % 2 === 0, 'Must be even');
    const result = even.safeParse(3);
    assert.equal(result.success, false);
    assert.ok(result.errors?.some((e) => e.message === 'Must be even'));
  });

  it('uses default message when none is provided', () => {
    const schema = v.string().refine((s) => s.startsWith('A'));
    const result = schema.safeParse('Bob');
    assert.equal(result.success, false);
    assert.ok((result.errors?.length ?? 0) > 0);
  });

  it('can chain refine with other methods', () => {
    const schema = v
      .string()
      .min(3)
      .refine((s) => s === s.toUpperCase(), 'Must be uppercase');
    assert.equal(schema.parse('ABC'), 'ABC');
    assert.throws(() => schema.parse('abc'));
    assert.throws(() => schema.parse('AB')); // too short
  });
});

// ─── v.any() ─────────────────────────────────────────────────────────────────

describe('v.any()', () => {
  it('accepts any value', () => {
    assert.equal(v.any().parse(null), null);
    assert.equal(v.any().parse(undefined), undefined);
    assert.deepEqual(v.any().parse({ a: 1 }), { a: 1 });
    assert.equal(v.any().parse('hello'), 'hello');
    assert.equal(v.any().parse(42), 42);
  });
});
