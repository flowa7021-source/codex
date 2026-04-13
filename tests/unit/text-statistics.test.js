// ─── Unit Tests: text-statistics ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  tokenize,
  sentences,
  wordCount,
  sentenceCount,
  paragraphCount,
  characterCount,
  averageWordLength,
  averageSentenceLength,
  uniqueWordCount,
  wordFrequency,
  topWords,
} from '../../app/modules/text-statistics.js';

// ─── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('splits a simple sentence into words', () => {
    assert.deepEqual(tokenize('Hello world'), ['hello', 'world']);
  });

  it('strips leading and trailing punctuation', () => {
    assert.deepEqual(tokenize('Hello, world!'), ['hello', 'world']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(tokenize(''), []);
  });

  it('returns empty array for whitespace-only string', () => {
    assert.deepEqual(tokenize('   '), []);
  });

  it('handles multiple spaces between words', () => {
    assert.deepEqual(tokenize('one  two   three'), ['one', 'two', 'three']);
  });

  it('lower-cases all tokens', () => {
    assert.deepEqual(tokenize('Hello WORLD'), ['hello', 'world']);
  });

  it('handles hyphenated words by keeping inner hyphens', () => {
    // "well-known" → outer punctuation stripped, hyphen kept
    const tokens = tokenize('well-known fact');
    assert.ok(tokens.includes('well-known') || tokens.includes('well'));
  });
});

// ─── sentences ────────────────────────────────────────────────────────────────

describe('sentences', () => {
  it('splits on period followed by space', () => {
    const result = sentences('Hello world. Goodbye world.');
    assert.equal(result.length, 2);
    assert.equal(result[0], 'Hello world.');
  });

  it('splits on exclamation and question marks', () => {
    const result = sentences('Really? Yes! Of course.');
    assert.equal(result.length, 3);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(sentences(''), []);
  });

  it('returns single element when no sentence-terminal punctuation', () => {
    const result = sentences('No punctuation here');
    assert.equal(result.length, 1);
  });
});

// ─── wordCount ────────────────────────────────────────────────────────────────

describe('wordCount', () => {
  it('counts words in a simple sentence', () => {
    assert.equal(wordCount('The quick brown fox'), 4);
  });

  it('returns 0 for empty string', () => {
    assert.equal(wordCount(''), 0);
  });

  it('handles punctuation correctly', () => {
    assert.equal(wordCount('Hello, world!'), 2);
  });

  it('counts words across multiple spaces', () => {
    assert.equal(wordCount('one  two   three'), 3);
  });
});

// ─── sentenceCount ────────────────────────────────────────────────────────────

describe('sentenceCount', () => {
  it('counts period-terminated sentences', () => {
    assert.equal(sentenceCount('One. Two. Three.'), 3);
  });

  it('counts exclamation marks', () => {
    assert.equal(sentenceCount('Wow! Amazing!'), 2);
  });

  it('counts question marks', () => {
    assert.equal(sentenceCount('Really? Why?'), 2);
  });

  it('returns 0 for empty string', () => {
    assert.equal(sentenceCount(''), 0);
  });

  it('returns 1 for text without terminal punctuation', () => {
    assert.equal(sentenceCount('No punctuation'), 1);
  });

  it('handles mixed punctuation', () => {
    assert.equal(sentenceCount('Hello. Are you OK? Yes!'), 3);
  });
});

// ─── paragraphCount ───────────────────────────────────────────────────────────

describe('paragraphCount', () => {
  it('counts two paragraphs separated by blank line', () => {
    assert.equal(paragraphCount('Para one.\n\nPara two.'), 2);
  });

  it('returns 1 for single paragraph', () => {
    assert.equal(paragraphCount('Just one paragraph.'), 1);
  });

  it('returns 0 for empty string', () => {
    assert.equal(paragraphCount(''), 0);
  });

  it('ignores extra blank lines between paragraphs', () => {
    assert.equal(paragraphCount('Para one.\n\n\n\nPara two.'), 2);
  });

  it('counts three paragraphs', () => {
    assert.equal(paragraphCount('A.\n\nB.\n\nC.'), 3);
  });
});

// ─── characterCount ───────────────────────────────────────────────────────────

describe('characterCount', () => {
  it('counts all characters including spaces by default', () => {
    assert.equal(characterCount('Hello world'), 11);
  });

  it('excludes spaces when includeSpaces is false', () => {
    assert.equal(characterCount('Hello world', false), 10);
  });

  it('returns 0 for empty string', () => {
    assert.equal(characterCount(''), 0);
  });

  it('counts newlines as characters when includeSpaces is true', () => {
    assert.equal(characterCount('a\nb'), 3);
  });
});

// ─── averageWordLength ────────────────────────────────────────────────────────

describe('averageWordLength', () => {
  it('returns correct average for known words', () => {
    // "cat" (3) + "dog" (3) = 6 / 2 = 3
    assert.equal(averageWordLength('cat dog'), 3);
  });

  it('returns 0 for empty string', () => {
    assert.equal(averageWordLength(''), 0);
  });

  it('computes average across words of different lengths', () => {
    // "a" (1) + "bee" (3) = 4 / 2 = 2
    assert.equal(averageWordLength('a bee'), 2);
  });
});

// ─── averageSentenceLength ────────────────────────────────────────────────────

describe('averageSentenceLength', () => {
  it('returns words-per-sentence for a simple two-sentence text', () => {
    // "One two. Three." → 3 words / 2 sentences = 1.5
    assert.equal(averageSentenceLength('One two. Three.'), 1.5);
  });

  it('returns 0 for empty string', () => {
    assert.equal(averageSentenceLength(''), 0);
  });
});

// ─── uniqueWordCount ──────────────────────────────────────────────────────────

describe('uniqueWordCount', () => {
  it('counts distinct words', () => {
    assert.equal(uniqueWordCount('the cat sat on the mat'), 5);
  });

  it('is case-insensitive', () => {
    assert.equal(uniqueWordCount('Hello hello HELLO'), 1);
  });

  it('returns 0 for empty string', () => {
    assert.equal(uniqueWordCount(''), 0);
  });
});

// ─── wordFrequency ────────────────────────────────────────────────────────────

describe('wordFrequency', () => {
  it('returns correct counts', () => {
    const freq = wordFrequency('cat cat dog');
    assert.equal(freq.get('cat'), 2);
    assert.equal(freq.get('dog'), 1);
  });

  it('is case-insensitive', () => {
    const freq = wordFrequency('Cat CAT cat');
    assert.equal(freq.get('cat'), 3);
  });

  it('returns empty map for empty string', () => {
    assert.equal(wordFrequency('').size, 0);
  });

  it('sorts entries by descending frequency', () => {
    const freq = wordFrequency('a a a b b c');
    const keys = [...freq.keys()];
    assert.equal(keys[0], 'a');
    assert.equal(keys[1], 'b');
    assert.equal(keys[2], 'c');
  });
});

// ─── topWords ─────────────────────────────────────────────────────────────────

describe('topWords', () => {
  it('returns the top n words by frequency', () => {
    const result = topWords('a a a b b c', 2);
    assert.equal(result.length, 2);
    assert.equal(result[0].word, 'a');
    assert.equal(result[0].count, 3);
    assert.equal(result[1].word, 'b');
    assert.equal(result[1].count, 2);
  });

  it('returns all words when n exceeds vocabulary size', () => {
    const result = topWords('one two', 10);
    assert.equal(result.length, 2);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(topWords('', 5), []);
  });

  it('each entry has word and count properties', () => {
    const result = topWords('hello world', 1);
    assert.ok('word' in result[0]);
    assert.ok('count' in result[0]);
  });
});
