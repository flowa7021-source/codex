// @ts-check
// ─── A/B Testing ──────────────────────────────────────────────────────────────
// Variant assignment for A/B experiments with deterministic hashing.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Experiment {
  id: string;
  name: string;
  variants: string[];
  weights?: number[];
  active: boolean;
}

export interface Assignment {
  experimentId: string;
  variant: string;
  assignedAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash: sum of char codes of the input string.
 * Returns a non-negative integer.
 */
function simpleHash(str: string): number {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  return sum;
}

// ─── ABTesting ────────────────────────────────────────────────────────────────

export class ABTesting {
  #experiments: Map<string, Experiment> = new Map();
  #overrides: Map<string, string> = new Map();

  /** Register an experiment. */
  register(experiment: Experiment): void {
    this.#experiments.set(experiment.id, { ...experiment });
  }

  /**
   * Get variant for a user/session (deterministic by userId + experimentId).
   * Returns null if the experiment is not found or not active.
   */
  getVariant(experimentId: string, userId: string): string | null {
    const experiment = this.#experiments.get(experimentId);
    if (!experiment || !experiment.active) return null;

    // Overrides take precedence
    const overrideKey = `${experimentId}:override`;
    if (this.#overrides.has(overrideKey)) {
      return this.#overrides.get(overrideKey)!;
    }

    const { variants, weights } = experiment;
    if (variants.length === 0) return null;

    // Build cumulative weights
    const w = weights && weights.length === variants.length ? weights : variants.map(() => 1);
    const totalWeight = w.reduce((a, b) => a + b, 0);

    const hash = simpleHash(`${experimentId}:${userId}`);
    const bucket = hash % totalWeight;

    let cumulative = 0;
    for (let i = 0; i < variants.length; i++) {
      cumulative += w[i];
      if (bucket < cumulative) {
        return variants[i];
      }
    }

    return variants[variants.length - 1];
  }

  /** Manually override a variant (for testing). */
  override(experimentId: string, variant: string): void {
    this.#overrides.set(`${experimentId}:override`, variant);
  }

  /** Clear override. */
  clearOverride(experimentId: string): void {
    this.#overrides.delete(`${experimentId}:override`);
  }

  /** Get all current assignments for a user. */
  getAssignments(userId: string): Assignment[] {
    const assignments: Assignment[] = [];
    for (const experiment of this.#experiments.values()) {
      if (!experiment.active) continue;
      const variant = this.getVariant(experiment.id, userId);
      if (variant !== null) {
        assignments.push({
          experimentId: experiment.id,
          variant,
          assignedAt: Date.now(),
        });
      }
    }
    return assignments;
  }

  /** Check if experiment is active. */
  isActive(experimentId: string): boolean {
    return this.#experiments.get(experimentId)?.active ?? false;
  }

  /** Deactivate experiment. */
  deactivate(experimentId: string): void {
    const experiment = this.#experiments.get(experimentId);
    if (!experiment) return;
    this.#experiments.set(experimentId, { ...experiment, active: false });
  }

  /** Get all registered experiments. */
  getExperiments(): Experiment[] {
    return Array.from(this.#experiments.values());
  }
}
