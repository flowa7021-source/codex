// @ts-check
// ─── Reservoir Sampling ─────────────────────────────────────────────────────
// Streaming reservoir sampling algorithms for selecting k items uniformly at
// random from an arbitrarily large (or unknown-size) data source.

// ─── Algorithm R ────────────────────────────────────────────────────────────

/**
 * Select k items uniformly at random from an iterable stream using
 * Vitter's Algorithm R.
 *
 * @param stream - Iterable source of items
 * @param k      - Reservoir size (number of items to sample)
 * @param rng    - Random number generator returning values in [0, 1)
 */
export function reservoirSample<T>(
  stream: Iterable<T>,
  k: number,
  rng: () => number = Math.random,
): T[] {
  if (k <= 0) return [];

  const reservoir: T[] = [];
  let i = 0;

  for (const item of stream) {
    if (i < k) {
      reservoir.push(item);
    } else {
      const j = Math.floor(rng() * (i + 1));
      if (j < k) {
        reservoir[j] = item;
      }
    }
    i++;
  }

  return reservoir;
}

// ─── Weighted Reservoir Sampling ────────────────────────────────────────────

/**
 * Weighted reservoir sampling using the key-based algorithm (Efraimidis &
 * Spirakis, 2006). Items with higher weights are more likely to be selected.
 *
 * @param items - Array of items with associated positive weights
 * @param k     - Number of items to sample
 * @param rng   - Random number generator returning values in [0, 1)
 */
export function weightedReservoirSample<T>(
  items: { value: T; weight: number }[],
  k: number,
  rng: () => number = Math.random,
): T[] {
  if (k <= 0) return [];

  // Assign keys: u^(1/weight) where u ~ Uniform(0,1)
  const keyed = items.map(item => ({
    value: item.value,
    key: Math.pow(rng(), 1 / item.weight),
  }));

  // Select the k items with the largest keys
  keyed.sort((a, b) => b.key - a.key);

  return keyed.slice(0, k).map(entry => entry.value);
}

// ─── Streaming Reservoir Sampler Class ──────────────────────────────────────

/**
 * A stateful streaming reservoir sampler that processes items one at a time.
 * Maintains a reservoir of size k using Algorithm R.
 */
export class ReservoirSampler<T> {
  private readonly _k: number;
  private readonly _rng: () => number;
  private _reservoir: T[];
  private _seen: number;

  /**
   * @param k   - Reservoir size
   * @param rng - Random number generator returning values in [0, 1)
   */
  constructor(k: number, rng: () => number = Math.random) {
    this._k = k;
    this._rng = rng;
    this._reservoir = [];
    this._seen = 0;
  }

  /**
   * Process one item from the stream.
   *
   * @param item - The next item to consider for the sample
   */
  add(item: T): void {
    if (this._seen < this._k) {
      this._reservoir.push(item);
    } else {
      const j = Math.floor(this._rng() * (this._seen + 1));
      if (j < this._k) {
        this._reservoir[j] = item;
      }
    }
    this._seen++;
  }

  /** Current reservoir sample (defensive copy). */
  get sample(): T[] {
    return [...this._reservoir];
  }

  /** Total number of items processed so far. */
  get seen(): number {
    return this._seen;
  }

  /** Reset the sampler to its initial empty state. */
  reset(): void {
    this._reservoir = [];
    this._seen = 0;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new ReservoirSampler instance.
 *
 * @param k   - Reservoir size
 * @param rng - Random number generator returning values in [0, 1)
 */
export function createReservoirSampler<T>(
  k: number,
  rng: () => number = Math.random,
): ReservoirSampler<T> {
  return new ReservoirSampler<T>(k, rng);
}
