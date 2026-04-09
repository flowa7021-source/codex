// @ts-check
// ─── Feature Flags ───────────────────────────────────────────────────────────
// Runtime feature-flag registry with optional percentage-based rollouts.

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Feature flag definition.
 */
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  /** 0-100: percentage of users that see this flag as enabled. */
  rolloutPercentage?: number;
}

// ─── Module state ─────────────────────────────────────────────────────────────

const flags = new Map<string, FeatureFlag>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * djb2 hash — returns an unsigned 32-bit integer for the given string.
 */
function djb2Hash(str: string): number {
  return str.split('').reduce((h, c) => ((h << 5) + h + c.charCodeAt(0)) | 0, 5381) >>> 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a feature flag.
 * If a flag with the same name already exists it is replaced.
 */
export function registerFlag(flag: FeatureFlag): void {
  flags.set(flag.name, { ...flag });
}

/**
 * Check if a feature flag is enabled.
 *
 * - If the flag does not exist, returns `false`.
 * - If `rolloutPercentage` is set and a `userId` is supplied, uses a
 *   deterministic hash to decide: `hash(userId) % 100 < rolloutPercentage`.
 * - Otherwise returns the flag's `enabled` value.
 */
export function isEnabled(name: string, userId?: string): boolean {
  const flag = flags.get(name);
  if (!flag) return false;

  if (typeof flag.rolloutPercentage === 'number' && userId !== undefined) {
    return djb2Hash(userId) % 100 < flag.rolloutPercentage;
  }

  return flag.enabled;
}

/**
 * Enable or disable a feature flag at runtime.
 * No-op if the flag does not exist.
 */
export function setEnabled(name: string, enabled: boolean): void {
  const flag = flags.get(name);
  if (flag) {
    flags.set(name, { ...flag, enabled });
  }
}

/**
 * Get all registered feature flags (shallow copies).
 */
export function getFlags(): FeatureFlag[] {
  return Array.from(flags.values()).map((f) => ({ ...f }));
}

/**
 * Get a feature flag by name.
 * Returns `undefined` if not found.
 */
export function getFlag(name: string): FeatureFlag | undefined {
  const flag = flags.get(name);
  return flag ? { ...flag } : undefined;
}

/**
 * Remove a feature flag.
 */
export function removeFlag(name: string): void {
  flags.delete(name);
}

/**
 * Clear all registered feature flags.
 */
export function clearFlags(): void {
  flags.clear();
}

/**
 * Load feature flags from an array, replacing all existing flags.
 */
export function loadFlags(incoming: FeatureFlag[]): void {
  flags.clear();
  for (const flag of incoming) {
    flags.set(flag.name, { ...flag });
  }
}
