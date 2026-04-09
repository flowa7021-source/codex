// @ts-check
// ─── Audit Trail ──────────────────────────────────────────────────────────────
// Immutable audit trail with event sourcing, querying, and CSV export.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure' | 'pending';
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `audit-${Date.now()}-${_counter}`;
}

// ─── CSV escaping ─────────────────────────────────────────────────────────────

function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── AuditTrail ───────────────────────────────────────────────────────────────

export class AuditTrail {
  #events: AuditEvent[] = [];
  #maxEvents: number;

  constructor(maxEvents = 5000) {
    this.#maxEvents = maxEvents;
  }

  /**
   * Record a new audit event. Generates id and timestamp automatically.
   * Returns the created AuditEvent.
   */
  record(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const full: AuditEvent = {
      id: generateId(),
      timestamp: Date.now(),
      ...event,
    };

    this.#events.push(full);

    // Drop oldest events if over capacity
    if (this.#events.length > this.#maxEvents) {
      this.#events.splice(0, this.#events.length - this.#maxEvents);
    }

    return full;
  }

  /**
   * Query events with optional filters. All provided filters are applied (AND logic).
   * Results are ordered chronologically (oldest first).
   */
  query(filter?: {
    actor?: string;
    action?: string;
    resource?: string;
    result?: AuditEvent['result'];
    since?: number;
    until?: number;
    limit?: number;
  }): AuditEvent[] {
    let result = this.#events.slice();

    if (filter?.actor !== undefined) {
      const actor = filter.actor;
      result = result.filter((e) => e.actor === actor);
    }

    if (filter?.action !== undefined) {
      const action = filter.action;
      result = result.filter((e) => e.action === action);
    }

    if (filter?.resource !== undefined) {
      const resource = filter.resource;
      result = result.filter((e) => e.resource === resource);
    }

    if (filter?.result !== undefined) {
      const res = filter.result;
      result = result.filter((e) => e.result === res);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((e) => e.timestamp >= since);
    }

    if (filter?.until !== undefined) {
      const until = filter.until;
      result = result.filter((e) => e.timestamp <= until);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /** Number of stored events. */
  get count(): number {
    return this.#events.length;
  }

  /** Remove all audit events. */
  clear(): void {
    this.#events = [];
  }

  /** Returns a map of action -> occurrence count across all events. */
  summarize(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const event of this.#events) {
      summary[event.action] = (summary[event.action] ?? 0) + 1;
    }
    return summary;
  }

  /**
   * Export events as CSV.
   * Columns: id,timestamp,actor,action,resource,result
   */
  toCSV(): string {
    const header = 'id,timestamp,actor,action,resource,result';
    const rows = this.#events.map((e) =>
      [
        csvCell(e.id),
        String(e.timestamp),
        csvCell(e.actor),
        csvCell(e.action),
        csvCell(e.resource),
        csvCell(e.result),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
