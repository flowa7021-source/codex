// @ts-check
// ─── Logger ───────────────────────────────────────────────────────────────────
// Structured logger with levels, transports, child loggers, and memory capture.

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
}

export type Transport = (entry: LogEntry) => void;

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  transports?: Transport[];
  silent?: boolean;
}

// ─── Level ordering ───────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// ─── Default console transport ────────────────────────────────────────────────

function defaultConsoleTransport(entry: LogEntry): void {
  const msg = entry.message;
  switch (entry.level) {
    case 'debug':
      console.debug(msg, ...(entry.context !== undefined ? [entry.context] : []));
      break;
    case 'info':
      console.info(msg, ...(entry.context !== undefined ? [entry.context] : []));
      break;
    case 'warn':
      console.warn(msg, ...(entry.context !== undefined ? [entry.context] : []));
      break;
    case 'error':
      console.error(
        msg,
        ...(entry.error !== undefined ? [entry.error] : []),
        ...(entry.context !== undefined ? [entry.context] : []),
      );
      break;
  }
}

// ─── Logger ───────────────────────────────────────────────────────────────────

export class Logger {
  #level: LogLevel;
  #prefix: string;
  #transports: Transport[];
  #silent: boolean;
  #memoryStore: LogEntry[] | null;
  #parentContext: Record<string, unknown>;

  constructor(options?: LoggerOptions) {
    this.#silent = options?.silent ?? false;
    this.#level = this.#silent ? 'silent' : (options?.level ?? 'info');
    this.#prefix = options?.prefix ?? '';
    this.#parentContext = {};
    this.#memoryStore = null;

    if (options?.transports !== undefined) {
      this.#transports = [...options.transports];
    } else {
      this.#transports = [defaultConsoleTransport];
    }
  }

  // ─── Private factory for child / memory loggers ───────────────────────────

  static #fromParts(
    level: LogLevel,
    prefix: string,
    silent: boolean,
    transports: Transport[],
    memoryStore: LogEntry[] | null,
    parentContext: Record<string, unknown>,
  ): Logger {
    const logger = new Logger();
    logger.#level = level;
    logger.#prefix = prefix;
    logger.#silent = silent;
    logger.#transports = transports;
    logger.#memoryStore = memoryStore;
    logger.#parentContext = parentContext;
    return logger;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  #shouldLog(level: LogLevel): boolean {
    if (this.#silent) return false;
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.#level];
  }

  #formatMessage(message: string): string {
    return this.#prefix ? `${this.#prefix} ${message}` : message;
  }

  #mergeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    const merged = { ...this.#parentContext, ...(context ?? {}) };
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  #emit(entry: LogEntry): void {
    if (this.#memoryStore !== null) {
      this.#memoryStore.push(entry);
    }
    for (const transport of this.#transports) {
      transport(entry);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.#shouldLog('debug')) return;
    this.#emit({
      level: 'debug',
      message: this.#formatMessage(message),
      timestamp: Date.now(),
      context: this.#mergeContext(context),
    });
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.#shouldLog('info')) return;
    this.#emit({
      level: 'info',
      message: this.#formatMessage(message),
      timestamp: Date.now(),
      context: this.#mergeContext(context),
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.#shouldLog('warn')) return;
    this.#emit({
      level: 'warn',
      message: this.#formatMessage(message),
      timestamp: Date.now(),
      context: this.#mergeContext(context),
    });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.#shouldLog('error')) return;
    this.#emit({
      level: 'error',
      message: this.#formatMessage(message),
      timestamp: Date.now(),
      context: this.#mergeContext(context),
      error,
    });
  }

  /** Change minimum log level. */
  setLevel(level: LogLevel): void {
    this.#level = level;
    this.#silent = level === 'silent';
  }

  /** Add a transport. */
  addTransport(transport: Transport): void {
    this.#transports.push(transport);
  }

  /** Create a child logger with additional context merged in. */
  child(context: Record<string, unknown>): Logger {
    return Logger.#fromParts(
      this.#level,
      this.#prefix,
      this.#silent,
      this.#transports,
      this.#memoryStore,
      { ...this.#parentContext, ...context },
    );
  }

  /** Get all entries captured by the memory transport (if enabled). */
  getEntries(): LogEntry[] {
    return this.#memoryStore !== null ? [...this.#memoryStore] : [];
  }

  // ─── Internal: attach memory store (used by createMemoryLogger) ───────────

  /** @internal */
  _attachMemoryStore(store: LogEntry[]): void {
    this.#memoryStore = store;
  }
}

// ─── createMemoryLogger ───────────────────────────────────────────────────────

/** Create a logger that captures entries in memory (useful for tests). */
export function createMemoryLogger(options?: LoggerOptions): Logger {
  const memoryStore: LogEntry[] = [];
  const logger = new Logger({ ...options, transports: options?.transports ?? [] });
  logger._attachMemoryStore(memoryStore);
  return logger;
}


/** Default module-level logger instance. */
export const logger = new Logger();

/** Convenience function: log at debug level on the default logger. */
export function debug(message: string, context?: Record<string, unknown>): void {
  logger.debug(message, context);
}

/** Convenience function: log at info level on the default logger. */
export function info(message: string, context?: Record<string, unknown>): void {
  logger.info(message, context);
}

/** Convenience function: log at warn level on the default logger. */
export function warn(message: string, context?: Record<string, unknown>): void {
  logger.warn(message, context);
}

/** Convenience function: log at error level on the default logger. */
export function error(message: string, err?: Error, context?: Record<string, unknown>): void {
  logger.error(message, err, context);
}
