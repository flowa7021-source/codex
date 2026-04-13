// ─── Unit Tests: reactive-store ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Store, createStore } from '../../app/modules/reactive-store.js';

// ─── Constructor / state ──────────────────────────────────────────────────────

describe('Store – initial state', () => {
  it('exposes the initial state', () => {
    const store = createStore({ state: { count: 0 }, mutations: {} });
    assert.deepEqual(store.state, { count: 0 });
  });

  it('state is the value passed in (reference equality for objects)', () => {
    const initial = { x: 1 };
    const store = createStore({ state: initial, mutations: {} });
    assert.deepEqual(store.state, { x: 1 });
  });
});

// ─── commit ───────────────────────────────────────────────────────────────────

describe('Store – commit', () => {
  it('applies a mutation and updates state', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: {
        increment: (state) => ({ ...state, count: state.count + 1 }),
      },
    });
    store.commit('increment');
    assert.equal(store.state.count, 1);
  });

  it('passes payload to mutation', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: {
        add: (state, payload) => ({ ...state, count: state.count + /** @type {number} */ (payload) }),
      },
    });
    store.commit('add', 5);
    assert.equal(store.state.count, 5);
  });

  it('throws for unknown mutation', () => {
    const store = createStore({ state: {}, mutations: {} });
    assert.throws(() => store.commit(/** @type {never} */ ('nope')), /Unknown mutation/);
  });

  it('applies multiple mutations in sequence', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: {
        inc: (s) => ({ ...s, count: s.count + 1 }),
        double: (s) => ({ ...s, count: s.count * 2 }),
      },
    });
    store.commit('inc');
    store.commit('inc');
    store.commit('double');
    assert.equal(store.state.count, 4);
  });
});

// ─── getters ─────────────────────────────────────────────────────────────────

describe('Store – getters', () => {
  it('returns derived value from getter', () => {
    const store = createStore({
      state: { items: [1, 2, 3] },
      mutations: {},
      getters: {
        total: (s) => s.items.reduce((a, b) => a + b, 0),
      },
    });
    assert.equal(store.get('total'), 6);
  });

  it('getter reflects updated state after commit', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: {
        inc: (s) => ({ ...s, count: s.count + 1 }),
      },
      getters: {
        doubled: (s) => s.count * 2,
      },
    });
    store.commit('inc');
    store.commit('inc');
    assert.equal(store.get('doubled'), 4);
  });

  it('throws for unknown getter', () => {
    const store = createStore({ state: {}, mutations: {}, getters: {} });
    assert.throws(() => store.get('missing'), /Unknown getter/);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('Store – subscribe', () => {
  it('fires subscriber after each commit', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: { inc: (s) => ({ ...s, count: s.count + 1 }) },
    });
    const calls = [];
    store.subscribe((state, mutation) => calls.push({ count: state.count, mutation }));
    store.commit('inc');
    store.commit('inc');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].count, 1);
    assert.equal(calls[0].mutation, 'inc');
    assert.equal(calls[1].count, 2);
  });

  it('unsubscribe stops future notifications', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: { inc: (s) => ({ ...s, count: s.count + 1 }) },
    });
    const calls = [];
    const unsub = store.subscribe((s) => calls.push(s.count));
    store.commit('inc');
    unsub();
    store.commit('inc');
    assert.equal(calls.length, 1);
  });

  it('multiple independent subscribers each receive calls', () => {
    const store = createStore({
      state: { v: 0 },
      mutations: { up: (s) => ({ ...s, v: s.v + 1 }) },
    });
    let a = 0, b = 0;
    store.subscribe(() => { a++; });
    store.subscribe(() => { b++; });
    store.commit('up');
    store.commit('up');
    assert.equal(a, 2);
    assert.equal(b, 2);
  });
});

// ─── watch ────────────────────────────────────────────────────────────────────

describe('Store – watch', () => {
  it('fires when the watched selector result changes', () => {
    const store = createStore({
      state: { count: 0, other: 'x' },
      mutations: {
        inc: (s) => ({ ...s, count: s.count + 1 }),
        setOther: (s, p) => ({ ...s, other: /** @type {string} */ (p) }),
      },
    });
    const changes = [];
    store.watch((s) => s.count, (newVal, oldVal) => changes.push({ newVal, oldVal }));
    store.commit('inc');
    store.commit('inc');
    assert.equal(changes.length, 2);
    assert.deepEqual(changes[0], { newVal: 1, oldVal: 0 });
    assert.deepEqual(changes[1], { newVal: 2, oldVal: 1 });
  });

  it('does NOT fire when an unrelated property changes', () => {
    const store = createStore({
      state: { count: 0, name: 'a' },
      mutations: {
        setName: (s, p) => ({ ...s, name: /** @type {string} */ (p) }),
      },
    });
    const calls = [];
    store.watch((s) => s.count, () => calls.push(1));
    store.commit('setName', 'b');
    assert.equal(calls.length, 0);
  });

  it('unsubscribe from watch stops future calls', () => {
    const store = createStore({
      state: { count: 0 },
      mutations: { inc: (s) => ({ ...s, count: s.count + 1 }) },
    });
    const calls = [];
    const unsub = store.watch((s) => s.count, () => calls.push(1));
    store.commit('inc');
    unsub();
    store.commit('inc');
    assert.equal(calls.length, 1);
  });

  it('watch fires with correct new/old values for non-primitive selector', () => {
    const store = createStore({
      state: { x: 1 },
      mutations: { setX: (s, p) => ({ ...s, x: /** @type {number} */ (p) }) },
    });
    const log = [];
    store.watch((s) => s.x, (n, o) => log.push([n, o]));
    store.commit('setX', 99);
    assert.deepEqual(log, [[99, 1]]);
  });

  it('Store constructor is exported and works directly', () => {
    const store = new Store({
      state: { n: 0 },
      mutations: { inc: (s) => ({ ...s, n: s.n + 1 }) },
    });
    store.commit('inc');
    assert.equal(store.state.n, 1);
  });
});
