// ─── Unit Tests: string-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  capitalize,
  camelToKebab,
  kebabToCamel,
  toSnakeCase,
  truncate,
  padLeft,
  padRight,
  countOccurrences,
  reverseString,
  isPalindrome,
  escapeRegex,
  slugify,
  splitWords,
  wordWrap,
} from '../../app/modules/string-utils.js';

// ─── capitalize ───────────────────────────────────────────────────────────────

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    assert.equal(capitalize('hello'), 'Hello');
  });

  it('returns empty string unchanged', () => {
    assert.equal(capitalize(''), '');
  });

  it('handles already-capitalized string', () => {
    assert.equal(capitalize('Hello'), 'Hello');
  });

  it('handles single character', () => {
    assert.equal(capitalize('a'), 'A');
  });

  it('does not alter the rest of the string', () => {
    assert.equal(capitalize('hELLO'), 'HELLO');
  });
});

// ─── camelToKebab ─────────────────────────────────────────────────────────────

describe('camelToKebab', () => {
  it('converts camelCase to kebab-case', () => {
    assert.equal(camelToKebab('camelCase'), 'camel-case');
  });

  it('converts myVar to my-var', () => {
    assert.equal(camelToKebab('myVar'), 'my-var');
  });

  it('handles consecutive uppercase letters', () => {
    assert.equal(camelToKebab('myHTMLParser'), 'my-h-t-m-l-parser');
  });

  it('leaves lowercase-only strings unchanged', () => {
    assert.equal(camelToKebab('simple'), 'simple');
  });

  it('handles empty string', () => {
    assert.equal(camelToKebab(''), '');
  });
});

// ─── kebabToCamel ─────────────────────────────────────────────────────────────

describe('kebabToCamel', () => {
  it('converts kebab-case to camelCase', () => {
    assert.equal(kebabToCamel('my-var'), 'myVar');
  });

  it('handles multiple hyphens', () => {
    assert.equal(kebabToCamel('my-long-variable-name'), 'myLongVariableName');
  });

  it('leaves no-hyphen strings unchanged', () => {
    assert.equal(kebabToCamel('simple'), 'simple');
  });

  it('handles empty string', () => {
    assert.equal(kebabToCamel(''), '');
  });
});

// ─── toSnakeCase ──────────────────────────────────────────────────────────────

describe('toSnakeCase', () => {
  it('converts camelCase to snake_case', () => {
    assert.equal(toSnakeCase('camelCase'), 'camel_case');
  });

  it('converts space-separated string to snake_case', () => {
    assert.equal(toSnakeCase('My Variable'), 'my_variable');
  });

  it('converts kebab-case to snake_case', () => {
    assert.equal(toSnakeCase('my-var'), 'my_var');
  });

  it('handles already snake_case', () => {
    assert.equal(toSnakeCase('my_var'), 'my_var');
  });

  it('handles empty string', () => {
    assert.equal(toSnakeCase(''), '');
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('truncates a string longer than maxLength', () => {
    assert.equal(truncate('Hello, World!', 8), 'Hello...');
  });

  it('returns string unchanged if short enough', () => {
    assert.equal(truncate('Hi', 10), 'Hi');
  });

  it('returns string unchanged if equal to maxLength', () => {
    assert.equal(truncate('Hello', 5), 'Hello');
  });

  it('uses a custom suffix', () => {
    assert.equal(truncate('Hello, World!', 7, '…'), 'Hello,…');
  });

  it('truncates to exact length including suffix', () => {
    const result = truncate('abcdefgh', 5);
    assert.equal(result.length, 5);
    assert.equal(result, 'ab...');
  });
});

// ─── padLeft ──────────────────────────────────────────────────────────────────

describe('padLeft', () => {
  it('pads a short string on the left', () => {
    assert.equal(padLeft('5', 3, '0'), '005');
  });

  it('returns string unchanged when already at target length', () => {
    assert.equal(padLeft('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target length', () => {
    assert.equal(padLeft('toolong', 3), 'toolong');
  });

  it('uses space as default padding character', () => {
    assert.equal(padLeft('hi', 4), '  hi');
  });
});

// ─── padRight ─────────────────────────────────────────────────────────────────

describe('padRight', () => {
  it('pads a short string on the right', () => {
    assert.equal(padRight('hi', 5, '-'), 'hi---');
  });

  it('returns string unchanged when already at target length', () => {
    assert.equal(padRight('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target length', () => {
    assert.equal(padRight('toolong', 3), 'toolong');
  });

  it('uses space as default padding character', () => {
    assert.equal(padRight('hi', 4), 'hi  ');
  });
});

// ─── countOccurrences ────────────────────────────────────────────────────────

describe('countOccurrences', () => {
  it('counts non-overlapping occurrences', () => {
    assert.equal(countOccurrences('hello hello hello', 'hello'), 3);
  });

  it('returns 0 when substring is not found', () => {
    assert.equal(countOccurrences('hello world', 'xyz'), 0);
  });

  it('returns 0 for empty substring', () => {
    assert.equal(countOccurrences('hello', ''), 0);
  });

  it('handles single-character substring', () => {
    assert.equal(countOccurrences('banana', 'a'), 3);
  });

  it('handles overlapping-style substrings (non-overlapping count)', () => {
    assert.equal(countOccurrences('aaa', 'aa'), 1);
  });
});

// ─── reverseString ────────────────────────────────────────────────────────────

describe('reverseString', () => {
  it('reverses a simple string', () => {
    assert.equal(reverseString('hello'), 'olleh');
  });

  it('returns empty string unchanged', () => {
    assert.equal(reverseString(''), '');
  });

  it('returns single character unchanged', () => {
    assert.equal(reverseString('a'), 'a');
  });

  it('reverses a palindrome to itself', () => {
    assert.equal(reverseString('racecar'), 'racecar');
  });
});

// ─── isPalindrome ─────────────────────────────────────────────────────────────

describe('isPalindrome', () => {
  it('returns true for racecar', () => {
    assert.equal(isPalindrome('racecar'), true);
  });

  it('returns true for classic palindrome phrase ignoring spaces and case', () => {
    assert.equal(isPalindrome('A man a plan a canal Panama'), true);
  });

  it('returns false for non-palindrome', () => {
    assert.equal(isPalindrome('hello'), false);
  });

  it('returns true for empty string', () => {
    assert.equal(isPalindrome(''), true);
  });

  it('returns true for single character', () => {
    assert.equal(isPalindrome('a'), true);
  });

  it('ignores punctuation', () => {
    assert.equal(isPalindrome('Was it a car or a cat I saw?'), true);
  });
});

// ─── escapeRegex ──────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
  it('escapes dot', () => {
    assert.equal(escapeRegex('.'), '\\.');
  });

  it('escapes brackets', () => {
    assert.equal(escapeRegex('[hello]'), '\\[hello\\]');
  });

  it('escapes multiple special characters', () => {
    const escaped = escapeRegex('1+1=2 (really?)');
    // Verify it can be used in a regex without throwing
    const re = new RegExp(escaped);
    assert.equal(re.test('1+1=2 (really?)'), true);
  });

  it('leaves normal strings unchanged', () => {
    assert.equal(escapeRegex('hello'), 'hello');
  });

  it('escapes all special regex characters', () => {
    const special = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(special);
    // Every character should now be escaped
    assert.equal(escaped.includes('\\'), true);
  });
});

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts Hello World! to hello-world', () => {
    assert.equal(slugify('Hello World!'), 'hello-world');
  });

  it('collapses multiple spaces to single hyphen', () => {
    assert.equal(slugify('foo   bar'), 'foo-bar');
  });

  it('removes leading and trailing hyphens', () => {
    assert.equal(slugify(' hello '), 'hello');
  });

  it('handles empty string', () => {
    assert.equal(slugify(''), '');
  });

  it('converts to lowercase', () => {
    assert.equal(slugify('NovaReader'), 'novareader');
  });

  it('strips special characters', () => {
    assert.equal(slugify('Hello, World! (2024)'), 'hello-world-2024');
  });
});

// ─── splitWords ───────────────────────────────────────────────────────────────

describe('splitWords', () => {
  it('splits camelCase into words', () => {
    assert.deepEqual(splitWords('camelCase'), ['camel', 'Case']);
  });

  it('splits snake_case into words', () => {
    assert.deepEqual(splitWords('my_variable'), ['my', 'variable']);
  });

  it('splits kebab-case into words', () => {
    assert.deepEqual(splitWords('my-variable'), ['my', 'variable']);
  });

  it('splits space-separated words', () => {
    assert.deepEqual(splitWords('hello world'), ['hello', 'world']);
  });

  it('handles mixed separators', () => {
    assert.deepEqual(splitWords('my-camelCase_word'), ['my', 'camel', 'Case', 'word']);
  });

  it('handles empty string', () => {
    assert.deepEqual(splitWords(''), []);
  });
});

// ─── wordWrap ─────────────────────────────────────────────────────────────────

describe('wordWrap', () => {
  it('wraps at the correct column width', () => {
    const lines = wordWrap('The quick brown fox', 10);
    assert.deepEqual(lines, ['The quick', 'brown fox']);
  });

  it('does not break short strings', () => {
    const lines = wordWrap('Hello', 20);
    assert.deepEqual(lines, ['Hello']);
  });

  it('returns each word on its own line if width is very small', () => {
    const lines = wordWrap('one two three', 3);
    assert.deepEqual(lines, ['one', 'two', 'three']);
  });

  it('handles empty string', () => {
    const lines = wordWrap('', 10);
    assert.deepEqual(lines, []);
  });

  it('fits exactly at width boundary', () => {
    const lines = wordWrap('ab cd ef', 5);
    assert.deepEqual(lines, ['ab cd', 'ef']);
  });

  it('handles multiple spaces between words', () => {
    const lines = wordWrap('hello   world', 20);
    assert.deepEqual(lines, ['hello world']);
  });
});
