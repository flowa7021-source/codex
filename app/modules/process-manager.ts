// @ts-check
// ─── Process Manager ─────────────────────────────────────────────────────────
// Named process/worker lifecycle management with status tracking and subscriptions.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProcessStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

export interface ManagedProcess {
  id: string;
  name: string;
  status: ProcessStatus;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateProcessId(): string {
  _counter += 1;
  return `proc-${Date.now()}-${_counter}`;
}

// ─── ProcessManager ──────────────────────────────────────────────────────────

export class ProcessManager {
  #processes: Map<string, ManagedProcess> = new Map();
  #subscribers: Map<string, Set<(process: ManagedProcess) => void>> = new Map();
  /** Pending waitFor promises keyed by process id. */
  #waiters: Map<string, Array<(process: ManagedProcess) => void>> = new Map();

  // ─── Internal helpers ────────────────────────────────────────────────────

  #notify(process: ManagedProcess): void {
    const subs = this.#subscribers.get(process.id);
    if (subs) {
      for (const cb of subs) {
        cb({ ...process });
      }
    }
  }

  #resolveWaiters(process: ManagedProcess): void {
    const waiters = this.#waiters.get(process.id);
    if (waiters && waiters.length > 0) {
      const snapshot = { ...process };
      for (const resolve of waiters) {
        resolve(snapshot);
      }
      this.#waiters.delete(process.id);
    }
  }

  #update(id: string, patch: Partial<ManagedProcess>): void {
    const proc = this.#processes.get(id);
    if (!proc) return;
    Object.assign(proc, patch);
    this.#notify(proc);

    const terminal: ProcessStatus[] = ['completed', 'failed', 'stopped'];
    if (patch.status !== undefined && terminal.includes(patch.status)) {
      this.#resolveWaiters(proc);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Register and start a named process. Returns the process id.
   */
  start(
    name: string,
    fn: () => Promise<unknown>,
    metadata?: Record<string, unknown>,
  ): string {
    const id = generateProcessId();

    const proc: ManagedProcess = {
      id,
      name,
      status: 'running',
      startedAt: Date.now(),
      metadata: metadata ? { ...metadata } : undefined,
    };

    this.#processes.set(id, proc);
    this.#notify(proc);

    fn().then(
      (result) => {
        const current = this.#processes.get(id);
        // Respect a stop() that arrived while the async was in flight
        if (current && current.status !== 'stopped') {
          this.#update(id, {
            status: 'completed',
            completedAt: Date.now(),
            result,
          });
        }
      },
      (err) => {
        const current = this.#processes.get(id);
        if (current && current.status !== 'stopped') {
          this.#update(id, {
            status: 'failed',
            completedAt: Date.now(),
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      },
    );

    return id;
  }

  /**
   * Mark a running process as stopped.
   * Does not cancel in-flight async work.
   * Returns true if the process existed and was running.
   */
  stop(id: string): boolean {
    const proc = this.#processes.get(id);
    if (!proc || proc.status !== 'running') return false;
    this.#update(id, { status: 'stopped', completedAt: Date.now() });
    return true;
  }

  /** Get process by id. */
  get(id: string): ManagedProcess | undefined {
    const proc = this.#processes.get(id);
    return proc ? { ...proc } : undefined;
  }

  /** Get all processes. */
  getAll(): ManagedProcess[] {
    return Array.from(this.#processes.values()).map((p) => ({ ...p }));
  }

  /** Get processes filtered by status. */
  getByStatus(status: ProcessStatus): ManagedProcess[] {
    return Array.from(this.#processes.values())
      .filter((p) => p.status === status)
      .map((p) => ({ ...p }));
  }

  /**
   * Wait for a process to reach a terminal state (completed / failed / stopped).
   * Rejects if the process id does not exist.
   */
  waitFor(id: string): Promise<ManagedProcess> {
    const proc = this.#processes.get(id);
    if (!proc) return Promise.reject(new Error(`Process not found: ${id}`));

    const terminal: ProcessStatus[] = ['completed', 'failed', 'stopped'];
    if (terminal.includes(proc.status)) {
      return Promise.resolve({ ...proc });
    }

    return new Promise((resolve) => {
      if (!this.#waiters.has(id)) {
        this.#waiters.set(id, []);
      }
      this.#waiters.get(id)!.push(resolve);
    });
  }

  /** Remove all processes in completed or failed state. */
  cleanup(): void {
    for (const [id, proc] of this.#processes) {
      if (proc.status === 'completed' || proc.status === 'failed') {
        this.#processes.delete(id);
        this.#subscribers.delete(id);
        this.#waiters.delete(id);
      }
    }
  }

  /** Number of currently running processes. */
  get runningCount(): number {
    let count = 0;
    for (const proc of this.#processes.values()) {
      if (proc.status === 'running') count++;
    }
    return count;
  }

  /**
   * Subscribe to status changes for a process.
   * Returns an unsubscribe function.
   */
  subscribe(id: string, callback: (process: ManagedProcess) => void): () => void {
    if (!this.#subscribers.has(id)) {
      this.#subscribers.set(id, new Set());
    }
    this.#subscribers.get(id)!.add(callback);

    return () => {
      this.#subscribers.get(id)?.delete(callback);
    };
  }
}
