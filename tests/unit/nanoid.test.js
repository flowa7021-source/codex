// ─── Unit Tests: Nanoid ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ALPHABET,
  nanoid,
  customNanoid,
  urlFriendlyId,
  numericId,
  alphanumericId,
  isValidNanoid,
} from '../../app/modules/nanoid.js';

// ─── DEFAULT_ALPHABET ─────────────────────────────────────────────────────────

describe('DEFAULT_ALPHABET', () => {
  it('is 64 characters long', () => {
    assert.equal(DEFAULT_ALPHABET.length, 64);
  });

  it('contains only URL-safe characters', () => {
    assert.match(DEFAULT_ALPHABET, /^[A-Za-z0-9_-]+$/);
  });

  it('has no duplicate characters', () => {
    assert.equal(new Set(DEFAULT_ALPHABET).size, DEFAULT_ALPHABET.length);
  });
});

// ─── nanoid ───────────────────────────────────────────────────────────────────

describe('nanoid', () => {
  it('returns a string of default length 21', () => {
    const id = nanoid();
    assert.equal(typeof id, 'string');
    assert.equal(id.length, 21);
  });

  it('respects a custom size', () => {
    assert.equal(nanoid(10).length, 10);
    assert.equal(nanoid(50).length, 50);
  });

  it('uses only characters from DEFAULT_ALPHABET', () => {
    const allowed = new Set(DEFAULT_ALPHABET);
    const id = nanoid();
    for (const ch of id) {
      assert.ok(allowed.has(ch), `unexpected char: ${ch}`);
    }
  });

  it('generates unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nanoid()));
    assert.equal(ids.size, 1000);
  });

  it('throws for size <= 0', () => {
    assert.throws(() => nanoid(0), RangeError);
    assert.throws(() => nanoid(-1), RangeError);
  });
});

// ─── customNanoid ─────────────────────────────────────────────────────────────

describe('customNanoid', () => {
  it('returns a factory function', () => {
    assert.equal(typeof customNanoid('abc'), 'function');
  });

  it('factory produces IDs of the specified size', () => {
    const gen = customNanoid('01', 8);
    assert.equal(gen().length, 8);
  });

  it('factory uses only characters from the given alphabet', () => {
    const alphabet = 'abc';
    const gen = customNanoid(alphabet, 20);
    const id = gen();
    for (const ch of id) {
      assert.ok(alphabet.includes(ch), `unexpected char: ${ch}`);
    }
  });

  it('factory with default size produces length-21 IDs', () => {
    const gen = customNanoid('XY');
    assert.equal(gen().length, 21);
  });

  it('different calls to the factory return unique IDs', () => {
    const gen = customNanoid(DEFAULT_ALPHABET, 21);
    const ids = new Set(Array.from({ length: 500 }, () => gen()));
    assert.equal(ids.size, 500);
  });

  it('throws for empty alphabet', () => {
    assert.throws(() => customNanoid(''), RangeError);
  });

  it('throws for size <= 0', () => {
    assert.throws(() => customNanoid('abc', 0), RangeError);
  });

  it('works with a single-character alphabet', () => {
    const gen = customNanoid('X', 5);
    assert.equal(gen(), 'XXXXX');
  });
});

// ─── urlFriendlyId ───────────────────────────────────────────────────────────

describe('urlFriendlyId', () => {
  it('returns a string of default length 21', () => {
    assert.equal(urlFriendlyId().length, 21);
  });

  it('respects a custom size', () => {
    assert.equal(urlFriendlyId(10).length, 10);
  });

  it('contains only URL-safe unreserved characters', () => {
    const id = urlFriendlyId(100);
    assert.match(id, /^[A-Za-z0-9~_.'-]*$/);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 500 }, () => urlFriendlyId()));
    assert.equal(ids.size, 500);
  });
});

// ─── numericId ───────────────────────────────────────────────────────────────

describe('numericId', () => {
  it('returns a string of default length 21', () => {
    assert.equal(numericId().length, 21);
  });

  it('respects a custom digit count', () => {
    assert.equal(numericId(6).length, 6);
  });

  it('contains only digits', () => {
    assert.match(numericId(50), /^\d+$/);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 500 }, () => numericId()));
    assert.ok(ids.size > 490); // allow tiny collision probability
  });
});

// ─── alphanumericId ───────────────────────────────────────────────────────────

describe('alphanumericId', () => {
  it('returns a string of default length 21', () => {
    assert.equal(alphanumericId().length, 21);
  });

  it('respects a custom size', () => {
    assert.equal(alphanumericId(16).length, 16);
  });

  it('contains only alphanumeric characters (no symbols)', () => {
    assert.match(alphanumericId(50), /^[A-Za-z0-9]+$/);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 500 }, () => alphanumericId()));
    assert.equal(ids.size, 500);
  });
});

// ─── isValidNanoid ────────────────────────────────────────────────────────────

describe('isValidNanoid', () => {
  it('accepts a nanoid() output with default alphabet and size', () => {
    const id = nanoid();
    assert.ok(isValidNanoid(id, DEFAULT_ALPHABET, 21));
  });

  it('accepts a valid ID when size is not specified', () => {
    assert.ok(isValidNanoid('abc', 'abc'));
  });

  it('rejects a string with a character outside the alphabet', () => {
    assert.equal(isValidNanoid('abc!', 'abcdefghij'), false);
  });

  it('rejects when length does not match the expected size', () => {
    assert.equal(isValidNanoid('abc', DEFAULT_ALPHABET, 5), false);
  });

  it('rejects an empty string', () => {
    assert.equal(isValidNanoid('', DEFAULT_ALPHABET), false);
  });

  it('rejects non-string input', () => {
    // @ts-ignore intentional wrong type
    assert.equal(isValidNanoid(42, DEFAULT_ALPHABET), false);
  });

  it('accepts numeric IDs against numeric alphabet', () => {
    const id = numericId(10);
    assert.ok(isValidNanoid(id, '0123456789', 10));
  });

  it('validates alphanumericId correctly', () => {
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const id = alphanumericId(16);
    assert.ok(isValidNanoid(id, ALPHA, 16));
  });

  it('validates urlFriendlyId against its alphabet', () => {
    const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_-.';
    const id = urlFriendlyId(21);
    assert.ok(isValidNanoid(id, URL_SAFE, 21));
  });
});
