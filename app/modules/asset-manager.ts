// @ts-check
// ─── Asset Manager ───────────────────────────────────────────────────────────
// Track and manage named assets (images, scripts, data files) with loading
// states. Supports concurrency limits, subscriptions, and custom loaders.

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface Asset<T = unknown> {
  id: string;
  url: string;
  status: AssetStatus;
  data?: T;
  error?: Error;
  loadedAt?: number;
  size?: number;
}

export interface AssetManagerOptions {
  /** Custom loader function (defaults to fetch). */
  load?: (url: string) => Promise<unknown>;
  /** Max concurrent loads, default 4. */
  concurrency?: number;
}

// ─── AssetManager ─────────────────────────────────────────────────────────────

/**
 * Tracks and manages named assets with loading state, concurrency limits,
 * and subscriber notifications.
 *
 * @example
 *   const manager = new AssetManager({ load: url => fetch(url).then(r => r.json()) });
 *   manager.register('logo', '/img/logo.png');
 *   const asset = await manager.loadAsset('logo');
 */
export class AssetManager {
  #assets: Map<string, Asset> = new Map();
  #subscribers: Map<string, Set<(asset: Asset) => void>> = new Map();
  #load: (url: string) => Promise<unknown>;
  #concurrency: number;
  #activeLoads = 0;
  #queue: Array<() => void> = [];

  constructor(options?: AssetManagerOptions) {
    this.#concurrency = options?.concurrency ?? 4;
    this.#load = options?.load ?? ((url: string) => fetch(url));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #notify(asset: Asset): void {
    const subs = this.#subscribers.get(asset.id);
    if (subs !== undefined) {
      for (const cb of subs) {
        cb(asset);
      }
    }
  }

  #updateAsset(id: string, patch: Partial<Asset>): Asset {
    const existing = this.#assets.get(id);
    if (existing === undefined) {
      throw new Error(`Asset not registered: ${id}`);
    }
    const updated: Asset = { ...existing, ...patch };
    this.#assets.set(id, updated);
    this.#notify(updated);
    return updated;
  }

  /**
   * Run the next queued loader if we have capacity.
   */
  #drain(): void {
    while (this.#activeLoads < this.#concurrency && this.#queue.length > 0) {
      const next = this.#queue.shift()!;
      next();
    }
  }

  async #executeLoad(id: string): Promise<Asset> {
    const asset = this.#assets.get(id);
    if (asset === undefined) {
      throw new Error(`Asset not registered: ${id}`);
    }

    this.#activeLoads += 1;
    this.#updateAsset(id, { status: 'loading' });

    try {
      const data = await this.#load(asset.url);
      const size = typeof data === 'string'
        ? data.length
        : data instanceof ArrayBuffer
          ? data.byteLength
          : undefined;

      const loaded = this.#updateAsset(id, {
        status: 'loaded',
        data,
        loadedAt: Date.now(),
        size,
        error: undefined,
      });
      return loaded;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const failed = this.#updateAsset(id, { status: 'error', error });
      return failed;
    } finally {
      this.#activeLoads -= 1;
      this.#drain();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Register an asset by id and url. Does not load it yet.
   * Calling register for an already-registered id is a no-op.
   */
  register(id: string, url: string): void {
    if (!this.#assets.has(id)) {
      const asset: Asset = { id, url, status: 'idle' };
      this.#assets.set(id, asset);
    }
  }

  /**
   * Load an asset by id. Returns the asset when done.
   * If the asset is already loaded, resolves immediately with the cached data.
   * If the asset is currently loading, queues behind the concurrency limit.
   */
  loadAsset<T>(id: string): Promise<Asset<T>> {
    const asset = this.#assets.get(id);
    if (asset === undefined) {
      return Promise.reject(new Error(`Asset not registered: ${id}`));
    }
    if (asset.status === 'loaded') {
      return Promise.resolve(asset as Asset<T>);
    }
    return new Promise<Asset<T>>((resolve) => {
      const run = () => {
        this.#executeLoad(id).then((a) => resolve(a as Asset<T>));
      };
      if (this.#activeLoads < this.#concurrency) {
        run();
      } else {
        this.#queue.push(run);
      }
    });
  }

  /**
   * Preload multiple assets concurrently (respecting the concurrency limit).
   * Resolves when all assets have been attempted (loaded or errored).
   */
  preload(ids: string[]): Promise<Asset[]> {
    return Promise.all(ids.map((id) => this.loadAsset(id)));
  }

  /**
   * Get an asset by id. Returns undefined if not registered.
   */
  get<T>(id: string): Asset<T> | undefined {
    return this.#assets.get(id) as Asset<T> | undefined;
  }

  /**
   * Get all registered assets.
   */
  getAll(): Asset[] {
    return Array.from(this.#assets.values());
  }

  /**
   * Check if an asset has been successfully loaded.
   */
  isLoaded(id: string): boolean {
    return this.#assets.get(id)?.status === 'loaded';
  }

  /**
   * Unload an asset, freeing its data and resetting status to idle.
   */
  unload(id: string): void {
    const asset = this.#assets.get(id);
    if (asset !== undefined) {
      const unloaded: Asset = { id: asset.id, url: asset.url, status: 'idle' };
      this.#assets.set(id, unloaded);
      this.#notify(unloaded);
    }
  }

  /**
   * Total count of successfully loaded assets.
   */
  get loadedCount(): number {
    let count = 0;
    for (const asset of this.#assets.values()) {
      if (asset.status === 'loaded') count += 1;
    }
    return count;
  }

  /**
   * Subscribe to status changes for a specific asset.
   * Returns an unsubscribe function.
   *
   * @example
   *   const unsub = manager.subscribe('logo', (asset) => console.log(asset.status));
   *   // later:
   *   unsub();
   */
  subscribe(id: string, callback: (asset: Asset) => void): () => void {
    if (!this.#subscribers.has(id)) {
      this.#subscribers.set(id, new Set());
    }
    this.#subscribers.get(id)!.add(callback);
    return () => {
      this.#subscribers.get(id)?.delete(callback);
    };
  }
}
