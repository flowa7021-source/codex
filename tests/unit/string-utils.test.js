// ─── Unit Tests: string-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  camelCase,
  pascalCase,
  snakeCase,
  kebabCase,
  titleCase,
  capitalize,
  truncate,
  padStart,
  padEnd,
  repeat,
  reverse,
  isPalindrome,
  countOccurrences,
  stripHtml,
  escapeHtml,
  unescapeHtml,
  slugify,
  wordCount,
  lineCount,
  trimLines,
  dedent,
  interpolate,
  randomString,
  isEmail,
  isUrl,
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

  it('handles single word already lowercase', () => {
    assert.equal(camelCase('hello'), 'hello');
  });

  it('handles multiple words', () => {
    assert.equal(camelCase('the quick brown fox'), 'theQuickBrownFox');
  });

  it('normalises consecutive separators', () => {
    assert.equal(camelCase('foo--bar'), 'fooBar');
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

  it('handles multiple words', () => {
    assert.equal(pascalCase('the quick brown fox'), 'TheQuickBrownFox');
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

  it('handles multiple words', () => {
    assert.equal(snakeCase('theQuickBrownFox'), 'the_quick_brown_fox');
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
  it('capitalizes each whitespace-delimited word', () => {
    assert.equal(titleCase('hello world'), 'Hello World');
  });

  it('lowercases non-leading letters', () => {
    assert.equal(titleCase('HELLO WORLD'), 'Hello World');
  });

  it('handles empty string', () => {
    assert.equal(titleCase(''), '');
  });

  it('handles single word', () => {
    assert.equal(titleCase('hello'), 'Hello');
  });

  it('preserves internal spacing', () => {
    assert.equal(titleCase('foo  bar'), 'Foo  Bar');
  });

  it('works on a three-word phrase', () => {
    assert.equal(titleCase('the quick fox'), 'The Quick Fox');
  });
});

// ─── capitalize ───────────────────────────────────────────────────────────────

describe('capitalize', () => {
  it('uppercases the first character', () => {
    assert.equal(capitalize('hello'), 'Hello');
  });

  it('leaves the rest of the string unchanged', () => {
    assert.equal(capitalize('hELLO wORLD'), 'HELLO wORLD');
  });

  it('handles empty string', () => {
    assert.equal(capitalize(''), '');
  });

  it('handles single character', () => {
    assert.equal(capitalize('a'), 'A');
  });

  it('handles already-capitalised string', () => {
    assert.equal(capitalize('Hello'), 'Hello');
  });

  it('handles string starting with a digit', () => {
    assert.equal(capitalize('1hello'), '1hello');
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

  it('handles empty source string', () => {
    assert.equal(truncate('', 5), '');
  });

  it('handles empty ellipsis', () => {
    assert.equal(truncate('Hello World', 5, ''), 'Hello');
  });

  it('returns only the ellipsis when maxLength is smaller than ellipsis length', () => {
    assert.equal(truncate('Hello', 0), '...');
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

// ─── repeat ───────────────────────────────────────────────────────────────────

describe('repeat', () => {
  it('repeats a string n times', () => {
    assert.equal(repeat('ab', 3), 'ababab');
  });

  it('returns empty string for count=0', () => {
    assert.equal(repeat('hello', 0), '');
  });

  it('returns the string itself for count=1', () => {
    assert.equal(repeat('hello', 1), 'hello');
  });

  it('handles empty string input', () => {
    assert.equal(repeat('', 5), '');
  });

  it('throws RangeError for negative count', () => {
    assert.throws(() => repeat('hello', -1), RangeError);
  });

  it('throws RangeError for -2', () => {
    assert.throws(() => repeat('x', -2), RangeError);
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

  it('handles string with spaces', () => {
    assert.equal(reverse('hello world'), 'dlrow olleh');
  });
});

// ─── isPalindrome ─────────────────────────────────────────────────────────────

describe('isPalindrome', () => {
  it('returns true for racecar', () => {
    assert.equal(isPalindrome('racecar'), true);
  });

  it('returns true for classic phrase ignoring spaces and case', () => {
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

  it('returns false for near-palindrome', () => {
    assert.equal(isPalindrome('racecarx'), false);
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

  it('counts non-overlapping: aaa with aa equals 1', () => {
    assert.equal(countOccurrences('aaa', 'aa'), 1);
  });

  it('handles empty source string', () => {
    assert.equal(countOccurrences('', 'a'), 0);
  });

  it('counts a multi-character substring', () => {
    assert.equal(countOccurrences('abcabcabc', 'abc'), 3);
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

  it('strips tags with class and id', () => {
    assert.equal(stripHtml('<span class="foo" id="bar">text</span>'), 'text');
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

  it('escapes all five special characters together', () => {
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

  it('is the inverse of escapeHtml', () => {
    const original = 'Hello <World> & "friends" \'here\'';
    assert.equal(unescapeHtml(escapeHtml(original)), original);
  });

  it('handles empty string', () => {
    assert.equal(unescapeHtml(''), '');
  });

  it('handles plain text with no entities', () => {
    assert.equal(unescapeHtml('hello world'), 'hello world');
  });
});

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts basic phrase to slug', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });

  it('strips special characters replacing with hyphen', () => {
    assert.equal(slugify('foo & bar!'), 'foo-bar');
  });

  it('collapses multiple consecutive special chars into one hyphen', () => {
    assert.equal(slugify('hello   world'), 'hello-world');
  });

  it('handles empty string', () => {
    assert.equal(slugify(''), '');
  });

  it('handles already-slugified string', () => {
    assert.equal(slugify('hello-world'), 'hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    assert.equal(slugify('!hello world!'), 'hello-world');
  });

  it('lowercases the result', () => {
    assert.equal(slugify('HELLO WORLD'), 'hello-world');
  });

  it('handles numbers', () => {
    assert.equal(slugify('version 2 release'), 'version-2-release');
  });
});

// ─── wordCount ────────────────────────────────────────────────────────────────

describe('wordCount', () => {
  it('counts words in a normal sentence', () => {
    assert.equal(wordCount('hello world'), 2);
  });

  it('returns 0 for an empty string', () => {
    assert.equal(wordCount(''), 0);
  });

  it('returns 0 for whitespace-only string', () => {
    assert.equal(wordCount('   '), 0);
  });

  it('handles multiple spaces between words', () => {
    assert.equal(wordCount('one  two   three'), 3);
  });

  it('counts a single word', () => {
    assert.equal(wordCount('hello'), 1);
  });

  it('handles leading and trailing whitespace', () => {
    assert.equal(wordCount('  hello world  '), 2);
  });

  it('counts words separated by tabs and newlines', () => {
    assert.equal(wordCount('one\ttwo\nthree'), 3);
  });
});

// ─── lineCount ────────────────────────────────────────────────────────────────

describe('lineCount', () => {
  it('counts lines in a multi-line string', () => {
    assert.equal(lineCount('line1\nline2\nline3'), 3);
  });

  it('returns 1 for a single line', () => {
    assert.equal(lineCount('hello'), 1);
  });

  it('returns 1 for an empty string', () => {
    assert.equal(lineCount(''), 1);
  });

  it('counts a trailing newline as an extra line', () => {
    assert.equal(lineCount('hello\n'), 2);
  });

  it('counts two newlines as three lines', () => {
    assert.equal(lineCount('a\nb\nc'), 3);
  });
});

// ─── trimLines ────────────────────────────────────────────────────────────────

describe('trimLines', () => {
  it('trims leading and trailing whitespace from each line', () => {
    assert.equal(trimLines('  hello  \n  world  '), 'hello\nworld');
  });

  it('returns single trimmed line', () => {
    assert.equal(trimLines('  hello  '), 'hello');
  });

  it('handles empty string', () => {
    assert.equal(trimLines(''), '');
  });

  it('trims tabs as well as spaces', () => {
    assert.equal(trimLines('\thello\t\n\tworld\t'), 'hello\nworld');
  });

  it('preserves blank lines (just trims them)', () => {
    assert.equal(trimLines('a\n  \nb'), 'a\n\nb');
  });
});

// ─── dedent ───────────────────────────────────────────────────────────────────

describe('dedent', () => {
  it('removes common leading whitespace', () => {
    const input = '  hello\n  world';
    assert.equal(dedent(input), 'hello\nworld');
  });

  it('preserves relative indentation differences', () => {
    const input = '  a\n    b\n  c';
    assert.equal(dedent(input), 'a\n  b\nc');
  });

  it('handles string with no indentation', () => {
    assert.equal(dedent('hello\nworld'), 'hello\nworld');
  });

  it('handles empty string', () => {
    assert.equal(dedent(''), '');
  });

  it('ignores blank lines when computing minimum indent', () => {
    const input = '  a\n\n  b';
    assert.equal(dedent(input), 'a\n\nb');
  });

  it('handles single line with indentation', () => {
    assert.equal(dedent('   hello'), 'hello');
  });
});

// ─── interpolate ──────────────────────────────────────────────────────────────

describe('interpolate', () => {
  it('replaces a single {{key}} placeholder', () => {
    assert.equal(interpolate('Hi {{name}}', { name: 'Alice' }), 'Hi Alice');
  });

  it('replaces multiple placeholders', () => {
    assert.equal(
      interpolate('{{greeting}}, {{name}}!', { greeting: 'Hello', name: 'Bob' }),
      'Hello, Bob!',
    );
  });

  it('supports numeric values', () => {
    assert.equal(interpolate('Age: {{age}}', { age: 30 }), 'Age: 30');
  });

  it('leaves unknown placeholders unchanged', () => {
    assert.equal(interpolate('Hi {{name}}', {}), 'Hi {{name}}');
  });

  it('handles empty template', () => {
    assert.equal(interpolate('', { name: 'Alice' }), '');
  });

  it('handles template with no placeholders', () => {
    assert.equal(interpolate('Hello world', { name: 'Alice' }), 'Hello world');
  });

  it('replaces the same key appearing multiple times', () => {
    assert.equal(interpolate('{{x}} + {{x}} = {{y}}', { x: 1, y: 2 }), '1 + 1 = 2');
  });

  it('converts boolean values to string', () => {
    assert.equal(interpolate('active: {{val}}', { val: false }), 'active: false');
  });
});

// ─── randomString ─────────────────────────────────────────────────────────────

describe('randomString', () => {
  it('returns a string of exactly the requested length', () => {
    assert.equal(randomString(10).length, 10);
  });

  it('returns empty string for length 0', () => {
    assert.equal(randomString(0), '');
  });

  it('uses only characters from the default alphanumeric set', () => {
    const result = randomString(100);
    assert.match(result, /^[A-Za-z0-9]+$/);
  });

  it('uses only characters from a custom charset', () => {
    const result = randomString(50, 'abc');
    assert.match(result, /^[abc]+$/);
  });

  it('returns a single-character string for length 1', () => {
    assert.equal(randomString(1).length, 1);
  });

  it('generates different strings on successive calls (very likely)', () => {
    const a = randomString(20);
    const b = randomString(20);
    // Astronomically unlikely to be equal; treat as a sanity check
    assert.notEqual(a, b);
  });
});

// ─── isEmail ──────────────────────────────────────────────────────────────────

describe('isEmail', () => {
  it('returns true for a basic email address', () => {
    assert.equal(isEmail('user@example.com'), true);
  });

  it('returns true for email with subdomain', () => {
    assert.equal(isEmail('user@mail.example.com'), true);
  });

  it('returns true for email with plus sign', () => {
    assert.equal(isEmail('user+tag@example.com'), true);
  });

  it('returns false for email with no @ sign', () => {
    assert.equal(isEmail('userexample.com'), false);
  });

  it('returns false for email with no domain', () => {
    assert.equal(isEmail('user@'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isEmail(''), false);
  });

  it('returns false for string with spaces', () => {
    assert.equal(isEmail('user @example.com'), false);
  });

  it('returns false for plain text', () => {
    assert.equal(isEmail('not-an-email'), false);
  });
});

// ─── isUrl ────────────────────────────────────────────────────────────────────

describe('isUrl', () => {
  it('returns true for a basic http URL', () => {
    assert.equal(isUrl('http://example.com'), true);
  });

  it('returns true for a https URL', () => {
    assert.equal(isUrl('https://example.com'), true);
  });

  it('returns true for URL with path', () => {
    assert.equal(isUrl('https://example.com/path/to/page'), true);
  });

  it('returns true for URL with query string', () => {
    assert.equal(isUrl('https://example.com/search?q=hello'), true);
  });

  it('returns false for ftp URL', () => {
    assert.equal(isUrl('ftp://example.com'), false);
  });

  it('returns false for a bare domain without protocol', () => {
    assert.equal(isUrl('example.com'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isUrl(''), false);
  });

  it('returns false for a string with spaces', () => {
    assert.equal(isUrl('https://example.com/path with spaces'), false);
  });
});
