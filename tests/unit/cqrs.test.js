// ─── Unit Tests: CQRS ───────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  CommandBus,
  QueryBus,
  createCommandBus,
  createQueryBus,
} from '../../app/modules/cqrs.js';

// ─── CommandBus ─────────────────────────────────────────────────────────────

describe('CommandBus', () => {
  let bus;

  beforeEach(() => {
    bus = new CommandBus();
  });

  it('starts with no handlers', () => {
    assert.equal(bus.hasHandler('Anything'), false);
  });

  it('register() adds a handler that hasHandler() reports', () => {
    bus.register('DoSomething', () => {});
    assert.equal(bus.hasHandler('DoSomething'), true);
  });

  it('dispatch() calls the registered handler with the command', async () => {
    const received = [];
    bus.register('CreateUser', (cmd) => { received.push(cmd); });
    await bus.dispatch({ type: 'CreateUser', payload: { name: 'Alice' } });
    assert.equal(received.length, 1);
    assert.deepEqual(received[0].payload, { name: 'Alice' });
  });

  it('dispatch() throws for an unregistered command type', async () => {
    await assert.rejects(
      () => bus.dispatch({ type: 'Unknown', payload: null }),
      { message: /No handler registered for command type: Unknown/ },
    );
  });

  it('dispatch() supports async handlers', async () => {
    let executed = false;
    bus.register('AsyncCmd', async () => {
      await new Promise((r) => setTimeout(r, 1));
      executed = true;
    });
    await bus.dispatch({ type: 'AsyncCmd', payload: null });
    assert.equal(executed, true);
  });

  it('register() overwrites a previous handler for the same type', async () => {
    const calls = [];
    bus.register('Overwrite', () => { calls.push('first'); });
    bus.register('Overwrite', () => { calls.push('second'); });
    await bus.dispatch({ type: 'Overwrite', payload: null });
    assert.deepEqual(calls, ['second']);
  });

  it('dispatch() with sync handler returns a resolved promise', async () => {
    bus.register('Sync', () => {});
    const result = bus.dispatch({ type: 'Sync', payload: null });
    assert.ok(result instanceof Promise);
    await result; // should not throw
  });

  it('dispatch() propagates errors from handler', async () => {
    bus.register('Fail', () => { throw new Error('handler error'); });
    await assert.rejects(
      () => bus.dispatch({ type: 'Fail', payload: null }),
      { message: 'handler error' },
    );
  });

  it('supports multiple different command types', async () => {
    const log = [];
    bus.register('A', () => log.push('A'));
    bus.register('B', () => log.push('B'));
    bus.register('C', () => log.push('C'));
    await bus.dispatch({ type: 'B', payload: null });
    await bus.dispatch({ type: 'A', payload: null });
    assert.deepEqual(log, ['B', 'A']);
  });

  it('hasHandler() returns false for unregistered types', () => {
    bus.register('Exists', () => {});
    assert.equal(bus.hasHandler('Exists'), true);
    assert.equal(bus.hasHandler('NotExists'), false);
  });
});

// ─── QueryBus ───────────────────────────────────────────────────────────────

describe('QueryBus', () => {
  let bus;

  beforeEach(() => {
    bus = new QueryBus();
  });

  it('starts with no handlers', () => {
    assert.equal(bus.hasHandler('AnyQuery'), false);
  });

  it('register() adds a handler that hasHandler() reports', () => {
    bus.register('GetUser', () => null);
    assert.equal(bus.hasHandler('GetUser'), true);
  });

  it('execute() returns the result from the handler', async () => {
    bus.register('GetUser', (q) => ({ id: q.params, name: 'Alice' }));
    const result = await bus.execute({ type: 'GetUser', params: '42' });
    assert.deepEqual(result, { id: '42', name: 'Alice' });
  });

  it('execute() throws for an unregistered query type', async () => {
    await assert.rejects(
      () => bus.execute({ type: 'Unknown' }),
      { message: /No handler registered for query type: Unknown/ },
    );
  });

  it('execute() supports async handlers', async () => {
    bus.register('SlowQuery', async (q) => {
      await new Promise((r) => setTimeout(r, 1));
      return q.params;
    });
    const result = await bus.execute({ type: 'SlowQuery', params: 'data' });
    assert.equal(result, 'data');
  });

  it('register() overwrites a previous handler for the same type', async () => {
    bus.register('Replace', () => 'old');
    bus.register('Replace', () => 'new');
    const result = await bus.execute({ type: 'Replace' });
    assert.equal(result, 'new');
  });

  it('execute() propagates errors from handler', async () => {
    bus.register('Boom', () => { throw new Error('query failed'); });
    await assert.rejects(
      () => bus.execute({ type: 'Boom' }),
      { message: 'query failed' },
    );
  });

  it('execute() with no params passes undefined for params', async () => {
    let receivedParams;
    bus.register('NoParams', (q) => { receivedParams = q.params; return 'ok'; });
    await bus.execute({ type: 'NoParams' });
    assert.equal(receivedParams, undefined);
  });

  it('supports multiple different query types', async () => {
    bus.register('GetA', () => 'A');
    bus.register('GetB', () => 'B');
    const a = await bus.execute({ type: 'GetA' });
    const b = await bus.execute({ type: 'GetB' });
    assert.equal(a, 'A');
    assert.equal(b, 'B');
  });

  it('hasHandler() returns false for unregistered types', () => {
    bus.register('Registered', () => null);
    assert.equal(bus.hasHandler('Registered'), true);
    assert.equal(bus.hasHandler('NotRegistered'), false);
  });
});

// ─── Factory Functions ──────────────────────────────────────────────────────

describe('createCommandBus()', () => {
  it('returns a CommandBus instance', () => {
    const bus = createCommandBus();
    assert.ok(bus instanceof CommandBus);
  });

  it('returned bus works for register + dispatch', async () => {
    const bus = createCommandBus();
    let called = false;
    bus.register('Test', () => { called = true; });
    await bus.dispatch({ type: 'Test', payload: null });
    assert.equal(called, true);
  });
});

describe('createQueryBus()', () => {
  it('returns a QueryBus instance', () => {
    const bus = createQueryBus();
    assert.ok(bus instanceof QueryBus);
  });

  it('returned bus works for register + execute', async () => {
    const bus = createQueryBus();
    bus.register('Sum', (q) => q.params.a + q.params.b);
    const result = await bus.execute({ type: 'Sum', params: { a: 3, b: 7 } });
    assert.equal(result, 10);
  });
});

// ─── Integration: CommandBus + QueryBus ─────────────────────────────────────

describe('CommandBus + QueryBus integration', () => {
  it('commands mutate state, queries read it', async () => {
    const commandBus = createCommandBus();
    const queryBus = createQueryBus();

    // Shared in-memory state
    const users = [];

    commandBus.register('AddUser', (cmd) => {
      users.push(cmd.payload);
    });

    queryBus.register('ListUsers', () => [...users]);
    queryBus.register('FindUser', (q) => users.find((u) => u.id === q.params));

    await commandBus.dispatch({ type: 'AddUser', payload: { id: 1, name: 'Alice' } });
    await commandBus.dispatch({ type: 'AddUser', payload: { id: 2, name: 'Bob' } });

    const all = await queryBus.execute({ type: 'ListUsers' });
    assert.equal(all.length, 2);

    const alice = await queryBus.execute({ type: 'FindUser', params: 1 });
    assert.deepEqual(alice, { id: 1, name: 'Alice' });

    const unknown = await queryBus.execute({ type: 'FindUser', params: 99 });
    assert.equal(unknown, undefined);
  });
});
