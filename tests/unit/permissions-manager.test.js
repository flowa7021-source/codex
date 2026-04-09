// ─── Unit Tests: PermissionsManager ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PermissionsManager } from '../../app/modules/permissions-manager.js';

// ─── grant / can ─────────────────────────────────────────────────────────────

describe('PermissionsManager – grant/can', () => {
  it('returns true for an exact permission that was granted', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    assert.equal(pm.can('user1', 'read', 'posts'), true);
  });

  it('returns false for a permission that was not granted', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    assert.equal(pm.can('user1', 'write', 'posts'), false);
  });

  it('permissions are scoped per subject', () => {
    const pm = new PermissionsManager();
    pm.grant('alice', 'read', 'posts');
    assert.equal(pm.can('bob', 'read', 'posts'), false);
  });

  it('multiple permissions can be granted to the same subject', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    pm.grant('user1', 'write', 'comments');
    assert.equal(pm.can('user1', 'read', 'posts'), true);
    assert.equal(pm.can('user1', 'write', 'comments'), true);
  });
});

// ─── revoke ───────────────────────────────────────────────────────────────────

describe('PermissionsManager – revoke', () => {
  it('revoke removes a previously granted permission', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    pm.revoke('user1', 'read', 'posts');
    assert.equal(pm.can('user1', 'read', 'posts'), false);
  });

  it('revoke does not affect other permissions of the same subject', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    pm.grant('user1', 'write', 'posts');
    pm.revoke('user1', 'read', 'posts');
    assert.equal(pm.can('user1', 'read', 'posts'), false);
    assert.equal(pm.can('user1', 'write', 'posts'), true);
  });

  it('revoke on a non-existent permission is a no-op', () => {
    const pm = new PermissionsManager();
    assert.doesNotThrow(() => pm.revoke('nobody', 'read', 'posts'));
  });
});

// ─── wildcard action '*' ──────────────────────────────────────────────────────

describe('PermissionsManager – wildcard action', () => {
  it('wildcard action matches any action on the specific resource', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', '*', 'posts');
    assert.equal(pm.can('user1', 'read', 'posts'), true);
    assert.equal(pm.can('user1', 'write', 'posts'), true);
    assert.equal(pm.can('user1', 'delete', 'posts'), true);
  });

  it('wildcard action does not match a different resource', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', '*', 'posts');
    assert.equal(pm.can('user1', 'read', 'comments'), false);
  });
});

// ─── wildcard resource '*' ────────────────────────────────────────────────────

describe('PermissionsManager – wildcard resource', () => {
  it('wildcard resource matches any resource for the specific action', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', '*');
    assert.equal(pm.can('user1', 'read', 'posts'), true);
    assert.equal(pm.can('user1', 'read', 'comments'), true);
    assert.equal(pm.can('user1', 'read', 'anything'), true);
  });

  it('wildcard resource does not match a different action', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', '*');
    assert.equal(pm.can('user1', 'write', 'posts'), false);
  });
});

// ─── double wildcard ─────────────────────────────────────────────────────────

describe('PermissionsManager – double wildcard (superuser)', () => {
  it('wildcard action and resource matches everything', () => {
    const pm = new PermissionsManager();
    pm.grant('admin', '*', '*');
    assert.equal(pm.can('admin', 'read', 'posts'), true);
    assert.equal(pm.can('admin', 'delete', 'users'), true);
    assert.equal(pm.can('admin', 'anything', 'anything'), true);
  });
});

// ─── getPermissions ───────────────────────────────────────────────────────────

describe('PermissionsManager – getPermissions', () => {
  it('returns all permissions for a subject', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    pm.grant('user1', 'write', 'comments');
    const perms = pm.getPermissions('user1');
    assert.equal(perms.length, 2);
    assert.ok(perms.some((p) => p.action === 'read' && p.resource === 'posts'));
    assert.ok(perms.some((p) => p.action === 'write' && p.resource === 'comments'));
  });

  it('returns empty array for a subject with no permissions', () => {
    const pm = new PermissionsManager();
    assert.deepEqual(pm.getPermissions('nobody'), []);
  });

  it('returns empty array after revokeAll', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    pm.revokeAll('user1');
    assert.deepEqual(pm.getPermissions('user1'), []);
  });
});

// ─── revokeAll ────────────────────────────────────────────────────────────────

describe('PermissionsManager – revokeAll', () => {
  it('removes all permissions for the subject', () => {
    const pm = new PermissionsManager();
    pm.grant('user1', 'read', 'posts');
    pm.grant('user1', 'write', 'posts');
    pm.grant('user1', 'delete', 'comments');
    pm.revokeAll('user1');
    assert.equal(pm.can('user1', 'read', 'posts'), false);
    assert.equal(pm.can('user1', 'write', 'posts'), false);
    assert.equal(pm.can('user1', 'delete', 'comments'), false);
  });

  it('revokeAll does not affect other subjects', () => {
    const pm = new PermissionsManager();
    pm.grant('alice', 'read', 'posts');
    pm.grant('bob', 'read', 'posts');
    pm.revokeAll('alice');
    assert.equal(pm.can('bob', 'read', 'posts'), true);
  });

  it('revokeAll on unknown subject is a no-op', () => {
    const pm = new PermissionsManager();
    assert.doesNotThrow(() => pm.revokeAll('ghost'));
  });
});

// ─── copyPermissions ─────────────────────────────────────────────────────────

describe('PermissionsManager – copyPermissions', () => {
  it('copies all permissions from one subject to another', () => {
    const pm = new PermissionsManager();
    pm.grant('alice', 'read', 'posts');
    pm.grant('alice', 'write', 'comments');
    pm.copyPermissions('alice', 'bob');
    assert.equal(pm.can('bob', 'read', 'posts'), true);
    assert.equal(pm.can('bob', 'write', 'comments'), true);
  });

  it('copy is additive — does not remove existing permissions of target', () => {
    const pm = new PermissionsManager();
    pm.grant('alice', 'read', 'posts');
    pm.grant('bob', 'delete', 'files');
    pm.copyPermissions('alice', 'bob');
    assert.equal(pm.can('bob', 'delete', 'files'), true);
    assert.equal(pm.can('bob', 'read', 'posts'), true);
  });

  it('copy does not modify the source subject', () => {
    const pm = new PermissionsManager();
    pm.grant('alice', 'read', 'posts');
    pm.copyPermissions('alice', 'bob');
    pm.revokeAll('bob');
    assert.equal(pm.can('alice', 'read', 'posts'), true);
  });

  it('copy from non-existent subject is a no-op', () => {
    const pm = new PermissionsManager();
    assert.doesNotThrow(() => pm.copyPermissions('ghost', 'bob'));
    assert.deepEqual(pm.getPermissions('bob'), []);
  });
});

// ─── non-existent subject ─────────────────────────────────────────────────────

describe('PermissionsManager – non-existent subject', () => {
  it('can() returns false for a subject that has never been granted anything', () => {
    const pm = new PermissionsManager();
    assert.equal(pm.can('unknown', 'read', 'posts'), false);
  });
});
