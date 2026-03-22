// ─── Integration Tests: Cloud Sync Pipeline ─────────────────────────────────
// Tests the cloud-integration module (provider registration, auth, file ops),
// workspace-controller sync (payload build/apply, push/pull), and
// sync-encryption (E2E encrypt/decrypt roundtrip, key derivation, tamper detection).

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── DOM body.classList patch (needed by workspace-controller theme toggle) ──
if (!document.body.classList || typeof document.body.classList.toggle !== 'function') {
  const _classes = new Set();
  document.body.classList = {
    add(...cls) { cls.forEach((c) => _classes.add(c)); },
    remove(...cls) { cls.forEach((c) => _classes.delete(c)); },
    toggle(c, force) {
      if (force === undefined) { _classes.has(c) ? _classes.delete(c) : _classes.add(c); }
      else if (force) { _classes.add(c); }
      else { _classes.delete(c); }
    },
    contains(c) { return _classes.has(c); },
  };
}

// ─── Module imports ─────────────────────────────────────────────────────────
import {
  registerProvider,
  getProviders,
  getProvider,
  authenticate,
  listFiles,
  saveFile,
  openFile,
  getShareLink,
  signOut,
  getConnectionStatus,
  onStatusChange,
  setEncryptionPassphrase,
} from '../../app/modules/cloud-integration.js';

import {
  buildWorkspacePayload,
  applyWorkspacePayload,
  initWorkspaceDeps,
} from '../../app/modules/workspace-controller.js';

import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
} from '../../app/modules/sync-encryption.js';

import { state } from '../../app/modules/state.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a mock cloud provider with controllable behaviour.
 * @param {string} id
 * @param {string} name
 * @param {object} [overrides]
 */
function createMockProvider(id, name, overrides = {}) {
  let authenticated = false;
  const files = overrides.files || [
    { id: 'f1', name: 'test.pdf', mimeType: 'application/pdf', size: 1024, modifiedAt: '2025-01-01T00:00:00Z', provider: id },
    { id: 'f2', name: 'scan.png', mimeType: 'image/png', size: 2048, modifiedAt: '2025-01-02T00:00:00Z', provider: id },
  ];
  return {
    id,
    name,
    authenticate: overrides.authenticate || (async () => { authenticated = true; return true; }),
    isAuthenticated: () => authenticated,
    listFiles: overrides.listFiles || (async (_folder, _query) => files),
    downloadFile: overrides.downloadFile || (async (_fileId) => new ArrayBuffer(8)),
    uploadFile: overrides.uploadFile || (async (fname, _data, _mime, _folder) => ({ id: 'up1', name: fname, mimeType: 'application/pdf', size: 100, modifiedAt: new Date().toISOString(), provider: id })),
    getShareLink: overrides.getShareLink || (async (_fileId) => `https://${id}.example.com/share/abc`),
    signOut: overrides.signOut || (async () => { authenticated = false; }),
    /** expose for test assertions */
    _setAuth(v) { authenticated = v; },
  };
}

// ─── Cleanup helper ─────────────────────────────────────────────────────────
// cloud-integration keeps module-level state (providers Map). We re-register
// fresh mocks in beforeEach to keep tests isolated.

// ══════════════════════════════════════════════════════════════════════════════
// A. Provider Registration
// ══════════════════════════════════════════════════════════════════════════════

describe('A — Provider Registration', () => {
  let mockProvider;

  beforeEach(() => {
    mockProvider = createMockProvider('test-drive', 'TestDrive');
  });

  it('registerProvider adds a provider retrievable via getProvider', () => {
    registerProvider(mockProvider);
    const p = getProvider('test-drive');
    assert.ok(p, 'provider should exist');
    assert.equal(p.id, 'test-drive');
    assert.equal(p.name, 'TestDrive');
  });

  it('getProviders returns all registered providers', () => {
    registerProvider(mockProvider);
    const second = createMockProvider('test-box', 'TestBox');
    registerProvider(second);
    const all = getProviders();
    const ids = all.map((p) => p.id);
    assert.ok(ids.includes('test-drive'), 'should contain test-drive');
    assert.ok(ids.includes('test-box'), 'should contain test-box');
  });

  it('duplicate provider id overwrites previous registration', () => {
    registerProvider(mockProvider);
    const replacement = createMockProvider('test-drive', 'ReplacedDrive');
    registerProvider(replacement);
    const p = getProvider('test-drive');
    assert.equal(p.name, 'ReplacedDrive');
    // Should not have duplicate entries
    const count = getProviders().filter((x) => x.id === 'test-drive').length;
    assert.equal(count, 1, 'only one provider with that id');
  });

  it('getProvider returns null for unknown id', () => {
    assert.equal(getProvider('nonexistent'), null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B. Authentication Flow
// ══════════════════════════════════════════════════════════════════════════════

describe('B — Authentication Flow', () => {
  let mockProvider;

  beforeEach(() => {
    mockProvider = createMockProvider('auth-test', 'AuthTest');
    registerProvider(mockProvider);
  });

  it('authenticate calls provider.authenticate and returns result', async () => {
    const result = await authenticate('auth-test');
    assert.equal(result, true);
    assert.equal(mockProvider.isAuthenticated(), true);
  });

  it('authenticate throws for unknown provider', async () => {
    await assert.rejects(
      () => authenticate('no-such-provider'),
      { message: /Unknown provider/ },
    );
  });

  it('signOut calls provider.signOut and clears auth state', async () => {
    await authenticate('auth-test');
    assert.equal(mockProvider.isAuthenticated(), true);
    await signOut('auth-test');
    assert.equal(mockProvider.isAuthenticated(), false);
  });

  it('signOut is silent for unknown provider', async () => {
    // Should not throw
    await signOut('nonexistent-provider');
  });

  it('getConnectionStatus reflects authentication state', async () => {
    let status = getConnectionStatus().find((s) => s.id === 'auth-test');
    assert.equal(status.connected, false, 'initially disconnected');

    await authenticate('auth-test');
    status = getConnectionStatus().find((s) => s.id === 'auth-test');
    assert.equal(status.connected, true, 'connected after auth');

    await signOut('auth-test');
    status = getConnectionStatus().find((s) => s.id === 'auth-test');
    assert.equal(status.connected, false, 'disconnected after sign-out');
  });

  it('onStatusChange fires on authenticate and signOut', async () => {
    const events = [];
    const unsub = onStatusChange((s) => events.push(s));

    await authenticate('auth-test');
    await signOut('auth-test');

    unsub();
    assert.ok(events.length >= 2, 'should have received at least 2 status events');
    // Last event should show disconnected
    const last = events[events.length - 1];
    const entry = last.find((s) => s.id === 'auth-test');
    assert.equal(entry.connected, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// C. File Operations (mocked)
// ══════════════════════════════════════════════════════════════════════════════

describe('C — File Operations (mocked)', () => {
  let mockProvider;

  beforeEach(async () => {
    mockProvider = createMockProvider('fileops', 'FileOps');
    registerProvider(mockProvider);
    await authenticate('fileops');
    // Clear any encryption state
    await setEncryptionPassphrase(null);
  });

  it('listFiles returns files from authenticated provider', async () => {
    const files = await listFiles('fileops');
    assert.ok(Array.isArray(files));
    assert.equal(files.length, 2);
    assert.equal(files[0].name, 'test.pdf');
    assert.equal(files[1].name, 'scan.png');
  });

  it('listFiles throws for unknown provider', async () => {
    await assert.rejects(
      () => listFiles('missing-provider'),
      { message: /Unknown provider/ },
    );
  });

  it('listFiles throws if not authenticated', async () => {
    await signOut('fileops');
    await assert.rejects(
      () => listFiles('fileops'),
      { message: /Not authenticated/ },
    );
  });

  it('saveFile delegates to provider.uploadFile', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const result = await saveFile('fileops', 'output.pdf', data, 'application/pdf');
    assert.ok(result, 'should return CloudFile');
    assert.equal(result.name, 'output.pdf');
    assert.equal(result.provider, 'fileops');
  });

  it('saveFile throws for unknown provider', async () => {
    await assert.rejects(
      () => saveFile('nope', 'x.pdf', new ArrayBuffer(0)),
      { message: /Unknown provider/ },
    );
  });

  it('getShareLink returns a share URL', async () => {
    const link = await getShareLink('fileops', 'f1');
    assert.ok(link.includes('fileops.example.com'), 'should contain provider domain');
  });

  it('getShareLink throws for unknown provider', async () => {
    await assert.rejects(
      () => getShareLink('nope', 'f1'),
      { message: /Unknown provider/ },
    );
  });

  it('openFile downloads and returns data', async () => {
    const result = await openFile('fileops', 'f1');
    assert.ok(result.data instanceof ArrayBuffer, 'data should be ArrayBuffer');
    assert.equal(result.file.id, 'f1');
    assert.equal(result.file.provider, 'fileops');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// D. Workspace Sync
// ══════════════════════════════════════════════════════════════════════════════

describe('D — Workspace Sync', () => {
  beforeEach(() => {
    localStorage.clear();
    // Set up minimal state for workspace-controller
    state.docName = 'integration-test.pdf';
    state.pageCount = 3;
    state.adapter = { type: 'pdf' };

    // Register minimal deps so buildWorkspacePayload / applyWorkspacePayload work
    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: 'Test Note', tags: 'tag1', body: 'body' }),
      normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
      saveNotes: () => {},
      loadBookmarks: () => [{ page: 1, label: 'Ch1' }],
      saveBookmarks: () => {},
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, fallback) => v || fallback,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
      renderPagePreviews: async () => {},
      renderCurrentPage: async () => {},
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('buildWorkspacePayload returns correct structure', () => {
    const payload = buildWorkspacePayload();
    assert.equal(payload.app, 'NovaReader');
    assert.equal(payload.type, 'workspace-backup');
    assert.equal(payload.version, 1);
    assert.equal(payload.docName, 'integration-test.pdf');
    assert.equal(payload.pageCount, 3);
    assert.ok(payload.exportedAt, 'should have exportedAt');
    assert.ok(payload.notes, 'should have notes');
    assert.equal(payload.notes.title, 'Test Note');
    assert.ok(Array.isArray(payload.bookmarks), 'should have bookmarks array');
    assert.ok(payload.hotkeys, 'should have hotkeys');
    assert.ok(typeof payload.pages === 'object', 'should have pages object');
  });

  it('applyWorkspacePayload rejects invalid payload', async () => {
    await assert.rejects(
      () => applyWorkspacePayload(null, { skipConfirm: true }),
      { message: /bad workspace payload/ },
    );

    await assert.rejects(
      () => applyWorkspacePayload({ type: 'wrong' }, { skipConfirm: true }),
      { message: /bad workspace payload/ },
    );

    await assert.rejects(
      () => applyWorkspacePayload('not-an-object', { skipConfirm: true }),
      { message: /bad workspace payload/ },
    );
  });

  it('applyWorkspacePayload accepts valid payload (skipConfirm)', async () => {
    const payload = buildWorkspacePayload();
    const result = await applyWorkspacePayload(payload, { skipConfirm: true });
    assert.equal(result, true, 'should return true on success');
  });

  it('push/pull roundtrip with mocked cloud preserves workspace data', async () => {
    // Simulate push: build payload, serialize, then parse (simulating server round-trip)
    const pushPayload = buildWorkspacePayload();
    const serialized = JSON.stringify(pushPayload);
    const pullPayload = JSON.parse(serialized);

    // Apply the pulled payload
    const result = await applyWorkspacePayload(pullPayload, { skipConfirm: true });
    assert.equal(result, true);

    // Rebuild and verify key fields survived the round-trip
    const rebuilt = buildWorkspacePayload();
    assert.equal(rebuilt.docName, pushPayload.docName);
    assert.equal(rebuilt.pageCount, pushPayload.pageCount);
    assert.equal(rebuilt.notes.title, pushPayload.notes.title);
    assert.equal(rebuilt.notes.tags, pushPayload.notes.tags);
    assert.equal(rebuilt.notes.body, pushPayload.notes.body);
  });

  it('applyWorkspacePayload handles missing optional fields gracefully', async () => {
    const minimal = {
      type: 'workspace-backup',
      docName: 'integration-test.pdf',
    };
    const result = await applyWorkspacePayload(minimal, { skipConfirm: true });
    assert.equal(result, true);
  });

  it('applyWorkspacePayload filters invalid bookmarks', async () => {
    const saved = [];
    initWorkspaceDeps({
      loadStrokes: () => [],
      saveStrokes: () => {},
      loadComments: () => [],
      saveComments: () => {},
      getNotesModel: () => ({ title: '', tags: '', body: '' }),
      normalizeImportedNotes: (n) => n || { title: '', tags: '', body: '' },
      saveNotes: () => {},
      saveBookmarks: (b) => { saved.push(...b); },
      loadBookmarks: () => [],
      renderBookmarks: () => {},
      setBookmarksStatus: () => {},
      normalizeHotkey: (v, f) => v || f,
      validateHotkeys: () => ({ ok: true }),
      renderHotkeyInputs: () => {},
      setHotkeysInputErrors: () => {},
      setHotkeysStatus: () => {},
      renderAnnotations: () => {},
      renderCommentList: () => {},
      clearDocumentAnnotationStorage: () => {},
      clearDocumentCommentStorage: () => {},
      renderPagePreviews: async () => {},
      renderCurrentPage: async () => {},
    });

    const payload = {
      type: 'workspace-backup',
      docName: 'integration-test.pdf',
      bookmarks: [
        { page: 1, label: 'Valid' },
        { page: 999, label: 'OutOfRange' },   // > pageCount=3
        { page: -1, label: 'Negative' },
        null,
        { label: 'NoPage' },
      ],
    };

    await applyWorkspacePayload(payload, { skipConfirm: true });
    // Only page=1 should survive (page 999 and -1 are out of range, null and {nopage} are invalid)
    assert.equal(saved.length, 1);
    assert.equal(saved[0].page, 1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E. E2E Encryption (sync-encryption module)
// ══════════════════════════════════════════════════════════════════════════════

describe('E — E2E Encryption', () => {
  it('generateSalt returns 16-byte Uint8Array', () => {
    const salt = generateSalt();
    assert.ok(salt instanceof Uint8Array);
    assert.equal(salt.length, 16);
  });

  it('generateSalt returns unique salts', () => {
    const a = generateSalt();
    const b = generateSalt();
    // Extremely unlikely to collide
    const same = a.every((v, i) => v === b[i]);
    assert.equal(same, false, 'two salts should differ');
  });

  it('deriveKey produces a CryptoKey from passphrase + salt', async () => {
    const salt = generateSalt();
    const key = await deriveKey('my-secret-passphrase', salt);
    assert.ok(key, 'key should be truthy');
    // CryptoKey has a type property
    assert.equal(key.type, 'secret');
    assert.ok(key.algorithm, 'should have algorithm info');
  });

  it('deriveKey throws on empty passphrase', async () => {
    const salt = generateSalt();
    await assert.rejects(
      () => deriveKey('', salt),
      { message: /Passphrase is required/ },
    );
  });

  it('deriveKey throws on invalid salt length', async () => {
    await assert.rejects(
      () => deriveKey('pass', new Uint8Array(8)),
      { message: /Salt must be 16 bytes/ },
    );
  });

  it('encrypt/decrypt roundtrip preserves binary data', async () => {
    const salt = generateSalt();
    const key = await deriveKey('roundtrip-test', salt);

    const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const encrypted = await encrypt(original, key);

    assert.ok(encrypted.iv instanceof Uint8Array, 'iv should be Uint8Array');
    assert.equal(encrypted.iv.length, 12, 'iv should be 12 bytes');
    assert.ok(encrypted.ciphertext instanceof Uint8Array, 'ciphertext should be Uint8Array');
    assert.ok(encrypted.ciphertext.length > 0, 'ciphertext should not be empty');

    const decryptedBuf = await decrypt(encrypted, key);
    const decrypted = new Uint8Array(decryptedBuf);
    assert.deepEqual([...decrypted], [...original], 'decrypted data should match original');
  });

  it('encrypt/decrypt roundtrip preserves string data', async () => {
    const salt = generateSalt();
    const key = await deriveKey('string-test', salt);

    const original = 'Hello, NovaReader cloud sync!';
    const encrypted = await encrypt(original, key);
    const decryptedBuf = await decrypt(encrypted, key);
    const decrypted = new TextDecoder().decode(decryptedBuf);
    assert.equal(decrypted, original);
  });

  it('encrypt/decrypt roundtrip with ArrayBuffer input', async () => {
    const salt = generateSalt();
    const key = await deriveKey('arraybuffer-test', salt);

    const original = new Uint8Array([0xFF, 0x00, 0xAB, 0xCD]);
    const encrypted = await encrypt(original.buffer, key);
    const decryptedBuf = await decrypt(encrypted, key);
    const decrypted = new Uint8Array(decryptedBuf);
    assert.deepEqual([...decrypted], [...original]);
  });

  it('decrypt fails with wrong key (tamper detection)', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('correct-passphrase', salt);
    const key2 = await deriveKey('wrong-passphrase', salt);

    const encrypted = await encrypt('sensitive data', key1);

    await assert.rejects(
      () => decrypt(encrypted, key2),
      // AES-GCM decryption with wrong key throws an OperationError
      (err) => err.name === 'OperationError' || err.message.includes('decrypt'),
    );
  });

  it('decrypt fails with tampered ciphertext', async () => {
    const salt = generateSalt();
    const key = await deriveKey('tamper-test', salt);

    const encrypted = await encrypt('original content', key);
    // Flip a byte in the ciphertext
    encrypted.ciphertext[0] ^= 0xFF;

    await assert.rejects(
      () => decrypt(encrypted, key),
      (err) => err.name === 'OperationError' || err.message.includes('decrypt'),
    );
  });

  it('decrypt fails with tampered IV', async () => {
    const salt = generateSalt();
    const key = await deriveKey('iv-tamper-test', salt);

    const encrypted = await encrypt('test data', key);
    // Flip a byte in the IV
    encrypted.iv[0] ^= 0xFF;

    await assert.rejects(
      () => decrypt(encrypted, key),
      (err) => err.name === 'OperationError' || err.message.includes('decrypt'),
    );
  });

  it('same plaintext produces different ciphertext (random IV)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('random-iv-test', salt);

    const enc1 = await encrypt('same data', key);
    const enc2 = await encrypt('same data', key);

    // IVs should differ
    const sameIv = enc1.iv.every((v, i) => v === enc2.iv[i]);
    assert.equal(sameIv, false, 'IVs should be different');

    // Ciphertexts should differ
    const sameCt = enc1.ciphertext.length === enc2.ciphertext.length &&
      enc1.ciphertext.every((v, i) => v === enc2.ciphertext[i]);
    assert.equal(sameCt, false, 'ciphertexts should differ due to random IV');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// F. Cloud Integration + Encryption (end-to-end)
// ══════════════════════════════════════════════════════════════════════════════

describe('F — Cloud + Encryption integration', () => {
  let uploadedData;

  beforeEach(async () => {
    uploadedData = null;

    const mockProvider = createMockProvider('enc-test', 'EncTest', {
      uploadFile: async (name, data, mime, folder) => {
        uploadedData = data;
        return { id: 'enc-up1', name, mimeType: mime, size: data.byteLength || data.length, modifiedAt: new Date().toISOString(), provider: 'enc-test' };
      },
      downloadFile: async () => {
        // Return whatever was last uploaded
        if (uploadedData instanceof Uint8Array) return uploadedData.buffer.slice(0);
        if (uploadedData instanceof ArrayBuffer) return uploadedData;
        return new ArrayBuffer(0);
      },
    });
    registerProvider(mockProvider);
    await authenticate('enc-test');
  });

  afterEach(async () => {
    await setEncryptionPassphrase(null);
  });

  it('saveFile with encryption produces NRSE envelope', async () => {
    await setEncryptionPassphrase('integration-test-pass');

    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
    await saveFile('enc-test', 'encrypted.pdf', plaintext, 'application/pdf');

    assert.ok(uploadedData, 'should have uploaded data');
    const bytes = new Uint8Array(uploadedData instanceof ArrayBuffer ? uploadedData : uploadedData.buffer || uploadedData);
    // Check NRSE magic header
    assert.equal(bytes[0], 0x4E, 'N');
    assert.equal(bytes[1], 0x52, 'R');
    assert.equal(bytes[2], 0x53, 'S');
    assert.equal(bytes[3], 0x45, 'E');
    // Envelope should be longer than plaintext (4 magic + 16 salt + 12 iv + ciphertext with auth tag)
    assert.ok(bytes.length > plaintext.length + 32, 'envelope should be larger than plaintext');
  });

  it('saveFile without encryption does not add NRSE envelope', async () => {
    await setEncryptionPassphrase(null);

    const plaintext = new Uint8Array([10, 20, 30]);
    await saveFile('enc-test', 'plain.pdf', plaintext, 'application/pdf');

    const bytes = new Uint8Array(uploadedData instanceof ArrayBuffer ? uploadedData : uploadedData.buffer || uploadedData);
    // Should NOT have NRSE magic
    const hasNRSE = bytes[0] === 0x4E && bytes[1] === 0x52 && bytes[2] === 0x53 && bytes[3] === 0x45;
    assert.equal(hasNRSE, false, 'should not have NRSE header when encryption is off');
  });
});
