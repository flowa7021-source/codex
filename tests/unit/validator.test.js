// ─── Unit Tests: Validator ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validators, validate, validateField } from '../../app/modules/validator.js';

// ─── validators.isEmail ───────────────────────────────────────────────────────

describe('validators.isEmail', () => {
  it('accepts a simple valid address', () => {
    assert.ok(validators.isEmail('user@example.com'));
  });

  it('accepts addresses with subdomains', () => {
    assert.ok(validators.isEmail('user@mail.example.co.uk'));
  });

  it('accepts addresses with plus addressing', () => {
    assert.ok(validators.isEmail('user+tag@example.org'));
  });

  it('accepts addresses with dots in the local part', () => {
    assert.ok(validators.isEmail('first.last@example.com'));
  });

  it('rejects a string with no @', () => {
    assert.ok(!validators.isEmail('notanemail'));
  });

  it('rejects a string with no domain after @', () => {
    assert.ok(!validators.isEmail('user@'));
  });

  it('rejects a string with no TLD', () => {
    assert.ok(!validators.isEmail('user@domain'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isEmail(''));
  });

  it('rejects an address with spaces', () => {
    assert.ok(!validators.isEmail('user @example.com'));
  });
});

// ─── validators.isUrl ─────────────────────────────────────────────────────────

describe('validators.isUrl', () => {
  it('accepts an http URL', () => {
    assert.ok(validators.isUrl('http://example.com'));
  });

  it('accepts an https URL with path and query', () => {
    assert.ok(validators.isUrl('https://example.com/path?q=1#anchor'));
  });

  it('accepts an ftp URL', () => {
    assert.ok(validators.isUrl('ftp://files.example.com/file.txt'));
  });

  it('rejects a URL without a scheme', () => {
    assert.ok(!validators.isUrl('example.com'));
  });

  it('rejects a mailto URL (wrong scheme)', () => {
    assert.ok(!validators.isUrl('mailto:user@example.com'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isUrl(''));
  });

  it('rejects a completely arbitrary string', () => {
    assert.ok(!validators.isUrl('not a url at all'));
  });
});

// ─── validators.isIPv4 ───────────────────────────────────────────────────────

describe('validators.isIPv4', () => {
  it('accepts a typical private address', () => {
    assert.ok(validators.isIPv4('192.168.1.1'));
  });

  it('accepts the all-zeros address', () => {
    assert.ok(validators.isIPv4('0.0.0.0'));
  });

  it('accepts the broadcast address', () => {
    assert.ok(validators.isIPv4('255.255.255.255'));
  });

  it('rejects an octet above 255', () => {
    assert.ok(!validators.isIPv4('256.0.0.1'));
  });

  it('rejects fewer than 4 octets', () => {
    assert.ok(!validators.isIPv4('192.168.1'));
  });

  it('rejects more than 4 octets', () => {
    assert.ok(!validators.isIPv4('1.2.3.4.5'));
  });

  it('rejects non-digit octets', () => {
    assert.ok(!validators.isIPv4('192.168.one.1'));
  });

  it('rejects octets with leading zeros', () => {
    assert.ok(!validators.isIPv4('01.02.03.04'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isIPv4(''));
  });
});

// ─── validators.isIPv6 ───────────────────────────────────────────────────────

describe('validators.isIPv6', () => {
  it('accepts a full 8-group address', () => {
    assert.ok(validators.isIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334'));
  });

  it('accepts the loopback address in compressed form', () => {
    assert.ok(validators.isIPv6('::1'));
  });

  it('accepts the all-zeros address (double-colon only)', () => {
    assert.ok(validators.isIPv6('::'));
  });

  it('accepts a mid-string compressed form', () => {
    assert.ok(validators.isIPv6('fe80::1'));
  });

  it('accepts a mixed IPv4-mapped address', () => {
    assert.ok(validators.isIPv6('::ffff:192.168.1.1'));
  });

  it('rejects a plain IPv4 address', () => {
    assert.ok(!validators.isIPv6('192.168.1.1'));
  });

  it('rejects an address with invalid hex characters', () => {
    assert.ok(!validators.isIPv6('gggg::1'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isIPv6(''));
  });
});

// ─── validators.isCreditCard ─────────────────────────────────────────────────

describe('validators.isCreditCard', () => {
  // Well-known Luhn-valid test numbers
  it('accepts a valid Visa test number', () => {
    assert.ok(validators.isCreditCard('4532015112830366'));
  });

  it('accepts a valid Mastercard test number', () => {
    assert.ok(validators.isCreditCard('5425233430109903'));
  });

  it('accepts a valid Amex test number (15 digits)', () => {
    assert.ok(validators.isCreditCard('378282246310005'));
  });

  it('accepts a number with spaces as separators', () => {
    assert.ok(validators.isCreditCard('4532 0151 1283 0366'));
  });

  it('accepts a number with dashes as separators', () => {
    assert.ok(validators.isCreditCard('4532-0151-1283-0366'));
  });

  it('rejects a number that fails the Luhn check', () => {
    assert.ok(!validators.isCreditCard('4532015112830367'));
  });

  it('rejects a string with non-digit characters', () => {
    assert.ok(!validators.isCreditCard('1234abcd56789012'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isCreditCard(''));
  });

  it('rejects a number that is too short (fewer than 13 digits)', () => {
    assert.ok(!validators.isCreditCard('123456789012'));
  });
});

// ─── validators.isUUID ───────────────────────────────────────────────────────

describe('validators.isUUID', () => {
  it('accepts a canonical lowercase v4 UUID', () => {
    assert.ok(validators.isUUID('550e8400-e29b-41d4-a716-446655440000'));
  });

  it('accepts a v4 UUID with uppercase hex', () => {
    assert.ok(validators.isUUID('550E8400-E29B-41D4-A716-446655440000'));
  });

  it('rejects a UUID with a wrong version digit (v1)', () => {
    assert.ok(!validators.isUUID('550e8400-e29b-11d4-a716-446655440000'));
  });

  it('rejects a UUID with a wrong variant nibble', () => {
    assert.ok(!validators.isUUID('550e8400-e29b-41d4-0716-446655440000'));
  });

  it('rejects a UUID with no dashes', () => {
    assert.ok(!validators.isUUID('550e8400e29b41d4a716446655440000'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isUUID(''));
  });
});

// ─── validators.isISO8601 ─────────────────────────────────────────────────────

describe('validators.isISO8601', () => {
  it('accepts a plain date string', () => {
    assert.ok(validators.isISO8601('2024-06-15'));
  });

  it('accepts a date-time with UTC suffix', () => {
    assert.ok(validators.isISO8601('2024-06-15T12:30:00Z'));
  });

  it('accepts a date-time with a numeric timezone offset', () => {
    assert.ok(validators.isISO8601('2024-06-15T12:30:00+05:30'));
  });

  it('accepts a date-time with fractional seconds', () => {
    assert.ok(validators.isISO8601('2024-06-15T12:30:00.123Z'));
  });

  it('rejects an invalid month (month 13)', () => {
    assert.ok(!validators.isISO8601('2024-13-01'));
  });

  it('rejects an invalid day (day 00)', () => {
    assert.ok(!validators.isISO8601('2024-06-00'));
  });

  it('rejects a non-date string', () => {
    assert.ok(!validators.isISO8601('not-a-date'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isISO8601(''));
  });
});

// ─── validators.isAlpha ──────────────────────────────────────────────────────

describe('validators.isAlpha', () => {
  it('accepts a lowercase-only string', () => {
    assert.ok(validators.isAlpha('hello'));
  });

  it('accepts a mixed-case string', () => {
    assert.ok(validators.isAlpha('HelloWorld'));
  });

  it('rejects a string with digits', () => {
    assert.ok(!validators.isAlpha('hello1'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isAlpha(''));
  });

  it('rejects a string with spaces', () => {
    assert.ok(!validators.isAlpha('hello world'));
  });
});

// ─── validators.isAlphanumeric ───────────────────────────────────────────────

describe('validators.isAlphanumeric', () => {
  it('accepts letters and digits mixed together', () => {
    assert.ok(validators.isAlphanumeric('abc123'));
  });

  it('accepts a letters-only string', () => {
    assert.ok(validators.isAlphanumeric('Hello'));
  });

  it('accepts a digits-only string', () => {
    assert.ok(validators.isAlphanumeric('12345'));
  });

  it('rejects a string with an underscore', () => {
    assert.ok(!validators.isAlphanumeric('abc_123'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isAlphanumeric(''));
  });
});

// ─── validators.isNumeric ────────────────────────────────────────────────────

describe('validators.isNumeric', () => {
  it('accepts a string of only digits', () => {
    assert.ok(validators.isNumeric('12345'));
  });

  it('accepts a single digit', () => {
    assert.ok(validators.isNumeric('0'));
  });

  it('rejects a decimal number string', () => {
    assert.ok(!validators.isNumeric('12.34'));
  });

  it('rejects a negative number string', () => {
    assert.ok(!validators.isNumeric('-42'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isNumeric(''));
  });
});

// ─── validators.isHexColor ───────────────────────────────────────────────────

describe('validators.isHexColor', () => {
  it('accepts a 3-digit hex color', () => {
    assert.ok(validators.isHexColor('#fff'));
  });

  it('accepts a 6-digit hex color', () => {
    assert.ok(validators.isHexColor('#1a2b3c'));
  });

  it('accepts uppercase hex digits', () => {
    assert.ok(validators.isHexColor('#AABBCC'));
  });

  it('rejects a hex color without the # prefix', () => {
    assert.ok(!validators.isHexColor('ffffff'));
  });

  it('rejects a 4-digit hex color', () => {
    assert.ok(!validators.isHexColor('#ffff'));
  });

  it('rejects a 5-digit hex color', () => {
    assert.ok(!validators.isHexColor('#fffff'));
  });

  it('rejects a hex color with invalid characters', () => {
    assert.ok(!validators.isHexColor('#gggggg'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isHexColor(''));
  });
});

// ─── validators.isJSON ────────────────────────────────────────────────────────

describe('validators.isJSON', () => {
  it('accepts a JSON object string', () => {
    assert.ok(validators.isJSON('{"key":"value"}'));
  });

  it('accepts a JSON array string', () => {
    assert.ok(validators.isJSON('[1,2,3]'));
  });

  it('accepts a JSON numeric primitive', () => {
    assert.ok(validators.isJSON('42'));
  });

  it('accepts JSON null', () => {
    assert.ok(validators.isJSON('null'));
  });

  it('accepts JSON boolean', () => {
    assert.ok(validators.isJSON('true'));
  });

  it('rejects an unquoted word', () => {
    assert.ok(!validators.isJSON('hello'));
  });

  it('rejects malformed JSON (unquoted key)', () => {
    assert.ok(!validators.isJSON('{key:value}'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isJSON(''));
  });

  it('rejects a whitespace-only string', () => {
    assert.ok(!validators.isJSON('   '));
  });
});

// ─── validators.isBase64 ─────────────────────────────────────────────────────

describe('validators.isBase64', () => {
  it('accepts a valid Base64 string ("hello")', () => {
    assert.ok(validators.isBase64('aGVsbG8='));
  });

  it('accepts a Base64 string with double padding', () => {
    assert.ok(validators.isBase64('dGVzdA=='));
  });

  it('accepts Base64 with + and / characters', () => {
    assert.ok(validators.isBase64('SGVsbG8+V29ybGQ/'));
  });

  it('rejects a string with invalid Base64 characters', () => {
    assert.ok(!validators.isBase64('aGVsb$8='));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isBase64(''));
  });

  it('rejects a string whose length is not a multiple of 4', () => {
    assert.ok(!validators.isBase64('aGVsb'));
  });
});

// ─── validators.isEmpty ───────────────────────────────────────────────────────

describe('validators.isEmpty', () => {
  it('returns true for null', () => {
    assert.ok(validators.isEmpty(null));
  });

  it('returns true for undefined', () => {
    assert.ok(validators.isEmpty(undefined));
  });

  it('returns true for an empty string', () => {
    assert.ok(validators.isEmpty(''));
  });

  it('returns true for a whitespace-only string', () => {
    assert.ok(validators.isEmpty('   '));
  });

  it('returns true for a tab-and-newline-only string', () => {
    assert.ok(validators.isEmpty('\t\n'));
  });

  it('returns false for a non-empty string', () => {
    assert.ok(!validators.isEmpty('hello'));
  });

  it('returns false for a string with content surrounded by spaces', () => {
    assert.ok(!validators.isEmpty('  x  '));
  });
});

// ─── validators.isPhoneNumber ─────────────────────────────────────────────────

describe('validators.isPhoneNumber', () => {
  it('accepts an E.164 number with a + prefix', () => {
    assert.ok(validators.isPhoneNumber('+14155552671'));
  });

  it('accepts a number with spaces', () => {
    assert.ok(validators.isPhoneNumber('+1 415 555 2671'));
  });

  it('accepts a number with dashes', () => {
    assert.ok(validators.isPhoneNumber('+1-415-555-2671'));
  });

  it('accepts a number with parentheses', () => {
    assert.ok(validators.isPhoneNumber('+1 (415) 555-2671'));
  });

  it('accepts a number without a + prefix', () => {
    assert.ok(validators.isPhoneNumber('14155552671'));
  });

  it('rejects a string with letters', () => {
    assert.ok(!validators.isPhoneNumber('+1-800-FLOWERS'));
  });

  it('rejects a number that is too short (fewer than 7 digits)', () => {
    assert.ok(!validators.isPhoneNumber('+12345'));
  });

  it('rejects an empty string', () => {
    assert.ok(!validators.isPhoneNumber(''));
  });
});

// ─── validate – required fields ───────────────────────────────────────────────

describe('validate – required fields', () => {
  it('fails when a required field is missing', () => {
    const schema = { name: { type: 'string', required: true } };
    const result = validate({}, schema);
    assert.ok(!result.valid);
    assert.ok(result.errors.length > 0);
  });

  it('fails when a required field is null', () => {
    const schema = { name: { type: 'string', required: true } };
    const result = validate({ name: null }, schema);
    assert.ok(!result.valid);
  });

  it('passes when a required field is present', () => {
    const schema = { name: { type: 'string', required: true } };
    const result = validate({ name: 'Alice' }, schema);
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it('passes when an optional field is absent', () => {
    const schema = { age: { type: 'number', required: false } };
    const result = validate({}, schema);
    assert.ok(result.valid);
  });

  it('collects errors from multiple required fields that are missing', () => {
    const schema = {
      name: { type: 'string', required: true },
      age:  { type: 'number', required: true },
    };
    const result = validate({}, schema);
    assert.ok(!result.valid);
    assert.ok(result.errors.length >= 2);
  });
});

// ─── validate – type checking ─────────────────────────────────────────────────

describe('validate – type checking', () => {
  it('fails when a string field receives a number', () => {
    const schema = { name: { type: 'string' } };
    const result = validate({ name: 42 }, schema);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('string')));
  });

  it('fails when a number field receives a string', () => {
    const schema = { age: { type: 'number' } };
    const result = validate({ age: 'old' }, schema);
    assert.ok(!result.valid);
  });

  it('fails when an object field receives an array', () => {
    const schema = { meta: { type: 'object' } };
    const result = validate({ meta: [] }, schema);
    assert.ok(!result.valid);
  });

  it('fails when an array field receives a plain object', () => {
    const schema = { tags: { type: 'array' } };
    const result = validate({ tags: {} }, schema);
    assert.ok(!result.valid);
  });

  it('passes when a boolean field receives true', () => {
    const schema = { active: { type: 'boolean' } };
    const result = validate({ active: true }, schema);
    assert.ok(result.valid);
  });

  it('passes when an array field receives an actual array', () => {
    const schema = { tags: { type: 'array' } };
    const result = validate({ tags: ['a', 'b'] }, schema);
    assert.ok(result.valid);
  });
});

// ─── validate – string constraints ───────────────────────────────────────────

describe('validate – string constraints', () => {
  it('fails when a string is shorter than minLength', () => {
    const schema = { pw: { type: 'string', minLength: 8 } };
    const result = validate({ pw: 'abc' }, schema);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('least')));
  });

  it('fails when a string exceeds maxLength', () => {
    const schema = { tag: { type: 'string', maxLength: 5 } };
    const result = validate({ tag: 'toolongstring' }, schema);
    assert.ok(!result.valid);
  });

  it('fails when a string does not match a pattern', () => {
    const schema = { code: { type: 'string', pattern: /^\d{4}$/ } };
    const result = validate({ code: 'abcd' }, schema);
    assert.ok(!result.valid);
  });

  it('passes when a string satisfies minLength, maxLength, and pattern', () => {
    const schema = {
      code: { type: 'string', minLength: 4, maxLength: 4, pattern: /^\d{4}$/ },
    };
    const result = validate({ code: '1234' }, schema);
    assert.ok(result.valid);
  });
});

// ─── validate – numeric constraints ──────────────────────────────────────────

describe('validate – numeric constraints', () => {
  it('fails when a number is below min', () => {
    const schema = { age: { type: 'number', min: 0 } };
    const result = validate({ age: -1 }, schema);
    assert.ok(!result.valid);
  });

  it('fails when a number exceeds max', () => {
    const schema = { pct: { type: 'number', max: 100 } };
    const result = validate({ pct: 101 }, schema);
    assert.ok(!result.valid);
  });

  it('passes at boundary minimum value', () => {
    const schema = { pct: { type: 'number', min: 0, max: 100 } };
    assert.ok(validate({ pct: 0 }, schema).valid);
  });

  it('passes at boundary maximum value', () => {
    const schema = { pct: { type: 'number', min: 0, max: 100 } };
    assert.ok(validate({ pct: 100 }, schema).valid);
  });
});

// ─── validate – custom validator ─────────────────────────────────────────────

describe('validate – custom validator', () => {
  it('fails when a custom validator returns false', () => {
    const schema = {
      email: {
        type: 'string',
        validate: (v) => validators.isEmail(String(v)),
      },
    };
    const result = validate({ email: 'not-an-email' }, schema);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('custom')));
  });

  it('passes when a custom validator returns true', () => {
    const schema = {
      email: {
        type: 'string',
        validate: (v) => validators.isEmail(String(v)),
      },
    };
    const result = validate({ email: 'user@example.com' }, schema);
    assert.ok(result.valid);
  });
});

// ─── validate – multiple fields ───────────────────────────────────────────────

describe('validate – multiple fields', () => {
  it('collects errors from multiple failing fields simultaneously', () => {
    const schema = {
      name: { type: 'string', required: true },
      age:  { type: 'number', required: true, min: 0 },
    };
    const result = validate({ name: null, age: -5 }, schema);
    assert.ok(!result.valid);
    assert.ok(result.errors.length >= 2);
  });

  it('returns an empty errors array when all fields pass', () => {
    const schema = {
      name: { type: 'string', required: true },
      age:  { type: 'number', required: true, min: 0 },
    };
    const result = validate({ name: 'Alice', age: 30 }, schema);
    assert.ok(result.valid);
    assert.deepEqual(result.errors, []);
  });

  it('ignores extra keys in data that are absent from schema', () => {
    const schema = { name: { type: 'string' } };
    const result = validate({ name: 'Bob', extra: 'ignored' }, schema);
    assert.ok(result.valid);
  });
});

// ─── validateField – basic usage ─────────────────────────────────────────────

describe('validateField – basic usage', () => {
  it('returns valid:true for a string matching its descriptor', () => {
    const result = validateField('hello', { type: 'string' }, 'greeting');
    assert.ok(result.valid);
  });

  it('returns valid:false with an error mentioning the field name', () => {
    const result = validateField(42, { type: 'string' }, 'greeting');
    assert.ok(!result.valid);
    assert.ok(result.errors[0].includes('greeting'));
  });

  it('uses "value" as the default field name when omitted', () => {
    const result = validateField(null, { type: 'string', required: true });
    assert.ok(!result.valid);
    assert.ok(result.errors[0].includes('value'));
  });

  it('fails for an absent required field (undefined)', () => {
    const result = validateField(undefined, { type: 'string', required: true }, 'x');
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('required')));
  });

  it('passes for an absent optional field (null)', () => {
    const result = validateField(null, { type: 'string', required: false }, 'x');
    assert.ok(result.valid);
  });

  it('fails for absent required fields of every supported type', () => {
    const types = ['string', 'number', 'boolean', 'array', 'object'];
    for (const type of types) {
      const result = validateField(undefined, { type, required: true }, 'field');
      assert.ok(!result.valid, `expected invalid for absent required ${type}`);
    }
  });
});

// ─── validateField – string constraints ──────────────────────────────────────

describe('validateField – string constraints', () => {
  it('fails when string is shorter than minLength', () => {
    const result = validateField('hi', { type: 'string', minLength: 5 }, 'pw');
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('least')));
  });

  it('fails when string exceeds maxLength', () => {
    const result = validateField('toolong', { type: 'string', maxLength: 3 }, 'tag');
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('most')));
  });

  it('fails when string does not match pattern', () => {
    const result = validateField('abc', { type: 'string', pattern: /^\d+$/ }, 'code');
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('pattern')));
  });

  it('passes when string satisfies all constraints', () => {
    const result = validateField('1234', {
      type: 'string', minLength: 4, maxLength: 4, pattern: /^\d{4}$/,
    }, 'pin');
    assert.ok(result.valid);
  });
});

// ─── validateField – array with items schema ──────────────────────────────────

describe('validateField – array with items schema', () => {
  it('passes when all array items satisfy the items schema', () => {
    const result = validateField(
      ['a', 'b', 'c'],
      { type: 'array', items: { type: 'string' } },
      'tags',
    );
    assert.ok(result.valid);
  });

  it('fails when an array item violates the items type', () => {
    const result = validateField(
      ['a', 2, 'c'],
      { type: 'array', items: { type: 'string' } },
      'tags',
    );
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('tags[1]')));
  });

  it('includes the correct index in the error message', () => {
    const result = validateField(
      [1, 2, 'oops'],
      { type: 'array', items: { type: 'number' } },
      'nums',
    );
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('nums[2]')));
  });
});

// ─── validateField – nested object with properties ────────────────────────────

describe('validateField – nested object with properties', () => {
  it('passes for a nested object with all valid properties', () => {
    const result = validateField(
      { street: 'Main St', zip: '12345' },
      {
        type: 'object',
        properties: {
          street: { type: 'string', required: true },
          zip:    { type: 'string', required: true, pattern: /^\d{5}$/ },
        },
      },
      'address',
    );
    assert.ok(result.valid);
  });

  it('fails for a nested object missing a required property', () => {
    const result = validateField(
      { street: 'Main St' },
      {
        type: 'object',
        properties: {
          street: { type: 'string', required: true },
          zip:    { type: 'string', required: true },
        },
      },
      'address',
    );
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('zip')));
  });
});

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('validate returns valid when schema is empty (no fields to check)', () => {
    const result = validate({ extra: 'ignored' }, {});
    assert.ok(result.valid);
    assert.deepEqual(result.errors, []);
  });

  it('validate returns valid for an empty data object with an empty schema', () => {
    const result = validate({}, {});
    assert.ok(result.valid);
  });

  it('validators.isEmpty identifies null as empty', () => {
    assert.ok(validators.isEmpty(null));
  });

  it('validators.isEmpty identifies undefined as empty', () => {
    assert.ok(validators.isEmpty(undefined));
  });

  it('validators.isEmail returns false for an empty string', () => {
    assert.ok(!validators.isEmail(''));
  });

  it('validateField returns valid for an absent optional field', () => {
    const result = validateField(undefined, { type: 'number' }, 'count');
    assert.ok(result.valid);
  });

  it('validate does not mutate the input data object', () => {
    const data = Object.freeze({ name: 'Alice' });
    const schema = { name: { type: 'string', required: true } };
    // Should not throw even though data is frozen
    const result = validate(data, schema);
    assert.ok(result.valid);
  });

  it('ValidationResult always has a boolean valid and an array errors', () => {
    const r1 = validate({}, {});
    assert.equal(typeof r1.valid, 'boolean');
    assert.ok(Array.isArray(r1.errors));

    const r2 = validateField('x', { type: 'number' }, 'f');
    assert.equal(typeof r2.valid, 'boolean');
    assert.ok(Array.isArray(r2.errors));
  });
});
