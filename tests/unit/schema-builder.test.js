// ─── Unit Tests: schema-builder ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { s } from '../../app/modules/schema-builder.js';

// ─── s.string() ───────────────────────────────────────────────────────────────

describe('s.string() basic', () => {
  it('accepts a string', () => {
    const result = s.string().validate('hello');
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects a number', () => {
    const result = s.string().validate(42);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects null', () => {
    const result = s.string().validate(null);
    assert.equal(result.valid, false);
  });

  it('rejects undefined', () => {
    const result = s.string().validate(undefined);
    assert.equal(result.valid, false);
  });

  it('accepts empty string', () => {
    const result = s.string().validate('');
    assert.equal(result.valid, true);
  });
});

describe('s.string().min()', () => {
  it('accepts string meeting minimum length', () => {
    assert.equal(s.string().min(3).validate('hello').valid, true);
  });

  it('accepts string equal to minimum', () => {
    assert.equal(s.string().min(5).validate('hello').valid, true);
  });

  it('rejects string below minimum', () => {
    const result = s.string().min(10).validate('hi');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('10'));
  });
});

describe('s.string().max()', () => {
  it('accepts string within maximum', () => {
    assert.equal(s.string().max(10).validate('hello').valid, true);
  });

  it('accepts string equal to maximum', () => {
    assert.equal(s.string().max(5).validate('hello').valid, true);
  });

  it('rejects string exceeding maximum', () => {
    const result = s.string().max(3).validate('hello');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('3'));
  });
});

describe('s.string().email()', () => {
  it('accepts valid email', () => {
    assert.equal(s.string().email().validate('user@example.com').valid, true);
  });

  it('rejects invalid email', () => {
    const result = s.string().email().validate('not-an-email');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].toLowerCase().includes('email'));
  });
});

describe('s.string().url()', () => {
  it('accepts valid https URL', () => {
    assert.equal(s.string().url().validate('https://example.com').valid, true);
  });

  it('rejects invalid URL', () => {
    const result = s.string().url().validate('not-a-url');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].toLowerCase().includes('url'));
  });
});

describe('s.string().pattern()', () => {
  it('accepts string matching pattern', () => {
    assert.equal(s.string().pattern(/^\d+$/).validate('12345').valid, true);
  });

  it('rejects string not matching pattern', () => {
    const result = s.string().pattern(/^\d+$/).validate('abc');
    assert.equal(result.valid, false);
  });
});

describe('s.string().trim()', () => {
  it('validates trimmed value, so leading spaces do not count toward min', () => {
    // "  hi  " trimmed is "hi" which is 2 chars < min 5
    const result = s.string().trim().min(5).validate('  hi  ');
    assert.equal(result.valid, false);
  });

  it('parse() returns trimmed string', () => {
    const value = s.string().trim().parse('  hello  ');
    assert.equal(value, 'hello');
  });

  it('accepts string that meets min after trim', () => {
    assert.equal(s.string().trim().min(3).validate('  hello  ').valid, true);
  });
});

// ─── s.number() ───────────────────────────────────────────────────────────────

describe('s.number() basic', () => {
  it('accepts a number', () => {
    assert.equal(s.number().validate(42).valid, true);
  });

  it('rejects a string', () => {
    assert.equal(s.number().validate('42').valid, false);
  });

  it('rejects NaN', () => {
    assert.equal(s.number().validate(NaN).valid, false);
  });

  it('accepts zero', () => {
    assert.equal(s.number().validate(0).valid, true);
  });

  it('accepts negative number', () => {
    assert.equal(s.number().validate(-5).valid, true);
  });
});

describe('s.number().min()', () => {
  it('accepts value at minimum', () => {
    assert.equal(s.number().min(5).validate(5).valid, true);
  });

  it('accepts value above minimum', () => {
    assert.equal(s.number().min(5).validate(10).valid, true);
  });

  it('rejects value below minimum', () => {
    const result = s.number().min(5).validate(4);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('5'));
  });
});

describe('s.number().max()', () => {
  it('accepts value at maximum', () => {
    assert.equal(s.number().max(10).validate(10).valid, true);
  });

  it('rejects value above maximum', () => {
    const result = s.number().max(10).validate(11);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('10'));
  });
});

describe('s.number().integer()', () => {
  it('accepts integer value', () => {
    assert.equal(s.number().integer().validate(5).valid, true);
  });

  it('rejects float value', () => {
    const result = s.number().integer().validate(5.5);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].toLowerCase().includes('integer'));
  });
});

describe('s.number().positive()', () => {
  it('accepts positive number', () => {
    assert.equal(s.number().positive().validate(1).valid, true);
  });

  it('rejects zero', () => {
    const result = s.number().positive().validate(0);
    assert.equal(result.valid, false);
  });

  it('rejects negative number', () => {
    assert.equal(s.number().positive().validate(-1).valid, false);
  });
});

// ─── s.boolean() ──────────────────────────────────────────────────────────────

describe('s.boolean()', () => {
  it('accepts true', () => {
    assert.equal(s.boolean().validate(true).valid, true);
  });

  it('accepts false', () => {
    assert.equal(s.boolean().validate(false).valid, true);
  });

  it('rejects string "true"', () => {
    assert.equal(s.boolean().validate('true').valid, false);
  });

  it('rejects number 1', () => {
    assert.equal(s.boolean().validate(1).valid, false);
  });

  it('rejects null', () => {
    assert.equal(s.boolean().validate(null).valid, false);
  });
});

// ─── s.object() ───────────────────────────────────────────────────────────────

describe('s.object() basic', () => {
  const schema = s.object({
    name: s.string(),
    age: s.number(),
  });

  it('accepts valid object', () => {
    assert.equal(schema.validate({ name: 'Alice', age: 30 }).valid, true);
  });

  it('collects errors from multiple invalid fields', () => {
    const result = schema.validate({ name: 123, age: 'old' });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 2);
    assert.ok(result.errors.some((e) => e.startsWith('name:')));
    assert.ok(result.errors.some((e) => e.startsWith('age:')));
  });

  it('rejects null', () => {
    assert.equal(schema.validate(null).valid, false);
  });

  it('rejects array', () => {
    assert.equal(schema.validate([]).valid, false);
  });

  it('allows unknown keys by default', () => {
    assert.equal(schema.validate({ name: 'Alice', age: 30, extra: true }).valid, true);
  });
});

describe('s.object().strict()', () => {
  const schema = s.object({ name: s.string() }).strict();

  it('rejects objects with extra keys', () => {
    const result = schema.validate({ name: 'Alice', extra: 'key' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('extra')));
  });

  it('accepts objects with only known keys', () => {
    assert.equal(schema.validate({ name: 'Alice' }).valid, true);
  });
});

// ─── s.array() ────────────────────────────────────────────────────────────────

describe('s.array() basic', () => {
  const schema = s.array(s.string());

  it('accepts array of strings', () => {
    assert.equal(schema.validate(['a', 'b', 'c']).valid, true);
  });

  it('accepts empty array', () => {
    assert.equal(schema.validate([]).valid, true);
  });

  it('rejects non-array', () => {
    assert.equal(schema.validate('not an array').valid, false);
  });

  it('rejects array with invalid items', () => {
    const result = schema.validate(['a', 1, 'b']);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.startsWith('[1]:')));
  });

  it('collects errors from multiple invalid items', () => {
    const result = schema.validate([1, 2, 3]);
    assert.equal(result.errors.length, 3);
  });
});

describe('s.array().min()', () => {
  it('accepts array meeting minimum length', () => {
    assert.equal(s.array(s.number()).min(2).validate([1, 2, 3]).valid, true);
  });

  it('rejects array below minimum length', () => {
    const result = s.array(s.number()).min(3).validate([1, 2]);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('3'));
  });
});

describe('s.array().max()', () => {
  it('accepts array within maximum length', () => {
    assert.equal(s.array(s.number()).max(5).validate([1, 2, 3]).valid, true);
  });

  it('rejects array exceeding maximum length', () => {
    const result = s.array(s.number()).max(2).validate([1, 2, 3]);
    assert.equal(result.valid, false);
  });
});

describe('s.array().unique()', () => {
  it('accepts array with unique items', () => {
    assert.equal(s.array(s.number()).unique().validate([1, 2, 3]).valid, true);
  });

  it('rejects array with duplicate items', () => {
    const result = s.array(s.number()).unique().validate([1, 2, 2]);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].toLowerCase().includes('unique'));
  });
});

// ─── s.literal() ──────────────────────────────────────────────────────────────

describe('s.literal()', () => {
  it('accepts matching string literal', () => {
    assert.equal(s.literal('active').validate('active').valid, true);
  });

  it('rejects non-matching string', () => {
    const result = s.literal('active').validate('inactive');
    assert.equal(result.valid, false);
  });

  it('accepts matching number literal', () => {
    assert.equal(s.literal(42).validate(42).valid, true);
  });

  it('rejects non-matching number', () => {
    assert.equal(s.literal(42).validate(43).valid, false);
  });

  it('accepts matching boolean literal', () => {
    assert.equal(s.literal(true).validate(true).valid, true);
  });

  it('rejects false when literal is true', () => {
    assert.equal(s.literal(true).validate(false).valid, false);
  });
});

// ─── s.union() ────────────────────────────────────────────────────────────────

describe('s.union()', () => {
  const schema = s.union(s.literal('a'), s.literal('b'), s.literal('c'));

  it('accepts value matching first schema', () => {
    assert.equal(schema.validate('a').valid, true);
  });

  it('accepts value matching second schema', () => {
    assert.equal(schema.validate('b').valid, true);
  });

  it('accepts value matching last schema', () => {
    assert.equal(schema.validate('c').valid, true);
  });

  it('rejects value not matching any schema', () => {
    const result = schema.validate('d');
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('works with mixed type schemas', () => {
    const mixed = s.union(s.string(), s.number());
    assert.equal(mixed.validate('hello').valid, true);
    assert.equal(mixed.validate(42).valid, true);
    assert.equal(mixed.validate(true).valid, false);
  });
});

// ─── optional ─────────────────────────────────────────────────────────────────

describe('.optional()', () => {
  const schema = s.string().optional();

  it('accepts a valid string', () => {
    assert.equal(schema.validate('hello').valid, true);
  });

  it('accepts undefined without error', () => {
    assert.equal(schema.validate(undefined).valid, true);
  });

  it('rejects null (null is not undefined)', () => {
    assert.equal(schema.validate(null).valid, false);
  });

  it('rejects invalid non-undefined value', () => {
    assert.equal(schema.validate(42).valid, false);
  });

  it('parse() returns undefined for undefined input', () => {
    assert.equal(schema.parse(undefined), undefined);
  });

  it('parse() returns the string for valid input', () => {
    assert.equal(schema.parse('hello'), 'hello');
  });
});

// ─── nullable ─────────────────────────────────────────────────────────────────

describe('.nullable()', () => {
  const schema = s.string().nullable();

  it('accepts a valid string', () => {
    assert.equal(schema.validate('hello').valid, true);
  });

  it('accepts null', () => {
    assert.equal(schema.validate(null).valid, true);
  });

  it('rejects undefined (undefined is not null)', () => {
    assert.equal(schema.validate(undefined).valid, false);
  });

  it('rejects invalid non-null value', () => {
    assert.equal(schema.validate(42).valid, false);
  });

  it('parse() returns null for null input', () => {
    assert.equal(schema.parse(null), null);
  });

  it('parse() returns the string for valid input', () => {
    assert.equal(schema.parse('hello'), 'hello');
  });
});

// ─── default ──────────────────────────────────────────────────────────────────

describe('.default()', () => {
  const schema = s.string().default('fallback');

  it('accepts a valid string', () => {
    assert.equal(schema.validate('hello').valid, true);
  });

  it('uses default value when input is undefined', () => {
    assert.equal(schema.validate(undefined).valid, true);
  });

  it('parse() returns default when input is undefined', () => {
    assert.equal(schema.parse(undefined), 'fallback');
  });

  it('parse() returns provided value when not undefined', () => {
    assert.equal(schema.parse('custom'), 'custom');
  });

  it('rejects invalid non-undefined value (not string)', () => {
    assert.equal(schema.validate(42).valid, false);
  });

  it('works with number schema', () => {
    const numSchema = s.number().default(0);
    assert.equal(numSchema.parse(undefined), 0);
    assert.equal(numSchema.parse(5), 5);
  });
});

// ─── parse() throws on invalid ────────────────────────────────────────────────

describe('parse() throws on invalid', () => {
  it('throws Error for invalid string', () => {
    assert.throws(
      () => s.string().parse(42),
      (err) => err instanceof Error,
    );
  });

  it('error message includes validation errors', () => {
    try {
      s.string().min(10).parse('hi');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('10'));
    }
  });

  it('throws for invalid object fields', () => {
    const schema = s.object({ name: s.string(), age: s.number() });
    assert.throws(
      () => schema.parse({ name: 123, age: 'old' }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('name'));
        assert.ok(err.message.includes('age'));
        return true;
      },
    );
  });

  it('parse() returns valid value when valid', () => {
    assert.equal(s.string().parse('hello'), 'hello');
    assert.equal(s.number().parse(42), 42);
    assert.equal(s.boolean().parse(true), true);
  });
});

// ─── s.any() ──────────────────────────────────────────────────────────────────

describe('s.any()', () => {
  it('accepts any value', () => {
    assert.equal(s.any().validate('string').valid, true);
    assert.equal(s.any().validate(42).valid, true);
    assert.equal(s.any().validate(null).valid, true);
    assert.equal(s.any().validate(undefined).valid, true);
    assert.equal(s.any().validate([]).valid, true);
    assert.equal(s.any().validate({}).valid, true);
  });
});

// ─── Nested schemas ───────────────────────────────────────────────────────────

describe('nested schemas', () => {
  it('validates nested object schema', () => {
    const schema = s.object({
      user: s.object({
        name: s.string().min(1),
        age: s.number().min(0).integer(),
      }),
    });

    assert.equal(schema.validate({ user: { name: 'Alice', age: 30 } }).valid, true);

    const result = schema.validate({ user: { name: '', age: -1 } });
    assert.equal(result.valid, false);
  });

  it('validates array of objects', () => {
    const schema = s.array(s.object({ id: s.number(), label: s.string() }));
    assert.equal(schema.validate([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]).valid, true);

    const result = schema.validate([{ id: 'x', label: 'a' }]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('[0]')));
  });

  it('validates optional field in object', () => {
    const schema = s.object({
      name: s.string(),
      nickname: s.string().optional(),
    });
    assert.equal(schema.validate({ name: 'Alice' }).valid, true);
    assert.equal(schema.validate({ name: 'Alice', nickname: 'Ali' }).valid, true);
    assert.equal(schema.validate({ name: 'Alice', nickname: 42 }).valid, false);
  });
});
