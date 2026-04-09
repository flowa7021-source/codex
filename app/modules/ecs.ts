// @ts-check
// ─── Entity Component System ────────────────────────────────────────────────
// A minimal ECS implementation providing entity management, component storage,
// and multi-component queries. Entities are plain numeric IDs; components are
// keyed by string name and stored in nested Maps for O(1) access.

// ─── World ──────────────────────────────────────────────────────────────────

/**
 * Central container for entities and their components.
 *
 * Entities are sequential integer IDs. Components are arbitrary data objects
 * associated with an entity via a string key.
 */
export class World {
  /** Next entity ID to hand out. */
  private _nextId = 0;

  /** Set of currently alive entity IDs. */
  private _entities = new Set<number>();

  /**
   * Component storage: entity → (component name → data).
   * Only entities that actually carry components appear here.
   */
  private _components = new Map<number, Map<string, unknown>>();

  /** Create a new entity and return its numeric ID. */
  createEntity(): number {
    const id = this._nextId++;
    this._entities.add(id);
    return id;
  }

  /**
   * Destroy an entity, removing it and all of its components.
   * Silently does nothing if the entity does not exist.
   */
  destroyEntity(id: number): void {
    this._entities.delete(id);
    this._components.delete(id);
  }

  /**
   * Attach a named component with arbitrary data to an entity.
   * Overwrites any previous value stored under the same name.
   *
   * @throws {Error} If the entity does not exist.
   */
  addComponent<T>(entity: number, name: string, data: T): void {
    if (!this._entities.has(entity)) {
      throw new Error(`Entity ${entity} does not exist`);
    }
    let bag = this._components.get(entity);
    if (!bag) {
      bag = new Map<string, unknown>();
      this._components.set(entity, bag);
    }
    bag.set(name, data);
  }

  /**
   * Remove a named component from an entity.
   * Silently does nothing if the entity or component does not exist.
   */
  removeComponent(entity: number, name: string): void {
    const bag = this._components.get(entity);
    if (bag) {
      bag.delete(name);
      if (bag.size === 0) {
        this._components.delete(entity);
      }
    }
  }

  /**
   * Retrieve the data stored for a named component on an entity.
   * Returns `undefined` when the entity or component is absent.
   */
  getComponent<T>(entity: number, name: string): T | undefined {
    return this._components.get(entity)?.get(name) as T | undefined;
  }

  /** Check whether an entity currently carries a named component. */
  hasComponent(entity: number, name: string): boolean {
    return this._components.get(entity)?.has(name) ?? false;
  }

  /**
   * Return all entity IDs that possess **every** listed component.
   * An empty argument list returns all alive entities.
   */
  query(...components: string[]): number[] {
    const result: number[] = [];
    for (const id of this._entities) {
      const bag = this._components.get(id);
      if (components.length === 0) {
        result.push(id);
        continue;
      }
      if (!bag) continue;
      if (components.every((c) => bag.has(c))) {
        result.push(id);
      }
    }
    return result;
  }

  /** Number of alive entities. */
  get entityCount(): number {
    return this._entities.size;
  }

  /** Remove all entities and components, resetting the world. */
  clear(): void {
    this._entities.clear();
    this._components.clear();
    this._nextId = 0;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create and return a fresh empty World. */
export function createWorld(): World {
  return new World();
}
