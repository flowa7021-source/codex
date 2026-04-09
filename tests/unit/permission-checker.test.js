// ─── Unit Tests: PermissionChecker ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PermissionChecker } from '../../app/modules/permission-checker.js';

// ─── Simple allow policy ──────────────────────────────────────────────────────

describe('PermissionChecker – simple allow policy', () => {
  it('allows when a matching allow policy exists', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'p1',
      effect: 'allow',
      subjects: ['alice'],
      resources: ['document'],
      actions: ['read'],
    });

    const subject = { id: 'alice' };
    const resource = { type: 'document' };

    assert.equal(checker.can(subject, 'read', resource), true);
  });

  it('denies by default when no policy matches', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'p1',
      effect: 'allow',
      subjects: ['alice'],
      resources: ['document'],
      actions: ['read'],
    });

    const subject = { id: 'bob' };
    const resource = { type: 'document' };

    assert.equal(checker.can(subject, 'read', resource), false);
  });

  it('denies by default when checker has no policies', () => {
    const checker = new PermissionChecker();
    assert.equal(
      checker.can({ id: 'alice' }, 'read', { type: 'document' }),
      false,
    );
  });
});

// ─── Simple deny policy ───────────────────────────────────────────────────────

describe('PermissionChecker – simple deny policy', () => {
  it('denies when a matching deny policy exists', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'p1',
      effect: 'deny',
      subjects: ['alice'],
      resources: ['document'],
      actions: ['delete'],
    });

    assert.equal(
      checker.can({ id: 'alice' }, 'delete', { type: 'document' }),
      false,
    );
  });
});

// ─── Deny overrides allow ─────────────────────────────────────────────────────

describe('PermissionChecker – deny overrides allow', () => {
  it('deny wins when both allow and deny policies match', () => {
    const checker = new PermissionChecker();

    checker.addPolicy({
      id: 'allow-all',
      effect: 'allow',
      subjects: ['*'],
      resources: ['document'],
      actions: ['read'],
    });

    checker.addPolicy({
      id: 'deny-alice',
      effect: 'deny',
      subjects: ['alice'],
      resources: ['document'],
      actions: ['read'],
    });

    // alice is denied even though allow-all exists
    assert.equal(
      checker.can({ id: 'alice' }, 'read', { type: 'document' }),
      false,
    );
    // bob is still allowed
    assert.equal(
      checker.can({ id: 'bob' }, 'read', { type: 'document' }),
      true,
    );
  });
});

// ─── Role-based matching ──────────────────────────────────────────────────────

describe('PermissionChecker – role-based matching', () => {
  it('allows subject whose role is listed in policy.roles', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'editor-write',
      effect: 'allow',
      roles: ['editor'],
      resources: ['document'],
      actions: ['write'],
    });

    const editor = { id: 'alice', roles: ['editor'] };
    const viewer = { id: 'bob', roles: ['viewer'] };

    assert.equal(checker.can(editor, 'write', { type: 'document' }), true);
    assert.equal(checker.can(viewer, 'write', { type: 'document' }), false);
  });

  it('matches subject id listed inside policy.subjects alongside roles', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'admin-read',
      effect: 'allow',
      subjects: ['admin'],
      resources: ['secret'],
      actions: ['read'],
    });

    // Role "admin" matches the subjects list
    const adminByRole = { id: 'charlie', roles: ['admin'] };
    assert.equal(checker.can(adminByRole, 'read', { type: 'secret' }), true);

    // Direct id match
    const adminById = { id: 'admin' };
    assert.equal(checker.can(adminById, 'read', { type: 'secret' }), true);
  });
});

// ─── Wildcard subjects / resources / actions ──────────────────────────────────

describe('PermissionChecker – wildcards', () => {
  it('wildcard subjects matches any subject', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'public-read',
      effect: 'allow',
      subjects: ['*'],
      resources: ['article'],
      actions: ['read'],
    });

    assert.equal(
      checker.can({ id: 'anyone' }, 'read', { type: 'article' }),
      true,
    );
  });

  it('wildcard resources matches any resource type', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'superuser',
      effect: 'allow',
      subjects: ['root'],
      resources: ['*'],
      actions: ['*'],
    });

    assert.equal(
      checker.can({ id: 'root' }, 'delete', { type: 'anything' }),
      true,
    );
  });

  it('omitting subjects/resources/actions fields is treated as wildcard', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'open',
      effect: 'allow',
      // no subjects, no resources, no actions
    });

    assert.equal(
      checker.can({ id: 'anyone' }, 'any-action', { type: 'any-resource' }),
      true,
    );
  });
});

// ─── Condition function ───────────────────────────────────────────────────────

describe('PermissionChecker – condition function', () => {
  it('allows only when condition returns true', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'owner-only',
      effect: 'allow',
      subjects: ['*'],
      resources: ['file'],
      actions: ['write'],
      condition: (subject, resource) =>
        resource.attributes?.['ownerId'] === subject.id,
    });

    const alice = { id: 'alice' };
    const ownedByAlice = { type: 'file', attributes: { ownerId: 'alice' } };
    const ownedByBob = { type: 'file', attributes: { ownerId: 'bob' } };

    assert.equal(checker.can(alice, 'write', ownedByAlice), true);
    assert.equal(checker.can(alice, 'write', ownedByBob), false);
  });

  it('denies when condition returns false even if effect is allow', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'time-locked',
      effect: 'allow',
      subjects: ['*'],
      resources: ['vault'],
      actions: ['open'],
      condition: () => false,
    });

    assert.equal(
      checker.can({ id: 'alice' }, 'open', { type: 'vault' }),
      false,
    );
  });
});

// ─── removePolicy ─────────────────────────────────────────────────────────────

describe('PermissionChecker – removePolicy', () => {
  it('removing a policy stops it from being applied', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'p1',
      effect: 'allow',
      subjects: ['alice'],
      resources: ['doc'],
      actions: ['read'],
    });

    assert.equal(
      checker.can({ id: 'alice' }, 'read', { type: 'doc' }),
      true,
    );

    checker.removePolicy('p1');

    assert.equal(
      checker.can({ id: 'alice' }, 'read', { type: 'doc' }),
      false,
    );
  });
});

// ─── getApplicablePolicies ────────────────────────────────────────────────────

describe('PermissionChecker – getApplicablePolicies', () => {
  it('returns only policies that match', () => {
    const checker = new PermissionChecker();
    const p1 = {
      id: 'p1',
      effect: /** @type {'allow'} */ ('allow'),
      subjects: ['alice'],
      resources: ['doc'],
      actions: ['read'],
    };
    const p2 = {
      id: 'p2',
      effect: /** @type {'deny'} */ ('deny'),
      subjects: ['alice'],
      resources: ['doc'],
      actions: ['delete'],
    };
    const p3 = {
      id: 'p3',
      effect: /** @type {'allow'} */ ('allow'),
      subjects: ['bob'],
      resources: ['doc'],
      actions: ['read'],
    };

    checker.addPolicy(p1);
    checker.addPolicy(p2);
    checker.addPolicy(p3);

    const applicable = checker.getApplicablePolicies(
      { id: 'alice' },
      'read',
      { type: 'doc' },
    );

    assert.equal(applicable.length, 1);
    assert.equal(applicable[0].id, 'p1');
  });

  it('returns empty array when no policies match', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'p1',
      effect: 'allow',
      subjects: ['alice'],
      resources: ['doc'],
      actions: ['read'],
    });

    const applicable = checker.getApplicablePolicies(
      { id: 'bob' },
      'read',
      { type: 'doc' },
    );
    assert.equal(applicable.length, 0);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('PermissionChecker – clear', () => {
  it('removes all policies so every check returns false', () => {
    const checker = new PermissionChecker();
    checker.addPolicy({
      id: 'p1',
      effect: 'allow',
      subjects: ['*'],
      resources: ['*'],
      actions: ['*'],
    });

    assert.equal(
      checker.can({ id: 'alice' }, 'read', { type: 'doc' }),
      true,
    );

    checker.clear();

    assert.equal(
      checker.can({ id: 'alice' }, 'read', { type: 'doc' }),
      false,
    );
  });
});
