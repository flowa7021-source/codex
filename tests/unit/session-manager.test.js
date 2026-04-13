// ─── Unit Tests: SessionManager ───────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { SessionManager } from '../../app/modules/session-manager.js';

// ─── create ───────────────────────────────────────────────────────────────────

describe('SessionManager – create', () => {
  it('creates a session with id, createdAt, lastActiveAt', () => {
    const manager = new SessionManager();
    const before = Date.now();
    const session = manager.create();
    const after = Date.now();

    assert.ok(typeof session.id === 'string' && session.id.length > 0);
    assert.ok(session.createdAt >= before && session.createdAt <= after);
    assert.ok(session.lastActiveAt >= before && session.lastActiveAt <= after);
  });

  it('creates a session with userId when provided', () => {
    const manager = new SessionManager();
    const session = manager.create('user-42');
    assert.equal(session.userId, 'user-42');
  });

  it('creates a session with initial data when provided', () => {
    const manager = new SessionManager();
    const session = manager.create(undefined, { theme: 'dark' });
    assert.deepEqual(session.data, { theme: 'dark' });
  });

  it('creates sessions with unique ids', () => {
    const manager = new SessionManager();
    const s1 = manager.create();
    const s2 = manager.create();
    assert.notEqual(s1.id, s2.id);
  });

  it('sets expiresAt based on TTL', () => {
    const ttl = 60_000;
    const manager = new SessionManager({ ttl });
    const before = Date.now();
    const session = manager.create();
    const after = Date.now();

    assert.ok(session.expiresAt !== undefined);
    assert.ok(session.expiresAt >= before + ttl);
    assert.ok(session.expiresAt <= after + ttl);
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe('SessionManager – get', () => {
  it('returns the session for a valid id', () => {
    const manager = new SessionManager();
    const created = manager.create('alice');
    const fetched = manager.get(created.id);
    assert.ok(fetched !== null);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.userId, 'alice');
  });

  it('returns null for a missing id', () => {
    const manager = new SessionManager();
    assert.equal(manager.get('nonexistent'), null);
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('SessionManager – TTL expiry', () => {
  it('get returns null after TTL has passed', () => {
    const realNow = Date.now;

    const manager = new SessionManager({ ttl: 1000 });
    const session = manager.create();

    // Simulate time passing beyond TTL
    Date.now = () => realNow() + 2000;

    try {
      assert.equal(manager.get(session.id), null);
    } finally {
      Date.now = realNow;
    }
  });

  it('get returns session when TTL has not yet passed', () => {
    const manager = new SessionManager({ ttl: 60_000 });
    const session = manager.create();
    assert.ok(manager.get(session.id) !== null);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('SessionManager – update', () => {
  it('merges data into existing session', () => {
    const manager = new SessionManager();
    const session = manager.create(undefined, { a: 1 });
    manager.update(session.id, { b: 2 });
    const updated = manager.get(session.id);
    assert.ok(updated !== null);
    assert.deepEqual(updated.data, { a: 1, b: 2 });
  });

  it('overwrites existing key when updating', () => {
    const manager = new SessionManager();
    const session = manager.create(undefined, { color: 'red' });
    manager.update(session.id, { color: 'blue' });
    const updated = manager.get(session.id);
    assert.ok(updated !== null);
    assert.equal(updated.data['color'], 'blue');
  });

  it('refreshes lastActiveAt', () => {
    const manager = new SessionManager();
    const session = manager.create();
    const originalLastActive = session.lastActiveAt;
    // Ensure time advances
    const realNow = Date.now;
    Date.now = () => realNow() + 100;
    try {
      manager.update(session.id, { x: 1 });
      const updated = manager.get(session.id);
      assert.ok(updated !== null);
      assert.ok(updated.lastActiveAt > originalLastActive);
    } finally {
      Date.now = realNow;
    }
  });

  it('returns false for a missing session id', () => {
    const manager = new SessionManager();
    assert.equal(manager.update('nonexistent', { x: 1 }), false);
  });

  it('returns true on successful update', () => {
    const manager = new SessionManager();
    const session = manager.create();
    assert.equal(manager.update(session.id, { x: 1 }), true);
  });
});

// ─── destroy ──────────────────────────────────────────────────────────────────

describe('SessionManager – destroy', () => {
  it('removes the session', () => {
    const manager = new SessionManager();
    const session = manager.create();
    manager.destroy(session.id);
    assert.equal(manager.get(session.id), null);
  });

  it('returns true when session existed', () => {
    const manager = new SessionManager();
    const session = manager.create();
    assert.equal(manager.destroy(session.id), true);
  });

  it('returns false when session did not exist', () => {
    const manager = new SessionManager();
    assert.equal(manager.destroy('ghost'), false);
  });
});

// ─── getActiveSessions ────────────────────────────────────────────────────────

describe('SessionManager – getActiveSessions', () => {
  it('returns all non-expired sessions', () => {
    const manager = new SessionManager();
    manager.create();
    manager.create();
    assert.equal(manager.getActiveSessions().length, 2);
  });

  it('excludes expired sessions', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 500 });
    manager.create('userA');
    manager.create('userB');

    // Advance time past TTL
    Date.now = () => realNow() + 1000;

    // Create a fresh session (non-expired at the mocked time)
    const fresh = manager.create('userC');

    try {
      const active = manager.getActiveSessions();
      assert.equal(active.length, 1);
      assert.equal(active[0].id, fresh.id);
    } finally {
      Date.now = realNow;
    }
  });
});

// ─── prune ────────────────────────────────────────────────────────────────────

describe('SessionManager – prune', () => {
  it('removes expired sessions and returns count', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 500 });
    manager.create();
    manager.create();

    Date.now = () => realNow() + 1000;

    try {
      const removed = manager.prune();
      assert.equal(removed, 2);
      assert.equal(manager.activeCount, 0);
    } finally {
      Date.now = realNow;
    }
  });

  it('returns 0 when no sessions are expired', () => {
    const manager = new SessionManager({ ttl: 60_000 });
    manager.create();
    manager.create();
    assert.equal(manager.prune(), 0);
  });

  it('only removes expired sessions, keeps active ones', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 500 });
    manager.create('old1');
    manager.create('old2');

    Date.now = () => realNow() + 1000;

    const fresh = manager.create('fresh');

    try {
      const removed = manager.prune();
      assert.equal(removed, 2);
      assert.ok(manager.get(fresh.id) !== null);
    } finally {
      Date.now = realNow;
    }
  });
});

// ─── touch ────────────────────────────────────────────────────────────────────

describe('SessionManager – touch', () => {
  it('updates lastActiveAt', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 60_000 });
    const session = manager.create();
    const originalLastActive = session.lastActiveAt;

    Date.now = () => realNow() + 500;

    try {
      manager.touch(session.id);
      const updated = manager.get(session.id);
      assert.ok(updated !== null);
      assert.ok(updated.lastActiveAt > originalLastActive);
    } finally {
      Date.now = realNow;
    }
  });

  it('resets TTL so session does not expire', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 1000 });
    const session = manager.create();

    // Advance to just before expiry and touch
    Date.now = () => realNow() + 900;
    manager.touch(session.id);

    // Advance further past original expiry but within new TTL
    Date.now = () => realNow() + 1500;

    try {
      assert.ok(manager.get(session.id) !== null);
    } finally {
      Date.now = realNow;
    }
  });

  it('returns true for a valid session', () => {
    const manager = new SessionManager();
    const session = manager.create();
    assert.equal(manager.touch(session.id), true);
  });

  it('returns false for a missing session', () => {
    const manager = new SessionManager();
    assert.equal(manager.touch('none'), false);
  });
});

// ─── activeCount ──────────────────────────────────────────────────────────────

describe('SessionManager – activeCount', () => {
  it('starts at 0', () => {
    const manager = new SessionManager();
    assert.equal(manager.activeCount, 0);
  });

  it('increments with each created session', () => {
    const manager = new SessionManager();
    manager.create();
    assert.equal(manager.activeCount, 1);
    manager.create();
    assert.equal(manager.activeCount, 2);
  });

  it('decrements after destroy', () => {
    const manager = new SessionManager();
    const session = manager.create();
    manager.create();
    manager.destroy(session.id);
    assert.equal(manager.activeCount, 1);
  });

  it('excludes expired sessions', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 500 });
    manager.create();
    manager.create();

    Date.now = () => realNow() + 1000;

    try {
      assert.equal(manager.activeCount, 0);
    } finally {
      Date.now = realNow;
    }
  });
});

// ─── getUserSessions ──────────────────────────────────────────────────────────

describe('SessionManager – getUserSessions', () => {
  it('returns all active sessions for a userId', () => {
    const manager = new SessionManager();
    manager.create('alice');
    manager.create('alice');
    manager.create('bob');
    const aliceSessions = manager.getUserSessions('alice');
    assert.equal(aliceSessions.length, 2);
    assert.ok(aliceSessions.every((s) => s.userId === 'alice'));
  });

  it('returns empty array when user has no sessions', () => {
    const manager = new SessionManager();
    manager.create('bob');
    assert.deepEqual(manager.getUserSessions('alice'), []);
  });

  it('excludes expired sessions from result', () => {
    const realNow = Date.now;
    const manager = new SessionManager({ ttl: 500 });
    manager.create('alice');

    Date.now = () => realNow() + 1000;

    try {
      assert.deepEqual(manager.getUserSessions('alice'), []);
    } finally {
      Date.now = realNow;
    }
  });
});

// ─── maxSessions ──────────────────────────────────────────────────────────────

describe('SessionManager – maxSessions', () => {
  it('does not exceed maxSessions', () => {
    const manager = new SessionManager({ maxSessions: 3 });
    manager.create();
    manager.create();
    manager.create();
    manager.create();
    assert.equal(manager.activeCount, 3);
  });

  it('removes the oldest session when limit is reached', () => {
    const manager = new SessionManager({ maxSessions: 2 });
    const first = manager.create();
    manager.create();
    manager.create(); // should evict 'first'
    assert.equal(manager.get(first.id), null);
  });
});
