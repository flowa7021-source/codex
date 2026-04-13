// @ts-check
// ─── Component Pool ─────────────────────────────────────────────────────────
// A typed, recycling pool for ECS components. Instead of creating/destroying
// component objects on every attach/detach, the pool keeps a free-list and
// reuses previously allocated instances after running an optional reset
// function.

// ─── ComponentPool ──────────────────────────────────────────────────────────

/**
 * Manages a pool of reusable component instances keyed by entity ID.
 *
 * @template T - The component data type.
 */
export class ComponentPool<T> {
  /** Factory that produces a fresh component instance. */
  private _create: () => T;

  /** Optional function to reset a component before it is returned to the pool. */
  private _reset: ((item: T) => void) | undefined;

  /** Components currently assigned to an entity. */
  private _active = new Map<number, T>();

  /** Recycled components waiting to be reused. */
  private _pool: T[] = [];

  constructor(create: () => T, reset?: (item: T) => void) {
    this._create = create;
    this._reset = reset;
  }

  /**
   * Acquire a component for `entity`.
   *
   * If a recycled instance is available it will be reused; otherwise a new
   * one is created via the factory. If the entity already has an active
   * component it is returned as-is (idempotent).
   */
  acquire(entity: number): T {
    const existing = this._active.get(entity);
    if (existing !== undefined) return existing;

    const item = this._pool.length > 0 ? this._pool.pop()! : this._create();
    this._active.set(entity, item);
    return item;
  }

  /**
   * Release the component for `entity` back into the pool.
   * If a reset function was provided it is called before pooling.
   * Does nothing if the entity has no active component.
   */
  release(entity: number): void {
    const item = this._active.get(entity);
    if (item === undefined) return;
    this._active.delete(entity);
    if (this._reset) this._reset(item);
    this._pool.push(item);
  }

  /** Get the active component for `entity`, or `undefined` if none. */
  get(entity: number): T | undefined {
    return this._active.get(entity);
  }

  /** Check whether `entity` has an active component in this pool. */
  has(entity: number): boolean {
    return this._active.has(entity);
  }

  /** Number of components currently assigned to entities. */
  get activeCount(): number {
    return this._active.size;
  }

  /** Number of recycled components waiting in the pool. */
  get pooledCount(): number {
    return this._pool.length;
  }

  /** Return all entity IDs that currently hold a component from this pool. */
  entities(): number[] {
    return [...this._active.keys()];
  }

  /** Release all active components and clear the pool entirely. */
  clear(): void {
    this._active.clear();
    this._pool.length = 0;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create and return a new ComponentPool. */
export function createComponentPool<T>(
  create: () => T,
  reset?: (item: T) => void,
): ComponentPool<T> {
  return new ComponentPool<T>(create, reset);
}
