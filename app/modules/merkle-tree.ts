// @ts-check
// ─── Merkle Tree ────────────────────────────────────────────────────────────
// Binary hash tree for data integrity verification. Supports proof generation,
// verification, and in-place leaf updates with efficient recomputation.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProofStep {
  hash: string;
  direction: 'left' | 'right';
}

export type HashFn = (data: string) => string;

// ─── Default Hash (djb2) ────────────────────────────────────────────────────

function djb2(data: string): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

// ─── MerkleTree ─────────────────────────────────────────────────────────────

/**
 * Binary Merkle tree built from an array of string leaves.
 *
 * Internal nodes are computed by hashing the concatenation of their children.
 * If the leaf count is not a power of two, the last leaf is duplicated to fill
 * the level.
 *
 * @example
 *   const tree = new MerkleTree(['a', 'b', 'c', 'd']);
 *   const proof = tree.getProof(2);
 *   console.log(tree.verify('c', proof, tree.root)); // true
 */
export class MerkleTree {
  readonly #hashFn: HashFn;
  #leaves: string[];
  /** Flat array: layers[0] = leaf hashes, layers[depth] = [root] */
  #layers: string[][];

  constructor(leaves: string[], hashFn?: HashFn) {
    if (leaves.length === 0) {
      throw new Error('MerkleTree requires at least one leaf');
    }
    this.#hashFn = hashFn ?? djb2;
    this.#leaves = [...leaves];
    this.#layers = this.#buildLayers(this.#leaves.map((l) => this.#hashFn(l)));
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get root(): string {
    return this.#layers[this.#layers.length - 1][0];
  }

  get depth(): number {
    return this.#layers.length - 1;
  }

  get leafCount(): number {
    return this.#leaves.length;
  }

  // ─── Public methods ─────────────────────────────────────────────────────────

  getLeaf(index: number): string {
    if (index < 0 || index >= this.#leaves.length) {
      throw new RangeError(`Leaf index ${index} out of range [0, ${this.#leaves.length})`);
    }
    return this.#leaves[index];
  }

  /**
   * Return the sibling-hash path from a leaf to the root.
   * Each step contains the sibling hash and whether it sits to the 'left'
   * or 'right' of the current node.
   */
  getProof(index: number): ProofStep[] {
    if (index < 0 || index >= this.#leaves.length) {
      throw new RangeError(`Leaf index ${index} out of range [0, ${this.#leaves.length})`);
    }
    const proof: ProofStep[] = [];
    let idx = index;
    for (let layer = 0; layer < this.#layers.length - 1; layer++) {
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      const level = this.#layers[layer];
      const siblingHash = siblingIdx < level.length ? level[siblingIdx] : level[idx];
      proof.push({
        hash: siblingHash,
        direction: isRight ? 'left' : 'right',
      });
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  /**
   * Verify that a leaf value belongs to a tree with the given root, using the
   * provided proof path.
   */
  verify(leaf: string, proof: ProofStep[], root: string): boolean {
    let hash = this.#hashFn(leaf);
    for (const step of proof) {
      if (step.direction === 'left') {
        hash = this.#hashFn(step.hash + hash);
      } else {
        hash = this.#hashFn(hash + step.hash);
      }
    }
    return hash === root;
  }

  /**
   * Replace a leaf value and recompute only the affected path to the root.
   */
  update(index: number, value: string): void {
    if (index < 0 || index >= this.#leaves.length) {
      throw new RangeError(`Leaf index ${index} out of range [0, ${this.#leaves.length})`);
    }
    this.#leaves[index] = value;
    this.#layers[0][index] = this.#hashFn(value);
    let idx = index;
    for (let layer = 0; layer < this.#layers.length - 1; layer++) {
      const parentIdx = Math.floor(idx / 2);
      const leftIdx = parentIdx * 2;
      const rightIdx = leftIdx + 1;
      const level = this.#layers[layer];
      const leftHash = level[leftIdx];
      const rightHash = rightIdx < level.length ? level[rightIdx] : leftHash;
      this.#layers[layer + 1][parentIdx] = this.#hashFn(leftHash + rightHash);
      idx = parentIdx;
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  #buildLayers(leafHashes: string[]): string[][] {
    const layers: string[][] = [leafHashes];
    let current = leafHashes;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : left;
        next.push(this.#hashFn(left + right));
      }
      layers.push(next);
      current = next;
    }
    return layers;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createMerkleTree(leaves: string[]): MerkleTree {
  return new MerkleTree(leaves);
}
