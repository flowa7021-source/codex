// ─── Unit Tests: json-schema ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validate,
  validateStrict,
  compileSchema,
} from '../../app/modules/json-schema.js';

// ─── validate – type checks ───────────────────────────────────────────────────

describe('validate – type checks', () => {
  it('accepts a string when type is string', () => {
    const r = validate('hello', { type: 'string' });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, []);
  });

  it('rejects a number when type is string', () => {
    const r = validate(42, { type: 'string' });
    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 1);
    assert.ok(r.errors[0].message.includes('string'));
  });

  it('accepts one of multiple allowed types', () => {
    const schema = { type: ['string', 'null'] };
    assert.equal(validate('hi', schema).valid, true);
    assert.equal(validate(null, schema).valid, true);
    assert.equal(validate(42, schema).valid, false);
  });

  it('accepts integer type for whole numbers', () => {
    const schema = { type: 'integer' };
    assert.equal(validate(7, schema).valid, true);
    assert.equal(validate(7.5, schema).valid, false);
  });

  it('nullable allows null regardless of type', () => {
    const schema = { type: 'string', nullable: true };
    assert.equal(validate(null, schema).valid, true);
    assert.equal(validate('ok', schema).valid, true);
    assert.equal(validate(99, schema).valid, false);
  });
});

// ─── validate – string constraints ───────────────────────────────────────────

describe('validate – string constraints', () => {
  it('enforces minLength', () => {
    const schema = { type: 'string', minLength: 3 };
    assert.equal(validate('ab', schema).valid, false);
    assert.equal(validate('abc', schema).valid, true);
  });

  it('enforces maxLength', () => {
    const schema = { type: 'string', maxLength: 5 };
    assert.equal(validate('hello!', schema).valid, false);
    assert.equal(validate('hello', schema).valid, true);
  });

  it('enforces pattern', () => {
    const schema = { type: 'string', pattern: '^[a-z]+$' };
    assert.equal(validate('abc', schema).valid, true);
    assert.equal(validate('ABC', schema).valid, false);
    assert.equal(validate('abc123', schema).valid, false);
  });
});

// ─── validate – number constraints ───────────────────────────────────────────

describe('validate – number constraints', () => {
  it('enforces minimum', () => {
    const schema = { type: 'number', minimum: 0 };
    assert.equal(validate(-1, schema).valid, false);
    assert.equal(validate(0, schema).valid, true);
    assert.equal(validate(10, schema).valid, true);
  });

  it('enforces maximum', () => {
    const schema = { type: 'number', maximum: 100 };
    assert.equal(validate(101, schema).valid, false);
    assert.equal(validate(100, schema).valid, true);
  });
});

// ─── validate – enum ──────────────────────────────────────────────────────────

describe('validate – enum', () => {
  it('accepts a value in the enum list', () => {
    const schema = { enum: ['red', 'green', 'blue'] };
    assert.equal(validate('red', schema).valid, true);
  });

  it('rejects a value not in the enum list', () => {
    const schema = { enum: ['red', 'green', 'blue'] };
    const r = validate('purple', schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].message.includes('one of'));
  });
});

// ─── validate – object constraints ───────────────────────────────────────────

describe('validate – object constraints', () => {
  it('enforces required properties', () => {
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    const r = validate({ name: 'Alice' }, schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.message.includes("'age'")));
  });

  it('validates nested property types', () => {
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
    };
    assert.equal(validate({ count: 'not-a-number' }, schema).valid, false);
    assert.equal(validate({ count: 5 }, schema).valid, true);
  });

  it('blocks additionalProperties when set to false', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    };
    const r = validate({ a: 'x', b: 'y' }, schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.message.includes("'b'")));
  });

  it('validates additionalProperties against a sub-schema', () => {
    const schema = {
      type: 'object',
      properties: { known: { type: 'string' } },
      additionalProperties: { type: 'number' },
    };
    assert.equal(validate({ known: 'ok', extra: 42 }, schema).valid, true);
    assert.equal(validate({ known: 'ok', extra: 'oops' }, schema).valid, false);
  });
});

// ─── validate – array constraints ────────────────────────────────────────────

describe('validate – array items', () => {
  it('validates each item against the items schema', () => {
    const schema = { type: 'array', items: { type: 'number' } };
    assert.equal(validate([1, 2, 3], schema).valid, true);
    const r = validate([1, 'two', 3], schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.path.includes('/1')));
  });
});

// ─── validate – error path ────────────────────────────────────────────────────

describe('validate – error paths', () => {
  it('reports nested path for property errors', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: { age: { type: 'number' } },
        },
      },
    };
    const r = validate({ user: { age: 'old' } }, schema);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.path === '/user/age'));
  });
});

// ─── validateStrict ───────────────────────────────────────────────────────────

describe('validateStrict', () => {
  it('does not throw on valid data', () => {
    assert.doesNotThrow(() => validateStrict('hello', { type: 'string' }));
  });

  it('throws TypeError on invalid data', () => {
    assert.throws(
      () => validateStrict(42, { type: 'string' }),
      (err) => err instanceof TypeError && err.message.includes('validation failed'),
    );
  });

  it('includes error details in the thrown message', () => {
    assert.throws(
      () => validateStrict({ x: 'bad' }, { type: 'object', properties: { x: { type: 'number' } } }),
      (err) => err.message.includes('/x'),
    );
  });
});

// ─── compileSchema ────────────────────────────────────────────────────────────

describe('compileSchema', () => {
  it('returns a reusable validator function', () => {
    const check = compileSchema({ type: 'number', minimum: 0, maximum: 10 });
    assert.equal(check(5).valid, true);
    assert.equal(check(-1).valid, false);
    assert.equal(check(11).valid, false);
  });

  it('compiled validator is independent of schema mutations', () => {
    const schema = { type: 'string', minLength: 2 };
    const check = compileSchema(schema);
    // Mutate the original — compiled validator must be unaffected
    schema.minLength = 100;
    assert.equal(check('hi').valid, true); // original minLength was 2
  });

  it('compiled validator accumulates errors per call without leakage', () => {
    const check = compileSchema({ type: 'number', minimum: 1, maximum: 5 });
    const r1 = check(0);
    const r2 = check(3);
    assert.equal(r1.valid, false);
    assert.equal(r2.valid, true);
    // r1 errors must not bleed into r2
    assert.equal(r2.errors.length, 0);
  });
});
