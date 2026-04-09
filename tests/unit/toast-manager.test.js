// ─── Unit Tests: ToastManager ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ToastManager } from '../../app/modules/toast-manager.js';

// ─── show ─────────────────────────────────────────────────────────────────────

describe('ToastManager – show', () => {
  it('creates toast with correct fields', () => {
    const manager = new ToastManager();
    const before = Date.now();
    const toast = manager.show('info', 'Hello world');
    const after = Date.now();

    assert.ok(typeof toast.id === 'string' && toast.id.length > 0);
    assert.equal(toast.type, 'info');
    assert.equal(toast.message, 'Hello world');
    assert.ok(toast.createdAt >= before && toast.createdAt <= after);
    assert.equal(typeof toast.duration, 'number');
  });

  it('uses provided duration', () => {
    const manager = new ToastManager();
    const toast = manager.show('success', 'Done', 5000);
    assert.equal(toast.duration, 5000);
  });

  it('increments count with each show', () => {
    const manager = new ToastManager();
    manager.show('info', 'A');
    manager.show('warning', 'B');
    assert.equal(manager.count, 2);
  });

  it('all toast types are accepted', () => {
    const manager = new ToastManager();
    for (const type of ['info', 'success', 'warning', 'error']) {
      const toast = manager.show(/** @type {any} */ (type), 'msg');
      assert.equal(toast.type, type);
    }
  });
});

// ─── dismiss ──────────────────────────────────────────────────────────────────

describe('ToastManager – dismiss', () => {
  it('removes toast by id', () => {
    const manager = new ToastManager();
    const toast = manager.show('info', 'To remove');
    assert.equal(manager.count, 1);
    const result = manager.dismiss(toast.id);
    assert.equal(result, true);
    assert.equal(manager.count, 0);
  });

  it('returns false for unknown id', () => {
    const manager = new ToastManager();
    assert.equal(manager.dismiss('no-such-id'), false);
  });

  it('only removes the specified toast', () => {
    const manager = new ToastManager();
    const t1 = manager.show('info', 'Keep');
    const t2 = manager.show('info', 'Remove');
    manager.dismiss(t2.id);
    assert.equal(manager.count, 1);
    assert.equal(manager.activeToasts[0].id, t1.id);
  });
});

// ─── dismissAll ───────────────────────────────────────────────────────────────

describe('ToastManager – dismissAll', () => {
  it('clears all active toasts', () => {
    const manager = new ToastManager();
    manager.show('info', 'A');
    manager.show('error', 'B');
    manager.dismissAll();
    assert.equal(manager.count, 0);
    assert.deepEqual(manager.activeToasts, []);
  });

  it('no-op on empty manager', () => {
    const manager = new ToastManager();
    assert.doesNotThrow(() => manager.dismissAll());
    assert.equal(manager.count, 0);
  });
});

// ─── activeToasts ─────────────────────────────────────────────────────────────

describe('ToastManager – activeToasts', () => {
  it('returns current list of toasts', () => {
    const manager = new ToastManager();
    const t1 = manager.show('info', 'First');
    const t2 = manager.show('success', 'Second');
    const toasts = manager.activeToasts;
    assert.equal(toasts.length, 2);
    assert.equal(toasts[0].id, t1.id);
    assert.equal(toasts[1].id, t2.id);
  });

  it('returns a copy — mutating returned array does not affect manager', () => {
    const manager = new ToastManager();
    manager.show('info', 'Toast');
    const toasts = manager.activeToasts;
    toasts.push({ id: 'fake', type: 'info', message: 'fake', duration: 0, createdAt: 0 });
    assert.equal(manager.count, 1);
  });

  it('returns empty array when no toasts', () => {
    const manager = new ToastManager();
    assert.deepEqual(manager.activeToasts, []);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('ToastManager – count', () => {
  it('starts at 0', () => {
    const manager = new ToastManager();
    assert.equal(manager.count, 0);
  });

  it('increments on show', () => {
    const manager = new ToastManager();
    manager.show('info', 'A');
    assert.equal(manager.count, 1);
  });

  it('decrements on dismiss', () => {
    const manager = new ToastManager();
    const toast = manager.show('info', 'A');
    manager.dismiss(toast.id);
    assert.equal(manager.count, 0);
  });

  it('resets to 0 on dismissAll', () => {
    const manager = new ToastManager();
    manager.show('info', 'A');
    manager.show('info', 'B');
    manager.dismissAll();
    assert.equal(manager.count, 0);
  });
});

// ─── maxToasts ────────────────────────────────────────────────────────────────

describe('ToastManager – maxToasts', () => {
  it('oldest removed when maxToasts exceeded', () => {
    const manager = new ToastManager({ maxToasts: 3 });
    const t1 = manager.show('info', 'First');
    manager.show('info', 'Second');
    manager.show('info', 'Third');
    manager.show('info', 'Fourth');

    assert.equal(manager.count, 3);
    const toasts = manager.activeToasts;
    assert.ok(!toasts.some((t) => t.id === t1.id), 'oldest should be removed');
    assert.ok(toasts.some((t) => t.message === 'Fourth'));
  });

  it('keeps exactly maxToasts active toasts', () => {
    const manager = new ToastManager({ maxToasts: 2 });
    for (let i = 0; i < 5; i++) {
      manager.show('info', `Toast ${i}`);
    }
    assert.equal(manager.count, 2);
  });
});

// ─── tick ─────────────────────────────────────────────────────────────────────

describe('ToastManager – tick', () => {
  it('removes expired toasts', () => {
    const manager = new ToastManager();
    const now = Date.now();
    const toast = manager.show('info', 'Expiring', 1000);
    // Tick at createdAt + duration (exact boundary — expired)
    manager.tick(toast.createdAt + 1001);
    assert.equal(manager.count, 0);
  });

  it('keeps non-expired toasts', () => {
    const manager = new ToastManager();
    const toast = manager.show('info', 'Not yet', 5000);
    // Tick before expiry
    manager.tick(toast.createdAt + 100);
    assert.equal(manager.count, 1);
  });

  it('uses Date.now() when no argument provided', () => {
    const manager = new ToastManager();
    // Show with very short duration that is already expired
    const toast = manager.show('info', 'Expired', 1);
    // Wait for actual expiry (at least 2ms)
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin wait */ }
    manager.tick();
    assert.equal(manager.count, 0);
  });

  it('does not remove toasts that are not yet expired', () => {
    const manager = new ToastManager();
    manager.show('success', 'Long lived', 60000);
    manager.tick(Date.now());
    assert.equal(manager.count, 1);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('ToastManager – subscribe', () => {
  it('callback called on show', () => {
    const manager = new ToastManager();
    const updates = [];
    manager.subscribe((toasts) => updates.push(toasts.length));

    manager.show('info', 'Hello');
    assert.equal(updates.length, 1);
    assert.equal(updates[0], 1);
  });

  it('callback called on dismiss', () => {
    const manager = new ToastManager();
    const updates = [];
    const toast = manager.show('info', 'Hi');
    manager.subscribe((toasts) => updates.push(toasts.length));

    manager.dismiss(toast.id);
    assert.equal(updates.length, 1);
    assert.equal(updates[0], 0);
  });

  it('callback called on dismissAll', () => {
    const manager = new ToastManager();
    manager.show('info', 'A');
    manager.show('info', 'B');
    const updates = [];
    manager.subscribe((toasts) => updates.push(toasts.length));

    manager.dismissAll();
    assert.equal(updates.length, 1);
    assert.equal(updates[0], 0);
  });

  it('callback called on tick when toasts expire', () => {
    const manager = new ToastManager();
    const toast = manager.show('info', 'Short', 1000);
    const updates = [];
    manager.subscribe((toasts) => updates.push(toasts.length));

    manager.tick(toast.createdAt + 2000);
    assert.equal(updates.length, 1);
    assert.equal(updates[0], 0);
  });

  it('callback not called on tick when nothing expires', () => {
    const manager = new ToastManager();
    const toast = manager.show('info', 'Long', 60000);
    const updates = [];
    manager.subscribe((toasts) => updates.push(toasts.length));

    manager.tick(toast.createdAt + 100);
    assert.equal(updates.length, 0);
  });

  it('unsubscribe stops callback from firing', () => {
    const manager = new ToastManager();
    const received = [];
    const unsubscribe = manager.subscribe((t) => received.push(t));

    manager.show('info', 'Before');
    unsubscribe();
    manager.show('info', 'After');

    assert.equal(received.length, 1);
    assert.equal(received[0].length, 1);
  });

  it('multiple subscribers all receive updates', () => {
    const manager = new ToastManager();
    const calls1 = [];
    const calls2 = [];
    manager.subscribe((t) => calls1.push(t));
    manager.subscribe((t) => calls2.push(t));

    manager.show('success', 'Done');
    assert.equal(calls1.length, 1);
    assert.equal(calls2.length, 1);
  });
});

// ─── persistent toast (duration=0) ───────────────────────────────────────────

describe('ToastManager – persistent toast', () => {
  it('duration=0 toast is not expired by tick', () => {
    const manager = new ToastManager();
    manager.show('info', 'Persistent', 0);
    // Tick far in the future
    manager.tick(Date.now() + 999999999);
    assert.equal(manager.count, 1);
  });

  it('persistent toast remains after multiple ticks', () => {
    const manager = new ToastManager();
    manager.show('warning', 'Always here', 0);
    manager.tick(Date.now() + 1000);
    manager.tick(Date.now() + 5000);
    manager.tick(Date.now() + 100000);
    assert.equal(manager.count, 1);
  });
});

// ─── defaultDuration ──────────────────────────────────────────────────────────

describe('ToastManager – defaultDuration', () => {
  it('used when no duration specified', () => {
    const manager = new ToastManager({ defaultDuration: 7000 });
    const toast = manager.show('info', 'Hello');
    assert.equal(toast.duration, 7000);
  });

  it('default is 3000ms when not configured', () => {
    const manager = new ToastManager();
    const toast = manager.show('success', 'Standard');
    assert.equal(toast.duration, 3000);
  });

  it('explicit duration overrides defaultDuration', () => {
    const manager = new ToastManager({ defaultDuration: 7000 });
    const toast = manager.show('info', 'Custom', 500);
    assert.equal(toast.duration, 500);
  });
});
