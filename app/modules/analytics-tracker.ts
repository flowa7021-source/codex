// @ts-check
// ─── Analytics Tracker ────────────────────────────────────────────────────────
// In-memory analytics event tracker with filtering, summaries, and funnels.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: string;
  name: string;
  category?: string;
  properties: Record<string, unknown>;
  timestamp: number;
  sessionId?: string;
}

export interface AnalyticsOptions {
  sessionId?: string;
  maxEvents?: number;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `evt-${Date.now()}-${_counter}`;
}

// ─── AnalyticsTracker ─────────────────────────────────────────────────────────

export class AnalyticsTracker {
  #events: AnalyticsEvent[] = [];
  #sessionId: string | undefined;
  #maxEvents: number;
  #globalProperties: Record<string, unknown> = {};

  constructor(options?: AnalyticsOptions) {
    this.#sessionId = options?.sessionId;
    this.#maxEvents = options?.maxEvents ?? 1000;
  }

  /** Track an event. */
  track(
    name: string,
    properties?: Record<string, unknown>,
    category?: string,
  ): AnalyticsEvent {
    const event: AnalyticsEvent = {
      id: generateId(),
      name,
      category,
      properties: { ...this.#globalProperties, ...(properties ?? {}) },
      timestamp: Date.now(),
      sessionId: this.#sessionId,
    };

    this.#events.push(event);

    // Drop oldest events when over capacity
    if (this.#events.length > this.#maxEvents) {
      this.#events.splice(0, this.#events.length - this.#maxEvents);
    }

    return event;
  }

  /** Get events with optional filter. */
  getEvents(filter?: {
    name?: string;
    category?: string;
    since?: number;
    limit?: number;
  }): AnalyticsEvent[] {
    let result = this.#events.slice();

    if (filter?.name !== undefined) {
      const name = filter.name;
      result = result.filter((e) => e.name === name);
    }

    if (filter?.category !== undefined) {
      const category = filter.category;
      result = result.filter((e) => e.category === category);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((e) => e.timestamp >= since);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /** Get count of events by name. */
  getEventCount(name: string): number {
    return this.#events.filter((e) => e.name === name).length;
  }

  /** Get event names and their counts. */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const event of this.#events) {
      summary[event.name] = (summary[event.name] ?? 0) + 1;
    }
    return summary;
  }

  /**
   * Get a funnel: percentage of users who completed each step (events in order).
   * The first step is 100% by definition; subsequent steps are expressed as a
   * percentage of the first step's count.
   */
  getFunnel(eventNames: string[]): number[] {
    if (eventNames.length === 0) return [];

    const counts = eventNames.map((name) => this.getEventCount(name));
    const base = counts[0];

    if (base === 0) {
      return eventNames.map(() => 0);
    }

    return counts.map((count) => (count / base) * 100);
  }

  /** Remove all tracked events. */
  clear(): void {
    this.#events = [];
  }

  /** Total number of tracked events. */
  get totalEvents(): number {
    return this.#events.length;
  }

  /** Set global properties added to every future event. */
  setGlobalProperties(props: Record<string, unknown>): void {
    this.#globalProperties = { ...this.#globalProperties, ...props };
  }
}
