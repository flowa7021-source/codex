// ─── Unit Tests: AccessControl ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AccessControl } from '../../app/modules/access-control.js';

// ─── grant / check / revoke ───────────────────────────────────────────────────

describe('AccessControl – grant / check / revoke', () => {
  it('grants permissions and check returns true', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read', 'write']);

    assert.equal(ac.check('alice', 'file-1', 'read'), true);
    assert.equal(ac.check('alice', 'file-1', 'write'), true);
  });

  it('check returns false for unpermitted action', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read']);

    assert.equal(ac.check('alice', 'file-1', 'delete'), false);
  });

  it('check returns false for unknown subject', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read']);

    assert.equal(ac.check('bob', 'file-1', 'read'), false);
  });

  it('check returns false for unknown resource', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read']);

    assert.equal(ac.check('alice', 'file-2', 'read'), false);
  });

  it('revoke removes specific permissions', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read', 'write', 'delete']);
    ac.revoke('alice', 'file-1', ['write', 'delete']);

    assert.equal(ac.check('alice', 'file-1', 'read'), true);
    assert.equal(ac.check('alice', 'file-1', 'write'), false);
    assert.equal(ac.check('alice', 'file-1', 'delete'), false);
  });

  it('revoke on non-existent entry is a no-op', () => {
    const ac = new AccessControl();
    // Should not throw
    ac.revoke('nobody', 'file-x', ['read']);
  });

  it('grant merges permissions on successive calls', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read']);
    ac.grant('alice', 'file-1', ['write']);

    assert.equal(ac.check('alice', 'file-1', 'read'), true);
    assert.equal(ac.check('alice', 'file-1', 'write'), true);
  });
});

// ─── checkAll / checkAny ──────────────────────────────────────────────────────

describe('AccessControl – checkAll / checkAny', () => {
  it('checkAll returns true only when all permissions are present', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'doc', ['read', 'write']);

    assert.equal(ac.checkAll('alice', 'doc', ['read', 'write']), true);
    assert.equal(ac.checkAll('alice', 'doc', ['read', 'write', 'delete']), false);
  });

  it('checkAll returns true for empty list', () => {
    const ac = new AccessControl();
    assert.equal(ac.checkAll('alice', 'doc', []), true);
  });

  it('checkAny returns true when at least one permission is present', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'doc', ['read']);

    assert.equal(ac.checkAny('alice', 'doc', ['read', 'write']), true);
    assert.equal(ac.checkAny('alice', 'doc', ['write', 'delete']), false);
  });

  it('checkAny returns false for empty list', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'doc', ['read']);

    assert.equal(ac.checkAny('alice', 'doc', []), false);
  });
});

// ─── setOwner ─────────────────────────────────────────────────────────────────

describe('AccessControl – setOwner', () => {
  it('owner passes all permission checks', () => {
    const ac = new AccessControl();
    ac.setOwner('doc-1', 'alice');

    assert.equal(ac.check('alice', 'doc-1', 'read'), true);
    assert.equal(ac.check('alice', 'doc-1', 'write'), true);
    assert.equal(ac.check('alice', 'doc-1', 'delete'), true);
    assert.equal(ac.check('alice', 'doc-1', 'anything'), true);
  });

  it('non-owner does not get owner permissions', () => {
    const ac = new AccessControl();
    ac.setOwner('doc-1', 'alice');

    assert.equal(ac.check('bob', 'doc-1', 'read'), false);
  });

  it('owner also passes checkAll', () => {
    const ac = new AccessControl();
    ac.setOwner('doc-1', 'alice');

    assert.equal(
      ac.checkAll('alice', 'doc-1', ['read', 'write', 'delete']),
      true,
    );
  });

  it('owner also passes checkAny', () => {
    const ac = new AccessControl();
    ac.setOwner('doc-1', 'alice');

    assert.equal(ac.checkAny('alice', 'doc-1', ['read']), true);
  });
});

// ─── revokeAll ────────────────────────────────────────────────────────────────

describe('AccessControl – revokeAll', () => {
  it('removes all permissions for a subject on a resource', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read', 'write', 'delete']);
    ac.revokeAll('alice', 'file-1');

    assert.equal(ac.check('alice', 'file-1', 'read'), false);
    assert.equal(ac.check('alice', 'file-1', 'write'), false);
    assert.equal(ac.check('alice', 'file-1', 'delete'), false);
  });

  it('revokeAll does not affect other subjects', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read']);
    ac.grant('bob', 'file-1', ['read']);

    ac.revokeAll('alice', 'file-1');

    assert.equal(ac.check('alice', 'file-1', 'read'), false);
    assert.equal(ac.check('bob', 'file-1', 'read'), true);
  });

  it('revokeAll on non-existent entry is a no-op', () => {
    const ac = new AccessControl();
    ac.revokeAll('nobody', 'ghost-resource');
  });
});

// ─── getForSubject ────────────────────────────────────────────────────────────

describe('AccessControl – getForSubject', () => {
  it('returns all ACL entries for a subject', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'file-1', ['read']);
    ac.grant('alice', 'file-2', ['write', 'delete']);
    ac.grant('bob', 'file-1', ['read']);

    const entries = ac.getForSubject('alice');
    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.subjectId === 'alice'));

    const resourceIds = entries.map((e) => e.resourceId).sort();
    assert.deepEqual(resourceIds, ['file-1', 'file-2']);
  });

  it('returns empty array when subject has no entries', () => {
    const ac = new AccessControl();
    assert.deepEqual(ac.getForSubject('nobody'), []);
  });
});

// ─── getForResource ───────────────────────────────────────────────────────────

describe('AccessControl – getForResource', () => {
  it('returns all ACL entries for a resource', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'doc-1', ['read']);
    ac.grant('bob', 'doc-1', ['read', 'write']);
    ac.grant('alice', 'doc-2', ['read']);

    const entries = ac.getForResource('doc-1');
    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.resourceId === 'doc-1'));

    const subjectIds = entries.map((e) => e.subjectId).sort();
    assert.deepEqual(subjectIds, ['alice', 'bob']);
  });

  it('returns empty array when resource has no entries', () => {
    const ac = new AccessControl();
    assert.deepEqual(ac.getForResource('ghost'), []);
  });
});

// ─── cloneAccess ─────────────────────────────────────────────────────────────

describe('AccessControl – cloneAccess', () => {
  it('copies all ACL entries from source to target resource', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'template', ['read', 'write']);
    ac.grant('bob', 'template', ['read']);

    ac.cloneAccess('template', 'new-doc');

    assert.equal(ac.check('alice', 'new-doc', 'read'), true);
    assert.equal(ac.check('alice', 'new-doc', 'write'), true);
    assert.equal(ac.check('bob', 'new-doc', 'read'), true);
    assert.equal(ac.check('bob', 'new-doc', 'write'), false);
  });

  it('cloneAccess does not remove existing entries on target', () => {
    const ac = new AccessControl();
    ac.grant('charlie', 'new-doc', ['delete']);
    ac.grant('alice', 'template', ['read']);

    ac.cloneAccess('template', 'new-doc');

    // charlie still has delete on new-doc
    assert.equal(ac.check('charlie', 'new-doc', 'delete'), true);
    // alice gained read on new-doc
    assert.equal(ac.check('alice', 'new-doc', 'read'), true);
  });

  it('source resource entries are unaffected by clone', () => {
    const ac = new AccessControl();
    ac.grant('alice', 'src', ['read']);

    ac.cloneAccess('src', 'dst');
    ac.revokeAll('alice', 'dst');

    // src should be unaffected
    assert.equal(ac.check('alice', 'src', 'read'), true);
  });

  it('cloneAccess on non-existent source is a no-op', () => {
    const ac = new AccessControl();
    ac.cloneAccess('ghost', 'new-doc');
    assert.deepEqual(ac.getForResource('new-doc'), []);
  });
});
