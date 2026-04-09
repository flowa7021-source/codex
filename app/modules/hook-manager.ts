// @ts-check
// ─── Hook Manager ─────────────────────────────────────────────────────────────
// WordPress-style action/filter hook system with priority ordering.
// Lower priority number = earlier execution; same priority = FIFO.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionHandler = (...args: unknown[]) => void;
export type FilterHandler<T = unknown> = (value: T, ...args: unknown[]) => T;

interface HookEntry<H> {
  handler: H;
  priority: number;
  seq: number;  // insertion sequence for stable FIFO within same priority
}

// ─── HookManager ──────────────────────────────────────────────────────────────

export class HookManager {
  #actions: Map<string, HookEntry<ActionHandler>[]> = new Map();
  #filters: Map<string, HookEntry<FilterHandler>[]> = new Map();
  #seq = 0;

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Register an action hook. Returns remove fn. */
  addAction(hook: string, handler: ActionHandler, priority = 10): () => void {
    const entries = this.#getOrCreate(this.#actions, hook);
    const entry: HookEntry<ActionHandler> = { handler, priority, seq: this.#seq++ };
    entries.push(entry);
    entries.sort(this.#compare);
    return () => this.removeAction(hook, handler);
  }

  /** Remove an action hook. */
  removeAction(hook: string, handler: ActionHandler): void {
    const entries = this.#actions.get(hook);
    if (!entries) return;
    const idx = entries.findIndex((e) => e.handler === handler);
    if (idx !== -1) entries.splice(idx, 1);
  }

  /** Fire all action handlers for a hook. */
  doAction(hook: string, ...args: unknown[]): void {
    const entries = this.#actions.get(hook);
    if (!entries) return;
    // Snapshot to handle mutations during iteration
    for (const entry of entries.slice()) {
      entry.handler(...args);
    }
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  /** Register a filter hook. Returns remove fn. */
  addFilter<T>(hook: string, handler: FilterHandler<T>, priority = 10): () => void {
    const entries = this.#getOrCreate(this.#filters, hook);
    const entry: HookEntry<FilterHandler> = {
      handler: handler as FilterHandler,
      priority,
      seq: this.#seq++,
    };
    entries.push(entry);
    entries.sort(this.#compare);
    return () => this.removeFilter(hook, handler);
  }

  /** Remove a filter hook. */
  removeFilter<T>(hook: string, handler: FilterHandler<T>): void {
    const entries = this.#filters.get(hook);
    if (!entries) return;
    const idx = entries.findIndex((e) => e.handler === handler);
    if (idx !== -1) entries.splice(idx, 1);
  }

  /** Apply all filter handlers, threading value through. */
  applyFilters<T>(hook: string, value: T, ...args: unknown[]): T {
    const entries = this.#filters.get(hook);
    if (!entries) return value;
    let current: unknown = value;
    for (const entry of entries.slice()) {
      current = entry.handler(current, ...args);
    }
    return current as T;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /** Check if hook has handlers (actions or filters). */
  hasHook(hook: string): boolean {
    return (
      (this.#actions.get(hook)?.length ?? 0) > 0 ||
      (this.#filters.get(hook)?.length ?? 0) > 0
    );
  }

  /** Remove all handlers for a hook (both actions and filters). */
  removeAll(hook: string): void {
    this.#actions.delete(hook);
    this.#filters.delete(hook);
  }

  /** Get handler count for a hook (actions + filters combined). */
  count(hook: string): number {
    return (
      (this.#actions.get(hook)?.length ?? 0) +
      (this.#filters.get(hook)?.length ?? 0)
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  #getOrCreate<H>(map: Map<string, HookEntry<H>[]>, hook: string): HookEntry<H>[] {
    let entries = map.get(hook);
    if (!entries) {
      entries = [];
      map.set(hook, entries);
    }
    return entries;
  }

  #compare<H>(a: HookEntry<H>, b: HookEntry<H>): number {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.seq - b.seq;
  }
}
