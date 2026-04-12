// ─── Unit Tests: string-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  camelCase,
  snakeCase,
  kebabCase,
  pascalCase,
  titleCase,
  padLeft,
  padRight,
  truncate,
  isPalindrome,
  isAnagram,
  countOccurrences,
  reverse,
  capitalize,
  words,
  wrap,
  stripDiacritics,
  interpolate,
  hammingDistance,
  longestCommonPrefix,
} from '../../app/modules/string-utils.js';

// ─── camelCase ────────────────────────────────────────────────────────────────

describe('camelCase', () => {
  it('converts space-separated words', () => {
    assert.equal(camelCase('hello world'), 'helloWorld');
  });

  it('converts kebab-case', () => {
    assert.equal(camelCase('hello-world'), 'helloWorld');
  });

  it('converts snake_case', () => {
    assert.equal(camelCase('hello_world'), 'helloWorld');
  });

  it('converts PascalCase', () => {
    assert.equal(camelCase('HelloWorld'), 'helloWorld');
  });

  it('handles empty string', () => {
    assert.equal(camelCase(''), '');
  });

  it('handles single word', () => {
    assert.equal(camelCase('hello'), 'hello');
  });

  it('handles multiple words', () => {
    assert.equal(camelCase('the quick brown fox'), 'theQuickBrownFox');
  });
});

// ─── snakeCase ────────────────────────────────────────────────────────────────

describe('snakeCase', () => {
  it('converts camelCase to snake_case', () => {
    assert.equal(snakeCase('helloWorld'), 'hello_world');
  });

  it('converts space-separated words', () => {
    assert.equal(snakeCase('hello world'), 'hello_world');
  });

  it('converts kebab-case', () => {
    assert.equal(snakeCase('hello-world'), 'hello_world');
  });

  it('lowercases everything', () => {
    assert.equal(snakeCase('Hello World'), 'hello_world');
  });

  it('handles empty string', () => {
    assert.equal(snakeCase(''), '');
  });

  it('handles already snake_case', () => {
    assert.equal(snakeCase('hello_world'), 'hello_world');
  });
});

// ─── kebabCase ────────────────────────────────────────────────────────────────

describe('kebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    assert.equal(kebabCase('helloWorld'), 'hello-world');
  });

  it('converts space-separated words', () => {
    assert.equal(kebabCase('hello world'), 'hello-world');
  });

  it('converts snake_case', () => {
    assert.equal(kebabCase('hello_world'), 'hello-world');
  });

  it('lowercases everything', () => {
    assert.equal(kebabCase('Hello World'), 'hello-world');
  });

  it('handles empty string', () => {
    assert.equal(kebabCase(''), '');
  });

  it('handles already kebab-case', () => {
    assert.equal(kebabCase('hello-world'), 'hello-world');
  });
});

// ─── pascalCase ───────────────────────────────────────────────────────────────

describe('pascalCase', () => {
  it('converts space-separated words', () => {
    assert.equal(pascalCase('hello world'), 'HelloWorld');
  });

  it('converts camelCase', () => {
    assert.equal(pascalCase('helloWorld'), 'HelloWorld');
  });

  it('converts snake_case', () => {
    assert.equal(pascalCase('hello_world'), 'HelloWorld');
  });

  it('converts kebab-case', () => {
    assert.equal(pascalCase('hello-world'), 'HelloWorld');
  });

  it('handles empty string', () => {
    assert.equal(pascalCase(''), '');
  });

  it('handles single word', () => {
    assert.equal(pascalCase('hello'), 'Hello');
  });
});

// ─── titleCase ────────────────────────────────────────────────────────────────

describe('titleCase', () => {
  it('capitalizes each word', () => {
    assert.equal(titleCase('hello world'), 'Hello World');
  });

  it('handles camelCase input', () => {
    assert.equal(titleCase('helloWorld'), 'Hello World');
  });

  it('handles snake_case input', () => {
    assert.equal(titleCase('hello_world'), 'Hello World');
  });

  it('handles empty string', () => {
    assert.equal(titleCase(''), '');
  });

  it('handles single word', () => {
    assert.equal(titleCase('hello'), 'Hello');
  });

  it('lowercases non-leading letters', () => {
    assert.equal(titleCase('HELLO WORLD'), 'Hello World');
  });
});

// ─── padLeft ──────────────────────────────────────────────────────────────────

describe('padLeft', () => {
  it('pads with zeros', () => {
    assert.equal(padLeft('5', 3, '0'), '005');
  });

  it('returns string unchanged when at target length', () => {
    assert.equal(padLeft('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target', () => {
    assert.equal(padLeft('toolong', 3), 'toolong');
  });

  it('uses space as default pad character', () => {
    assert.equal(padLeft('hi', 4), '  hi');
  });

  it('handles zero-length target', () => {
    assert.equal(padLeft('hi', 0), 'hi');
  });

  it('pads with custom character', () => {
    assert.equal(padLeft('42', 6, '*'), '****42');
  });

  it('handles empty source string', () => {
    assert.equal(padLeft('', 3, '-'), '---');
  });
});

// ─── padRight ─────────────────────────────────────────────────────────────────

describe('padRight', () => {
  it('pads on the right with custom character', () => {
    assert.equal(padRight('hi', 5, '-'), 'hi---');
  });

  it('returns string unchanged when at target length', () => {
    assert.equal(padRight('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target', () => {
    assert.equal(padRight('toolong', 3), 'toolong');
  });

  it('uses space as default pad character', () => {
    assert.equal(padRight('hi', 4), 'hi  ');
  });

  it('handles zero-length target', () => {
    assert.equal(padRight('hi', 0), 'hi');
  });

  it('handles empty source string', () => {
    assert.equal(padRight('', 3, '.'), '...');
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('truncates a long string with default ellipsis', () => {
    assert.equal(truncate('Hello, World!', 8), 'Hello...');
  });

  it('returns original string when it fits exactly', () => {
    assert.equal(truncate('Hello', 5), 'Hello');
  });

  it('returns original string when shorter than maxLength', () => {
    assert.equal(truncate('Hi', 10), 'Hi');
  });

  it('uses a custom ellipsis', () => {
    assert.equal(truncate('Hello, World!', 9, '…'), 'Hello, W…');
  });

  it('handles maxLength equal to ellipsis length', () => {
    assert.equal(truncate('Hello, World!', 3), '...');
  });

  it('handles maxLength shorter than ellipsis', () => {
    assert.equal(truncate('Hello, World!', 2), '..');
  });

  it('handles empty source string', () => {
    assert.equal(truncate('', 5), '');
  });

  it('handles empty ellipsis', () => {
    assert.equal(truncate('Hello World', 5, ''), 'Hello');
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

  it('returns false for a non-palindrome', () => {
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

  it('is case-insensitive', () => {
    assert.equal(isPalindrome('Racecar'), true);
  });
});

// ─── isAnagram ────────────────────────────────────────────────────────────────

describe('isAnagram', () => {
  it('returns true for valid anagram', () => {
    assert.equal(isAnagram('listen', 'silent'), true);
  });

  it('returns false for non-anagram', () => {
    assert.equal(isAnagram('hello', 'world'), false);
  });

  it('is case-insensitive', () => {
    assert.equal(isAnagram('Listen', 'Silent'), true);
  });

  it('ignores non-alphabetic characters', () => {
    assert.equal(isAnagram('a b c', 'c b a'), true);
  });

  it('returns true for identical strings', () => {
    assert.equal(isAnagram('abc', 'abc'), true);
  });

  it('returns false when one string has extra letters', () => {
    assert.equal(isAnagram('abc', 'abcd'), false);
  });

  it('returns true for two empty strings', () => {
    assert.equal(isAnagram('', ''), true);
  });
});

// ─── countOccurrences ────────────────────────────────────────────────────────

describe('countOccurrences', () => {
  it('counts non-overlapping occurrences', () => {
    assert.equal(countOccurrences('hello hello hello', 'hello'), 3);
  });

  it('returns 0 when substring not found', () => {
    assert.equal(countOccurrences('hello world', 'xyz'), 0);
  });

  it('returns 0 for empty substring', () => {
    assert.equal(countOccurrences('hello', ''), 0);
  });

  it('handles single-character substring', () => {
    assert.equal(countOccurrences('banana', 'a'), 3);
  });

  it('counts non-overlapping (aaa with aa = 1)', () => {
    assert.equal(countOccurrences('aaa', 'aa'), 1);
  });

  it('handles empty source string', () => {
    assert.equal(countOccurrences('', 'a'), 0);
  });
});

// ─── reverse ──────────────────────────────────────────────────────────────────

describe('reverse', () => {
  it('reverses a simple string', () => {
    assert.equal(reverse('hello'), 'olleh');
  });

  it('returns empty string unchanged', () => {
    assert.equal(reverse(''), '');
  });

  it('returns single character unchanged', () => {
    assert.equal(reverse('a'), 'a');
  });

  it('reverses a palindrome to itself', () => {
    assert.equal(reverse('racecar'), 'racecar');
  });

  it('handles numeric characters', () => {
    assert.equal(reverse('12345'), '54321');
  });
});

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

// ─── words ────────────────────────────────────────────────────────────────────

describe('words', () => {
  it('splits on whitespace', () => {
    assert.deepEqual(words('hello world'), ['hello', 'world']);
  });

  it('splits on punctuation', () => {
    assert.deepEqual(words('hello, world!'), ['hello', 'world']);
  });

  it('handles multiple spaces', () => {
    assert.deepEqual(words('foo   bar'), ['foo', 'bar']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(words(''), []);
  });

  it('handles leading and trailing spaces', () => {
    assert.deepEqual(words('  hello world  '), ['hello', 'world']);
  });

  it('handles mixed punctuation separators', () => {
    assert.deepEqual(words('one.two,three'), ['one', 'two', 'three']);
  });
});

// ─── wrap ─────────────────────────────────────────────────────────────────────

describe('wrap', () => {
  it('wraps at the correct column width', () => {
    assert.equal(wrap('The quick brown fox', 10), 'The quick\nbrown fox');
  });

  it('does not wrap short strings', () => {
    assert.equal(wrap('Hello', 20), 'Hello');
  });

  it('wraps each word on its own line if width is very small', () => {
    assert.equal(wrap('one two three', 3), 'one\ntwo\nthree');
  });

  it('handles empty string', () => {
    assert.equal(wrap('', 10), '');
  });

  it('fits exactly at width boundary', () => {
    assert.equal(wrap('ab cd ef', 5), 'ab cd\nef');
  });

  it('handles multiple spaces between words', () => {
    assert.equal(wrap('hello   world', 20), 'hello world');
  });

  it('uses custom newline separator', () => {
    assert.equal(wrap('hello world', 5, '<br>'), 'hello<br>world');
  });
});

// ─── stripDiacritics ──────────────────────────────────────────────────────────

describe('stripDiacritics', () => {
  it('strips accents from é', () => {
    assert.equal(stripDiacritics('café'), 'cafe');
  });

  it('strips accents from multiple characters', () => {
    assert.equal(stripDiacritics('résumé'), 'resume');
  });

  it('strips umlaut from ü', () => {
    assert.equal(stripDiacritics('über'), 'uber');
  });

  it('handles string with no diacritics unchanged', () => {
    assert.equal(stripDiacritics('hello'), 'hello');
  });

  it('handles empty string', () => {
    assert.equal(stripDiacritics(''), '');
  });

  it('strips cedilla from ç', () => {
    assert.equal(stripDiacritics('façade'), 'facade');
  });

  it('handles Spanish characters', () => {
    assert.equal(stripDiacritics('España'), 'Espana');
  });
});

// ─── interpolate ─────────────────────────────────────────────────────────────

describe('interpolate', () => {
  it('replaces a single placeholder', () => {
    assert.equal(interpolate('Hi {name}', { name: 'Alice' }), 'Hi Alice');
  });

  it('replaces multiple placeholders', () => {
    assert.equal(
      interpolate('{greeting}, {name}!', { greeting: 'Hello', name: 'Bob' }),
      'Hello, Bob!',
    );
  });

  it('supports numeric values', () => {
    assert.equal(interpolate('Age: {age}', { age: 30 }), 'Age: 30');
  });

  it('leaves unknown placeholders unchanged', () => {
    assert.equal(interpolate('Hi {name}', {}), 'Hi {name}');
  });

  it('handles empty template', () => {
    assert.equal(interpolate('', { name: 'Alice' }), '');
  });

  it('handles template with no placeholders', () => {
    assert.equal(interpolate('Hello world', { name: 'Alice' }), 'Hello world');
  });

  it('handles repeated placeholder', () => {
    assert.equal(interpolate('{x} + {x} = {y}', { x: 1, y: 2 }), '1 + 1 = 2');
  });
});

// ─── hammingDistance ──────────────────────────────────────────────────────────

describe('hammingDistance', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(hammingDistance('abc', 'abc'), 0);
  });

  it('returns correct distance for known example', () => {
    // 'karolin' vs 'kathrin': k=k, a=a, r≠t, o≠h, l≠r, i=i, n=n → 3
    assert.equal(hammingDistance('karolin', 'kathrin'), 3);
  });

  it('returns the full length when strings are completely different', () => {
    assert.equal(hammingDistance('abc', 'xyz'), 3);
  });

  it('returns 0 for two empty strings', () => {
    assert.equal(hammingDistance('', ''), 0);
  });

  it('handles single-character strings that match', () => {
    assert.equal(hammingDistance('a', 'a'), 0);
  });

  it('handles single-character strings that differ', () => {
    assert.equal(hammingDistance('a', 'b'), 1);
  });

  it('throws RangeError for different-length strings', () => {
    assert.throws(
      () => hammingDistance('abc', 'ab'),
      RangeError,
    );
  });

  it('throws RangeError with informative message', () => {
    assert.throws(
      () => hammingDistance('hello', 'hi'),
      (err) => {
        assert.ok(err instanceof RangeError);
        assert.ok(/** @type {RangeError} */ (err).message.includes('5'));
        assert.ok(/** @type {RangeError} */ (err).message.includes('2'));
        return true;
      },
    );
  });
});

// ─── longestCommonPrefix ──────────────────────────────────────────────────────

describe('longestCommonPrefix', () => {
  it('finds common prefix for standard example', () => {
    assert.equal(longestCommonPrefix(['flower', 'flow', 'flight']), 'fl');
  });

  it('returns empty string when there is no common prefix', () => {
    assert.equal(longestCommonPrefix(['dog', 'racecar', 'car']), '');
  });

  it('returns empty string for empty array', () => {
    assert.equal(longestCommonPrefix([]), '');
  });

  it('returns the string itself for a single-element array', () => {
    assert.equal(longestCommonPrefix(['hello']), 'hello');
  });

  it('returns the entire string when all strings are identical', () => {
    assert.equal(longestCommonPrefix(['abc', 'abc', 'abc']), 'abc');
  });

  it('returns empty string when one element is empty', () => {
    assert.equal(longestCommonPrefix(['abc', '', 'abcd']), '');
  });

  it('handles two-element array', () => {
    assert.equal(longestCommonPrefix(['interview', 'interact']), 'inter');
  });

  it('returns full common prefix when one string is prefix of another', () => {
    assert.equal(longestCommonPrefix(['prefix', 'pre', 'prefix-long']), 'pre');
  });
});
