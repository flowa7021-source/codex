// @ts-check
// ─── Notification Queue ────────────────────────────────────────────────────────
// Queue-based notification manager with filtering, deduplication, and subscriptions.

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  data?: unknown;
}

export interface NotificationQueueOptions {
  maxSize?: number;       // default 100
  deduplicate?: boolean;  // default false — skip if same title+level exists unread
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `notif-${Date.now()}-${_counter}`;
}

// ─── NotificationQueue ────────────────────────────────────────────────────────

export class NotificationQueue {
  #queue: Notification[] = [];
  #maxSize: number;
  #deduplicate: boolean;
  #subscribers: Set<(notification: Notification) => void> = new Set();

  constructor(options?: NotificationQueueOptions) {
    this.#maxSize = options?.maxSize ?? 100;
    this.#deduplicate = options?.deduplicate ?? false;
  }

  /**
   * Add a new notification. Returns the created Notification.
   * When deduplicate is enabled, returns existing unread notification if same
   * title+level already exists unread.
   */
  add(level: NotificationLevel, title: string, message?: string, data?: unknown): Notification {
    if (this.#deduplicate) {
      const existing = this.#queue.find(
        (n) => !n.read && n.level === level && n.title === title,
      );
      if (existing) return existing;
    }

    const notification: Notification = {
      id: generateId(),
      level,
      title,
      message,
      timestamp: Date.now(),
      read: false,
      data,
    };

    this.#queue.push(notification);

    // Drop oldest when over capacity
    if (this.#queue.length > this.#maxSize) {
      this.#queue.splice(0, this.#queue.length - this.#maxSize);
    }

    // Notify subscribers
    for (const fn of this.#subscribers) {
      fn(notification);
    }

    return notification;
  }

  /**
   * Mark a notification as read by id.
   * Returns true if found and marked, false if not found.
   */
  markRead(id: string): boolean {
    const notification = this.#queue.find((n) => n.id === id);
    if (!notification) return false;
    notification.read = true;
    return true;
  }

  /** Mark all notifications as read. */
  markAllRead(): void {
    for (const notification of this.#queue) {
      notification.read = true;
    }
  }

  /**
   * Remove a notification by id.
   * Returns true if found and removed, false if not found.
   */
  remove(id: string): boolean {
    const index = this.#queue.findIndex((n) => n.id === id);
    if (index === -1) return false;
    this.#queue.splice(index, 1);
    return true;
  }

  /** Remove all notifications. */
  clear(): void {
    this.#queue = [];
  }

  /** Number of unread notifications. */
  get unreadCount(): number {
    return this.#queue.filter((n) => !n.read).length;
  }

  /** Total number of notifications. */
  get count(): number {
    return this.#queue.length;
  }

  /**
   * Get all notifications with optional filtering.
   * Returns a copy of the matching notifications.
   */
  getAll(filter?: { level?: NotificationLevel; unreadOnly?: boolean }): Notification[] {
    let result = this.#queue.slice();

    if (filter?.level !== undefined) {
      const level = filter.level;
      result = result.filter((n) => n.level === level);
    }

    if (filter?.unreadOnly) {
      result = result.filter((n) => !n.read);
    }

    return result;
  }

  /**
   * Subscribe to new notifications.
   * Returns an unsubscribe function.
   */
  subscribe(fn: (notification: Notification) => void): () => void {
    this.#subscribers.add(fn);
    return () => {
      this.#subscribers.delete(fn);
    };
  }
}
