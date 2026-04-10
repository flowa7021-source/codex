// ─── Unit Tests: json-schema ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateSchema,
  compileSchema,
} from '../../app/modules/json-schema.js';

// ─── validateSchema – type checks ─────────────────────────────────────────────

describe('validateSchema – type: string', () => {
  it('accepts a string value', () => {
    const r = validateSchema('hello', { type: 'string' });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, []);
  });

  it('rejects a number when type is string', () => {
    const r = validateSchema(42, { type: 'string' });
    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 1);
    assert.ok(typeof r.errors[0] === 'string');
    assert.ok(r.errors[0].includes('string'));
  });

  it('rejects null when type is string', () => {
    const r = validateSchema(null, { type: 'string' });
    assert.equal(r.valid, false);
  });

  it('rejects boolean when type is string', () => {
    const r = validateSchema(true, { type: 'string' });
    assert.equal(r.valid, false);
  });
});

describe('validateSchema – type: number', () => {
  it('accepts a number value', () => {
    assert.equal(validateSchema(3.14, { type: 'number' }).valid, true);
  });

  it('rejects a string when type is number', () => {
    assert.equal(validateSchema('42', { type: 'number' }).valid, false);
  });
});

describe('validateSchema – type: boolean', () => {
  it('accepts true and false', () => {
    assert.equal(validateSchema(true, { type: 'boolean' }).valid, true);
    assert.equal(validateSchema(false, { type: 'boolean' }).valid, true);
  });

  it('rejects string "true"', () => {
    assert.equal(validateSchema('true', { type: 'boolean' }).valid, false);
  });
});

describe('validateSchema – type: null', () => {
  it('accepts null', () => {
    assert.equal(validateSchema(null, { type: 'null' }).valid, true);
  });

  it('rejects undefined (not JSON-null)', () => {
    assert.equal(validateSchema(undefined, { type: 'null' }).valid, false);
  });
});

describe('validateSchema – type: array', () => {
  it('accepts an array', () => {
    assert.equal(validateSchema([1, 2], { type: 'array' }).valid, true);
  });

  it('rejects a plain object', () => {
    assert.equal(validateSchema({}, { type: 'array' }).valid, false);
  });
});

describe('validateSchema – type: object', () => {
  it('accepts a plain object', () => {
    assert.equal(validateSchema({ a: 1 }, { type: 'object' }).valid, true);
  });

  it('rejects an array', () => {
    assert.equal(validateSchema([], { type: 'object' }).valid, false);
  });

  it('rejects null', () => {
    assert.equal(validateSchema(null, { type: 'object' }).valid, false);
  });
});

describe('validateSchema – type: integer', () => {
  it('accepts a whole number', () => {
    assert.equal(validateSchema(7, { type: 'integer' }).valid, true);
  });

  it('rejects a fractional number', () => {
    assert.equal(validateSchema(7.5, { type: 'integer' }).valid, false);
  });
});

describe('validateSchema – multiple types', () => {
  it('accepts any listed type', () => {
    const schema = { type: ['string', 'null'] };
    assert.equal(validateSchema('hi', schema).valid, true);
    assert.equal(validateSchema(null, schema).valid, true);
  });

  it('rejects unlisted type', () => {
    const schema = { type: ['string', 'null'] };
    assert.equal(validateSchema(42, schema).valid, false);
  });
});

// ─── validateSchema – string constraints ──────────────────────────────────────

describe('validateSchema – minLength', () => {
  it('accepts string meeting minLength', () => {
    assert.equal(validateSchema('abc', { type: 'string', minLength: 3 }).valid, true);
  });

  it('rejects string shorter than minLength', () => {
    const r = validateSchema('ab', { type: 'string', minLength: 3 });
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('minLength'));
  });
});

describe('validateSchema – maxLength', () => {
  it('accepts string within maxLength', () => {
    assert.equal(validateSchema('hello', { type: 'string', maxLength: 5 }).valid, true);
  });

  it('rejects string exceeding maxLength', () => {
    const r = validateSchema('hello!', { type: 'string', maxLength: 5 });
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('maxLength'));
  });
});

describe('validateSchema – pattern', () => {
  it('accepts string matching pattern', () => {
    assert.equal(validateSchema('abc', { type: 'string', pattern: '^[a-z]+$' }).valid, true);
  });

  it('rejects string not matching pattern', () => {
    const r = validateSchema('ABC', { type: 'string', pattern: '^[a-z]+$' });
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('pattern'));
  });

  it('rejects mixed alphanumeric against letters-only pattern', () => {
    assert.equal(validateSchema('abc123', { type: 'string', pattern: '^[a-z]+$' }).valid, false);
  });
});

// ─── validateSchema – number constraints ──────────────────────────────────────

describe('validateSchema – minimum / maximum', () => {
  it('accepts value equal to minimum', () => {
    assert.equal(validateSchema(0, { type: 'number', minimum: 0 }).valid, true);
  });

  it('rejects value below minimum', () => {
    const r = validateSchema(-1, { type: 'number', minimum: 0 });
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('minimum'));
  });

  it('accepts value equal to maximum', () => {
    assert.equal(validateSchema(100, { type: 'number', maximum: 100 }).valid, true);
  });

  it('rejects value above maximum', () => {
    const r = validateSchema(101, { type: 'number', maximum: 100 });
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('maximum'));
  });
});

// ─── validateSchema – enum ────────────────────────────────────────────────────

describe('validateSchema – enum', () => {
  it('accepts a value that is in the enum', () => {
    assert.equal(validateSchema('red', { enum: ['red', 'green', 'blue'] }).valid, true);
  });

  it('rejects a value not in the enum', () => {
    const r = validateSchema('purple', { enum: ['red', 'green', 'blue'] });
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('one of'));
  });

  it('accepts numeric enum value', () => {
    assert.equal(validateSchema(2, { enum: [1, 2, 3] }).valid, true);
  });

  it('rejects value not in numeric enum', () => {
    assert.equal(validateSchema(4, { enum: [1, 2, 3] }).valid, false);
  });
});

// ─── validateSchema – required ────────────────────────────────────────────────

describe('validateSchema – required', () => {
  it('passes when all required fields are present', () => {
    const schema = { type: 'object', required: ['name', 'age'] };
    assert.equal(validateSchema({ name: 'Alice', age: 30 }, schema).valid, true);
  });

  it('fails when a required field is missing', () => {
    const schema = { type: 'object', required: ['name', 'age'] };
    const r = validateSchema({ name: 'Alice' }, schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('age')));
  });

  it('reports all missing required fields', () => {
    const schema = { type: 'object', required: ['a', 'b', 'c'] };
    const r = validateSchema({}, schema);
    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 3);
  });
});

// ─── validateSchema – properties ──────────────────────────────────────────────

describe('validateSchema – properties', () => {
  it('validates each property against its sub-schema', () => {
    const schema = {
      type: 'object',
      properties: { count: { type: 'number' } },
    };
    assert.equal(validateSchema({ count: 5 }, schema).valid, true);
    assert.equal(validateSchema({ count: 'five' }, schema).valid, false);
  });

  it('ignores extra properties unless additionalProperties restricts them', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' } },
    };
    assert.equal(validateSchema({ a: 'x', b: 'y' }, schema).valid, true);
  });

  it('validates deeply nested properties', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: { age: { type: 'number' } },
        },
      },
    };
    assert.equal(validateSchema({ user: { age: 30 } }, schema).valid, true);
    assert.equal(validateSchema({ user: { age: 'old' } }, schema).valid, false);
  });
});

// ─── validateSchema – additionalProperties ────────────────────────────────────

describe('validateSchema – additionalProperties: false', () => {
  it('allows only declared properties', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    };
    assert.equal(validateSchema({ a: 'x' }, schema).valid, true);
  });

  it('rejects extra properties', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    };
    const r = validateSchema({ a: 'x', b: 'y' }, schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('b')));
  });
});

describe('validateSchema – additionalProperties: schema', () => {
  it('validates extra properties against the sub-schema', () => {
    const schema = {
      type: 'object',
      properties: { known: { type: 'string' } },
      additionalProperties: { type: 'number' },
    };
    assert.equal(validateSchema({ known: 'ok', extra: 42 }, schema).valid, true);
    assert.equal(validateSchema({ known: 'ok', extra: 'oops' }, schema).valid, false);
  });
});

// ─── validateSchema – array items ─────────────────────────────────────────────

describe('validateSchema – array items', () => {
  it('validates each element against items schema', () => {
    const schema = { type: 'array', items: { type: 'number' } };
    assert.equal(validateSchema([1, 2, 3], schema).valid, true);
  });

  it('reports errors for invalid items', () => {
    const schema = { type: 'array', items: { type: 'number' } };
    const r = validateSchema([1, 'two', 3], schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('[1]')));
  });

  it('accepts an empty array regardless of items schema', () => {
    const schema = { type: 'array', items: { type: 'number' } };
    assert.equal(validateSchema([], schema).valid, true);
  });
});

// ─── validateSchema – combined constraints ────────────────────────────────────

describe('validateSchema – combined constraints', () => {
  it('collects multiple errors in one pass', () => {
    const schema = {
      type: 'object',
      required: ['x', 'y'],
      properties: { x: { type: 'number' } },
    };
    const r = validateSchema({ x: 'bad' }, schema);
    assert.equal(r.valid, false);
    // Should report both: type error on x AND missing y
    assert.ok(r.errors.length >= 2);
  });

  it('no-op schema accepts anything', () => {
    assert.equal(validateSchema(42, {}).valid, true);
    assert.equal(validateSchema('str', {}).valid, true);
    assert.equal(validateSchema(null, {}).valid, true);
  });
});

// ─── compileSchema ────────────────────────────────────────────────────────────

describe('compileSchema', () => {
  it('returns a reusable validator function', () => {
    const check = compileSchema({ type: 'number', minimum: 0, maximum: 10 });
    assert.equal(typeof check, 'function');
    assert.equal(check(5).valid, true);
    assert.equal(check(-1).valid, false);
    assert.equal(check(11).valid, false);
  });

  it('compiled function returns the same result as validateSchema', () => {
    const schema = { type: 'string', minLength: 2 };
    const check = compileSchema(schema);
    assert.deepEqual(check('hi'), validateSchema('hi', schema));
    assert.deepEqual(check('h'), validateSchema('h', schema));
  });

  it('errors do not leak between calls', () => {
    const check = compileSchema({ type: 'number', minimum: 1 });
    const r1 = check(0);
    const r2 = check(5);
    assert.equal(r1.valid, false);
    assert.equal(r2.valid, true);
    assert.equal(r2.errors.length, 0);
  });

  it('can validate objects with required fields', () => {
    const check = compileSchema({ type: 'object', required: ['id'] });
    assert.equal(check({ id: 1 }).valid, true);
    assert.equal(check({}).valid, false);
  });
});
