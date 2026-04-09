// @ts-check
// ─── Structured Logger ───────────────────────────────────────────────────────
// Provides levelled, contextual logging with history tracking and child loggers.

/**
 * Log levels in ascending severity order.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A log entry.
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  data?: unknown;
}

/**
 * Logger configuration.
 */
export interface LoggerConfig {
  /** Minimum level to emit (default: 'info'). */
  level?: LogLevel;
  /** Context prefix for messages. */
  context?: string;
  /** Max entries to keep in history (default: 100). */
  maxHistory?: number;
  /** Custom log handler called for every emitted entry. */
  onLog?: (entry: LogEntry) => void;
}

// ─── Level ordering ──────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── Logger class ────────────────────────────────────────────────────────────

/**
 * A logger instance.
 */
export class Logger {
  readonly config: LoggerConfig;
  #history: LogEntry[] = [];

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: 'info',
      maxHistory: 100,
      ...config,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  #emit(level: LogLevel, message: string, data?: unknown): void {
    const minLevel = this.config.level ?? 'info';
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
    };

    if (this.config.context !== undefined) {
      entry.context = this.config.context;
    }

    if (data !== undefined) {
      entry.data = data;
    }

    // Append to history, dropping the oldest entry when full.
    const maxHistory = this.config.maxHistory ?? 100;
    if (this.#history.length >= maxHistory) {
      this.#history.shift();
    }
    this.#history.push(entry);

    // Invoke custom handler if provided.
    if (typeof this.config.onLog === 'function') {
      this.config.onLog(entry);
    }

    // Write to console.
    const prefix = this.config.context ? `[${this.config.context}]` : '';
    const label = prefix ? `${prefix} ${message}` : message;

    if (data !== undefined) {
      console[level](label, data);
    } else {
      console[level](label);
    }
  }

  // ─── Public logging API ──────────────────────────────────────────────────

  debug(message: string, data?: unknown): void {
    this.#emit('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.#emit('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.#emit('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.#emit('error', message, data);
  }

  // ─── History ─────────────────────────────────────────────────────────────

  /** Get all logged entries (up to maxHistory). */
  getHistory(): LogEntry[] {
    return this.#history.slice();
  }

  /** Clear the log history. */
  clearHistory(): void {
    this.#history = [];
  }

  // ─── Child logger ─────────────────────────────────────────────────────────

  /**
   * Create a child logger with additional context.
   * Inherits parent config; the context is appended with a '.' separator.
   */
  child(context: string): Logger {
    const parentContext = this.config.context;
    const childContext = parentContext ? `${parentContext}.${context}` : context;
    return new Logger({
      ...this.config,
      context: childContext,
    });
  }
}

// ─── Global default logger ───────────────────────────────────────────────────

/** Default global logger instance. */
export const logger = new Logger();

// ─── Convenience functions ───────────────────────────────────────────────────

/** Log a debug message using the global logger. */
export function debug(message: string, data?: unknown): void {
  logger.debug(message, data);
}

/** Log an info message using the global logger. */
export function info(message: string, data?: unknown): void {
  logger.info(message, data);
}

/** Log a warn message using the global logger. */
export function warn(message: string, data?: unknown): void {
  logger.warn(message, data);
}

/** Log an error message using the global logger. */
export function error(message: string, data?: unknown): void {
  logger.error(message, data);
}
