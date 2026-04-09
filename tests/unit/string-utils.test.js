// ─── Unit Tests: string-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  camelCase,
  snakeCase,
  kebabCase,
  pascalCase,
  titleCase,
  capitalize,
  uncapitalize,
  padStart,
  padEnd,
  repeat,
  reverse,
  isPalindrome,
  countOccurrences,
  replaceAll,
  trimChar,
  splitWords,
  wrap,
  slugify,
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

// ─── uncapitalize ─────────────────────────────────────────────────────────────

describe('uncapitalize', () => {
  it('lowercases first letter', () => {
    assert.equal(uncapitalize('Hello'), 'hello');
  });

  it('returns empty string unchanged', () => {
    assert.equal(uncapitalize(''), '');
  });

  it('handles already-uncapitalized string', () => {
    assert.equal(uncapitalize('hello'), 'hello');
  });

  it('handles single character', () => {
    assert.equal(uncapitalize('A'), 'a');
  });

  it('does not alter the rest of the string', () => {
    assert.equal(uncapitalize('HELLO'), 'hELLO');
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

  it('uses space as default pad char', () => {
    assert.equal(padStart('hi', 4), '  hi');
  });

  it('handles zero length target', () => {
    assert.equal(padStart('hi', 0), 'hi');
  });
});

// ─── padEnd ───────────────────────────────────────────────────────────────────

describe('padEnd', () => {
  it('pads on the right', () => {
    assert.equal(padEnd('hi', 5, '-'), 'hi---');
  });

  it('returns string unchanged when at target length', () => {
    assert.equal(padEnd('hello', 5), 'hello');
  });

  it('returns string unchanged when longer than target', () => {
    assert.equal(padEnd('toolong', 3), 'toolong');
  });

  it('uses space as default pad char', () => {
    assert.equal(padEnd('hi', 4), 'hi  ');
  });

  it('handles zero length target', () => {
    assert.equal(padEnd('hi', 0), 'hi');
  });
});

// ─── repeat ───────────────────────────────────────────────────────────────────

describe('repeat', () => {
  it('repeats a string n times', () => {
    assert.equal(repeat('ab', 3), 'ababab');
  });

  it('returns empty string when n is 0', () => {
    assert.equal(repeat('abc', 0), '');
  });

  it('returns empty string when n is negative', () => {
    assert.equal(repeat('abc', -1), '');
  });

  it('handles empty string input', () => {
    assert.equal(repeat('', 5), '');
  });

  it('handles n = 1', () => {
    assert.equal(repeat('x', 1), 'x');
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

  it('handles unicode characters', () => {
    // emoji are multi-codepoint; spreading handles surrogates correctly
    assert.equal(reverse('abc'), 'cba');
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

// ─── replaceAll ───────────────────────────────────────────────────────────────

describe('replaceAll', () => {
  it('replaces all occurrences', () => {
    assert.equal(replaceAll('foo bar foo baz foo', 'foo', 'qux'), 'qux bar qux baz qux');
  });

  it('returns string unchanged when search not found', () => {
    assert.equal(replaceAll('hello world', 'xyz', 'abc'), 'hello world');
  });

  it('handles empty search (returns original)', () => {
    assert.equal(replaceAll('hello', '', 'x'), 'hello');
  });

  it('handles empty string input', () => {
    assert.equal(replaceAll('', 'a', 'b'), '');
  });

  it('replaces with empty string (deletion)', () => {
    assert.equal(replaceAll('hello world', 'l', ''), 'heo word');
  });
});

// ─── trimChar ─────────────────────────────────────────────────────────────────

describe('trimChar', () => {
  it('trims a specific character from both ends', () => {
    assert.equal(trimChar('---hello---', '-'), 'hello');
  });

  it('trims only matching characters', () => {
    assert.equal(trimChar('xxhelloxx', 'x'), 'hello');
  });

  it('does not trim non-matching characters', () => {
    assert.equal(trimChar('  hello  ', 'x'), '  hello  ');
  });

  it('handles empty string', () => {
    assert.equal(trimChar('', '-'), '');
  });

  it('handles string that is all the char', () => {
    assert.equal(trimChar('-----', '-'), '');
  });

  it('handles regex-special char like dot', () => {
    assert.equal(trimChar('...hello...', '.'), 'hello');
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

  it('handles PascalCase', () => {
    assert.deepEqual(splitWords('HelloWorld'), ['Hello', 'World']);
  });
});

// ─── wrap ─────────────────────────────────────────────────────────────────────

describe('wrap', () => {
  it('wraps at the correct column width using default newline', () => {
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

  it('uses custom newline separator', () => {
    assert.equal(wrap('hello world', 5, '<br>'), 'hello<br>world');
  });

  it('fits exactly at width boundary', () => {
    assert.equal(wrap('ab cd ef', 5), 'ab cd\nef');
  });

  it('handles multiple spaces between words', () => {
    assert.equal(wrap('hello   world', 20), 'hello world');
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
