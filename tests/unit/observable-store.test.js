// ─── Unit Tests: Observable Store ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Store, createStore } from '../../app/modules/observable-store.js';

// ─── constructor / getState ───────────────────────────────────────────────────

describe('Store – constructor / getState', () => {
  it('getState returns the initial state', () => {
    const store = new Store({ initialState: { count: 0 } });
    assert.deepEqual(store.getState(), { count: 0 });
  });

  it('getState returns a deep clone, not the internal reference', () => {
    const store = new Store({ initialState: { nested: { x: 1 } } });
    const state = store.getState();
    state.nested.x = 99;
    assert.equal(store.getState().nested.x, 1);
  });

  it('createStore factory produces a Store instance', () => {
    const store = createStore({ initialState: { value: 'hello' } });
    assert.ok(store instanceof Store);
    assert.deepEqual(store.getState(), { value: 'hello' });
  });
});

// ─── setState ─────────────────────────────────────────────────────────────────

describe('Store – setState', () => {
  it('merges a partial object into existing state', () => {
    const store = createStore({ initialState: { a: 1, b: 2 } });
    store.setState({ a: 10 });
    assert.deepEqual(store.getState(), { a: 10, b: 2 });
  });

  it('accepts an updater function that receives current state', () => {
    const store = createStore({ initialState: { count: 5 } });
    store.setState((s) => ({ count: s.count + 1 }));
    assert.equal(store.getState().count, 6);
  });

  it('updater function receives a clone, not the internal reference', () => {
    const store = createStore({ initialState: { val: 1 } });
    store.setState((s) => {
      s.val = 999; // mutate the argument — should not affect next call
      return { val: 2 };
    });
    store.setState((s) => {
      assert.equal(s.val, 2);
      return s;
    });
  });

  it('multiple sequential setState calls accumulate correctly', () => {
    const store = createStore({ initialState: { n: 0 } });
    store.setState({ n: 1 });
    store.setState({ n: 2 });
    store.setState({ n: 3 });
    assert.equal(store.getState().n, 3);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('Store – subscribe', () => {
  it('calls subscriber with next and previous state after setState', () => {
    const store = createStore({ initialState: { x: 0 } });
    const calls = [];
    store.subscribe((next, prev) => calls.push({ next, prev }));
    store.setState({ x: 42 });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].next, { x: 42 });
    assert.deepEqual(calls[0].prev, { x: 0 });
  });

  it('unsubscribe stops future notifications', () => {
    const store = createStore({ initialState: { v: 0 } });
    const calls = [];
    const unsub = store.subscribe(() => calls.push(1));
    store.setState({ v: 1 });
    unsub();
    store.setState({ v: 2 });
    assert.equal(calls.length, 1);
  });

  it('multiple subscribers are all notified', () => {
    const store = createStore({ initialState: { n: 0 } });
    const results = [];
    store.subscribe(() => results.push('A'));
    store.subscribe(() => results.push('B'));
    store.setState({ n: 1 });
    assert.deepEqual(results, ['A', 'B']);
  });

  it('subscriber receives independent deep clones of state', () => {
    const store = createStore({ initialState: { obj: { v: 1 } } });
    let capturedNext;
    store.subscribe((next) => { capturedNext = next; });
    store.setState({ obj: { v: 2 } });
    capturedNext.obj.v = 999;
    assert.equal(store.getState().obj.v, 2);
  });
});

// ─── dispatch ─────────────────────────────────────────────────────────────────

describe('Store – dispatch', () => {
  it('runs the matching reducer and updates state', () => {
    const store = createStore({
      initialState: { count: 0 },
      reducers: {
        increment: (state) => ({ count: state.count + 1 }),
      },
    });
    store.dispatch('increment');
    assert.equal(store.getState().count, 1);
  });

  it('passes the payload to the reducer', () => {
    const store = createStore({
      initialState: { count: 0 },
      reducers: {
        add: (state, payload) => ({ count: state.count + payload }),
      },
    });
    store.dispatch('add', 5);
    assert.equal(store.getState().count, 5);
  });

  it('dispatching an unknown action does not throw and leaves state unchanged', () => {
    const store = createStore({ initialState: { v: 1 } });
    assert.doesNotThrow(() => store.dispatch('nonexistent'));
    assert.equal(store.getState().v, 1);
  });

  it('dispatch notifies subscribers', () => {
    const store = createStore({
      initialState: { n: 0 },
      reducers: { set: (_state, payload) => ({ n: payload }) },
    });
    const calls = [];
    store.subscribe((next) => calls.push(next.n));
    store.dispatch('set', 7);
    assert.deepEqual(calls, [7]);
  });
});

// ─── select ───────────────────────────────────────────────────────────────────

describe('Store – select', () => {
  it('returns the result of applying the selector to current state', () => {
    const store = createStore({ initialState: { items: [1, 2, 3] } });
    assert.equal(store.select((s) => s.items.length), 3);
  });

  it('reflects updates after setState', () => {
    const store = createStore({ initialState: { name: 'Alice' } });
    store.setState({ name: 'Bob' });
    assert.equal(store.select((s) => s.name.toUpperCase()), 'BOB');
  });
});

// ─── watch ────────────────────────────────────────────────────────────────────

describe('Store – watch', () => {
  it('fires when the watched slice changes', () => {
    const store = createStore({ initialState: { a: 1, b: 2 } });
    const calls = [];
    store.watch((s) => s.a, (val, prev) => calls.push({ val, prev }));
    store.setState({ a: 10 });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { val: 10, prev: 1 });
  });

  it('does NOT fire when an unrelated slice changes', () => {
    const store = createStore({ initialState: { a: 1, b: 2 } });
    const calls = [];
    store.watch((s) => s.a, () => calls.push(1));
    store.setState({ b: 99 });
    assert.equal(calls.length, 0);
  });

  it('unsubscribing stops watch notifications', () => {
    const store = createStore({ initialState: { x: 0 } });
    const calls = [];
    const unsub = store.watch((s) => s.x, () => calls.push(1));
    store.setState({ x: 1 });
    unsub();
    store.setState({ x: 2 });
    assert.equal(calls.length, 1);
  });

  it('fires multiple times for multiple changes', () => {
    const store = createStore({ initialState: { n: 0 } });
    const values = [];
    store.watch((s) => s.n, (v) => values.push(v));
    store.setState({ n: 1 });
    store.setState({ n: 2 });
    store.setState({ n: 3 });
    assert.deepEqual(values, [1, 2, 3]);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('Store – reset', () => {
  it('restores the initial state', () => {
    const store = createStore({ initialState: { count: 0 } });
    store.setState({ count: 100 });
    store.reset();
    assert.deepEqual(store.getState(), { count: 0 });
  });

  it('notifies subscribers on reset', () => {
    const store = createStore({ initialState: { v: 0 } });
    store.setState({ v: 5 });
    const calls = [];
    store.subscribe((next, prev) => calls.push({ next, prev }));
    store.reset();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].next, { v: 0 });
    assert.deepEqual(calls[0].prev, { v: 5 });
  });

  it('reset uses a clone of initialState, not the same reference', () => {
    const initial = { arr: [1, 2, 3] };
    const store = createStore({ initialState: initial });
    store.setState({ arr: [4, 5, 6] });
    store.reset();
    // Mutate the original initialState object — store should be unaffected
    initial.arr.push(99);
    assert.deepEqual(store.getState().arr, [1, 2, 3]);
  });
});
