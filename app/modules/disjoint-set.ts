// @ts-check
// ─── Disjoint Set / Union-Find ───────────────────────────────────────────────
// Generic key-based Union-Find with union-by-rank and path compression.

export class DisjointSet<K = unknown> {
  #parent: Map<K, K>;
  #rank: Map<K, number>;
  #compSize: Map<K, number>;
  #setCount: number;

  constructor() {
    this.#parent = new Map();
    this.#rank = new Map();
    this.#compSize = new Map();
    this.#setCount = 0;
  }

  get size(): number { return this.#parent.size; }
  get setCount(): number { return this.#setCount; }

  makeSet(key: K): void {
    if (this.#parent.has(key)) return;
    this.#parent.set(key, key);
    this.#rank.set(key, 0);
    this.#compSize.set(key, 1);
    this.#setCount++;
  }

  find(key: K): K {
    if (!this.#parent.has(key)) {
      throw new Error(`DisjointSet: key not found`);
    }
    let root = key;
    while (this.#parent.get(root) !== root) {
      root = this.#parent.get(root) as K;
    }
    let cur = key;
    while (cur !== root) {
      const next = this.#parent.get(cur) as K;
      this.#parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: K, b: K): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    const rankA = this.#rank.get(rootA) ?? 0;
    const rankB = this.#rank.get(rootB) ?? 0;
    const sizeA = this.#compSize.get(rootA) ?? 1;
    const sizeB = this.#compSize.get(rootB) ?? 1;
    if (rankA < rankB) {
      this.#parent.set(rootA, rootB);
      this.#compSize.set(rootB, sizeA + sizeB);
    } else if (rankA > rankB) {
      this.#parent.set(rootB, rootA);
      this.#compSize.set(rootA, sizeA + sizeB);
    } else {
      this.#parent.set(rootB, rootA);
      this.#rank.set(rootA, rankA + 1);
      this.#compSize.set(rootA, sizeA + sizeB);
    }
    this.#setCount--;
    return true;
  }

  connected(a: K, b: K): boolean {
    return this.find(a) === this.find(b);
  }

  setSize(key: K): number {
    return this.#compSize.get(this.find(key)) ?? 1;
  }

  sets(): K[][] {
    const groups = new Map<K, K[]>();
    for (const key of this.#parent.keys()) {
      const root = this.find(key);
      if (!groups.has(root)) groups.set(root, []);
      (groups.get(root) as K[]).push(key);
    }
    return [...groups.values()];
  }
}

export function createDisjointSet<K = unknown>(): DisjointSet<K> {
  return new DisjointSet<K>();
}
