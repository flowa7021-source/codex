// ─── Unit Tests: Entity Component System ────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { World, createWorld } from '../../app/modules/ecs.js';

// ─── createWorld factory ────────────────────────────────────────────────────

describe('createWorld', () => {
  it('returns a World instance', () => {
    const world = createWorld();
    assert.ok(world instanceof World);
  });
});

// ─── Entity lifecycle ───────────────────────────────────────────────────────

describe('World – entity lifecycle', () => {
  it('creates entities with sequential IDs', () => {
    const w = createWorld();
    assert.equal(w.createEntity(), 0);
    assert.equal(w.createEntity(), 1);
    assert.equal(w.createEntity(), 2);
  });

  it('entityCount reflects alive entities', () => {
    const w = createWorld();
    assert.equal(w.entityCount, 0);
    const a = w.createEntity();
    const b = w.createEntity();
    assert.equal(w.entityCount, 2);
    w.destroyEntity(a);
    assert.equal(w.entityCount, 1);
    w.destroyEntity(b);
    assert.equal(w.entityCount, 0);
  });

  it('destroyEntity is idempotent for missing IDs', () => {
    const w = createWorld();
    w.destroyEntity(999); // should not throw
    assert.equal(w.entityCount, 0);
  });

  it('destroyEntity removes all components of the entity', () => {
    const w = createWorld();
    const e = w.createEntity();
    w.addComponent(e, 'pos', { x: 1, y: 2 });
    w.addComponent(e, 'vel', { dx: 0, dy: 1 });
    w.destroyEntity(e);
    // Entity gone — cannot add component anymore
    assert.throws(() => w.addComponent(e, 'pos', {}));
  });
});

// ─── Component operations ───────────────────────────────────────────────────

describe('World – component operations', () => {
  it('addComponent / getComponent round-trip', () => {
    const w = createWorld();
    const e = w.createEntity();
    w.addComponent(e, 'health', { hp: 100 });
    const c = w.getComponent(e, 'health');
    assert.deepEqual(c, { hp: 100 });
  });

  it('addComponent overwrites existing component data', () => {
    const w = createWorld();
    const e = w.createEntity();
    w.addComponent(e, 'tag', 'old');
    w.addComponent(e, 'tag', 'new');
    assert.equal(w.getComponent(e, 'tag'), 'new');
  });

  it('addComponent throws for a non-existent entity', () => {
    const w = createWorld();
    assert.throws(() => w.addComponent(42, 'x', 1), /does not exist/);
  });

  it('getComponent returns undefined for missing component', () => {
    const w = createWorld();
    const e = w.createEntity();
    assert.equal(w.getComponent(e, 'nope'), undefined);
  });

  it('getComponent returns undefined for missing entity', () => {
    const w = createWorld();
    assert.equal(w.getComponent(999, 'nope'), undefined);
  });

  it('hasComponent returns true/false correctly', () => {
    const w = createWorld();
    const e = w.createEntity();
    assert.equal(w.hasComponent(e, 'pos'), false);
    w.addComponent(e, 'pos', { x: 0, y: 0 });
    assert.equal(w.hasComponent(e, 'pos'), true);
  });

  it('removeComponent deletes the component', () => {
    const w = createWorld();
    const e = w.createEntity();
    w.addComponent(e, 'pos', { x: 0 });
    w.removeComponent(e, 'pos');
    assert.equal(w.hasComponent(e, 'pos'), false);
    assert.equal(w.getComponent(e, 'pos'), undefined);
  });

  it('removeComponent is safe on missing entity or component', () => {
    const w = createWorld();
    w.removeComponent(999, 'pos'); // no entity
    const e = w.createEntity();
    w.removeComponent(e, 'nope'); // no component — should not throw
    assert.equal(w.entityCount, 1);
  });
});

// ─── Query ──────────────────────────────────────────────────────────────────

describe('World – query', () => {
  it('returns entities matching all requested components', () => {
    const w = createWorld();
    const a = w.createEntity();
    const b = w.createEntity();
    const c = w.createEntity();
    w.addComponent(a, 'pos', 1);
    w.addComponent(a, 'vel', 1);
    w.addComponent(b, 'pos', 1);
    w.addComponent(c, 'vel', 1);

    const both = w.query('pos', 'vel');
    assert.deepEqual(both, [a]);
  });

  it('returns all alive entities when no components are specified', () => {
    const w = createWorld();
    const a = w.createEntity();
    const b = w.createEntity();
    const ids = w.query();
    assert.deepEqual(ids, [a, b]);
  });

  it('returns empty array when no entities match', () => {
    const w = createWorld();
    w.createEntity(); // no components
    assert.deepEqual(w.query('pos'), []);
  });

  it('reflects component removal in subsequent queries', () => {
    const w = createWorld();
    const e = w.createEntity();
    w.addComponent(e, 'pos', 1);
    w.addComponent(e, 'vel', 1);
    assert.deepEqual(w.query('pos', 'vel'), [e]);

    w.removeComponent(e, 'vel');
    assert.deepEqual(w.query('pos', 'vel'), []);
    assert.deepEqual(w.query('pos'), [e]);
  });
});

// ─── Clear ──────────────────────────────────────────────────────────────────

describe('World – clear', () => {
  it('removes all entities and resets IDs', () => {
    const w = createWorld();
    w.createEntity();
    w.createEntity();
    w.addComponent(0, 'a', 1);
    w.clear();
    assert.equal(w.entityCount, 0);
    assert.deepEqual(w.query(), []);
    // IDs restart from 0
    assert.equal(w.createEntity(), 0);
  });
});
