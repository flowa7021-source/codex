import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PERMISSIONS,
  LOCKED_PERMISSIONS,
  PermissionEnforcer,
  getSecurityInfo,
  cleanMetadata,
} from '../../app/modules/pdf-security.js';
import { PDFDocument } from 'pdf-lib';

async function createTestPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.setTitle('Test Title');
  doc.setAuthor('Test Author');
  return doc.save();
}

describe('DEFAULT_PERMISSIONS', () => {
  it('allows printing by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.printing, true);
  });

  it('disallows modifying by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.modifying, false);
  });
});

describe('LOCKED_PERMISSIONS', () => {
  it('disallows all operations', () => {
    for (const val of Object.values(LOCKED_PERMISSIONS)) {
      assert.equal(val, false);
    }
  });
});

describe('PermissionEnforcer', () => {
  it('grants all permissions for unencrypted doc', () => {
    const e = new PermissionEnforcer({ isEncrypted: false, permissions: null });
    assert.ok(e.canEdit());
    assert.ok(e.canCopy());
    assert.ok(e.canPrint());
    assert.ok(e.canAnnotate());
    assert.ok(e.canFillForms());
    assert.ok(e.canAssemble());
    assert.ok(e.canAccessContent());
    assert.ok(e.canPrintHQ());
  });

  it('uses provided permissions for encrypted doc', () => {
    const perms = { ...LOCKED_PERMISSIONS, copying: true };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    assert.ok(e.canCopy());
    assert.ok(!e.canEdit());
    assert.ok(!e.canPrint());
  });

  it('assertAllowed throws for disallowed op', () => {
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: LOCKED_PERMISSIONS });
    assert.throws(() => e.assertAllowed('edit'), /not permitted/);
    assert.throws(() => e.assertAllowed('copy'), /not permitted/);
    assert.throws(() => e.assertAllowed('print'), /not permitted/);
  });

  it('assertAllowed does not throw for allowed op', () => {
    const e = new PermissionEnforcer({ isEncrypted: false, permissions: null });
    assert.doesNotThrow(() => e.assertAllowed('edit'));
    assert.doesNotThrow(() => e.assertAllowed('copy'));
  });

  it('enforceUI disables editing tools when modifying is false', () => {
    const disabled = [];
    const notices = [];
    const toolbar = {
      disable: (id) => disabled.push(id),
      showNotice: (msg) => notices.push(msg),
    };
    const perms = { ...DEFAULT_PERMISSIONS, modifying: false, copying: true, printing: true, annotating: true, assembling: true, fillingForms: true };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('editText'));
    assert.ok(disabled.includes('redact'));
    assert.ok(notices.length > 0);
  });
});

describe('getSecurityInfo', () => {
  it('reads title and author from unencrypted PDF', async () => {
    const bytes = await createTestPdf();
    const info = await getSecurityInfo(bytes);
    assert.equal(info.title, 'Test Title');
    assert.equal(info.author, 'Test Author');
    assert.equal(info.pageCount, 1);
    assert.equal(info.isEncrypted, false);
  });
});

describe('cleanMetadata', () => {
  it('removes author and returns removed list', async () => {
    const bytes = await createTestPdf();
    const result = await cleanMetadata(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.removed.includes('author'));
    assert.ok(result.removed.includes('title'));
  });

  it('keeps title when keepTitle is true', async () => {
    const bytes = await createTestPdf();
    const result = await cleanMetadata(bytes, { keepTitle: true });
    assert.ok(!result.removed.includes('title'));
    assert.ok(result.removed.includes('author'));
  });
});
