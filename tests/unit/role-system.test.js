// ─── Unit Tests: RoleSystem ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RoleSystem } from '../../app/modules/role-system.js';

// ─── defineRole ───────────────────────────────────────────────────────────────

describe('RoleSystem – defineRole', () => {
  it('creates a role that can later be assigned', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'editor', permissions: [{ action: 'edit', resource: 'posts' }] });
    rs.assignRole('user1', 'editor');
    assert.equal(rs.hasRole('user1', 'editor'), true);
  });

  it('redefining a role replaces the old definition', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'viewer', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.defineRole({ name: 'viewer', permissions: [{ action: 'read', resource: 'files' }] });
    rs.assignRole('user1', 'viewer');
    assert.equal(rs.can('user1', 'read', 'files'), true);
    assert.equal(rs.can('user1', 'read', 'posts'), false);
  });
});

// ─── assignRole / hasRole ─────────────────────────────────────────────────────

describe('RoleSystem – assignRole/hasRole', () => {
  it('user gets the role after assignRole', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'admin', permissions: [] });
    rs.assignRole('alice', 'admin');
    assert.equal(rs.hasRole('alice', 'admin'), true);
  });

  it('hasRole returns false before assignment', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'admin', permissions: [] });
    assert.equal(rs.hasRole('alice', 'admin'), false);
  });

  it('hasRole is scoped per user', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'admin', permissions: [] });
    rs.assignRole('alice', 'admin');
    assert.equal(rs.hasRole('bob', 'admin'), false);
  });

  it('can assign multiple roles to the same user', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [] });
    rs.defineRole({ name: 'editor', permissions: [] });
    rs.assignRole('alice', 'reader');
    rs.assignRole('alice', 'editor');
    assert.equal(rs.hasRole('alice', 'reader'), true);
    assert.equal(rs.hasRole('alice', 'editor'), true);
  });
});

// ─── revokeRole ───────────────────────────────────────────────────────────────

describe('RoleSystem – revokeRole', () => {
  it('role is removed after revokeRole', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'admin', permissions: [] });
    rs.assignRole('alice', 'admin');
    rs.revokeRole('alice', 'admin');
    assert.equal(rs.hasRole('alice', 'admin'), false);
  });

  it('revokeRole does not affect other roles of the same user', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [] });
    rs.defineRole({ name: 'editor', permissions: [] });
    rs.assignRole('alice', 'reader');
    rs.assignRole('alice', 'editor');
    rs.revokeRole('alice', 'reader');
    assert.equal(rs.hasRole('alice', 'reader'), false);
    assert.equal(rs.hasRole('alice', 'editor'), true);
  });

  it('revokeRole on a role not held is a no-op', () => {
    const rs = new RoleSystem();
    assert.doesNotThrow(() => rs.revokeRole('nobody', 'ghost'));
  });
});

// ─── can ─────────────────────────────────────────────────────────────────────

describe('RoleSystem – can', () => {
  it('user with role can perform permitted action', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.assignRole('alice', 'reader');
    assert.equal(rs.can('alice', 'read', 'posts'), true);
  });

  it('user with role cannot perform non-permitted action', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.assignRole('alice', 'reader');
    assert.equal(rs.can('alice', 'write', 'posts'), false);
  });

  it('user without any role cannot perform any action', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    assert.equal(rs.can('bob', 'read', 'posts'), false);
  });
});

// ─── getUserRoles ─────────────────────────────────────────────────────────────

describe('RoleSystem – getUserRoles', () => {
  it('returns all directly assigned roles', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [] });
    rs.defineRole({ name: 'editor', permissions: [] });
    rs.assignRole('alice', 'reader');
    rs.assignRole('alice', 'editor');
    const roles = rs.getUserRoles('alice');
    assert.ok(roles.includes('reader'));
    assert.ok(roles.includes('editor'));
  });

  it('returns empty array for user with no roles', () => {
    const rs = new RoleSystem();
    assert.deepEqual(rs.getUserRoles('nobody'), []);
  });
});

// ─── role inheritance ─────────────────────────────────────────────────────────

describe('RoleSystem – role inheritance', () => {
  it('inheriting role gets parent permissions', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.defineRole({
      name: 'editor',
      permissions: [{ action: 'write', resource: 'posts' }],
      inherits: ['reader'],
    });
    rs.assignRole('alice', 'editor');
    // Direct permission from editor
    assert.equal(rs.can('alice', 'write', 'posts'), true);
    // Inherited permission from reader
    assert.equal(rs.can('alice', 'read', 'posts'), true);
  });

  it('getUserRoles includes inherited role names', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [] });
    rs.defineRole({ name: 'editor', permissions: [], inherits: ['reader'] });
    rs.assignRole('alice', 'editor');
    const roles = rs.getUserRoles('alice');
    assert.ok(roles.includes('editor'));
    assert.ok(roles.includes('reader'));
  });

  it('multi-level inheritance works transitively', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'viewer', permissions: [{ action: 'view', resource: 'docs' }] });
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'docs' }], inherits: ['viewer'] });
    rs.defineRole({ name: 'editor', permissions: [{ action: 'edit', resource: 'docs' }], inherits: ['reader'] });
    rs.assignRole('alice', 'editor');
    assert.equal(rs.can('alice', 'edit', 'docs'), true);
    assert.equal(rs.can('alice', 'read', 'docs'), true);
    assert.equal(rs.can('alice', 'view', 'docs'), true);
  });
});

// ─── getEffectivePermissions ──────────────────────────────────────────────────

describe('RoleSystem – getEffectivePermissions', () => {
  it('returns all permissions across all roles', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.defineRole({ name: 'editor', permissions: [{ action: 'write', resource: 'posts' }] });
    rs.assignRole('alice', 'reader');
    rs.assignRole('alice', 'editor');
    const perms = rs.getEffectivePermissions('alice');
    assert.ok(perms.some((p) => p.action === 'read' && p.resource === 'posts'));
    assert.ok(perms.some((p) => p.action === 'write' && p.resource === 'posts'));
  });

  it('includes inherited permissions', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.defineRole({
      name: 'editor',
      permissions: [{ action: 'write', resource: 'posts' }],
      inherits: ['reader'],
    });
    rs.assignRole('alice', 'editor');
    const perms = rs.getEffectivePermissions('alice');
    assert.ok(perms.some((p) => p.action === 'read' && p.resource === 'posts'));
    assert.ok(perms.some((p) => p.action === 'write' && p.resource === 'posts'));
  });

  it('duplicate permissions are deduplicated', () => {
    const rs = new RoleSystem();
    const perm = { action: 'read', resource: 'posts' };
    rs.defineRole({ name: 'role1', permissions: [perm] });
    rs.defineRole({ name: 'role2', permissions: [perm] });
    rs.assignRole('alice', 'role1');
    rs.assignRole('alice', 'role2');
    const perms = rs.getEffectivePermissions('alice');
    const readPerms = perms.filter((p) => p.action === 'read' && p.resource === 'posts');
    assert.equal(readPerms.length, 1);
  });

  it('returns empty array for user with no roles', () => {
    const rs = new RoleSystem();
    assert.deepEqual(rs.getEffectivePermissions('nobody'), []);
  });
});

// ─── user without role ────────────────────────────────────────────────────────

describe('RoleSystem – user without role', () => {
  it('can() returns false for user with no assigned roles', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'admin', permissions: [{ action: 'delete', resource: 'users' }] });
    assert.equal(rs.can('newbie', 'delete', 'users'), false);
  });
});

// ─── multiple roles ───────────────────────────────────────────────────────────

describe('RoleSystem – multiple roles', () => {
  it('user with multiple roles gets union of permissions', () => {
    const rs = new RoleSystem();
    rs.defineRole({ name: 'reader', permissions: [{ action: 'read', resource: 'posts' }] });
    rs.defineRole({ name: 'commenter', permissions: [{ action: 'write', resource: 'comments' }] });
    rs.assignRole('alice', 'reader');
    rs.assignRole('alice', 'commenter');
    assert.equal(rs.can('alice', 'read', 'posts'), true);
    assert.equal(rs.can('alice', 'write', 'comments'), true);
    // Not in either role
    assert.equal(rs.can('alice', 'delete', 'posts'), false);
  });
});
