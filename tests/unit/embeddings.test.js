// ─── Unit Tests: Embeddings ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  tokenize,
  cosineSimilarity,
  euclideanDistance,
  normalize,
  BagOfWordsVectorizer,
  TfIdfVectorizer,
} from '../../app/modules/embeddings.js';

// ─── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('lowercases the input', () => {
    assert.deepEqual(tokenize('Hello World'), ['hello', 'world']);
  });

  it('splits on non-alphanumeric characters', () => {
    assert.deepEqual(tokenize('foo,bar.baz!'), ['foo', 'bar', 'baz']);
  });

  it('discards empty tokens', () => {
    assert.deepEqual(tokenize('  hello   world  '), ['hello', 'world']);
  });

  it('handles numbers in tokens', () => {
    const tokens = tokenize('chapter1 v2');
    assert.ok(tokens.includes('chapter1'));
    assert.ok(tokens.includes('v2'));
  });

  it('removeStopWords=false keeps stop words (default)', () => {
    const tokens = tokenize('the cat sat on the mat');
    assert.ok(tokens.includes('the'));
    assert.ok(tokens.includes('on'));
  });

  it('removeStopWords=true removes common English stop words', () => {
    const tokens = tokenize('the cat sat on the mat', true);
    assert.ok(!tokens.includes('the'), '"the" should be removed');
    assert.ok(!tokens.includes('on'), '"on" should be removed');
    assert.ok(tokens.includes('cat'));
    assert.ok(tokens.includes('sat'));
    assert.ok(tokens.includes('mat'));
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(tokenize(''), []);
  });

  it('returns empty array when all tokens are stop words', () => {
    assert.deepEqual(tokenize('the and or', true), []);
  });
});

// ─── cosineSimilarity ────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('identical vectors return 1', () => {
    const result = cosineSimilarity([1, 2, 3], [1, 2, 3]);
    assert.ok(Math.abs(result - 1) < 1e-9, `expected 1, got ${result}`);
  });

  it('orthogonal vectors return 0', () => {
    const result = cosineSimilarity([1, 0], [0, 1]);
    assert.ok(Math.abs(result) < 1e-9, `expected 0, got ${result}`);
  });

  it('similar vectors return value > 0.5', () => {
    const result = cosineSimilarity([1, 1, 0], [1, 1, 1]);
    assert.ok(result > 0.5, `expected > 0.5, got ${result}`);
  });

  it('opposite vectors return -1', () => {
    const result = cosineSimilarity([1, 0], [-1, 0]);
    assert.ok(Math.abs(result - (-1)) < 1e-9, `expected -1, got ${result}`);
  });

  it('zero vector returns 0', () => {
    const result = cosineSimilarity([0, 0], [1, 0]);
    assert.equal(result, 0);
  });

  it('throws for vectors of different lengths', () => {
    assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), RangeError);
  });
});

// ─── euclideanDistance ────────────────────────────────────────────────────────

describe('euclideanDistance', () => {
  it('distance to itself is 0', () => {
    assert.equal(euclideanDistance([1, 2, 3], [1, 2, 3]), 0);
  });

  it('computes correct 2-D distance', () => {
    const d = euclideanDistance([0, 0], [3, 4]);
    assert.ok(Math.abs(d - 5) < 1e-9, `expected 5, got ${d}`);
  });

  it('throws for vectors of different lengths', () => {
    assert.throws(() => euclideanDistance([1, 2], [1, 2, 3]), RangeError);
  });
});

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('normalized vector has unit length', () => {
    const v = normalize([3, 4]);
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(mag - 1) < 1e-9, `expected magnitude 1, got ${mag}`);
  });

  it('returns zero vector unchanged when magnitude is 0', () => {
    assert.deepEqual(normalize([0, 0, 0]), [0, 0, 0]);
  });

  it('cosine similarity of two normalized vectors equals dot product', () => {
    const a = normalize([3, 4]);
    const b = normalize([1, 1]);
    const dot = a.reduce((s, x, i) => s + x * b[i], 0);
    const cos = cosineSimilarity(a, b);
    assert.ok(Math.abs(dot - cos) < 1e-9);
  });

  it('does not mutate the input vector', () => {
    const v = [3, 4];
    normalize(v);
    assert.deepEqual(v, [3, 4]);
  });
});

// ─── BagOfWordsVectorizer ─────────────────────────────────────────────────────

describe('BagOfWordsVectorizer', () => {
  it('vocabulary is sorted and unique', () => {
    const bow = new BagOfWordsVectorizer();
    bow.fit(['cat sat', 'sat on mat', 'cat on mat']);
    const vocab = bow.vocabulary;
    assert.deepEqual(vocab, [...vocab].sort());
    assert.equal(vocab.length, new Set(vocab).size);
  });

  it('transforms to term-frequency count vector', () => {
    const bow = new BagOfWordsVectorizer();
    bow.fit(['cat sat mat']);
    const vec = bow.transform('cat cat sat');
    // cat appears twice, sat once, mat zero times
    const vocab = bow.vocabulary;
    const catIdx = vocab.indexOf('cat');
    const satIdx = vocab.indexOf('sat');
    const matIdx = vocab.indexOf('mat');
    assert.equal(vec[catIdx], 2);
    assert.equal(vec[satIdx], 1);
    assert.equal(vec[matIdx], 0);
  });

  it('different documents produce different vectors', () => {
    const bow = new BagOfWordsVectorizer();
    const vecs = bow.fitTransform(['hello world', 'foo bar']);
    assert.notDeepEqual(vecs[0], vecs[1]);
  });

  it('fitTransform returns a vector for each document', () => {
    const bow = new BagOfWordsVectorizer();
    const corpus = ['alpha beta', 'beta gamma', 'gamma delta'];
    const vecs = bow.fitTransform(corpus);
    assert.equal(vecs.length, corpus.length);
    for (const v of vecs) {
      assert.equal(v.length, bow.vocabulary.length);
    }
  });

  it('vocabulary is a copy (mutations do not affect internal state)', () => {
    const bow = new BagOfWordsVectorizer();
    bow.fit(['hello world']);
    const vocab = bow.vocabulary;
    vocab.push('injected');
    assert.ok(!bow.vocabulary.includes('injected'));
  });

  it('throws when transform is called before fit', () => {
    const bow = new BagOfWordsVectorizer();
    assert.throws(() => bow.transform('hello'), Error);
  });
});

// ─── TfIdfVectorizer ──────────────────────────────────────────────────────────

describe('TfIdfVectorizer', () => {
  it('vocabulary is sorted and unique', () => {
    const tfidf = new TfIdfVectorizer();
    tfidf.fit(['one two three', 'two three four']);
    const vocab = tfidf.vocabulary;
    assert.deepEqual(vocab, [...vocab].sort());
    assert.equal(vocab.length, new Set(vocab).size);
  });

  it('transform returns a vector the same length as vocabulary', () => {
    const tfidf = new TfIdfVectorizer();
    tfidf.fit(['hello world', 'world foo']);
    const vec = tfidf.transform('hello world');
    assert.equal(vec.length, tfidf.vocabulary.length);
  });

  it('different documents produce different vectors', () => {
    const tfidf = new TfIdfVectorizer();
    const corpus = [
      'machine learning is great',
      'i love cooking and baking',
    ];
    tfidf.fit(corpus);
    const v0 = tfidf.transform(corpus[0]);
    const v1 = tfidf.transform(corpus[1]);
    assert.notDeepEqual(v0, v1);
  });

  it('rare term has higher IDF weight than common term', () => {
    const tfidf = new TfIdfVectorizer();
    // 'rare' appears once, 'common' appears in all 4 docs
    tfidf.fit([
      'common rare',
      'common alpha',
      'common beta',
      'common gamma',
    ]);
    const vocab = tfidf.vocabulary;
    const rareIdx = vocab.indexOf('rare');
    const commonIdx = vocab.indexOf('common');
    const vec = tfidf.transform('common rare');
    assert.ok(vec[rareIdx] > vec[commonIdx], 'rare term should have higher TF-IDF weight');
  });

  it('fitTransform returns a vector for each document', () => {
    const tfidf = new TfIdfVectorizer();
    const corpus = ['a b c', 'd e f', 'g h i'];
    const vecs = tfidf.fitTransform(corpus);
    assert.equal(vecs.length, corpus.length);
    for (const v of vecs) {
      assert.equal(v.length, tfidf.vocabulary.length);
    }
  });

  it('vocabulary getter returns a copy', () => {
    const tfidf = new TfIdfVectorizer();
    tfidf.fit(['hello world']);
    const vocab = tfidf.vocabulary;
    vocab.push('injected');
    assert.ok(!tfidf.vocabulary.includes('injected'));
  });

  it('throws when transform is called before fit', () => {
    const tfidf = new TfIdfVectorizer();
    assert.throws(() => tfidf.transform('hello'), Error);
  });

  it('cosine similarity is higher for semantically similar docs', () => {
    const tfidf = new TfIdfVectorizer();
    const corpus = [
      'the dog barked loudly at night',
      'a dog barked outside in the evening',
      'she enjoys painting watercolor landscapes',
    ];
    tfidf.fit(corpus);
    const v0 = tfidf.transform(corpus[0]);
    const v1 = tfidf.transform(corpus[1]);
    const v2 = tfidf.transform(corpus[2]);
    const sim01 = cosineSimilarity(v0, v1);
    const sim02 = cosineSimilarity(v0, v2);
    assert.ok(sim01 > sim02, `expected dog docs more similar: sim01=${sim01.toFixed(4)}, sim02=${sim02.toFixed(4)}`);
  });
});
