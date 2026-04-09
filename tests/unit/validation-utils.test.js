// ─── Unit Tests: validation-utils ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isEmail,
  isURL,
  isIPv4,
  isIPv6,
  isUUID,
  isCreditCard,
  isHexColor,
  isBase64,
  isJSON,
  isAlphanumeric,
  isNumericString,
  isPhoneNumber,
  inRange,
  hasLength,
  matchesPattern,
} from '../../app/modules/validation-utils.js';

// ─── isEmail ──────────────────────────────────────────────────────────────────

describe('isEmail', () => {
  it('accepts a simple email', () => {
    assert.equal(isEmail('user@example.com'), true);
  });

  it('accepts email with subdomain', () => {
    assert.equal(isEmail('user@mail.example.com'), true);
  });

  it('accepts email with plus addressing', () => {
    assert.equal(isEmail('user+tag@example.org'), true);
  });

  it('rejects missing @', () => {
    assert.equal(isEmail('userexample.com'), false);
  });

  it('rejects missing domain', () => {
    assert.equal(isEmail('user@'), false);
  });

  it('rejects missing local part', () => {
    assert.equal(isEmail('@example.com'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isEmail(''), false);
  });

  it('rejects string with spaces', () => {
    assert.equal(isEmail('user @example.com'), false);
  });
});

// ─── isURL ────────────────────────────────────────────────────────────────────

describe('isURL', () => {
  it('accepts http URL', () => {
    assert.equal(isURL('http://example.com'), true);
  });

  it('accepts https URL', () => {
    assert.equal(isURL('https://example.com/path?q=1'), true);
  });

  it('rejects ftp URL', () => {
    assert.equal(isURL('ftp://example.com'), false);
  });

  it('rejects plain string', () => {
    assert.equal(isURL('example.com'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isURL(''), false);
  });

  it('accepts URL with port', () => {
    assert.equal(isURL('http://localhost:3000/api'), true);
  });
});

// ─── isIPv4 ───────────────────────────────────────────────────────────────────

describe('isIPv4', () => {
  it('accepts valid IPv4', () => {
    assert.equal(isIPv4('192.168.1.1'), true);
  });

  it('accepts all zeros', () => {
    assert.equal(isIPv4('0.0.0.0'), true);
  });

  it('accepts broadcast address', () => {
    assert.equal(isIPv4('255.255.255.255'), true);
  });

  it('rejects value > 255', () => {
    assert.equal(isIPv4('256.0.0.1'), false);
  });

  it('rejects too few octets', () => {
    assert.equal(isIPv4('192.168.1'), false);
  });

  it('rejects too many octets', () => {
    assert.equal(isIPv4('1.2.3.4.5'), false);
  });

  it('rejects non-numeric octets', () => {
    assert.equal(isIPv4('192.168.one.1'), false);
  });

  it('rejects leading zeros', () => {
    assert.equal(isIPv4('192.168.01.1'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isIPv4(''), false);
  });
});

// ─── isIPv6 ───────────────────────────────────────────────────────────────────

describe('isIPv6', () => {
  it('accepts full IPv6', () => {
    assert.equal(isIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
  });

  it('accepts loopback with ::', () => {
    assert.equal(isIPv6('::1'), true);
  });

  it('accepts :: alone', () => {
    assert.equal(isIPv6('::'), true);
  });

  it('accepts compressed form', () => {
    assert.equal(isIPv6('fe80::1'), true);
  });

  it('rejects more than one ::', () => {
    assert.equal(isIPv6('::1::2'), false);
  });

  it('rejects wrong number of groups without ::', () => {
    assert.equal(isIPv6('2001:db8:85a3:0:0:8a2e:370'), false);
  });

  it('rejects invalid hex characters', () => {
    assert.equal(isIPv6('gggg::1'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isIPv6(''), false);
  });
});

// ─── isUUID ───────────────────────────────────────────────────────────────────

describe('isUUID', () => {
  it('accepts valid UUID v4', () => {
    // version digit = 4, variant = [89ab] in 3rd segment
    assert.equal(isUUID('123e4567-e89b-4fd4-8456-426614174000'), true);
  });

  it('accepts another valid UUID v4', () => {
    assert.equal(isUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479'), true);
  });

  it('rejects UUID with wrong version digit (5 instead of 4)', () => {
    assert.equal(isUUID('123e4567-e89b-5fd4-8456-426614174000'), false);
  });

  it('rejects UUID with invalid variant digit (4 not in [89ab])', () => {
    // 4th group starts with 4, which is not in [89ab]
    assert.equal(isUUID('123e4567-e89b-42d4-4456-426614174000'), false);
  });

  it('rejects UUID without dashes', () => {
    assert.equal(isUUID('123e4567e89b4fd48456426614174000'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isUUID(''), false);
  });

  it('rejects UUID with wrong structure', () => {
    assert.equal(isUUID('not-a-uuid'), false);
  });
});

// ─── isCreditCard ─────────────────────────────────────────────────────────────

describe('isCreditCard', () => {
  it('accepts a valid Visa card number', () => {
    assert.equal(isCreditCard('4532015112830366'), true);
  });

  it('accepts card number with spaces', () => {
    assert.equal(isCreditCard('4532 0151 1283 0366'), true);
  });

  it('accepts card number with dashes', () => {
    assert.equal(isCreditCard('4532-0151-1283-0366'), true);
  });

  it('rejects invalid card number (Luhn fail)', () => {
    assert.equal(isCreditCard('4532015112830367'), false);
  });

  it('rejects non-numeric string', () => {
    assert.equal(isCreditCard('abcd-efgh-ijkl-mnop'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isCreditCard(''), false);
  });

  it('rejects too-short number', () => {
    assert.equal(isCreditCard('123456'), false);
  });
});

// ─── isHexColor ───────────────────────────────────────────────────────────────

describe('isHexColor', () => {
  it('accepts #RGB shorthand', () => {
    assert.equal(isHexColor('#fff'), true);
  });

  it('accepts #RRGGBB full form', () => {
    assert.equal(isHexColor('#ff0000'), true);
  });

  it('accepts uppercase letters', () => {
    assert.equal(isHexColor('#FF0000'), true);
  });

  it('rejects without #', () => {
    assert.equal(isHexColor('ff0000'), false);
  });

  it('rejects wrong length', () => {
    assert.equal(isHexColor('#ff00'), false);
  });

  it('rejects non-hex characters', () => {
    assert.equal(isHexColor('#gggggg'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isHexColor(''), false);
  });
});

// ─── isBase64 ─────────────────────────────────────────────────────────────────

describe('isBase64', () => {
  it('accepts valid base64 string', () => {
    assert.equal(isBase64('SGVsbG8gV29ybGQ='), true);
  });

  it('accepts base64 without padding', () => {
    // "Man" in base64 is "TWFu" (no padding needed)
    assert.equal(isBase64('TWFu'), true);
  });

  it('accepts base64 with double padding', () => {
    // "Ma" = "TWE="... length must be multiple of 4
    assert.equal(isBase64('TWE='), true);
  });

  it('rejects string with invalid characters', () => {
    assert.equal(isBase64('SGVs!G8='), false);
  });

  it('rejects string with wrong length', () => {
    assert.equal(isBase64('SGVsb'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isBase64(''), false);
  });
});

// ─── isJSON ───────────────────────────────────────────────────────────────────

describe('isJSON', () => {
  it('accepts valid JSON object', () => {
    assert.equal(isJSON('{"key":"value"}'), true);
  });

  it('accepts JSON array', () => {
    assert.equal(isJSON('[1,2,3]'), true);
  });

  it('accepts JSON null', () => {
    assert.equal(isJSON('null'), true);
  });

  it('accepts JSON number', () => {
    assert.equal(isJSON('42'), true);
  });

  it('accepts JSON string', () => {
    assert.equal(isJSON('"hello"'), true);
  });

  it('rejects malformed JSON', () => {
    assert.equal(isJSON('{key: value}'), false);
  });

  it('rejects plain text', () => {
    assert.equal(isJSON('hello world'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isJSON(''), false);
  });
});

// ─── isAlphanumeric ───────────────────────────────────────────────────────────

describe('isAlphanumeric', () => {
  it('accepts letters only', () => {
    assert.equal(isAlphanumeric('hello'), true);
  });

  it('accepts digits only', () => {
    assert.equal(isAlphanumeric('12345'), true);
  });

  it('accepts mixed letters and digits', () => {
    assert.equal(isAlphanumeric('abc123'), true);
  });

  it('rejects string with spaces', () => {
    assert.equal(isAlphanumeric('hello world'), false);
  });

  it('rejects string with special characters', () => {
    assert.equal(isAlphanumeric('hello!'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isAlphanumeric(''), false);
  });
});

// ─── isNumericString ──────────────────────────────────────────────────────────

describe('isNumericString', () => {
  it('accepts integer string', () => {
    assert.equal(isNumericString('42'), true);
  });

  it('accepts float string', () => {
    assert.equal(isNumericString('3.14'), true);
  });

  it('accepts negative number string', () => {
    assert.equal(isNumericString('-7'), true);
  });

  it('accepts scientific notation', () => {
    assert.equal(isNumericString('1e5'), true);
  });

  it('rejects alphabetic string', () => {
    assert.equal(isNumericString('abc'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isNumericString(''), false);
  });

  it('rejects whitespace-only string', () => {
    assert.equal(isNumericString('   '), false);
  });

  it('rejects Infinity', () => {
    assert.equal(isNumericString('Infinity'), false);
  });
});

// ─── isPhoneNumber ────────────────────────────────────────────────────────────

describe('isPhoneNumber', () => {
  it('accepts international format', () => {
    assert.equal(isPhoneNumber('+1-800-555-0100'), true);
  });

  it('accepts US format with parens', () => {
    assert.equal(isPhoneNumber('(555) 123-4567'), true);
  });

  it('accepts plain digits', () => {
    assert.equal(isPhoneNumber('5551234567'), true);
  });

  it('accepts digits with spaces', () => {
    assert.equal(isPhoneNumber('555 123 4567'), true);
  });

  it('rejects empty string', () => {
    assert.equal(isPhoneNumber(''), false);
  });

  it('rejects too-short number', () => {
    assert.equal(isPhoneNumber('123'), false);
  });

  it('rejects string with letters', () => {
    assert.equal(isPhoneNumber('555-CALL-NOW'), false);
  });
});

// ─── inRange ──────────────────────────────────────────────────────────────────

describe('inRange', () => {
  it('returns true for value within range', () => {
    assert.equal(inRange(5, 1, 10), true);
  });

  it('returns true for value at minimum', () => {
    assert.equal(inRange(1, 1, 10), true);
  });

  it('returns true for value at maximum', () => {
    assert.equal(inRange(10, 1, 10), true);
  });

  it('returns false for value below minimum', () => {
    assert.equal(inRange(0, 1, 10), false);
  });

  it('returns false for value above maximum', () => {
    assert.equal(inRange(11, 1, 10), false);
  });

  it('works with negative range', () => {
    assert.equal(inRange(-3, -5, 0), true);
  });

  it('works with float values', () => {
    assert.equal(inRange(0.5, 0.0, 1.0), true);
  });
});

// ─── hasLength ────────────────────────────────────────────────────────────────

describe('hasLength', () => {
  it('returns true when string length meets minimum', () => {
    assert.equal(hasLength('hello', 3), true);
  });

  it('returns false when string length is below minimum', () => {
    assert.equal(hasLength('hi', 3), false);
  });

  it('returns true when string length is within min and max', () => {
    assert.equal(hasLength('hello', 3, 10), true);
  });

  it('returns false when string length exceeds max', () => {
    assert.equal(hasLength('hello world', 3, 8), false);
  });

  it('works with arrays', () => {
    assert.equal(hasLength([1, 2, 3], 2, 5), true);
  });

  it('returns false for array shorter than min', () => {
    assert.equal(hasLength([1], 2), false);
  });

  it('returns true for exact length match', () => {
    assert.equal(hasLength('abc', 3, 3), true);
  });
});

// ─── matchesPattern ───────────────────────────────────────────────────────────

describe('matchesPattern', () => {
  it('returns true when string matches pattern', () => {
    assert.equal(matchesPattern('hello123', /^[a-z]+\d+$/), true);
  });

  it('returns false when string does not match pattern', () => {
    assert.equal(matchesPattern('hello', /^\d+$/), false);
  });

  it('works with case-insensitive flag', () => {
    assert.equal(matchesPattern('HELLO', /^hello$/i), true);
  });

  it('returns false for empty string with non-matching pattern', () => {
    assert.equal(matchesPattern('', /\w+/), false);
  });

  it('returns true for empty string matching empty pattern', () => {
    assert.equal(matchesPattern('', /^$/), true);
  });
});
