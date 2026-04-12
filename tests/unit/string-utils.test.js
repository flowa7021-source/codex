// ─── Unit Tests: string-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  camelCase,
  pascalCase,
  snakeCase,
  kebabCase,
  titleCase,
  constantCase,
  trim,
  trimStart,
  trimEnd,
  padStart,
  padEnd,
  truncate,
  truncateWords,
  startsWith,
  endsWith,
  includes,
  isBlank,
  isPalindrome,
  reverse,
  repeat,
  replaceAll,
  countOccurrences,
  words,
  slugify,
  escapeHtml,
  unescapeHtml,
  stripHtml,
  wrapAt,
  interpolate,
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

// ─── constantCase ─────────────────────────────────────────────────────────────

describe('constantCase', () => {
  it('converts camelCase to CONSTANT_CASE', () => {
    assert.equal(constantCase('helloWorld'), 'HELLO_WORLD');
  });

  it('converts space-separated words', () => {
    assert.equal(constantCase('hello world'), 'HELLO_WORLD');
  });

  it('converts kebab-case', () => {
    assert.equal(constantCase('hello-world'), 'HELLO_WORLD');
  });

  it('converts snake_case', () => {
    assert.equal(constantCase('hello_world'), 'HELLO_WORLD');
  });

  it('handles empty string', () => {
    assert.equal(constantCase(''), '');
  });

  it('handles single word', () => {
    assert.equal(constantCase('hello'), 'HELLO');
  });
});

// ─── trim ─────────────────────────────────────────────────────────────────────

describe('trim', () => {
  it('trims whitespace by default', () => {
    assert.equal(trim('  hello  '), 'hello');
  });

  it('trims custom chars from both ends', () => {
    assert.equal(trim('***hello***', '*'), 'hello');
  });

  it('handles string with nothing to trim', () => {
    assert.equal(trim('hello'), 'hello');
  });

  it('returns empty string when everything is trimmed', () => {
    assert.equal(trim('   ', ' '), '');
  });

  it('trims multiple different custom chars', () => {
    assert.equal(trim('--**hello**--', '-*'), 'hello');
  });
});

// ─── trimStart ────────────────────────────────────────────────────────────────

describe('trimStart', () => {
  it('trims leading whitespace by default', () => {
    assert.equal(trimStart('  hello  '), 'hello  ');
  });

  it('trims custom chars from the start only', () => {
    assert.equal(trimStart('***hello***', '*'), 'hello***');
  });

  it('handles string with nothing to trim at start', () => {
    assert.equal(trimStart('hello  '), 'hello  ');
  });

  it('handles empty string', () => {
    assert.equal(trimStart(''), '');
  });
});

// ─── trimEnd ──────────────────────────────────────────────────────────────────

describe('trimEnd', () => {
  it('trims trailing whitespace by default', () => {
    assert.equal(trimEnd('  hello  '), '  hello');
  });

  it('trims custom chars from the end only', () => {
    assert.equal(trimEnd('***hello***', '*'), '***hello');
  });

  it('handles string with nothing to trim at end', () => {
    assert.equal(trimEnd('  hello'), '  hello');
  });

  it('handles empty string', () => {
    assert.equal(trimEnd(''), '');
  });
});

// ─── padStart ─────────────────────────────────────────────────────────────────

describe('padStart', () => {
  it('pads with zeros', () => {
    assert.equal(padStart('5', 3, '0'), '005');
  });

  it('returns string unchanged when at target length', () => {
    assert.equal(padStart('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target', () => {
    assert.equal(padStart('toolong', 3), 'toolong');
  });

  it('uses space as default pad character', () => {
    assert.equal(padStart('hi', 4), '  hi');
  });

  it('pads with custom character', () => {
    assert.equal(padStart('42', 6, '*'), '****42');
  });

  it('handles empty source string', () => {
    assert.equal(padStart('', 3, '-'), '---');
  });
});

// ─── padEnd ───────────────────────────────────────────────────────────────────

describe('padEnd', () => {
  it('pads on the right with custom character', () => {
    assert.equal(padEnd('hi', 5, '-'), 'hi---');
  });

  it('returns string unchanged when at target length', () => {
    assert.equal(padEnd('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target', () => {
    assert.equal(padEnd('toolong', 3), 'toolong');
  });

  it('uses space as default pad character', () => {
    assert.equal(padEnd('hi', 4), 'hi  ');
  });

  it('handles empty source string', () => {
    assert.equal(padEnd('', 3, '.'), '...');
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('truncates a long string with default suffix', () => {
    assert.equal(truncate('Hello, World!', 8), 'Hello...');
  });

  it('returns original string when it fits exactly', () => {
    assert.equal(truncate('Hello', 5), 'Hello');
  });

  it('returns original string when shorter than maxLen', () => {
    assert.equal(truncate('Hi', 10), 'Hi');
  });

  it('uses a custom suffix', () => {
    assert.equal(truncate('Hello, World!', 9, '…'), 'Hello, W…');
  });

  it('handles maxLen equal to suffix length', () => {
    assert.equal(truncate('Hello, World!', 3), '...');
  });

  it('handles empty source string', () => {
    assert.equal(truncate('', 5), '');
  });

  it('handles empty suffix', () => {
    assert.equal(truncate('Hello World', 5, ''), 'Hello');
  });
});

// ─── truncateWords ────────────────────────────────────────────────────────────

describe('truncateWords', () => {
  it('truncates to given word count with default suffix', () => {
    assert.equal(truncateWords('one two three four', 2), 'one two...');
  });

  it('returns string unchanged when word count fits', () => {
    assert.equal(truncateWords('hello world', 5), 'hello world');
  });

  it('uses a custom suffix', () => {
    assert.equal(truncateWords('one two three', 2, ' [more]'), 'one two [more]');
  });

  it('handles single-word string within limit', () => {
    assert.equal(truncateWords('hello', 1), 'hello');
  });

  it('handles exact word count match', () => {
    assert.equal(truncateWords('one two three', 3), 'one two three');
  });
});

// ─── startsWith ───────────────────────────────────────────────────────────────

describe('startsWith', () => {
  it('returns true when prefix matches', () => {
    assert.equal(startsWith('hello world', 'hello'), true);
  });

  it('returns false when prefix does not match', () => {
    assert.equal(startsWith('hello world', 'world'), false);
  });

  it('returns true for empty prefix', () => {
    assert.equal(startsWith('hello', ''), true);
  });

  it('returns true when string equals prefix', () => {
    assert.equal(startsWith('hello', 'hello'), true);
  });
});

// ─── endsWith ─────────────────────────────────────────────────────────────────

describe('endsWith', () => {
  it('returns true when suffix matches', () => {
    assert.equal(endsWith('hello world', 'world'), true);
  });

  it('returns false when suffix does not match', () => {
    assert.equal(endsWith('hello world', 'hello'), false);
  });

  it('returns true for empty suffix', () => {
    assert.equal(endsWith('hello', ''), true);
  });

  it('returns true when string equals suffix', () => {
    assert.equal(endsWith('hello', 'hello'), true);
  });
});

// ─── includes ─────────────────────────────────────────────────────────────────

describe('includes', () => {
  it('returns true when substring is found', () => {
    assert.equal(includes('hello world', 'world'), true);
  });

  it('returns false when substring is not found', () => {
    assert.equal(includes('hello world', 'xyz'), false);
  });

  it('returns true for empty substring', () => {
    assert.equal(includes('hello', ''), true);
  });

  it('returns false for empty string with non-empty substr', () => {
    assert.equal(includes('', 'a'), false);
  });
});

// ─── isBlank ──────────────────────────────────────────────────────────────────

describe('isBlank', () => {
  it('returns true for empty string', () => {
    assert.equal(isBlank(''), true);
  });

  it('returns true for whitespace-only string', () => {
    assert.equal(isBlank('   '), true);
  });

  it('returns true for tab and newline only', () => {
    assert.equal(isBlank('\t\n'), true);
  });

  it('returns false for non-blank string', () => {
    assert.equal(isBlank('hello'), false);
  });

  it('returns false for string with leading/trailing whitespace but content', () => {
    assert.equal(isBlank('  hi  '), false);
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

// ─── repeat ───────────────────────────────────────────────────────────────────

describe('repeat', () => {
  it('repeats a string n times', () => {
    assert.equal(repeat('ab', 3), 'ababab');
  });

  it('returns empty string for n=0', () => {
    assert.equal(repeat('hello', 0), '');
  });

  it('returns empty string for negative n', () => {
    assert.equal(repeat('hello', -1), '');
  });

  it('returns the string itself for n=1', () => {
    assert.equal(repeat('hello', 1), 'hello');
  });

  it('handles empty string input', () => {
    assert.equal(repeat('', 5), '');
  });
});

// ─── replaceAll ───────────────────────────────────────────────────────────────

describe('replaceAll', () => {
  it('replaces all occurrences', () => {
    assert.equal(replaceAll('aabbaa', 'aa', 'x'), 'xbbx');
  });

  it('returns original string when search not found', () => {
    assert.equal(replaceAll('hello world', 'xyz', 'z'), 'hello world');
  });

  it('handles empty search string (returns original)', () => {
    assert.equal(replaceAll('hello', '', 'x'), 'hello');
  });

  it('can replace with empty string (deletion)', () => {
    assert.equal(replaceAll('h-e-l-l-o', '-', ''), 'hello');
  });

  it('handles empty source string', () => {
    assert.equal(replaceAll('', 'a', 'b'), '');
  });
});

// ─── countOccurrences ─────────────────────────────────────────────────────────

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

// ─── words ────────────────────────────────────────────────────────────────────

describe('words', () => {
  it('splits on whitespace', () => {
    assert.deepEqual(words('hello world'), ['hello', 'world']);
  });

  it('splits camelCase', () => {
    assert.deepEqual(words('helloWorld'), ['hello', 'World']);
  });

  it('splits on dashes', () => {
    assert.deepEqual(words('hello-world'), ['hello', 'world']);
  });

  it('splits on underscores', () => {
    assert.deepEqual(words('hello_world'), ['hello', 'world']);
  });

  it('handles multiple spaces', () => {
    assert.deepEqual(words('foo   bar'), ['foo', 'bar']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(words(''), []);
  });

  it('handles leading and trailing delimiters', () => {
    assert.deepEqual(words('  hello world  '), ['hello', 'world']);
  });
});

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts basic phrase to slug', () => {
    assert.equal(slugify('Hello World!'), 'hello-world');
  });

  it('strips special characters', () => {
    assert.equal(slugify('foo & bar'), 'foo-bar');
  });

  it('collapses multiple spaces into one hyphen', () => {
    assert.equal(slugify('hello   world'), 'hello-world');
  });

  it('strips diacritics', () => {
    assert.equal(slugify('café'), 'cafe');
  });

  it('handles empty string', () => {
    assert.equal(slugify(''), '');
  });

  it('handles already-slugified string', () => {
    assert.equal(slugify('hello-world'), 'hello-world');
  });

  it('strips leading and trailing whitespace', () => {
    assert.equal(slugify('  hello world  '), 'hello-world');
  });
});

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  it('escapes less-than', () => {
    assert.equal(escapeHtml('<div>'), '&lt;div&gt;');
  });

  it('escapes double quote', () => {
    assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
  });

  it('escapes single quote', () => {
    assert.equal(escapeHtml("it's"), 'it&#39;s');
  });

  it('handles string with no special characters', () => {
    assert.equal(escapeHtml('hello world'), 'hello world');
  });

  it('handles empty string', () => {
    assert.equal(escapeHtml(''), '');
  });

  it('escapes all special characters together', () => {
    assert.equal(escapeHtml('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
  });
});

// ─── unescapeHtml ─────────────────────────────────────────────────────────────

describe('unescapeHtml', () => {
  it('unescapes &amp;', () => {
    assert.equal(unescapeHtml('a &amp; b'), 'a & b');
  });

  it('unescapes &lt; and &gt;', () => {
    assert.equal(unescapeHtml('&lt;div&gt;'), '<div>');
  });

  it('unescapes &quot;', () => {
    assert.equal(unescapeHtml('&quot;hello&quot;'), '"hello"');
  });

  it('unescapes &#39;', () => {
    assert.equal(unescapeHtml('it&#39;s'), "it's");
  });

  it('is inverse of escapeHtml', () => {
    const original = 'Hello <World> & "friends" \'here\'';
    assert.equal(unescapeHtml(escapeHtml(original)), original);
  });

  it('handles empty string', () => {
    assert.equal(unescapeHtml(''), '');
  });
});

// ─── stripHtml ────────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('strips a simple tag', () => {
    assert.equal(stripHtml('<b>hello</b>'), 'hello');
  });

  it('strips nested tags', () => {
    assert.equal(stripHtml('<div><p>text</p></div>'), 'text');
  });

  it('strips self-closing tags', () => {
    assert.equal(stripHtml('hello<br/>world'), 'helloworld');
  });

  it('returns plain text unchanged', () => {
    assert.equal(stripHtml('hello world'), 'hello world');
  });

  it('handles empty string', () => {
    assert.equal(stripHtml(''), '');
  });

  it('strips tags with attributes', () => {
    assert.equal(stripHtml('<a href="http://example.com">link</a>'), 'link');
  });
});

// ─── wrapAt ───────────────────────────────────────────────────────────────────

describe('wrapAt', () => {
  it('wraps at the correct column width', () => {
    assert.equal(wrapAt('The quick brown fox', 10), 'The quick\nbrown fox');
  });

  it('does not wrap short strings', () => {
    assert.equal(wrapAt('Hello', 20), 'Hello');
  });

  it('wraps each word on its own line if width is very small', () => {
    assert.equal(wrapAt('one two three', 3), 'one\ntwo\nthree');
  });

  it('handles empty string', () => {
    assert.equal(wrapAt('', 10), '');
  });

  it('fits exactly at width boundary', () => {
    assert.equal(wrapAt('ab cd ef', 5), 'ab cd\nef');
  });

  it('handles multiple spaces between words', () => {
    assert.equal(wrapAt('hello   world', 20), 'hello world');
  });
});

// ─── interpolate ──────────────────────────────────────────────────────────────

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

  it('converts boolean values to string', () => {
    assert.equal(interpolate('active: {val}', { val: false }), 'active: false');
  });
});
