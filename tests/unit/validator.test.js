// ─── Unit Tests: validator ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isEmail,
  isURL,
  isIPv4,
  isUUID,
  isFiniteNumber,
  isNonEmptyString,
  hasRequiredKeys,
  matchesPattern,
  validate,
} from '../../app/modules/validator.js';

// ─── isEmail() ───────────────────────────────────────────────────────────────

describe('isEmail()', () => {
  it('returns true for valid email addresses', () => {
    assert.ok(isEmail('user@example.com'));
    assert.ok(isEmail('user.name+tag@sub.domain.org'));
    assert.ok(isEmail('x@y.z'));
    assert.ok(isEmail('hello@world.co.uk'));
  });

  it('returns false when there is no @ symbol', () => {
    assert.ok(!isEmail('userexample.com'));
    assert.ok(!isEmail('nodomain'));
  });

  it('returns false for multiple @ symbols', () => {
    assert.ok(!isEmail('a@b@c.com'));
  });

  it('returns false when local part is empty', () => {
    assert.ok(!isEmail('@example.com'));
  });

  it('returns false when domain has no dot', () => {
    assert.ok(!isEmail('user@nodot'));
  });

  it('returns false for empty string', () => {
    assert.ok(!isEmail(''));
  });

  it('returns false for strings with spaces', () => {
    assert.ok(!isEmail('user name@example.com'));
    assert.ok(!isEmail('user@exam ple.com'));
  });
});

// ─── isURL() ─────────────────────────────────────────────────────────────────

describe('isURL()', () => {
  it('returns true for valid http URLs', () => {
    assert.ok(isURL('http://example.com'));
    assert.ok(isURL('http://www.example.com/path?q=1#section'));
  });

  it('returns true for valid https URLs', () => {
    assert.ok(isURL('https://example.com'));
    assert.ok(isURL('https://sub.domain.org/path/to/page'));
  });

  it('returns false for other schemes', () => {
    assert.ok(!isURL('ftp://example.com'));
    assert.ok(!isURL('file:///etc/hosts'));
    assert.ok(!isURL('mailto:user@example.com'));
  });

  it('returns false for strings that are not URLs at all', () => {
    assert.ok(!isURL('not a url'));
    assert.ok(!isURL(''));
    assert.ok(!isURL('example.com'));      // no scheme
  });

  it('returns false for // without a scheme', () => {
    assert.ok(!isURL('//example.com'));
  });
});

// ─── isIPv4() ────────────────────────────────────────────────────────────────

describe('isIPv4()', () => {
  it('returns true for valid IPv4 addresses', () => {
    assert.ok(isIPv4('0.0.0.0'));
    assert.ok(isIPv4('127.0.0.1'));
    assert.ok(isIPv4('192.168.1.255'));
    assert.ok(isIPv4('255.255.255.255'));
  });

  it('returns false when an octet exceeds 255', () => {
    assert.ok(!isIPv4('256.0.0.1'));
    assert.ok(!isIPv4('1.2.3.300'));
  });

  it('returns false for too few or too many octets', () => {
    assert.ok(!isIPv4('1.2.3'));
    assert.ok(!isIPv4('1.2.3.4.5'));
  });

  it('returns false for non-numeric octets', () => {
    assert.ok(!isIPv4('a.b.c.d'));
    assert.ok(!isIPv4('192.168.one.1'));
  });

  it('returns false for empty string', () => {
    assert.ok(!isIPv4(''));
  });

  it('returns false for IP with port', () => {
    assert.ok(!isIPv4('192.168.1.1:80'));
  });
});

// ─── isUUID() ────────────────────────────────────────────────────────────────

describe('isUUID()', () => {
  it('returns true for valid v4 UUIDs', () => {
    assert.ok(isUUID('550e8400-e29b-41d4-a716-446655440000'));
    assert.ok(isUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479'));
    assert.ok(isUUID('6ba7b810-9dad-41d1-80b4-00c04fd430c8'));
    // v4 — random variant
    assert.ok(isUUID('123e4567-e89b-4aab-b456-426614174000'));
  });

  it('returns true for uppercase valid UUIDs', () => {
    assert.ok(isUUID('550E8400-E29B-41D4-A716-446655440000'));
  });

  it('returns false for strings without hyphens', () => {
    assert.ok(!isUUID('550e8400e29b41d4a716446655440000'));
  });

  it('returns false for wrong segment lengths', () => {
    assert.ok(!isUUID('550e8400-e29b-41d4-a716-44665544000'));   // last too short
    assert.ok(!isUUID('550e8400-e29b-41d4-a716-4466554400000')); // last too long
  });

  it('returns false for wrong version digit (not 4)', () => {
    assert.ok(!isUUID('550e8400-e29b-31d4-a716-446655440000')); // version 3
    assert.ok(!isUUID('550e8400-e29b-51d4-a716-446655440000')); // version 5
  });

  it('returns false for wrong variant', () => {
    // variant bits must be 8, 9, a, or b
    assert.ok(!isUUID('550e8400-e29b-41d4-0716-446655440000')); // variant 0
    assert.ok(!isUUID('550e8400-e29b-41d4-c716-446655440000')); // variant c
  });

  it('returns false for empty string', () => {
    assert.ok(!isUUID(''));
  });
});

// ─── isFiniteNumber() ────────────────────────────────────────────────────────

describe('isFiniteNumber()', () => {
  it('returns true for finite numbers', () => {
    assert.ok(isFiniteNumber(0));
    assert.ok(isFiniteNumber(42));
    assert.ok(isFiniteNumber(-3.14));
    assert.ok(isFiniteNumber(Number.MAX_SAFE_INTEGER));
  });

  it('returns false for NaN', () => {
    assert.ok(!isFiniteNumber(NaN));
  });

  it('returns false for Infinity and -Infinity', () => {
    assert.ok(!isFiniteNumber(Infinity));
    assert.ok(!isFiniteNumber(-Infinity));
  });

  it('returns false for non-number types', () => {
    assert.ok(!isFiniteNumber('42'));
    assert.ok(!isFiniteNumber(null));
    assert.ok(!isFiniteNumber(undefined));
    assert.ok(!isFiniteNumber(true));
    assert.ok(!isFiniteNumber({}));
    assert.ok(!isFiniteNumber([]));
  });
});

// ─── isNonEmptyString() ──────────────────────────────────────────────────────

describe('isNonEmptyString()', () => {
  it('returns true for non-empty strings', () => {
    assert.ok(isNonEmptyString('hello'));
    assert.ok(isNonEmptyString(' '));        // space is non-empty
    assert.ok(isNonEmptyString('0'));
  });

  it('returns false for empty string', () => {
    assert.ok(!isNonEmptyString(''));
  });

  it('returns false for null and undefined', () => {
    assert.ok(!isNonEmptyString(null));
    assert.ok(!isNonEmptyString(undefined));
  });

  it('returns false for non-string types', () => {
    assert.ok(!isNonEmptyString(123));
    assert.ok(!isNonEmptyString(true));
    assert.ok(!isNonEmptyString([]));
    assert.ok(!isNonEmptyString({}));
  });
});

// ─── hasRequiredKeys() ───────────────────────────────────────────────────────

describe('hasRequiredKeys()', () => {
  it('returns true when all required keys are present', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.ok(hasRequiredKeys(obj, ['a', 'b']));
    assert.ok(hasRequiredKeys(obj, ['a', 'b', 'c']));
  });

  it('returns true when key list is empty', () => {
    assert.ok(hasRequiredKeys({ a: 1 }, []));
    assert.ok(hasRequiredKeys({}, []));
  });

  it('returns false when a required key is missing', () => {
    const obj = { a: 1, b: 2 };
    assert.ok(!hasRequiredKeys(obj, ['a', 'b', 'c']));
    assert.ok(!hasRequiredKeys(obj, ['x']));
  });

  it('returns true for keys with falsy values', () => {
    const obj = { a: 0, b: null, c: false, d: '' };
    assert.ok(hasRequiredKeys(obj, ['a', 'b', 'c', 'd']));
  });

  it('returns true for keys inherited via prototype', () => {
    const obj = Object.create({ inherited: true });
    obj.own = 1;
    assert.ok(hasRequiredKeys(obj, ['inherited', 'own']));
  });
});

// ─── matchesPattern() ────────────────────────────────────────────────────────

describe('matchesPattern()', () => {
  it('matches using a RegExp pattern', () => {
    assert.ok(matchesPattern('hello world', /hello/));
    assert.ok(matchesPattern('abc123', /\d+/));
  });

  it('does not match when RegExp pattern fails', () => {
    assert.ok(!matchesPattern('hello', /^\d+$/));
    assert.ok(!matchesPattern('', /\w+/));
  });

  it('matches using a string pattern converted to RegExp', () => {
    assert.ok(matchesPattern('hello world', 'hello'));
    assert.ok(matchesPattern('foo123bar', '\\d+'));
  });

  it('does not match when string pattern fails', () => {
    assert.ok(!matchesPattern('hello', '^\\d+$'));
  });

  it('supports case-insensitive RegExp', () => {
    assert.ok(matchesPattern('Hello', /hello/i));
    assert.ok(!matchesPattern('Hello', /hello/));
  });
});

// ─── validate() ──────────────────────────────────────────────────────────────

describe('validate()', () => {
  // ── Valid cases ──────────────────────────────────────────────────────────

  it('returns valid for a string that passes all constraints', () => {
    const result = validate('hello', {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 10,
    });
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it('returns valid for a number within bounds', () => {
    const result = validate(5, { type: 'number', min: 1, max: 10 });
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it('returns valid for a boolean', () => {
    assert.ok(validate(true, { type: 'boolean' }).valid);
    assert.ok(validate(false, { type: 'boolean' }).valid);
  });

  it('returns valid for an array', () => {
    assert.ok(validate([1, 2], { type: 'array' }).valid);
  });

  it('returns valid for an object', () => {
    assert.ok(validate({ a: 1 }, { type: 'object' }).valid);
  });

  it('returns valid when value is absent and not required', () => {
    const result = validate(undefined, { type: 'string' });
    assert.ok(result.valid);
  });

  it('returns valid for enum match', () => {
    const result = validate('red', { enum: ['red', 'green', 'blue'] });
    assert.ok(result.valid);
  });

  // ── Required ─────────────────────────────────────────────────────────────

  it('returns invalid when required value is null', () => {
    const result = validate(null, { required: true });
    assert.ok(!result.valid);
    assert.ok(result.errors.length > 0);
  });

  it('returns invalid when required value is undefined', () => {
    const result = validate(undefined, { required: true });
    assert.ok(!result.valid);
    assert.ok(result.errors.length > 0);
  });

  // ── Type mismatch ─────────────────────────────────────────────────────────

  it('returns invalid on type mismatch (string vs number)', () => {
    const result = validate(42, { type: 'string' });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('string')));
  });

  it('returns invalid on type mismatch (number vs boolean)', () => {
    const result = validate('true', { type: 'boolean' });
    assert.ok(!result.valid);
  });

  it('distinguishes array from object type', () => {
    assert.ok(!validate([1, 2], { type: 'object' }).valid);
    assert.ok(!validate({ a: 1 }, { type: 'array' }).valid);
  });

  // ── String length constraints ─────────────────────────────────────────────

  it('returns invalid when string is shorter than minLength', () => {
    const result = validate('hi', { type: 'string', minLength: 5 });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('minLength')));
  });

  it('returns invalid when string exceeds maxLength', () => {
    const result = validate('hello world', { type: 'string', maxLength: 5 });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('maxLength')));
  });

  it('returns valid when string length is exactly at boundaries', () => {
    assert.ok(validate('hi', { minLength: 2, maxLength: 2 }).valid);
  });

  // ── Number range constraints ──────────────────────────────────────────────

  it('returns invalid when number is below min', () => {
    const result = validate(-1, { type: 'number', min: 0 });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('min')));
  });

  it('returns invalid when number exceeds max', () => {
    const result = validate(101, { type: 'number', max: 100 });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('max')));
  });

  it('returns valid when number is exactly at min or max', () => {
    assert.ok(validate(0, { min: 0, max: 10 }).valid);
    assert.ok(validate(10, { min: 0, max: 10 }).valid);
  });

  // ── Pattern constraint ────────────────────────────────────────────────────

  it('returns invalid when string does not match pattern', () => {
    const result = validate('hello', { pattern: /^\d+$/ });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('pattern')));
  });

  it('returns valid when string matches pattern', () => {
    const result = validate('12345', { pattern: /^\d+$/ });
    assert.ok(result.valid);
  });

  // ── Enum constraint ───────────────────────────────────────────────────────

  it('returns invalid when value is not in enum', () => {
    const result = validate('yellow', { enum: ['red', 'green', 'blue'] });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('yellow')));
  });

  it('accumulates multiple errors for multiple violations', () => {
    const result = validate('x', {
      type: 'string',
      minLength: 5,
      maxLength: 3,  // contradictory but tests multi-error
    });
    // minLength failure at least
    assert.ok(!result.valid);
    assert.ok(result.errors.length >= 1);
  });
});
