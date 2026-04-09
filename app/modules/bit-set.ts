// @ts-check
// ─── Bit Set ────────────────────────────────────────────────────────────────
// A bit set backed by Uint32Array, providing efficient bitwise operations
// and compact boolean storage.

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BITS_PER_WORD = 32;

/** Number of Uint32 words needed to hold `bits` bits. */
function wordsNeeded(bits: number): number {
  return Math.ceil(bits / BITS_PER_WORD) || 1;
}

/** Count set bits in a 32-bit integer (Hamming weight). */
function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >>> 24);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** A bit set backed by Uint32Array for efficient bitwise operations. */
export class BitSet {
  private _words: Uint32Array;
  private _size: number;

  constructor(size: number = 32) {
    this._size = Math.max(size, 1);
    this._words = new Uint32Array(wordsNeeded(this._size));
  }

  /** Capacity in bits. */
  get size(): number {
    return this._size;
  }

  /** Grow internal storage to accommodate the given bit index. */
  private _grow(bit: number): void {
    if (bit >= this._size) {
      const newSize = Math.max(bit + 1, this._size * 2);
      const newWords = new Uint32Array(wordsNeeded(newSize));
      newWords.set(this._words);
      this._words = newWords;
      this._size = newSize;
    }
  }

  /** Set a bit to 1. */
  set(bit: number): void {
    this._grow(bit);
    const word = (bit / BITS_PER_WORD) | 0;
    const mask = 1 << (bit % BITS_PER_WORD);
    this._words[word] |= mask;
  }

  /** Set a bit to 0. */
  clear(bit: number): void {
    if (bit >= this._size) return;
    const word = (bit / BITS_PER_WORD) | 0;
    const mask = 1 << (bit % BITS_PER_WORD);
    this._words[word] &= ~mask;
  }

  /** Test if a bit is 1. */
  get(bit: number): boolean {
    if (bit >= this._size) return false;
    const word = (bit / BITS_PER_WORD) | 0;
    const mask = 1 << (bit % BITS_PER_WORD);
    return (this._words[word] & mask) !== 0;
  }

  /** Toggle a bit. */
  toggle(bit: number): void {
    this._grow(bit);
    const word = (bit / BITS_PER_WORD) | 0;
    const mask = 1 << (bit % BITS_PER_WORD);
    this._words[word] ^= mask;
  }

  /** Count the number of set bits (popcount). */
  count(): number {
    let total = 0;
    for (let i = 0; i < this._words.length; i++) {
      total += popcount32(this._words[i]);
    }
    return total;
  }

  /** Return a new BitSet that is the intersection (AND) of this and other. */
  and(other: BitSet): BitSet {
    const maxSize = Math.max(this._size, other._size);
    const result = new BitSet(maxSize);
    const minLen = Math.min(this._words.length, other._words.length);
    for (let i = 0; i < minLen; i++) {
      result._words[i] = this._words[i] & other._words[i];
    }
    return result;
  }

  /** Return a new BitSet that is the union (OR) of this and other. */
  or(other: BitSet): BitSet {
    const maxSize = Math.max(this._size, other._size);
    const result = new BitSet(maxSize);
    const maxLen = Math.max(this._words.length, other._words.length);
    for (let i = 0; i < maxLen; i++) {
      const a = i < this._words.length ? this._words[i] : 0;
      const b = i < other._words.length ? other._words[i] : 0;
      result._words[i] = a | b;
    }
    return result;
  }

  /** Return a new BitSet that is the XOR of this and other. */
  xor(other: BitSet): BitSet {
    const maxSize = Math.max(this._size, other._size);
    const result = new BitSet(maxSize);
    const maxLen = Math.max(this._words.length, other._words.length);
    for (let i = 0; i < maxLen; i++) {
      const a = i < this._words.length ? this._words[i] : 0;
      const b = i < other._words.length ? other._words[i] : 0;
      result._words[i] = a ^ b;
    }
    return result;
  }

  /** Return a new BitSet that is the complement (NOT) within the current size. */
  not(): BitSet {
    const result = new BitSet(this._size);
    for (let i = 0; i < this._words.length; i++) {
      result._words[i] = ~this._words[i];
    }
    // Mask off excess bits in the last word so only bits within size are set
    const excessBits = this._size % BITS_PER_WORD;
    if (excessBits !== 0) {
      const lastIndex = this._words.length - 1;
      result._words[lastIndex] &= (1 << excessBits) - 1;
    }
    return result;
  }

  /** Check equality with another BitSet. */
  equals(other: BitSet): boolean {
    const maxLen = Math.max(this._words.length, other._words.length);
    for (let i = 0; i < maxLen; i++) {
      const a = i < this._words.length ? this._words[i] : 0;
      const b = i < other._words.length ? other._words[i] : 0;
      if (a !== b) return false;
    }
    return true;
  }

  /** Check if no bits are set. */
  isEmpty(): boolean {
    for (let i = 0; i < this._words.length; i++) {
      if (this._words[i] !== 0) return false;
    }
    return true;
  }

  /** Return a sorted array of set bit indices. */
  toArray(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this._words.length; i++) {
      let word = this._words[i];
      const base = i * BITS_PER_WORD;
      while (word !== 0) {
        const bit = Math.log2(word & -word) | 0;
        result.push(base + bit);
        word &= word - 1; // clear lowest set bit
      }
    }
    return result;
  }

  /** Binary string representation (LSB first per word, words in order). */
  toString(): string {
    let str = '';
    for (let i = 0; i < this._size; i++) {
      str += this.get(i) ? '1' : '0';
    }
    return str;
  }
}

/** Factory function to create a new BitSet. */
export function createBitSet(size?: number): BitSet {
  return new BitSet(size);
}
