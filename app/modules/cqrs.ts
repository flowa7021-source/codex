// @ts-check
// ─── CQRS (Command Query Responsibility Segregation) ────────────────────────
// Separate write (command) and read (query) paths through dedicated buses
// with pluggable handlers.

// ─── Types ──────────────────────────────────────────────────────────────────

/** A command representing an intent to change state. */
export interface Command {
  type: string;
  payload: unknown;
}

/** A query representing a request for data. */
export interface Query {
  type: string;
  params?: unknown;
}

/** Handler that processes a command. */
export type CommandHandler<C extends Command> = (command: C) => void | Promise<void>;

/** Handler that processes a query and returns a result. */
export type QueryHandler<Q extends Query, R> = (query: Q) => R | Promise<R>;

// ─── CommandBus ─────────────────────────────────────────────────────────────

/**
 * A bus that routes commands to their registered handlers.
 *
 * @example
 *   const bus = createCommandBus();
 *   bus.register('CreateUser', (cmd) => { console.log('Creating', cmd.payload); });
 *   await bus.dispatch({ type: 'CreateUser', payload: { name: 'Alice' } });
 */
export class CommandBus {
  private _handlers: Map<string, CommandHandler<any>>;

  constructor() {
    this._handlers = new Map();
  }

  /** Register a handler for a command type. */
  register<C extends Command>(type: string, handler: CommandHandler<C>): void {
    this._handlers.set(type, handler as CommandHandler<any>);
  }

  /** Dispatch a command to its registered handler. Throws if none is registered. */
  async dispatch(command: Command): Promise<void> {
    const handler = this._handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }
    await handler(command);
  }

  /** Check whether a handler is registered for a command type. */
  hasHandler(type: string): boolean {
    return this._handlers.has(type);
  }
}

// ─── QueryBus ───────────────────────────────────────────────────────────────

/**
 * A bus that routes queries to their registered handlers and returns results.
 *
 * @example
 *   const bus = createQueryBus();
 *   bus.register('GetUser', (q) => ({ id: q.params, name: 'Alice' }));
 *   const user = await bus.execute({ type: 'GetUser', params: '1' });
 */
export class QueryBus {
  private _handlers: Map<string, QueryHandler<any, any>>;

  constructor() {
    this._handlers = new Map();
  }

  /** Register a handler for a query type. */
  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void {
    this._handlers.set(type, handler as QueryHandler<any, any>);
  }

  /** Execute a query and return the result. Throws if no handler is registered. */
  async execute<R>(query: Query): Promise<R> {
    const handler = this._handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${query.type}`);
    }
    return handler(query) as Promise<R>;
  }

  /** Check whether a handler is registered for a query type. */
  hasHandler(type: string): boolean {
    return this._handlers.has(type);
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/** Create a new CommandBus instance. */
export function createCommandBus(): CommandBus {
  return new CommandBus();
}

/** Create a new QueryBus instance. */
export function createQueryBus(): QueryBus {
  return new QueryBus();
}
