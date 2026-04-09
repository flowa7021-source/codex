// ─── Unit Tests: HookManager ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HookManager } from '../../app/modules/hook-manager.js';

// ─── addAction / doAction ─────────────────────────────────────────────────────

describe('HookManager – addAction / doAction', () => {
  it('calls registered handler when doAction fires', () => {
    const hm = new HookManager();
    let called = false;
    hm.addAction('init', () => { called = true; });
    hm.doAction('init');
    assert.equal(called, true);
  });

  it('multiple handlers called in registration order (default priority)', () => {
    const hm = new HookManager();
    const order = [];
    hm.addAction('run', () => order.push('a'));
    hm.addAction('run', () => order.push('b'));
    hm.addAction('run', () => order.push('c'));
    hm.doAction('run');
    assert.deepEqual(order, ['a', 'b', 'c']);
  });

  it('passes arguments to handler', () => {
    const hm = new HookManager();
    let received;
    hm.addAction('save', (doc, opts) => { received = { doc, opts }; });
    hm.doAction('save', 'myDoc', { force: true });
    assert.deepEqual(received, { doc: 'myDoc', opts: { force: true } });
  });

  it('doAction on hook with no handlers is a no-op', () => {
    const hm = new HookManager();
    assert.doesNotThrow(() => hm.doAction('noop'));
  });
});

// ─── priority ordering ────────────────────────────────────────────────────────

describe('HookManager – action priority ordering', () => {
  it('lower priority number runs first', () => {
    const hm = new HookManager();
    const order = [];
    hm.addAction('go', () => order.push('p20'), 20);
    hm.addAction('go', () => order.push('p5'),  5);
    hm.addAction('go', () => order.push('p10'), 10);
    hm.doAction('go');
    assert.deepEqual(order, ['p5', 'p10', 'p20']);
  });

  it('same priority: FIFO order', () => {
    const hm = new HookManager();
    const order = [];
    hm.addAction('go', () => order.push(1), 10);
    hm.addAction('go', () => order.push(2), 10);
    hm.addAction('go', () => order.push(3), 10);
    hm.doAction('go');
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('mixed priorities maintain correct interleaving', () => {
    const hm = new HookManager();
    const order = [];
    hm.addAction('x', () => order.push('b'), 20);
    hm.addAction('x', () => order.push('a'), 1);
    hm.addAction('x', () => order.push('c'), 30);
    hm.doAction('x');
    assert.deepEqual(order, ['a', 'b', 'c']);
  });
});

// ─── removeAction ─────────────────────────────────────────────────────────────

describe('HookManager – removeAction', () => {
  it('removed handler is not called', () => {
    const hm = new HookManager();
    const log = [];
    const h = () => log.push('x');
    hm.addAction('evt', h);
    hm.removeAction('evt', h);
    hm.doAction('evt');
    assert.deepEqual(log, []);
  });

  it('only the removed handler is skipped; others still run', () => {
    const hm = new HookManager();
    const log = [];
    const h1 = () => log.push(1);
    const h2 = () => log.push(2);
    hm.addAction('evt', h1);
    hm.addAction('evt', h2);
    hm.removeAction('evt', h1);
    hm.doAction('evt');
    assert.deepEqual(log, [2]);
  });

  it('removing a handler not registered is a no-op', () => {
    const hm = new HookManager();
    assert.doesNotThrow(() => hm.removeAction('evt', () => {}));
  });

  it('returned remove fn from addAction() works', () => {
    const hm = new HookManager();
    const log = [];
    const remove = hm.addAction('evt', () => log.push('fired'));
    remove();
    hm.doAction('evt');
    assert.deepEqual(log, []);
  });
});

// ─── addFilter / applyFilters ─────────────────────────────────────────────────

describe('HookManager – addFilter / applyFilters', () => {
  it('returns original value when no filters registered', () => {
    const hm = new HookManager();
    assert.equal(hm.applyFilters('title', 'Hello'), 'Hello');
  });

  it('single filter transforms the value', () => {
    const hm = new HookManager();
    hm.addFilter('text', (v) => String(v).toUpperCase());
    assert.equal(hm.applyFilters('text', 'hello'), 'HELLO');
  });

  it('value is threaded through multiple filters in order', () => {
    const hm = new HookManager();
    hm.addFilter('n', (v) => Number(v) + 1);
    hm.addFilter('n', (v) => Number(v) * 2);
    hm.addFilter('n', (v) => Number(v) - 3);
    // (0 + 1) * 2 - 3 = -1
    assert.equal(hm.applyFilters('n', 0), -1);
  });

  it('passes extra args to each filter handler', () => {
    const hm = new HookManager();
    const seen = [];
    hm.addFilter('f', (v, ...args) => { seen.push(args); return v; });
    hm.applyFilters('f', 'val', 'extra1', 'extra2');
    assert.deepEqual(seen, [['extra1', 'extra2']]);
  });

  it('works with numeric values', () => {
    const hm = new HookManager();
    hm.addFilter('tax', (price) => Number(price) * 1.1);
    assert.ok(Math.abs(/** @type {number} */(hm.applyFilters('tax', 100)) - 110) < 0.001);
  });

  it('works with object values', () => {
    const hm = new HookManager();
    hm.addFilter('config', (cfg) => ({ .../** @type {object} */(cfg), debug: true }));
    const result = /** @type {Record<string,unknown>} */(hm.applyFilters('config', { env: 'prod' }));
    assert.deepEqual(result, { env: 'prod', debug: true });
  });
});

// ─── filter priority ──────────────────────────────────────────────────────────

describe('HookManager – filter priority', () => {
  it('lower priority filter runs first', () => {
    const hm = new HookManager();
    const order = [];
    hm.addFilter('chain', (v) => { order.push('p20'); return v; }, 20);
    hm.addFilter('chain', (v) => { order.push('p5');  return v; }, 5);
    hm.applyFilters('chain', 'x');
    assert.deepEqual(order, ['p5', 'p20']);
  });

  it('same priority: FIFO order', () => {
    const hm = new HookManager();
    const order = [];
    hm.addFilter('f', (v) => { order.push(1); return v; }, 10);
    hm.addFilter('f', (v) => { order.push(2); return v; }, 10);
    hm.applyFilters('f', 0);
    assert.deepEqual(order, [1, 2]);
  });
});

// ─── removeFilter ─────────────────────────────────────────────────────────────

describe('HookManager – removeFilter', () => {
  it('removed filter is not applied', () => {
    const hm = new HookManager();
    const double = (v) => Number(v) * 2;
    hm.addFilter('val', double);
    hm.removeFilter('val', double);
    assert.equal(hm.applyFilters('val', 5), 5);
  });

  it('only the removed filter is skipped', () => {
    const hm = new HookManager();
    const addOne  = (v) => Number(v) + 1;
    const addTen  = (v) => Number(v) + 10;
    hm.addFilter('val', addOne);
    hm.addFilter('val', addTen);
    hm.removeFilter('val', addOne);
    assert.equal(hm.applyFilters('val', 0), 10);
  });

  it('returned remove fn from addFilter() works', () => {
    const hm = new HookManager();
    const remove = hm.addFilter('val', (v) => Number(v) * 99);
    remove();
    assert.equal(hm.applyFilters('val', 1), 1);
  });

  it('removing unregistered filter is a no-op', () => {
    const hm = new HookManager();
    assert.doesNotThrow(() => hm.removeFilter('val', (v) => v));
  });
});

// ─── hasHook ──────────────────────────────────────────────────────────────────

describe('HookManager – hasHook', () => {
  it('returns false for unknown hook', () => {
    const hm = new HookManager();
    assert.equal(hm.hasHook('nope'), false);
  });

  it('returns true after addAction', () => {
    const hm = new HookManager();
    hm.addAction('save', () => {});
    assert.equal(hm.hasHook('save'), true);
  });

  it('returns true after addFilter', () => {
    const hm = new HookManager();
    hm.addFilter('text', (v) => v);
    assert.equal(hm.hasHook('text'), true);
  });

  it('returns false after all handlers removed via removeAction', () => {
    const hm = new HookManager();
    const h = () => {};
    hm.addAction('evt', h);
    hm.removeAction('evt', h);
    assert.equal(hm.hasHook('evt'), false);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('HookManager – count', () => {
  it('returns 0 for unknown hook', () => {
    const hm = new HookManager();
    assert.equal(hm.count('nope'), 0);
  });

  it('counts action handlers', () => {
    const hm = new HookManager();
    hm.addAction('go', () => {});
    hm.addAction('go', () => {});
    assert.equal(hm.count('go'), 2);
  });

  it('counts filter handlers', () => {
    const hm = new HookManager();
    hm.addFilter('val', (v) => v);
    hm.addFilter('val', (v) => v);
    hm.addFilter('val', (v) => v);
    assert.equal(hm.count('val'), 3);
  });

  it('counts both action and filter handlers combined', () => {
    const hm = new HookManager();
    hm.addAction('mixed', () => {});
    hm.addFilter('mixed', (v) => v);
    assert.equal(hm.count('mixed'), 2);
  });

  it('decrements after removeAction', () => {
    const hm = new HookManager();
    const h = () => {};
    hm.addAction('go', h);
    hm.addAction('go', () => {});
    hm.removeAction('go', h);
    assert.equal(hm.count('go'), 1);
  });
});

// ─── removeAll ────────────────────────────────────────────────────────────────

describe('HookManager – removeAll', () => {
  it('removes all action handlers', () => {
    const hm = new HookManager();
    const log = [];
    hm.addAction('evt', () => log.push(1));
    hm.addAction('evt', () => log.push(2));
    hm.removeAll('evt');
    hm.doAction('evt');
    assert.deepEqual(log, []);
  });

  it('removes all filter handlers', () => {
    const hm = new HookManager();
    hm.addFilter('val', (v) => Number(v) * 99);
    hm.addFilter('val', (v) => Number(v) + 99);
    hm.removeAll('val');
    assert.equal(hm.applyFilters('val', 1), 1);
  });

  it('hasHook returns false after removeAll', () => {
    const hm = new HookManager();
    hm.addAction('evt', () => {});
    hm.removeAll('evt');
    assert.equal(hm.hasHook('evt'), false);
  });

  it('count returns 0 after removeAll', () => {
    const hm = new HookManager();
    hm.addAction('evt', () => {});
    hm.addFilter('evt', (v) => v);
    hm.removeAll('evt');
    assert.equal(hm.count('evt'), 0);
  });

  it('removeAll on unknown hook is a no-op', () => {
    const hm = new HookManager();
    assert.doesNotThrow(() => hm.removeAll('ghost'));
  });

  it('removeAll only affects the named hook', () => {
    const hm = new HookManager();
    const log = [];
    hm.addAction('a', () => log.push('a'));
    hm.addAction('b', () => log.push('b'));
    hm.removeAll('a');
    hm.doAction('a');
    hm.doAction('b');
    assert.deepEqual(log, ['b']);
  });
});
