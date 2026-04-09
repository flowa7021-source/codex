// ─── Unit Tests: form-validator ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  rules,
  validateField,
  validateForm,
} from '../../app/modules/form-validator.js';

// ─── rules.required ──────────────────────────────────────────────────────────

describe('rules.required', () => {
  const required = rules.required();

  it('fails on empty string', () => {
    assert.notEqual(required(''), null);
  });

  it('fails on whitespace-only string', () => {
    assert.notEqual(required('   '), null);
  });

  it('fails on null', () => {
    assert.notEqual(required(/** @type {any} */ (null)), null);
  });

  it('fails on undefined', () => {
    assert.notEqual(required(/** @type {any} */ (undefined)), null);
  });

  it('passes on non-empty string', () => {
    assert.equal(required('hello'), null);
  });

  it('passes on string with content after trim', () => {
    assert.equal(required(' x '), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.required('Custom error');
    assert.equal(r(''), 'Custom error');
  });
});

// ─── rules.minLength ─────────────────────────────────────────────────────────

describe('rules.minLength', () => {
  const min3 = rules.minLength(3);

  it('fails when string is shorter than minimum', () => {
    assert.notEqual(min3('ab'), null);
  });

  it('passes when string equals minimum length', () => {
    assert.equal(min3('abc'), null);
  });

  it('passes when string is longer than minimum', () => {
    assert.equal(min3('abcd'), null);
  });

  it('fails on empty string', () => {
    assert.notEqual(min3(''), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.minLength(5, 'Too short');
    assert.equal(r('hi'), 'Too short');
  });

  it('boundary: minLength(1) passes for single character', () => {
    assert.equal(rules.minLength(1)('a'), null);
  });

  it('boundary: minLength(1) fails for empty string', () => {
    assert.notEqual(rules.minLength(1)(''), null);
  });
});

// ─── rules.maxLength ─────────────────────────────────────────────────────────

describe('rules.maxLength', () => {
  const max5 = rules.maxLength(5);

  it('fails when string exceeds maximum', () => {
    assert.notEqual(max5('toolong'), null);
  });

  it('passes when string equals maximum length', () => {
    assert.equal(max5('abcde'), null);
  });

  it('passes when string is shorter than maximum', () => {
    assert.equal(max5('abc'), null);
  });

  it('passes on empty string', () => {
    assert.equal(max5(''), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.maxLength(3, 'Too long');
    assert.equal(r('abcd'), 'Too long');
  });

  it('boundary: maxLength(0) fails for any non-empty string', () => {
    assert.notEqual(rules.maxLength(0)('a'), null);
  });

  it('boundary: maxLength(0) passes for empty string', () => {
    assert.equal(rules.maxLength(0)(''), null);
  });
});

// ─── rules.pattern ───────────────────────────────────────────────────────────

describe('rules.pattern', () => {
  const digitsOnly = rules.pattern(/^\d+$/);

  it('passes when string matches pattern', () => {
    assert.equal(digitsOnly('12345'), null);
  });

  it('fails when string does not match pattern', () => {
    assert.notEqual(digitsOnly('123abc'), null);
  });

  it('fails on empty string when pattern requires content', () => {
    assert.notEqual(digitsOnly(''), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.pattern(/^\d+$/, 'Digits only');
    assert.equal(r('abc'), 'Digits only');
  });

  it('works with case-insensitive flag', () => {
    const r = rules.pattern(/^hello$/i);
    assert.equal(r('HELLO'), null);
    assert.notEqual(r('world'), null);
  });
});

// ─── rules.email ─────────────────────────────────────────────────────────────

describe('rules.email', () => {
  const email = rules.email();

  it('passes for valid email', () => {
    assert.equal(email('user@example.com'), null);
  });

  it('passes for email with subdomain', () => {
    assert.equal(email('user@mail.example.org'), null);
  });

  it('passes for email with plus sign in local part', () => {
    assert.equal(email('user+tag@example.com'), null);
  });

  it('fails for email missing @', () => {
    assert.notEqual(email('userexample.com'), null);
  });

  it('fails for email missing domain', () => {
    assert.notEqual(email('user@'), null);
  });

  it('fails for email missing TLD', () => {
    assert.notEqual(email('user@example'), null);
  });

  it('fails for empty string', () => {
    assert.notEqual(email(''), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.email('Bad email');
    assert.equal(r('notanemail'), 'Bad email');
  });
});

// ─── rules.url ───────────────────────────────────────────────────────────────

describe('rules.url', () => {
  const url = rules.url();

  it('passes for http URL', () => {
    assert.equal(url('http://example.com'), null);
  });

  it('passes for https URL', () => {
    assert.equal(url('https://example.com/path?q=1'), null);
  });

  it('fails for javascript: scheme', () => {
    assert.notEqual(url('javascript:alert(1)'), null);
  });

  it('fails for ftp: scheme', () => {
    assert.notEqual(url('ftp://example.com'), null);
  });

  it('fails for empty string', () => {
    assert.notEqual(url(''), null);
  });

  it('fails for plain text', () => {
    assert.notEqual(url('not a url'), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.url('Invalid URL');
    assert.equal(r('bad'), 'Invalid URL');
  });
});

// ─── rules.min ───────────────────────────────────────────────────────────────

describe('rules.min', () => {
  const min5 = rules.min(5);

  it('passes when value equals minimum', () => {
    assert.equal(min5(5), null);
  });

  it('passes when value exceeds minimum', () => {
    assert.equal(min5(10), null);
  });

  it('fails when value is below minimum', () => {
    assert.notEqual(min5(4), null);
  });

  it('fails for negative values below minimum', () => {
    assert.notEqual(rules.min(0)(-1), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.min(10, 'Too small');
    assert.equal(r(5), 'Too small');
  });
});

// ─── rules.max ───────────────────────────────────────────────────────────────

describe('rules.max', () => {
  const max10 = rules.max(10);

  it('passes when value equals maximum', () => {
    assert.equal(max10(10), null);
  });

  it('passes when value is below maximum', () => {
    assert.equal(max10(5), null);
  });

  it('fails when value exceeds maximum', () => {
    assert.notEqual(max10(11), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.max(5, 'Too large');
    assert.equal(r(6), 'Too large');
  });
});

// ─── rules.integer ───────────────────────────────────────────────────────────

describe('rules.integer', () => {
  const integer = rules.integer();

  it('passes for whole number', () => {
    assert.equal(integer(42), null);
  });

  it('passes for zero', () => {
    assert.equal(integer(0), null);
  });

  it('passes for negative integer', () => {
    assert.equal(integer(-5), null);
  });

  it('fails for float', () => {
    assert.notEqual(integer(3.14), null);
  });

  it('fails for 0.5', () => {
    assert.notEqual(integer(0.5), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.integer('Integers only');
    assert.equal(r(1.5), 'Integers only');
  });
});

// ─── rules.oneOf ─────────────────────────────────────────────────────────────

describe('rules.oneOf', () => {
  const colors = rules.oneOf(['red', 'green', 'blue']);

  it('passes when value is in the list', () => {
    assert.equal(colors('red'), null);
    assert.equal(colors('green'), null);
    assert.equal(colors('blue'), null);
  });

  it('fails when value is not in the list', () => {
    assert.notEqual(colors('yellow'), null);
  });

  it('fails for empty string when not in list', () => {
    assert.notEqual(colors(''), null);
  });

  it('works with numbers', () => {
    const r = rules.oneOf([1, 2, 3]);
    assert.equal(r(2), null);
    assert.notEqual(r(4), null);
  });

  it('uses custom message when provided', () => {
    const r = rules.oneOf(['a', 'b'], 'Pick a or b');
    assert.equal(r('c'), 'Pick a or b');
  });
});

// ─── validateField ───────────────────────────────────────────────────────────

describe('validateField', () => {
  it('returns valid:true and empty errors when all rules pass', () => {
    const result = validateField('hello', [
      rules.required(),
      rules.minLength(3),
      rules.maxLength(10),
    ]);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('returns valid:false with all failing rule messages', () => {
    const result = validateField('', [
      rules.required(),
      rules.minLength(3),
    ]);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 2);
  });

  it('collects errors from multiple failing rules', () => {
    const result = validateField('ab', [
      rules.minLength(5),
      rules.maxLength(3),  // passes — 2 chars <= 3
      rules.pattern(/^\d+$/),  // fails — not digits
    ]);
    assert.equal(result.valid, false);
    // minLength fails + pattern fails = 2 errors
    assert.equal(result.errors.length, 2);
  });

  it('returns valid:true for empty rules array', () => {
    const result = validateField('anything', []);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('works with number rules', () => {
    const result = validateField(15, [rules.min(10), rules.max(20), rules.integer()]);
    assert.equal(result.valid, true);
  });

  it('fails with number rules when out of range', () => {
    const result = validateField(25, [rules.min(0), rules.max(20)]);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
  });
});

// ─── validateForm ─────────────────────────────────────────────────────────────

describe('validateForm', () => {
  it('returns valid:true when all fields pass', () => {
    const result = validateForm(
      { name: 'Alice', age: 30 },
      {
        name: [rules.required(), rules.minLength(2)],
        age: [rules.min(0), rules.max(120), rules.integer()],
      },
    );
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  it('returns valid:false with per-field errors when fields fail', () => {
    const result = validateForm(
      { name: '', email: 'notanemail' },
      {
        name: [rules.required()],
        email: [rules.email()],
      },
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.name);
    assert.ok(result.errors.email);
    assert.equal(result.errors.name.length, 1);
    assert.equal(result.errors.email.length, 1);
  });

  it('only reports errors for failing fields', () => {
    const result = validateForm(
      { name: 'Bob', email: 'notanemail' },
      {
        name: [rules.required()],
        email: [rules.email()],
      },
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors.name, undefined);
    assert.ok(result.errors.email);
  });

  it('handles schema fields with no rules', () => {
    const result = validateForm(
      { name: '' },
      { name: [] },
    );
    assert.equal(result.valid, true);
  });

  it('handles empty data and schema', () => {
    const result = validateForm({}, {});
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  it('collects multiple errors per field', () => {
    const result = validateForm(
      { password: 'ab' },
      { password: [rules.minLength(8), rules.pattern(/[A-Z]/, 'Need uppercase')] },
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors.password.length, 2);
  });
});
