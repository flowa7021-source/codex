// ─── Unit Tests: schema-validator ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validate,
  matches,
  createValidator,
} from '../../app/modules/schema-validator.js';

// ─── String validation ────────────────────────────────────────────────────────

describe('validate string', () => {
  it('accepts a valid string', () => {
    const result = validate('hello', { type: 'string' });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects non-string when type is string', () => {
    const result = validate(42, { type: 'string' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('enforces required: true — rejects undefined', () => {
    const result = validate(undefined, { type: 'string', required: true });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('required'));
  });

  it('enforces minLength', () => {
    const result = validate('hi', { type: 'string', minLength: 5 });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('minLength'));
  });

  it('accepts string at minLength boundary', () => {
    assert.equal(validate('hello', { type: 'string', minLength: 5 }).valid, true);
  });

  it('enforces maxLength', () => {
    const result = validate('toolongstring', { type: 'string', maxLength: 5 });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('maxLength'));
  });

  it('accepts string at maxLength boundary', () => {
    assert.equal(validate('hello', { type: 'string', maxLength: 5 }).valid, true);
  });

  it('enforces pattern', () => {
    const result = validate('abc123', { type: 'string', pattern: '^[a-z]+$' });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('pattern'));
  });

  it('accepts string matching pattern', () => {
    assert.equal(validate('abc', { type: 'string', pattern: '^[a-z]+$' }).valid, true);
  });

  it('enforces enum for strings', () => {
    const result = validate('banana', { type: 'string', enum: ['apple', 'cherry'] });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('one of'));
  });

  it('accepts string in enum', () => {
    assert.equal(validate('apple', { type: 'string', enum: ['apple', 'cherry'] }).valid, true);
  });
});

// ─── Number validation ────────────────────────────────────────────────────────

describe('validate number', () => {
  it('accepts a valid number', () => {
    assert.equal(validate(42, { type: 'number' }).valid, true);
  });

  it('rejects string when type is number', () => {
    const result = validate('42', { type: 'number' });
    assert.equal(result.valid, false);
  });

  it('enforces min', () => {
    const result = validate(3, { type: 'number', min: 5 });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('min'));
  });

  it('accepts number at min boundary', () => {
    assert.equal(validate(5, { type: 'number', min: 5 }).valid, true);
  });

  it('enforces max', () => {
    const result = validate(100, { type: 'number', max: 50 });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('max'));
  });

  it('accepts number at max boundary', () => {
    assert.equal(validate(50, { type: 'number', max: 50 }).valid, true);
  });

  it('enforces both min and max', () => {
    assert.equal(validate(10, { type: 'number', min: 1, max: 100 }).valid, true);
    assert.equal(validate(0, { type: 'number', min: 1, max: 100 }).valid, false);
    assert.equal(validate(101, { type: 'number', min: 1, max: 100 }).valid, false);
  });
});

// ─── Boolean validation ───────────────────────────────────────────────────────

describe('validate boolean', () => {
  it('accepts true', () => {
    assert.equal(validate(true, { type: 'boolean' }).valid, true);
  });

  it('accepts false', () => {
    assert.equal(validate(false, { type: 'boolean' }).valid, true);
  });

  it('rejects string when type is boolean', () => {
    assert.equal(validate('true', { type: 'boolean' }).valid, false);
  });

  it('rejects number when type is boolean', () => {
    assert.equal(validate(1, { type: 'boolean' }).valid, false);
  });
});

// ─── Array validation ─────────────────────────────────────────────────────────

describe('validate array', () => {
  it('accepts a valid array', () => {
    assert.equal(validate([1, 2, 3], { type: 'array' }).valid, true);
  });

  it('rejects non-array when type is array', () => {
    assert.equal(validate({ length: 1 }, { type: 'array' }).valid, false);
  });

  it('validates items schema', () => {
    const result = validate([1, 'two', 3], { type: 'array', items: { type: 'number' } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.path.includes('1')));
  });

  it('accepts array where all items match schema', () => {
    assert.equal(
      validate([1, 2, 3], { type: 'array', items: { type: 'number' } }).valid,
      true,
    );
  });

  it('enforces minItems', () => {
    const result = validate([1], { type: 'array', minItems: 3 });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('minItems'));
  });

  it('enforces maxItems', () => {
    const result = validate([1, 2, 3, 4, 5], { type: 'array', maxItems: 3 });
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].message.includes('maxItems'));
  });

  it('accepts empty array with no constraints', () => {
    assert.equal(validate([], { type: 'array' }).valid, true);
  });
});

// ─── Object validation ────────────────────────────────────────────────────────

describe('validate object', () => {
  it('accepts a plain object', () => {
    assert.equal(validate({ a: 1 }, { type: 'object' }).valid, true);
  });

  it('rejects array when type is object', () => {
    assert.equal(validate([1, 2], { type: 'object' }).valid, false);
  });

  it('validates properties schema', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: {
        name: { type: /** @type {const} */ ('string') },
        age: { type: /** @type {const} */ ('number') },
      },
    };
    const result = validate({ name: 'Alice', age: 'not a number' }, schema);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.path === 'age'));
  });

  it('detects missing required fields', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: {
        name: { type: /** @type {const} */ ('string'), required: true },
      },
    };
    const result = validate({}, schema);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.path === 'name'));
  });

  it('rejects additional properties when additionalProperties is false', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: { a: { type: /** @type {const} */ ('number') } },
      additionalProperties: false,
    };
    const result = validate({ a: 1, b: 2 }, schema);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.path === 'b'));
  });

  it('allows additional properties by default', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: { a: { type: /** @type {const} */ ('number') } },
    };
    assert.equal(validate({ a: 1, b: 2 }, schema).valid, true);
  });
});

// ─── Nullable ─────────────────────────────────────────────────────────────────

describe('nullable', () => {
  it('accepts null when nullable is true', () => {
    assert.equal(validate(null, { type: 'string', nullable: true }).valid, true);
  });

  it('rejects null when nullable is not set', () => {
    const result = validate(null, { type: 'string', required: true });
    assert.equal(result.valid, false);
  });

  it('accepts non-null value when nullable is true', () => {
    assert.equal(validate('hello', { type: 'string', nullable: true }).valid, true);
  });
});

// ─── Multiple types ───────────────────────────────────────────────────────────

describe('multiple types', () => {
  it('accepts string when type is [string, number]', () => {
    assert.equal(validate('hello', { type: ['string', 'number'] }).valid, true);
  });

  it('accepts number when type is [string, number]', () => {
    assert.equal(validate(42, { type: ['string', 'number'] }).valid, true);
  });

  it('rejects boolean when type is [string, number]', () => {
    assert.equal(validate(true, { type: ['string', 'number'] }).valid, false);
  });

  it('type: any accepts any value', () => {
    assert.equal(validate('anything', { type: 'any' }).valid, true);
    assert.equal(validate(42, { type: 'any' }).valid, true);
    assert.equal(validate(null, { type: 'any' }).valid, true);
    assert.equal(validate([], { type: 'any' }).valid, true);
  });
});

// ─── matches ──────────────────────────────────────────────────────────────────

describe('matches', () => {
  it('returns true when value is valid', () => {
    assert.equal(matches('hello', { type: 'string' }), true);
  });

  it('returns false when value is invalid', () => {
    assert.equal(matches(42, { type: 'string' }), false);
  });

  it('returns true for complex valid object', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: {
        name: { type: /** @type {const} */ ('string'), required: true },
      },
    };
    assert.equal(matches({ name: 'Alice' }, schema), true);
  });

  it('returns false for missing required property', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: {
        name: { type: /** @type {const} */ ('string'), required: true },
      },
    };
    assert.equal(matches({}, schema), false);
  });
});

// ─── createValidator ──────────────────────────────────────────────────────────

describe('createValidator', () => {
  it('returns a reusable validator function', () => {
    const validator = createValidator({ type: 'number', min: 0, max: 100 });
    assert.equal(typeof validator, 'function');
  });

  it('validator returns valid result for matching value', () => {
    const validator = createValidator({ type: 'number', min: 0, max: 100 });
    const result = validator(50);
    assert.equal(result.valid, true);
  });

  it('validator returns invalid result for non-matching value', () => {
    const validator = createValidator({ type: 'number', min: 0, max: 100 });
    const result = validator(150);
    assert.equal(result.valid, false);
  });

  it('validator can be called multiple times', () => {
    const validator = createValidator({ type: 'string', minLength: 3 });
    assert.equal(validator('hello').valid, true);
    assert.equal(validator('hi').valid, false);
    assert.equal(validator('world').valid, true);
  });
});

// ─── Nested schema ────────────────────────────────────────────────────────────

describe('nested schema', () => {
  it('validates a deeply nested object schema', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: {
        user: {
          type: /** @type {const} */ ('object'),
          properties: {
            name: { type: /** @type {const} */ ('string'), required: true },
            address: {
              type: /** @type {const} */ ('object'),
              properties: {
                city: { type: /** @type {const} */ ('string'), required: true },
                zip: { type: /** @type {const} */ ('string') },
              },
            },
          },
        },
      },
    };

    const valid = validate(
      { user: { name: 'Alice', address: { city: 'NY', zip: '10001' } } },
      schema,
    );
    assert.equal(valid.valid, true);
  });

  it('reports nested validation errors with correct paths', () => {
    const schema = {
      type: /** @type {const} */ ('object'),
      properties: {
        user: {
          type: /** @type {const} */ ('object'),
          properties: {
            name: { type: /** @type {const} */ ('string'), required: true },
            age: { type: /** @type {const} */ ('number'), min: 0 },
          },
        },
      },
    };

    const result = validate({ user: { name: 'Bob', age: -5 } }, schema);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.path === 'user.age'));
  });

  it('validates array of objects with item schema', () => {
    const schema = {
      type: /** @type {const} */ ('array'),
      items: {
        type: /** @type {const} */ ('object'),
        properties: {
          id: { type: /** @type {const} */ ('number'), required: true },
          label: { type: /** @type {const} */ ('string') },
        },
      },
    };

    const valid = validate([{ id: 1, label: 'a' }, { id: 2, label: 'b' }], schema);
    assert.equal(valid.valid, true);

    const invalid = validate([{ id: 1 }, { label: 'missing-id' }], schema);
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.some((e) => e.path.includes('1')));
  });
});
