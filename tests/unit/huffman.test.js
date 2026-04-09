// ─── Unit Tests: Huffman Coding ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  HuffmanTree,
  buildFrequencyMap,
  huffmanEncode,
  huffmanDecode,
  createHuffmanTree,
} from '../../app/modules/huffman.js';

// ─── buildFrequencyMap ─────────────────────────────────────────────────────

describe('buildFrequencyMap', () => {
  it('counts character frequencies correctly', () => {
    const freq = buildFrequencyMap('aabbc');
    assert.equal(freq.get('a'), 2);
    assert.equal(freq.get('b'), 2);
    assert.equal(freq.get('c'), 1);
    assert.equal(freq.size, 3);
  });

  it('returns an empty map for empty string', () => {
    const freq = buildFrequencyMap('');
    assert.equal(freq.size, 0);
  });

  it('handles single character string', () => {
    const freq = buildFrequencyMap('zzz');
    assert.equal(freq.get('z'), 3);
    assert.equal(freq.size, 1);
  });
});

// ─── HuffmanTree constructor ───────────────────────────────────────────────

describe('HuffmanTree – constructor', () => {
  it('throws on empty frequency map', () => {
    assert.throws(() => new HuffmanTree(new Map()), /empty/i);
  });

  it('produces prefix-free codes', () => {
    const freq = new Map([['a', 5], ['b', 9], ['c', 12], ['d', 13], ['e', 16], ['f', 45]]);
    const tree = new HuffmanTree(freq);
    const table = tree.getCodeTable();

    // No code should be a prefix of another
    const codes = [...table.values()];
    for (let i = 0; i < codes.length; i++) {
      for (let j = 0; j < codes.length; j++) {
        if (i !== j) {
          assert.ok(
            !codes[j].startsWith(codes[i]),
            `"${codes[i]}" is a prefix of "${codes[j]}"`,
          );
        }
      }
    }
  });
});

// ─── encode / decode roundtrip ─────────────────────────────────────────────

describe('HuffmanTree – encode / decode', () => {
  it('roundtrips a simple string', () => {
    const text = 'hello world';
    const tree = createHuffmanTree(text);
    const bits = tree.encode(text);
    assert.equal(tree.decode(bits), text);
  });

  it('roundtrips a string with all unique characters', () => {
    const text = 'abcdefgh';
    const tree = createHuffmanTree(text);
    const bits = tree.encode(text);
    assert.equal(tree.decode(bits), text);
  });

  it('roundtrips a single repeated character', () => {
    const text = 'aaaaaa';
    const tree = createHuffmanTree(text);
    const bits = tree.encode(text);
    assert.equal(tree.decode(bits), text);
  });

  it('encoded output contains only 0s and 1s', () => {
    const tree = createHuffmanTree('abracadabra');
    const bits = tree.encode('abracadabra');
    assert.match(bits, /^[01]+$/);
  });

  it('encode throws for unknown character', () => {
    const tree = createHuffmanTree('abc');
    assert.throws(() => tree.encode('z'), /not found/i);
  });
});

// ─── getCodeTable ──────────────────────────────────────────────────────────

describe('HuffmanTree – getCodeTable', () => {
  it('returns a code for every character in the input', () => {
    const text = 'banana';
    const tree = createHuffmanTree(text);
    const table = tree.getCodeTable();
    assert.ok(table.has('b'));
    assert.ok(table.has('a'));
    assert.ok(table.has('n'));
    assert.equal(table.size, 3);
  });

  it('assigns shorter codes to more frequent characters', () => {
    // 'a' appears 10 times, 'b' once — a should have a shorter (or equal) code
    const freq = new Map([['a', 10], ['b', 1]]);
    const tree = new HuffmanTree(freq);
    const table = tree.getCodeTable();
    assert.ok(table.get('a').length <= table.get('b').length);
  });
});

// ─── averageBitLength ──────────────────────────────────────────────────────

describe('HuffmanTree – averageBitLength', () => {
  it('returns a positive number', () => {
    const tree = createHuffmanTree('the quick brown fox');
    assert.ok(tree.averageBitLength > 0);
  });

  it('equals code length for single-character input', () => {
    const tree = createHuffmanTree('xxxx');
    // single unique char → code is "0", average is 1
    assert.equal(tree.averageBitLength, 1);
  });
});

// ─── huffmanEncode / huffmanDecode convenience ─────────────────────────────

describe('huffmanEncode / huffmanDecode', () => {
  it('roundtrips via convenience functions', () => {
    const text = 'abracadabra';
    const { encoded, tree } = huffmanEncode(text);
    assert.equal(huffmanDecode(encoded, tree), text);
  });

  it('produces shorter output for highly repetitive input', () => {
    const text = 'a'.repeat(100) + 'b';
    const { encoded } = huffmanEncode(text);
    // 101 characters should compress to fewer than 101 * 8 bits (trivially true),
    // but also fewer bits than the raw character count in many scenarios.
    assert.ok(encoded.length < text.length * 8);
  });
});

// ─── Unicode support ───────────────────────────────────────────────────────

describe('Huffman – unicode', () => {
  it('handles multi-byte characters', () => {
    const text = 'aaabbbccc\u00e9\u00e9\u00e9';
    const tree = createHuffmanTree(text);
    const bits = tree.encode(text);
    assert.equal(tree.decode(bits), text);
  });
});
