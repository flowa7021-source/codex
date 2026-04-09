// @ts-check
// ─── Huffman Coding ─────────────────────────────────────────────────────────
// Huffman tree construction, encoding and decoding for lossless data
// compression. Produces variable-length prefix-free binary codes where
// more-frequent symbols get shorter codes.

// ─── Internal node type ──────────────────────────────────────────────────────

interface HuffmanNode {
  char: string | null;
  freq: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
}

// ─── HuffmanTree class ──────────────────────────────────────────────────────

/**
 * A Huffman tree built from character frequencies. Provides encode / decode
 * and introspection via `getCodeTable()` and `averageBitLength`.
 */
export class HuffmanTree {
  /** @internal root of the binary tree */
  private root: HuffmanNode;
  /** @internal cached code table (char → binary string) */
  private codes: Map<string, string>;
  /** @internal total weight used for averageBitLength */
  private totalFreq: number;

  constructor(frequencies: Map<string, number>) {
    if (frequencies.size === 0) {
      throw new Error('Cannot build Huffman tree from empty frequency map');
    }

    this.totalFreq = 0;
    for (const f of frequencies.values()) {
      this.totalFreq += f;
    }

    this.root = this.buildTree(frequencies);
    this.codes = new Map();
    this.buildCodes(this.root, '');

    // Edge case: single unique character → assign code "0"
    if (this.codes.size === 1) {
      const [char] = this.codes.keys();
      this.codes.set(char, '0');
    }
  }

  // ── Tree construction ────────────────────────────────────────────────────

  private buildTree(frequencies: Map<string, number>): HuffmanNode {
    // Build leaf nodes
    const nodes: HuffmanNode[] = [];
    for (const [char, freq] of frequencies) {
      nodes.push({ char, freq, left: null, right: null });
    }

    // Simple priority-queue via repeated sort (fine for typical alphabet sizes)
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.freq - b.freq);
      const left = nodes.shift()!;
      const right = nodes.shift()!;
      nodes.push({
        char: null,
        freq: left.freq + right.freq,
        left,
        right,
      });
    }

    return nodes[0];
  }

  // ── Code generation ──────────────────────────────────────────────────────

  private buildCodes(node: HuffmanNode, prefix: string): void {
    if (node.char !== null) {
      this.codes.set(node.char, prefix);
      return;
    }
    if (node.left) this.buildCodes(node.left, prefix + '0');
    if (node.right) this.buildCodes(node.right, prefix + '1');
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Encode `text` into a binary string using the tree's code table.
   * Every character in `text` must be present in the original frequency map.
   */
  encode(text: string): string {
    let result = '';
    for (const ch of text) {
      const code = this.codes.get(ch);
      if (code === undefined) {
        throw new Error(`Character "${ch}" not found in Huffman tree`);
      }
      result += code;
    }
    return result;
  }

  /**
   * Decode a binary string back to the original text.
   */
  decode(bits: string): string {
    let result = '';
    let node = this.root;

    // Special case: single-character tree
    if (this.codes.size === 1) {
      const [char] = this.codes.keys();
      for (const b of bits) {
        if (b !== '0') throw new Error(`Invalid bit "${b}" for single-char tree`);
        result += char;
      }
      return result;
    }

    for (const bit of bits) {
      node = bit === '0' ? node.left! : node.right!;
      if (node.char !== null) {
        result += node.char;
        node = this.root;
      }
    }
    return result;
  }

  /**
   * Return the code table mapping each character to its binary code.
   */
  getCodeTable(): Map<string, string> {
    return new Map(this.codes);
  }

  /**
   * Weighted average bit length (Shannon-style), computed from the frequency
   * distribution and the generated codes.
   */
  get averageBitLength(): number {
    if (this.totalFreq === 0) return 0;
    let weightedSum = 0;
    for (const [char, code] of this.codes) {
      // We need the original frequency — recompute from root traversal is
      // overkill; instead walk the tree for each char (acceptable for the
      // typically small alphabets Huffman operates on).
      const freq = this.getFreq(this.root, char);
      weightedSum += freq * code.length;
    }
    return weightedSum / this.totalFreq;
  }

  /** @internal Walk tree to recover frequency for `char`. */
  private getFreq(node: HuffmanNode | null, char: string): number {
    if (!node) return 0;
    if (node.char === char) return node.freq;
    return this.getFreq(node.left, char) + this.getFreq(node.right, char);
  }
}

// ─── Standalone helpers ─────────────────────────────────────────────────────

/**
 * Build a frequency map from a string.
 */
export function buildFrequencyMap(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const ch of text) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  return freq;
}

/**
 * One-shot encode: builds a tree from `text` and returns encoded bits + tree.
 */
export function huffmanEncode(text: string): { encoded: string; tree: HuffmanTree } {
  const tree = createHuffmanTree(text);
  return { encoded: tree.encode(text), tree };
}

/**
 * Decode `bits` using the provided tree.
 */
export function huffmanDecode(bits: string, tree: HuffmanTree): string {
  return tree.decode(bits);
}

/**
 * Convenience factory: build a HuffmanTree directly from raw text.
 */
export function createHuffmanTree(text: string): HuffmanTree {
  return new HuffmanTree(buildFrequencyMap(text));
}
