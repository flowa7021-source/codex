// ─── Unit Tests: ServiceLocator ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ServiceLocator,
  GlobalServiceLocator,
  createServiceLocator,
} from '../../app/modules/service-locator.js';

// ─── register / get (transient) ───────────────────────────────────────────────

describe('ServiceLocator – register / get (transient)', () => {
  it('get returns the value produced by the factory', () => {
    const sl = new ServiceLocator();
    sl.register('answer', () => 42);
    assert.equal(sl.get('answer'), 42);
  });

  it('transient factory is called on each get', () => {
    const sl = new ServiceLocator();
    let calls = 0;
    sl.register('counter', () => ++calls, false);
    assert.equal(sl.get('counter'), 1);
    assert.equal(sl.get('counter'), 2);
    assert.equal(sl.get('counter'), 3);
  });

  it('different transient calls return distinct object instances', () => {
    const sl = new ServiceLocator();
    sl.register('obj', () => ({ id: Math.random() }), false);
    const a = sl.get('obj');
    const b = sl.get('obj');
    assert.notStrictEqual(a, b);
  });
});

// ─── register / get (singleton) ───────────────────────────────────────────────

describe('ServiceLocator – register / get (singleton)', () => {
  it('singleton always returns the same instance', () => {
    const sl = new ServiceLocator();
    sl.register('svc', () => ({ id: Math.random() }), true);
    const a = sl.get('svc');
    const b = sl.get('svc');
    assert.strictEqual(a, b);
  });

  it('singleton factory is called exactly once', () => {
    const sl = new ServiceLocator();
    let calls = 0;
    sl.register('once', () => { calls++; return 'value'; }, true);
    sl.get('once');
    sl.get('once');
    sl.get('once');
    assert.equal(calls, 1);
  });
});

// ─── registerInstance ─────────────────────────────────────────────────────────

describe('ServiceLocator – registerInstance', () => {
  it('resolves to the exact instance registered', () => {
    const sl = new ServiceLocator();
    const obj = { tag: 'instance' };
    sl.registerInstance('myObj', obj);
    assert.strictEqual(sl.get('myObj'), obj);
  });

  it('registerInstance always returns the same reference', () => {
    const sl = new ServiceLocator();
    const arr = [1, 2, 3];
    sl.registerInstance('arr', arr);
    assert.strictEqual(sl.get('arr'), sl.get('arr'));
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('ServiceLocator – has', () => {
  it('returns true for a registered key', () => {
    const sl = new ServiceLocator();
    sl.register('exists', () => 1);
    assert.equal(sl.has('exists'), true);
  });

  it('returns false for an unknown key', () => {
    const sl = new ServiceLocator();
    assert.equal(sl.has('missing'), false);
  });
});

// ─── get throws on unknown key ────────────────────────────────────────────────

describe('ServiceLocator – get unknown key', () => {
  it('throws when the key has not been registered', () => {
    const sl = new ServiceLocator();
    assert.throws(() => sl.get('ghost'), /service "ghost" is not registered/i);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('ServiceLocator – reset', () => {
  it('reset(key) clears singleton cache so a new instance is produced', () => {
    const sl = new ServiceLocator();
    sl.register('cached', () => ({ id: Math.random() }), true);
    const first = sl.get('cached');
    sl.reset('cached');
    const second = sl.get('cached');
    assert.notStrictEqual(first, second);
  });

  it('reset() with no argument clears all singleton caches', () => {
    const sl = new ServiceLocator();
    sl.register('a', () => ({ id: Math.random() }), true);
    sl.register('b', () => ({ id: Math.random() }), true);
    const a1 = sl.get('a');
    const b1 = sl.get('b');
    sl.reset();
    const a2 = sl.get('a');
    const b2 = sl.get('b');
    assert.notStrictEqual(a1, a2);
    assert.notStrictEqual(b1, b2);
  });

  it('reset(key) for unknown key is a no-op', () => {
    const sl = new ServiceLocator();
    assert.doesNotThrow(() => sl.reset('nonexistent'));
  });

  it('reset does not remove the registration, only the cache', () => {
    const sl = new ServiceLocator();
    sl.register('persists', () => 'hello', true);
    sl.get('persists');
    sl.reset('persists');
    assert.equal(sl.has('persists'), true);
    assert.equal(sl.get('persists'), 'hello');
  });
});

// ─── keys ─────────────────────────────────────────────────────────────────────

describe('ServiceLocator – keys', () => {
  it('returns all registered keys', () => {
    const sl = new ServiceLocator();
    sl.register('x', () => 1);
    sl.register('y', () => 2);
    sl.registerInstance('z', 3);
    const keys = sl.keys().sort();
    assert.deepEqual(keys, ['x', 'y', 'z']);
  });

  it('returns empty array when nothing is registered', () => {
    const sl = new ServiceLocator();
    assert.deepEqual(sl.keys(), []);
  });
});

// ─── GlobalServiceLocator ─────────────────────────────────────────────────────

describe('GlobalServiceLocator', () => {
  it('is an instance of ServiceLocator', () => {
    assert.ok(GlobalServiceLocator instanceof ServiceLocator);
  });

  it('is the same reference on repeated imports (module singleton)', async () => {
    // Re-import to confirm the exported value is stable.
    const mod = await import('../../app/modules/service-locator.js');
    assert.strictEqual(mod.GlobalServiceLocator, GlobalServiceLocator);
  });
});

// ─── createServiceLocator factory ─────────────────────────────────────────────

describe('createServiceLocator', () => {
  it('returns a ServiceLocator instance', () => {
    const sl = createServiceLocator();
    assert.ok(sl instanceof ServiceLocator);
  });

  it('each call returns a distinct, independent instance', () => {
    const sl1 = createServiceLocator();
    const sl2 = createServiceLocator();
    assert.notStrictEqual(sl1, sl2);

    sl1.register('shared-key', () => 'from-sl1');
    assert.equal(sl2.has('shared-key'), false);
  });
});
