import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PERMISSIONS,
  LOCKED_PERMISSIONS,
  PermissionEnforcer,
  getSecurityInfo,
  cleanMetadata,
  sanitizePdf,
  setPassword,
} from '../../app/modules/pdf-security.js';
import { PDFDocument } from 'pdf-lib';

async function createTestPdf({ title, author, subject, keywords, creator, producer } = {}) {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  if (title !== undefined) doc.setTitle(title);
  else doc.setTitle('Test Title');
  if (author !== undefined) doc.setAuthor(author);
  else doc.setAuthor('Test Author');
  if (subject !== undefined) doc.setSubject(subject);
  if (keywords !== undefined) doc.setKeywords(keywords);
  if (creator !== undefined) doc.setCreator(creator);
  if (producer !== undefined) doc.setProducer(producer);
  return doc.save();
}

async function createBlankPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
}

// ─── DEFAULT_PERMISSIONS ────────────────────────────────────────────────────

describe('DEFAULT_PERMISSIONS', () => {
  it('allows printing by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.printing, true);
  });

  it('allows printHighQuality by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.printHighQuality, true);
  });

  it('disallows modifying by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.modifying, false);
  });

  it('allows copying by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.copying, true);
  });

  it('allows annotating by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.annotating, true);
  });

  it('allows fillingForms by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.fillingForms, true);
  });

  it('allows contentAccess by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.contentAccess, true);
  });

  it('disallows assembling by default', () => {
    assert.equal(DEFAULT_PERMISSIONS.assembling, false);
  });

  it('has exactly 8 permission keys', () => {
    assert.equal(Object.keys(DEFAULT_PERMISSIONS).length, 8);
  });
});

// ─── LOCKED_PERMISSIONS ─────────────────────────────────────────────────────

describe('LOCKED_PERMISSIONS', () => {
  it('disallows all operations', () => {
    for (const val of Object.values(LOCKED_PERMISSIONS)) {
      assert.equal(val, false);
    }
  });

  it('has exactly 8 permission keys', () => {
    assert.equal(Object.keys(LOCKED_PERMISSIONS).length, 8);
  });
});

// ─── PermissionEnforcer ─────────────────────────────────────────────────────

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

  it('grants all permissions for encrypted doc with null permissions', () => {
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: null });
    assert.ok(e.canEdit());
    assert.ok(e.canCopy());
    assert.ok(e.canPrint());
  });

  it('uses provided permissions for encrypted doc', () => {
    const perms = { ...LOCKED_PERMISSIONS, copying: true };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    assert.ok(e.canCopy());
    assert.ok(!e.canEdit());
    assert.ok(!e.canPrint());
  });

  it('reflects locked permissions correctly for all methods', () => {
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: LOCKED_PERMISSIONS });
    assert.equal(e.canEdit(), false);
    assert.equal(e.canCopy(), false);
    assert.equal(e.canPrint(), false);
    assert.equal(e.canPrintHQ(), false);
    assert.equal(e.canAnnotate(), false);
    assert.equal(e.canFillForms(), false);
    assert.equal(e.canAssemble(), false);
    assert.equal(e.canAccessContent(), false);
  });

  it('isEncrypted property is set from securityInfo', () => {
    const e1 = new PermissionEnforcer({ isEncrypted: true, permissions: LOCKED_PERMISSIONS });
    assert.equal(e1.isEncrypted, true);
    const e2 = new PermissionEnforcer({ isEncrypted: false, permissions: null });
    assert.equal(e2.isEncrypted, false);
  });

  // ── assertAllowed ──

  it('assertAllowed throws for all disallowed ops on locked doc', () => {
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: LOCKED_PERMISSIONS });
    assert.throws(() => e.assertAllowed('edit'), /not permitted/);
    assert.throws(() => e.assertAllowed('copy'), /not permitted/);
    assert.throws(() => e.assertAllowed('print'), /not permitted/);
    assert.throws(() => e.assertAllowed('annotate'), /not permitted/);
    assert.throws(() => e.assertAllowed('fillForms'), /not permitted/);
    assert.throws(() => e.assertAllowed('assemble'), /not permitted/);
  });

  it('assertAllowed does not throw for allowed ops on unencrypted doc', () => {
    const e = new PermissionEnforcer({ isEncrypted: false, permissions: null });
    assert.doesNotThrow(() => e.assertAllowed('edit'));
    assert.doesNotThrow(() => e.assertAllowed('copy'));
    assert.doesNotThrow(() => e.assertAllowed('print'));
    assert.doesNotThrow(() => e.assertAllowed('annotate'));
    assert.doesNotThrow(() => e.assertAllowed('fillForms'));
    assert.doesNotThrow(() => e.assertAllowed('assemble'));
  });

  // ── enforceUI ──

  it('enforceUI disables editing tools and shows notice when modifying is false', () => {
    const disabled = [];
    const notices = [];
    const toolbar = {
      disable: (id) => disabled.push(id),
      showNotice: (msg) => notices.push(msg),
    };
    const perms = { ...DEFAULT_PERMISSIONS, modifying: false };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('editText'));
    assert.ok(disabled.includes('erase'));
    assert.ok(disabled.includes('addText'));
    assert.ok(disabled.includes('addImage'));
    assert.ok(disabled.includes('redact'));
    assert.ok(disabled.includes('watermark'));
    assert.ok(disabled.includes('headerFooter'));
    assert.ok(disabled.includes('batesNumber'));
    assert.ok(notices.length > 0);
  });

  it('enforceUI disables copy tools when copying is false', () => {
    const disabled = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: () => {} };
    const perms = { ...DEFAULT_PERMISSIONS, copying: false };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('copyText'));
    assert.ok(disabled.includes('selectText'));
    assert.ok(disabled.includes('exportText'));
  });

  it('enforceUI disables annotation tools when annotating is false', () => {
    const disabled = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: () => {} };
    const perms = { ...DEFAULT_PERMISSIONS, annotating: false };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('annotate'));
    assert.ok(disabled.includes('highlight'));
    assert.ok(disabled.includes('comment'));
    assert.ok(disabled.includes('stamp'));
  });

  it('enforceUI disables print when printing is false', () => {
    const disabled = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: () => {} };
    const perms = { ...DEFAULT_PERMISSIONS, printing: false };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('print'));
  });

  it('enforceUI disables assembly tools when assembling is false', () => {
    const disabled = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: () => {} };
    const perms = { ...DEFAULT_PERMISSIONS, assembling: false };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('pageOrganizer'));
    assert.ok(disabled.includes('insertPages'));
    assert.ok(disabled.includes('deletePages'));
    assert.ok(disabled.includes('extractPages'));
  });

  it('enforceUI disables fillForms when fillingForms is false', () => {
    const disabled = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: () => {} };
    const perms = { ...DEFAULT_PERMISSIONS, fillingForms: false };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: perms });
    e.enforceUI(toolbar);
    assert.ok(disabled.includes('fillForms'));
  });

  it('enforceUI does not disable tools when all permissions are granted', () => {
    const disabled = [];
    const notices = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: (m) => notices.push(m) };
    // All permissions true
    const allPerms = {
      printing: true, printHighQuality: true, modifying: true, copying: true,
      annotating: true, fillingForms: true, contentAccess: true, assembling: true,
    };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: allPerms });
    e.enforceUI(toolbar);
    assert.equal(disabled.length, 0);
    assert.equal(notices.length, 0);
  });

  it('enforceUI disables all restricted tools for fully locked doc', () => {
    const disabled = [];
    const notices = [];
    const toolbar = { disable: (id) => disabled.push(id), showNotice: (m) => notices.push(m) };
    const e = new PermissionEnforcer({ isEncrypted: true, permissions: LOCKED_PERMISSIONS });
    e.enforceUI(toolbar);
    // Should disable editing, copying, annotating, printing, assembling, fillForms
    assert.ok(disabled.includes('editText'));
    assert.ok(disabled.includes('copyText'));
    assert.ok(disabled.includes('annotate'));
    assert.ok(disabled.includes('print'));
    assert.ok(disabled.includes('pageOrganizer'));
    assert.ok(disabled.includes('fillForms'));
    assert.ok(notices.length > 0);
  });
});

// ─── getSecurityInfo ────────────────────────────────────────────────────────

describe('getSecurityInfo', () => {
  it('reads title and author from unencrypted PDF', async () => {
    const bytes = await createTestPdf();
    const info = await getSecurityInfo(bytes);
    assert.equal(info.title, 'Test Title');
    assert.equal(info.author, 'Test Author');
    assert.equal(info.pageCount, 1);
    assert.equal(info.isEncrypted, false);
  });

  it('returns empty string for missing title and author', async () => {
    const bytes = await createBlankPdf();
    const info = await getSecurityInfo(bytes);
    assert.equal(info.title, '');
    assert.equal(info.author, '');
    assert.equal(info.subject, '');
    assert.equal(info.isEncrypted, false);
    assert.equal(info.permissions, null);
  });

  it('reads subject when set', async () => {
    const bytes = await createTestPdf({
      subject: 'Test Subject',
    });
    const info = await getSecurityInfo(bytes);
    assert.equal(info.subject, 'Test Subject');
  });

  it('returns correct page count', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);
    const bytes = await doc.save();
    const info = await getSecurityInfo(bytes);
    assert.equal(info.pageCount, 3);
  });

  it('accepts ArrayBuffer input', async () => {
    const bytes = await createBlankPdf();
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const info = await getSecurityInfo(ab);
    assert.equal(info.pageCount, 1);
  });
});

// ─── setPassword ────────────────────────────────────────────────────────────

describe('setPassword', () => {
  it('throws when ownerPassword is empty string', async () => {
    const bytes = await createBlankPdf();
    await assert.rejects(() => setPassword(bytes, ''), /ownerPassword is required/);
  });

  it('throws when ownerPassword is null', async () => {
    const bytes = await createBlankPdf();
    await assert.rejects(() => setPassword(bytes, null), /ownerPassword is required/);
  });

  it('throws when ownerPassword is undefined', async () => {
    const bytes = await createBlankPdf();
    await assert.rejects(() => setPassword(bytes, undefined), /ownerPassword is required/);
  });

  it('throws (pdfDoc.encrypt not in this pdf-lib version) but validates ownerPassword first', async () => {
    const bytes = await createBlankPdf();
    // ownerPassword is provided so it passes the guard and hits pdfDoc.encrypt
    await assert.rejects(() => setPassword(bytes, 'ownerPass123', 'userPass456'));
  });

  it('throws with empty userPassword too (ownerPassword provided)', async () => {
    const bytes = await createBlankPdf();
    await assert.rejects(() => setPassword(bytes, 'ownerPass'));
  });
});

// ─── cleanMetadata ──────────────────────────────────────────────────────────

describe('cleanMetadata', () => {
  it('removes title and author and returns removed list', async () => {
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

  it('removes subject when present', async () => {
    const bytes = await createTestPdf({ subject: 'My Subject' });
    const result = await cleanMetadata(bytes);
    assert.ok(result.removed.includes('subject'));
  });

  it('removes keywords when present', async () => {
    const bytes = await createTestPdf({ keywords: ['key1', 'key2'] });
    const result = await cleanMetadata(bytes);
    assert.ok(result.removed.includes('keywords'));
  });

  it('removes creator when present', async () => {
    const bytes = await createTestPdf({ creator: 'SomeCreator' });
    const result = await cleanMetadata(bytes);
    assert.ok(result.removed.includes('creator'));
  });

  it('removes producer when present', async () => {
    const bytes = await createTestPdf({ producer: 'SomeProducer' });
    const result = await cleanMetadata(bytes);
    assert.ok(result.removed.includes('producer'));
  });

  it('returns blob of type application/pdf', async () => {
    const bytes = await createTestPdf();
    const result = await cleanMetadata(bytes);
    assert.equal(result.blob.type, 'application/pdf');
  });

  it('does not add title to removed list if already empty', async () => {
    const bytes = await createBlankPdf();
    const result = await cleanMetadata(bytes);
    assert.ok(!result.removed.includes('title'));
  });

  it('accepts ArrayBuffer input', async () => {
    const bytes = await createTestPdf();
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const result = await cleanMetadata(ab);
    assert.ok(result.blob instanceof Blob);
  });
});

// ─── sanitizePdf ────────────────────────────────────────────────────────────

describe('sanitizePdf', () => {
  it('returns blob and sanitized array for clean PDF', async () => {
    const bytes = await createBlankPdf();
    const result = await sanitizePdf(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.ok(Array.isArray(result.sanitized));
  });

  it('sanitized array is empty for clean PDF without JS or embedded files', async () => {
    const bytes = await createBlankPdf();
    const result = await sanitizePdf(bytes);
    assert.equal(result.sanitized.length, 0);
  });

  it('returns unique sanitized items (Set dedup)', async () => {
    const bytes = await createBlankPdf();
    const result = await sanitizePdf(bytes);
    const set = new Set(result.sanitized);
    assert.equal(set.size, result.sanitized.length);
  });

  it('accepts ArrayBuffer input', async () => {
    const bytes = await createBlankPdf();
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const result = await sanitizePdf(ab);
    assert.ok(result.blob instanceof Blob);
  });

  it('processes a multi-page PDF without throwing', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);
    doc.addPage([612, 792]);
    const bytes = await doc.save();
    const result = await sanitizePdf(bytes);
    assert.ok(result.blob instanceof Blob);
  });
});
