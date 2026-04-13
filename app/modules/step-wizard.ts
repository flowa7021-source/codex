// @ts-check
// ─── Step Wizard ──────────────────────────────────────────────────────────────
// Multi-step wizard/flow state management.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardStep<T = unknown> {
  id: string;
  label: string;
  data?: T;
  valid?: boolean;
}

// ─── StepWizard ───────────────────────────────────────────────────────────────

export class StepWizard<T = unknown> {
  #steps: WizardStep<T>[];
  #index: number;
  #subscribers: Set<(wizard: StepWizard<T>) => void> = new Set();

  constructor(steps: WizardStep<T>[]) {
    if (!steps || steps.length === 0) {
      throw new Error('StepWizard requires at least one step');
    }
    // Deep-copy steps to avoid mutating the original array
    this.#steps = steps.map((s) => ({ ...s }));
    this.#index = 0;
  }

  /** Current step object. */
  get currentStep(): WizardStep<T> {
    return { ...this.#steps[this.#index] };
  }

  /** Current step index (0-based). */
  get currentIndex(): number {
    return this.#index;
  }

  /** Total number of steps. */
  get stepCount(): number {
    return this.#steps.length;
  }

  /** Whether currently on the first step. */
  get isFirst(): boolean {
    return this.#index === 0;
  }

  /** Whether currently on the last step. */
  get isLast(): boolean {
    return this.#index === this.#steps.length - 1;
  }

  /**
   * Whether the wizard can advance.
   * True if the current step has no `valid` property set, or if valid===true.
   */
  get canGoNext(): boolean {
    const step = this.#steps[this.#index];
    return step.valid !== false;
  }

  /** Whether the wizard can go back. */
  get canGoPrev(): boolean {
    return this.#index > 0;
  }

  /**
   * Progress as a 0-100 value based on current position.
   * First step = 0, last step = 100.
   */
  get progress(): number {
    if (this.#steps.length <= 1) return 0;
    return Math.round((this.#index / (this.#steps.length - 1)) * 100);
  }

  /**
   * Advance to the next step.
   * Returns false if already on the last step or canGoNext is false.
   */
  next(): boolean {
    if (!this.canGoNext || this.isLast) return false;
    this.#index += 1;
    this.#notify();
    return true;
  }

  /**
   * Go back to the previous step.
   * Returns false if already on the first step.
   */
  prev(): boolean {
    if (this.#index === 0) return false;
    this.#index -= 1;
    this.#notify();
    return true;
  }

  /**
   * Jump to a specific step by index.
   * Returns false if the index is out of bounds.
   */
  goto(index: number): boolean {
    if (index < 0 || index >= this.#steps.length) return false;
    this.#index = index;
    this.#notify();
    return true;
  }

  /** Update data for the current step. */
  updateData(data: T): void {
    this.#steps[this.#index].data = data;
    this.#notify();
  }

  /** Set validity of the current step. */
  setValid(valid: boolean): void {
    this.#steps[this.#index].valid = valid;
    this.#notify();
  }

  /** Get all steps with their current state. */
  getSteps(): WizardStep<T>[] {
    return this.#steps.map((s) => ({ ...s }));
  }

  /** Reset to the first step. */
  reset(): void {
    this.#index = 0;
    this.#notify();
  }

  /** Subscribe to step changes. Returns unsubscribe function. */
  subscribe(fn: (wizard: StepWizard<T>) => void): () => void {
    this.#subscribers.add(fn);
    return () => {
      this.#subscribers.delete(fn);
    };
  }

  #notify(): void {
    for (const fn of this.#subscribers) {
      fn(this);
    }
  }
}
