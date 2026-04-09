// @ts-check
// ─── Session Manager ──────────────────────────────────────────────────────────
// In-memory user session state management with TTL and pruning.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId?: string;
  data: Record<string, unknown>;
  createdAt: number;
  lastActiveAt: number;
  expiresAt?: number;
}

export interface SessionManagerOptions {
  ttl?: number;
  maxSessions?: number;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _sessionCounter = 0;

function generateSessionId(): string {
  _sessionCounter += 1;
  return `sess-${Date.now()}-${_sessionCounter}`;
}

// ─── SessionManager ───────────────────────────────────────────────────────────

const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

export class SessionManager {
  #sessions: Map<string, Session> = new Map();
  #ttl: number;
  #maxSessions: number;

  constructor(options?: SessionManagerOptions) {
    this.#ttl = options?.ttl ?? DEFAULT_TTL;
    this.#maxSessions = options?.maxSessions ?? 100;
  }

  /** Create a new session. Returns the session. */
  create(userId?: string, data?: Record<string, unknown>): Session {
    // Drop oldest session if at capacity
    if (this.#sessions.size >= this.#maxSessions) {
      // Find the oldest session by createdAt
      let oldestId: string | undefined;
      let oldestTime = Infinity;
      for (const [id, session] of this.#sessions) {
        if (session.createdAt < oldestTime) {
          oldestTime = session.createdAt;
          oldestId = id;
        }
      }
      if (oldestId !== undefined) {
        this.#sessions.delete(oldestId);
      }
    }

    const now = Date.now();
    const session: Session = {
      id: generateSessionId(),
      userId,
      data: data ? { ...data } : {},
      createdAt: now,
      lastActiveAt: now,
      expiresAt: now + this.#ttl,
    };

    this.#sessions.set(session.id, session);
    return session;
  }

  /** Get a session by id. Returns null if not found or expired. */
  get(id: string): Session | null {
    const session = this.#sessions.get(id);
    if (!session) return null;

    if (this.#isExpired(session)) {
      this.#sessions.delete(id);
      return null;
    }

    return session;
  }

  /** Update session data (merges with existing). Refreshes lastActiveAt. */
  update(id: string, data: Record<string, unknown>): boolean {
    const session = this.get(id);
    if (!session) return false;

    session.data = { ...session.data, ...data };
    session.lastActiveAt = Date.now();
    return true;
  }

  /** Destroy a session. */
  destroy(id: string): boolean {
    return this.#sessions.delete(id);
  }

  /** Get all active (non-expired) sessions. */
  getActiveSessions(): Session[] {
    const active: Session[] = [];
    for (const [id, session] of this.#sessions) {
      if (this.#isExpired(session)) {
        this.#sessions.delete(id);
      } else {
        active.push(session);
      }
    }
    return active;
  }

  /** Remove expired sessions. Returns count removed. */
  prune(): number {
    let count = 0;
    for (const [id, session] of this.#sessions) {
      if (this.#isExpired(session)) {
        this.#sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Touch a session (update lastActiveAt and reset TTL). */
  touch(id: string): boolean {
    const session = this.get(id);
    if (!session) return false;

    const now = Date.now();
    session.lastActiveAt = now;
    session.expiresAt = now + this.#ttl;
    return true;
  }

  /** Number of active sessions (excludes expired). */
  get activeCount(): number {
    return this.getActiveSessions().length;
  }

  /** Get all sessions for a userId. */
  getUserSessions(userId: string): Session[] {
    const result: Session[] = [];
    for (const [id, session] of this.#sessions) {
      if (session.userId === userId && !this.#isExpired(session)) {
        result.push(session);
      } else if (this.#isExpired(session)) {
        this.#sessions.delete(id);
      }
    }
    return result;
  }

  #isExpired(session: Session): boolean {
    if (session.expiresAt === undefined) return false;
    return Date.now() > session.expiresAt;
  }
}
