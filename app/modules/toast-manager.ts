// @ts-check
// ─── Toast Manager ────────────────────────────────────────────────────────────
// Ephemeral toast notification manager with auto-expiry and subscriptions.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;   // ms, 0 = persistent
  createdAt: number;
}

export interface ToastManagerOptions {
  maxToasts?: number;         // default 5
  defaultDuration?: number;   // default 3000ms
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `toast-${Date.now()}-${_counter}`;
}

// ─── ToastManager ─────────────────────────────────────────────────────────────

export class ToastManager {
  #toasts: Toast[] = [];
  #maxToasts: number;
  #defaultDuration: number;
  #subscribers: Set<(toasts: Toast[]) => void> = new Set();

  constructor(options?: ToastManagerOptions) {
    this.#maxToasts = options?.maxToasts ?? 5;
    this.#defaultDuration = options?.defaultDuration ?? 3000;
  }

  /**
   * Show a new toast. Returns the created Toast.
   * When maxToasts is exceeded, the oldest toast is removed first.
   */
  show(type: ToastType, message: string, duration?: number): Toast {
    const toast: Toast = {
      id: generateId(),
      type,
      message,
      duration: duration ?? this.#defaultDuration,
      createdAt: Date.now(),
    };

    this.#toasts.push(toast);

    // Drop oldest when over capacity
    if (this.#toasts.length > this.#maxToasts) {
      this.#toasts.splice(0, this.#toasts.length - this.#maxToasts);
    }

    this.#notify();
    return toast;
  }

  /**
   * Dismiss a toast by id.
   * Returns true if found and removed, false if not found.
   */
  dismiss(id: string): boolean {
    const index = this.#toasts.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.#toasts.splice(index, 1);
    this.#notify();
    return true;
  }

  /** Dismiss all active toasts. */
  dismissAll(): void {
    this.#toasts = [];
    this.#notify();
  }

  /** Currently active toasts (copy). */
  get activeToasts(): Toast[] {
    return this.#toasts.slice();
  }

  /** Number of active toasts. */
  get count(): number {
    return this.#toasts.length;
  }

  /**
   * Subscribe to toast changes (add/remove).
   * Returns an unsubscribe function.
   */
  subscribe(fn: (toasts: Toast[]) => void): () => void {
    this.#subscribers.add(fn);
    return () => {
      this.#subscribers.delete(fn);
    };
  }

  /**
   * Process expired toasts. Should be called periodically or after each tick.
   * Toasts with duration === 0 are persistent and never expired.
   *
   * @param now - Current time in ms (defaults to Date.now())
   */
  tick(now?: number): void {
    const currentTime = now ?? Date.now();
    const before = this.#toasts.length;

    this.#toasts = this.#toasts.filter((t) => {
      if (t.duration === 0) return true; // persistent
      return currentTime < t.createdAt + t.duration;
    });

    if (this.#toasts.length !== before) {
      this.#notify();
    }
  }

  #notify(): void {
    const snapshot = this.#toasts.slice();
    for (const fn of this.#subscribers) {
      fn(snapshot);
    }
  }
}
