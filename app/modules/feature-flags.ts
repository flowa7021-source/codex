// @ts-check
// ─── Feature Flags ────────────────────────────────────────────────────────────
// Feature flag system with rollout percentages, allow lists, and conditions.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlagConfig {
  name: string;
  enabled: boolean;
  rolloutPercent?: number;
  allowList?: string[];
  conditions?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deterministic hash of a string — returns a non-negative integer in [0, 99].
 * Used for rollout bucket assignment.
 */
function hashToBucket(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0; // keep as unsigned 32-bit int
  }
  return hash % 100;
}

// ─── FeatureFlags ─────────────────────────────────────────────────────────────

export class FeatureFlags {
  #flags: Map<string, FlagConfig> = new Map();

  constructor(flags?: FlagConfig[]) {
    if (flags) {
      for (const flag of flags) {
        this.register(flag);
      }
    }
  }

  /** Register (or replace) a feature flag. */
  register(flag: FlagConfig): void {
    this.#flags.set(flag.name, { ...flag });
  }

  /**
   * Check whether a flag is enabled for the given context.
   *
   * Evaluation order:
   * 1. Flag must exist and have `enabled: true` — otherwise false.
   * 2. `allowList` — if present, userId must be in the list.
   * 3. `rolloutPercent` — if present, deterministic hash of userId must be < percent.
   * 4. `conditions` — if present, all key-value pairs must match context.
   */
  isEnabled(name: string, context?: { userId?: string; [key: string]: unknown }): boolean {
    const flag = this.#flags.get(name);
    if (!flag || !flag.enabled) return false;

    const userId = context?.userId;

    // allowList check
    if (flag.allowList !== undefined) {
      if (!userId || !flag.allowList.includes(userId)) return false;
    }

    // rolloutPercent check (requires userId)
    if (flag.rolloutPercent !== undefined) {
      if (!userId) return false;
      const bucket = hashToBucket(`${name}:${userId}`);
      if (bucket >= flag.rolloutPercent) return false;
    }

    // conditions check
    if (flag.conditions !== undefined && context !== undefined) {
      for (const [key, expected] of Object.entries(flag.conditions)) {
        if (context[key] !== expected) return false;
      }
    } else if (flag.conditions !== undefined && context === undefined) {
      // conditions exist but no context provided — cannot satisfy them
      return false;
    }

    return true;
  }

  /** Enable an existing flag (no-op if not registered). */
  enable(name: string): void {
    const flag = this.#flags.get(name);
    if (!flag) return;
    this.#flags.set(name, { ...flag, enabled: true });
  }

  /** Disable an existing flag (no-op if not registered). */
  disable(name: string): void {
    const flag = this.#flags.get(name);
    if (!flag) return;
    this.#flags.set(name, { ...flag, enabled: false });
  }

  /** Update the rollout percentage for a flag (no-op if not registered). */
  setRollout(name: string, percent: number): void {
    const flag = this.#flags.get(name);
    if (!flag) return;
    this.#flags.set(name, { ...flag, rolloutPercent: percent });
  }

  /** Return a copy of all registered flag configs. */
  list(): FlagConfig[] {
    return Array.from(this.#flags.values()).map((f) => ({ ...f }));
  }

  /** Return a copy of the named flag config, or undefined if not found. */
  getFlag(name: string): FlagConfig | undefined {
    const flag = this.#flags.get(name);
    return flag ? { ...flag } : undefined;
  }
}

/** Factory function that creates a new FeatureFlags instance. */
export function createFeatureFlags(flags?: FlagConfig[]): FeatureFlags {
  return new FeatureFlags(flags);
}
