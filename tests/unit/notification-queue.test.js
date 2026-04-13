// ─── Unit Tests: NotificationQueue ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { NotificationQueue } from '../../app/modules/notification-queue.js';

// ─── add ──────────────────────────────────────────────────────────────────────

describe('NotificationQueue – add', () => {
  it('creates notification with correct fields', () => {
    const queue = new NotificationQueue();
    const before = Date.now();
    const notif = queue.add('info', 'Hello', 'World', { extra: 1 });
    const after = Date.now();

    assert.ok(typeof notif.id === 'string' && notif.id.length > 0);
    assert.equal(notif.level, 'info');
    assert.equal(notif.title, 'Hello');
    assert.equal(notif.message, 'World');
    assert.ok(notif.timestamp >= before && notif.timestamp <= after);
    assert.equal(notif.read, false);
    assert.deepEqual(notif.data, { extra: 1 });
  });

  it('creates notification without optional message and data', () => {
    const queue = new NotificationQueue();
    const notif = queue.add('success', 'Done');

    assert.equal(notif.title, 'Done');
    assert.equal(notif.message, undefined);
    assert.equal(notif.data, undefined);
  });

  it('increments count with each add', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'A');
    queue.add('warning', 'B');
    assert.equal(queue.count, 2);
  });
});

// ─── level filtering ─────────────────────────────────────────────────────────

describe('NotificationQueue – level filtering', () => {
  it('getAll with level filter returns only matching notifications', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'Info one');
    queue.add('error', 'Error one');
    queue.add('info', 'Info two');
    queue.add('warning', 'Warn one');

    const infos = queue.getAll({ level: 'info' });
    assert.equal(infos.length, 2);
    assert.ok(infos.every((n) => n.level === 'info'));
  });

  it('returns empty array when no notifications match level', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'Only info');
    assert.equal(queue.getAll({ level: 'error' }).length, 0);
  });
});

// ─── unreadOnly filter ────────────────────────────────────────────────────────

describe('NotificationQueue – unreadOnly filter', () => {
  it('returns only unread notifications', () => {
    const queue = new NotificationQueue();
    const n1 = queue.add('info', 'First');
    queue.add('info', 'Second');
    queue.markRead(n1.id);

    const unread = queue.getAll({ unreadOnly: true });
    assert.equal(unread.length, 1);
    assert.equal(unread[0].title, 'Second');
  });

  it('returns all when no notifications are read', () => {
    const queue = new NotificationQueue();
    queue.add('success', 'A');
    queue.add('success', 'B');
    assert.equal(queue.getAll({ unreadOnly: true }).length, 2);
  });

  it('combines level and unreadOnly filters', () => {
    const queue = new NotificationQueue();
    const n1 = queue.add('error', 'Error read');
    queue.add('error', 'Error unread');
    queue.add('info', 'Info unread');
    queue.markRead(n1.id);

    const result = queue.getAll({ level: 'error', unreadOnly: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Error unread');
  });
});

// ─── markRead ─────────────────────────────────────────────────────────────────

describe('NotificationQueue – markRead', () => {
  it('marks a single notification as read', () => {
    const queue = new NotificationQueue();
    const notif = queue.add('info', 'Hello');
    assert.equal(notif.read, false);
    const result = queue.markRead(notif.id);
    assert.equal(result, true);
    assert.equal(notif.read, true);
  });

  it('returns false for unknown id', () => {
    const queue = new NotificationQueue();
    assert.equal(queue.markRead('nonexistent-id'), false);
  });

  it('marking already-read notification returns true', () => {
    const queue = new NotificationQueue();
    const notif = queue.add('info', 'Hi');
    queue.markRead(notif.id);
    assert.equal(queue.markRead(notif.id), true);
    assert.equal(notif.read, true);
  });
});

// ─── markAllRead ──────────────────────────────────────────────────────────────

describe('NotificationQueue – markAllRead', () => {
  it('marks all notifications as read', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'A');
    queue.add('warning', 'B');
    queue.add('error', 'C');
    queue.markAllRead();
    assert.equal(queue.unreadCount, 0);
    assert.ok(queue.getAll().every((n) => n.read));
  });

  it('no-op on empty queue', () => {
    const queue = new NotificationQueue();
    assert.doesNotThrow(() => queue.markAllRead());
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('NotificationQueue – remove', () => {
  it('removes notification by id', () => {
    const queue = new NotificationQueue();
    const notif = queue.add('info', 'To remove');
    assert.equal(queue.count, 1);
    const result = queue.remove(notif.id);
    assert.equal(result, true);
    assert.equal(queue.count, 0);
  });

  it('returns false for unknown id', () => {
    const queue = new NotificationQueue();
    assert.equal(queue.remove('no-such-id'), false);
  });

  it('only removes the specified notification', () => {
    const queue = new NotificationQueue();
    const n1 = queue.add('info', 'Keep');
    const n2 = queue.add('info', 'Remove');
    queue.remove(n2.id);
    assert.equal(queue.count, 1);
    assert.equal(queue.getAll()[0].id, n1.id);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('NotificationQueue – clear', () => {
  it('empties the queue', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'A');
    queue.add('error', 'B');
    queue.clear();
    assert.equal(queue.count, 0);
    assert.deepEqual(queue.getAll(), []);
  });

  it('can add again after clear', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'Old');
    queue.clear();
    queue.add('success', 'New');
    assert.equal(queue.count, 1);
    assert.equal(queue.getAll()[0].title, 'New');
  });
});

// ─── unreadCount / count ──────────────────────────────────────────────────────

describe('NotificationQueue – unreadCount and count', () => {
  it('count starts at 0', () => {
    const queue = new NotificationQueue();
    assert.equal(queue.count, 0);
  });

  it('unreadCount starts at 0', () => {
    const queue = new NotificationQueue();
    assert.equal(queue.unreadCount, 0);
  });

  it('count reflects total notifications', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'A');
    queue.add('info', 'B');
    assert.equal(queue.count, 2);
  });

  it('unreadCount decrements when notification is marked read', () => {
    const queue = new NotificationQueue();
    const n = queue.add('info', 'A');
    assert.equal(queue.unreadCount, 1);
    queue.markRead(n.id);
    assert.equal(queue.unreadCount, 0);
    assert.equal(queue.count, 1); // still in queue
  });

  it('count decrements when notification is removed', () => {
    const queue = new NotificationQueue();
    const n = queue.add('info', 'A');
    queue.remove(n.id);
    assert.equal(queue.count, 0);
  });
});

// ─── maxSize ──────────────────────────────────────────────────────────────────

describe('NotificationQueue – maxSize', () => {
  it('drops oldest when maxSize exceeded', () => {
    const queue = new NotificationQueue({ maxSize: 3 });
    const n1 = queue.add('info', 'First');
    queue.add('info', 'Second');
    queue.add('info', 'Third');
    queue.add('info', 'Fourth');

    assert.equal(queue.count, 3);
    const all = queue.getAll();
    assert.ok(!all.some((n) => n.id === n1.id), 'oldest should be dropped');
    assert.ok(all.some((n) => n.title === 'Fourth'));
  });

  it('keeps exactly maxSize notifications', () => {
    const queue = new NotificationQueue({ maxSize: 2 });
    for (let i = 0; i < 5; i++) {
      queue.add('info', `Item ${i}`);
    }
    assert.equal(queue.count, 2);
  });
});

// ─── deduplicate ──────────────────────────────────────────────────────────────

describe('NotificationQueue – deduplicate', () => {
  it('skips duplicate unread notification with same title+level', () => {
    const queue = new NotificationQueue({ deduplicate: true });
    const n1 = queue.add('warning', 'Disk full');
    const n2 = queue.add('warning', 'Disk full');

    assert.equal(n1.id, n2.id, 'should return existing notification');
    assert.equal(queue.count, 1);
  });

  it('allows duplicate after first is marked read', () => {
    const queue = new NotificationQueue({ deduplicate: true });
    const n1 = queue.add('error', 'Connection lost');
    queue.markRead(n1.id);
    const n2 = queue.add('error', 'Connection lost');

    assert.notEqual(n1.id, n2.id);
    assert.equal(queue.count, 2);
  });

  it('allows same title with different level', () => {
    const queue = new NotificationQueue({ deduplicate: true });
    const n1 = queue.add('info', 'Same title');
    const n2 = queue.add('warning', 'Same title');

    assert.notEqual(n1.id, n2.id);
    assert.equal(queue.count, 2);
  });

  it('allows duplicates when deduplicate is false (default)', () => {
    const queue = new NotificationQueue();
    queue.add('info', 'Repeated');
    queue.add('info', 'Repeated');
    assert.equal(queue.count, 2);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('NotificationQueue – subscribe', () => {
  it('callback is fired on add', () => {
    const queue = new NotificationQueue();
    const received = [];
    queue.subscribe((n) => received.push(n));

    queue.add('info', 'Hello');
    assert.equal(received.length, 1);
    assert.equal(received[0].title, 'Hello');
  });

  it('callback receives the newly added notification', () => {
    const queue = new NotificationQueue();
    let last = null;
    queue.subscribe((n) => { last = n; });

    const notif = queue.add('error', 'Critical', 'Details');
    assert.equal(last, notif);
  });

  it('multiple subscribers all receive notifications', () => {
    const queue = new NotificationQueue();
    const calls1 = [];
    const calls2 = [];
    queue.subscribe((n) => calls1.push(n));
    queue.subscribe((n) => calls2.push(n));

    queue.add('success', 'Done');
    assert.equal(calls1.length, 1);
    assert.equal(calls2.length, 1);
  });

  it('unsubscribe stops callback from firing', () => {
    const queue = new NotificationQueue();
    const received = [];
    const unsubscribe = queue.subscribe((n) => received.push(n));

    queue.add('info', 'Before');
    unsubscribe();
    queue.add('info', 'After');

    assert.equal(received.length, 1);
    assert.equal(received[0].title, 'Before');
  });

  it('deduplicate skips subscriber call for duplicate', () => {
    const queue = new NotificationQueue({ deduplicate: true });
    const received = [];
    queue.subscribe((n) => received.push(n));

    queue.add('info', 'Same');
    queue.add('info', 'Same'); // duplicate, should not fire again

    assert.equal(received.length, 1);
  });
});
