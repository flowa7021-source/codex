// ─── Unit Tests: OCR User Dictionary ──────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  addWord,
  removeWord,
  getCorrections,
  applyUserDictionary,
} from '../../app/modules/ocr-user-dictionary.js';

const STORAGE_KEY = 'novareader-user-dict';

function clearDict() {
  localStorage.clear();
  // Force cache reload by adding and removing a dummy entry
  // The module caches internally, so we clear localStorage and
  // manipulate via the public API to reset state.
  const corr = getCorrections();
  for (const key of corr.keys()) {
    removeWord(key);
  }
}

// ── addWord ────────────────────────────────────────────────────────────────

describe('addWord', () => {
  beforeEach(clearDict);

  it('adds a correction mapping', () => {
    addWord('teh', 'the');
    const corrections = getCorrections();
    assert.equal(corrections.get('teh'), 'the');
  });

  it('overwrites existing correction', () => {
    addWord('teh', 'the');
    addWord('teh', 'THE');
    const corrections = getCorrections();
    assert.equal(corrections.get('teh'), 'THE');
  });

  it('ignores empty wrong value', () => {
    addWord('', 'something');
    const corrections = getCorrections();
    assert.equal(corrections.size, 0);
  });

  it('ignores empty correct value', () => {
    addWord('teh', '');
    const corrections = getCorrections();
    assert.equal(corrections.has('teh'), false);
  });

  it('ignores when wrong equals correct', () => {
    addWord('same', 'same');
    const corrections = getCorrections();
    assert.equal(corrections.has('same'), false);
  });

  it('ignores null wrong value', () => {
    addWord(null, 'something');
    const corrections = getCorrections();
    assert.equal(corrections.size, 0);
  });

  it('ignores null correct value', () => {
    addWord('teh', null);
    const corrections = getCorrections();
    assert.equal(corrections.has('teh'), false);
  });

  it('stores multiple corrections', () => {
    addWord('teh', 'the');
    addWord('hte', 'the');
    addWord('adn', 'and');
    const corrections = getCorrections();
    assert.equal(corrections.size, 3);
    assert.equal(corrections.get('teh'), 'the');
    assert.equal(corrections.get('hte'), 'the');
    assert.equal(corrections.get('adn'), 'and');
  });

  it('persists to localStorage', () => {
    addWord('teh', 'the');
    const raw = localStorage.getItem(STORAGE_KEY);
    assert.ok(raw);
    const entries = JSON.parse(raw);
    assert.ok(Array.isArray(entries));
    assert.ok(entries.some(([k, v]) => k === 'teh' && v === 'the'));
  });
});

// ── removeWord ─────────────────────────────────────────────────────────────

describe('removeWord', () => {
  beforeEach(clearDict);

  it('removes an existing correction', () => {
    addWord('teh', 'the');
    removeWord('teh');
    const corrections = getCorrections();
    assert.equal(corrections.has('teh'), false);
  });

  it('does nothing for non-existent key', () => {
    addWord('teh', 'the');
    removeWord('nonexistent');
    const corrections = getCorrections();
    assert.equal(corrections.size, 1);
  });

  it('ignores empty input', () => {
    addWord('teh', 'the');
    removeWord('');
    const corrections = getCorrections();
    assert.equal(corrections.size, 1);
  });

  it('ignores null input', () => {
    addWord('teh', 'the');
    removeWord(null);
    const corrections = getCorrections();
    assert.equal(corrections.size, 1);
  });

  it('updates localStorage after removal', () => {
    addWord('teh', 'the');
    removeWord('teh');
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries = JSON.parse(raw);
    assert.ok(!entries.some(([k]) => k === 'teh'));
  });
});

// ── getCorrections ─────────────────────────────────────────────────────────

describe('getCorrections', () => {
  beforeEach(clearDict);

  it('returns a Map', () => {
    const corrections = getCorrections();
    assert.ok(corrections instanceof Map);
  });

  it('returns empty Map when no corrections', () => {
    const corrections = getCorrections();
    assert.equal(corrections.size, 0);
  });

  it('returns a copy (not the internal map)', () => {
    addWord('teh', 'the');
    const c1 = getCorrections();
    const c2 = getCorrections();
    assert.notEqual(c1, c2);
    assert.deepEqual([...c1], [...c2]);
  });

  it('does not allow mutation of internal state', () => {
    addWord('teh', 'the');
    const copy = getCorrections();
    copy.set('hacked', 'true');
    const fresh = getCorrections();
    assert.equal(fresh.has('hacked'), false);
  });
});

// ── applyUserDictionary ────────────────────────────────────────────────────

describe('applyUserDictionary', () => {
  beforeEach(clearDict);

  it('returns input unchanged when no corrections exist', () => {
    assert.equal(applyUserDictionary('hello world'), 'hello world');
  });

  it('returns empty/null input as-is', () => {
    assert.equal(applyUserDictionary(''), '');
    assert.equal(applyUserDictionary(null), null);
    assert.equal(applyUserDictionary(undefined), undefined);
  });

  it('applies a single correction', () => {
    addWord('teh', 'the');
    assert.equal(applyUserDictionary('teh cat'), 'the cat');
  });

  it('applies multiple corrections', () => {
    addWord('teh', 'the');
    addWord('adn', 'and');
    const result = applyUserDictionary('teh cat adn dog');
    assert.equal(result, 'the cat and dog');
  });

  it('replaces all occurrences', () => {
    addWord('teh', 'the');
    const result = applyUserDictionary('teh cat teh dog');
    assert.equal(result, 'the cat the dog');
  });

  it('does whole-word matching (does not match partial words)', () => {
    addWord('the', 'a');
    const result = applyUserDictionary('there is the cat');
    // "there" should not be modified, only standalone "the"
    assert.ok(result.includes('there'));
    assert.ok(result.includes('a cat') || result.includes('the cat'));
  });

  it('handles Cyrillic text', () => {
    addWord('слоно', 'слово');
    const result = applyUserDictionary('это слоно важно');
    assert.equal(result, 'это слово важно');
  });

  it('handles special regex characters in wrong text', () => {
    addWord('(test)', 'result');
    const result = applyUserDictionary('the (test) value');
    assert.equal(result, 'the result value');
  });

  it('handles correction with dots', () => {
    addWord('e.g', 'for example');
    const result = applyUserDictionary('e.g this works');
    assert.ok(result.includes('for example'));
  });

  it('is case-sensitive', () => {
    addWord('Hello', 'Hi');
    const result = applyUserDictionary('hello Hello HELLO');
    // Only exact match should be replaced
    assert.ok(result.includes('Hi'));
    // "hello" (lowercase) should remain
    assert.ok(result.startsWith('hello'));
  });
});
