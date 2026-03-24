import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const {
  registerProvider,
  getProviders,
  getProvider,
  authenticate,
  listFiles,
  openFile,
  saveFile,
  getShareLink,
  signOut,
  getConnectionStatus,
  onStatusChange,
  createGoogleDriveProvider,
  createOneDriveProvider,
  createDropboxProvider,
  setEncryptionPassphrase,
  MODULE_STATUS,
  MODULE_REQUIRES,
} = await import('../../app/modules/cloud-integration.js');

function makeMockProvider(id = 'test', name = 'Test') {
  let authed = false;
  return {
    id,
    name,
    authenticate: async () => { authed = true; return true; },
    isAuthenticated: () => authed,
    listFiles: async () => [{ id: 'f1', name: 'doc.pdf', mimeType: 'application/pdf', size: 100, modifiedAt: '', provider: id }],
    downloadFile: async () => new ArrayBuffer(8),
    uploadFile: async (n, d, m) => ({ id: 'f2', name: n, mimeType: m, size: 0, modifiedAt: '', provider: id }),
    getShareLink: async () => 'https://example.com/share',
    signOut: async () => { authed = false; },
  };
}

describe('cloud-integration', () => {
  beforeEach(() => {
    // Clear providers by re-registering nothing — we can't clear the internal Map
    // but we can overwrite test providers
  });

  it('MODULE_STATUS is stub', () => {
    assert.equal(MODULE_STATUS, 'stub');
  });

  it('MODULE_REQUIRES is an array with requirements', () => {
    assert.ok(Array.isArray(MODULE_REQUIRES));
    assert.ok(MODULE_REQUIRES.length > 0);
  });

  it('registerProvider and getProvider work', () => {
    const p = makeMockProvider('reg-test', 'RegTest');
    registerProvider(p);
    assert.equal(getProvider('reg-test'), p);
  });

  it('getProviders returns all registered providers', () => {
    registerProvider(makeMockProvider('gp1', 'GP1'));
    const all = getProviders();
    assert.ok(all.length >= 1);
    assert.ok(all.some(p => p.id === 'gp1'));
  });

  it('getProvider returns null for unknown id', () => {
    assert.equal(getProvider('nonexistent-xyz'), null);
  });

  it('authenticate calls provider.authenticate', async () => {
    const p = makeMockProvider('auth-test');
    registerProvider(p);
    const result = await authenticate('auth-test');
    assert.equal(result, true);
    assert.equal(p.isAuthenticated(), true);
  });

  it('authenticate throws for unknown provider', async () => {
    await assert.rejects(() => authenticate('unknown-xyz'), /Unknown provider/);
  });

  it('listFiles throws if not authenticated', async () => {
    const p = makeMockProvider('list-test');
    registerProvider(p);
    // Not authenticated yet (isAuthenticated returns false initially... wait, our mock starts false)
    // Actually our mock starts authed=false
    await assert.rejects(() => listFiles('list-test'), /Not authenticated/);
  });

  it('listFiles returns files when authenticated', async () => {
    const p = makeMockProvider('list-test2');
    registerProvider(p);
    await authenticate('list-test2');
    const files = await listFiles('list-test2');
    assert.ok(Array.isArray(files));
    assert.equal(files.length, 1);
  });

  it('openFile downloads and returns data', async () => {
    const p = makeMockProvider('open-test');
    registerProvider(p);
    const result = await openFile('open-test', 'f1');
    assert.ok(result.data instanceof ArrayBuffer);
    assert.equal(result.file.id, 'f1');
  });

  it('saveFile uploads data', async () => {
    const p = makeMockProvider('save-test');
    registerProvider(p);
    const result = await saveFile('save-test', 'test.pdf', new ArrayBuffer(4));
    assert.equal(result.name, 'test.pdf');
  });

  it('getShareLink returns a URL string', async () => {
    const p = makeMockProvider('share-test');
    registerProvider(p);
    const link = await getShareLink('share-test', 'f1');
    assert.equal(link, 'https://example.com/share');
  });

  it('signOut calls provider signOut', async () => {
    const p = makeMockProvider('signout-test');
    registerProvider(p);
    await authenticate('signout-test');
    assert.equal(p.isAuthenticated(), true);
    await signOut('signout-test');
    assert.equal(p.isAuthenticated(), false);
  });

  it('onStatusChange subscribes and returns unsubscribe function', () => {
    let called = false;
    const unsub = onStatusChange(() => { called = true; });
    assert.equal(typeof unsub, 'function');
    // Trigger status change
    registerProvider(makeMockProvider('status-test'));
    assert.equal(called, true);
    unsub();
  });

  it('createGoogleDriveProvider returns a provider object', () => {
    const p = createGoogleDriveProvider();
    assert.equal(p.id, 'gdrive');
    assert.equal(p.name, 'Google Drive');
    assert.equal(p.isAuthenticated(), false);
  });

  it('createOneDriveProvider returns a provider object', () => {
    const p = createOneDriveProvider();
    assert.equal(p.id, 'onedrive');
    assert.equal(p.name, 'OneDrive');
  });

  it('createDropboxProvider returns a provider object', () => {
    const p = createDropboxProvider();
    assert.equal(p.id, 'dropbox');
    assert.equal(p.name, 'Dropbox');
  });

  // ─── setEncryptionPassphrase ────────────────────────────────────────────
  it('setEncryptionPassphrase with null clears encryption', async () => {
    // Should not throw when clearing
    await setEncryptionPassphrase(null);
  });

  it('setEncryptionPassphrase with empty string clears encryption', async () => {
    await setEncryptionPassphrase('');
  });

  it('setEncryptionPassphrase with a passphrase sets encryption key', async () => {
    await setEncryptionPassphrase('my-secret');
    // Verify encryption is active by doing a save that triggers encryption path
    const uploaded = [];
    const p = {
      id: 'enc-save-test',
      name: 'EncSaveTest',
      authenticate: async () => true,
      isAuthenticated: () => true,
      listFiles: async () => [],
      downloadFile: async () => new ArrayBuffer(8),
      uploadFile: async (n, d, m) => { uploaded.push({ n, d, m }); return { id: 'x', name: n, mimeType: m, size: 0, modifiedAt: '', provider: 'enc-save-test' }; },
      getShareLink: async () => '',
      signOut: async () => {},
    };
    registerProvider(p);
    await saveFile('enc-save-test', 'enc.pdf', new ArrayBuffer(16));
    // The uploaded data should be an encrypted envelope starting with NRSE magic bytes
    assert.ok(uploaded.length === 1);
    const data = new Uint8Array(uploaded[0].d);
    assert.equal(data[0], 0x4E); // N
    assert.equal(data[1], 0x52); // R
    assert.equal(data[2], 0x53); // S
    assert.equal(data[3], 0x45); // E
    // Clear encryption for subsequent tests
    await setEncryptionPassphrase(null);
  });

  // ─── getConnectionStatus ───────────────────────────────────────────────
  it('getConnectionStatus returns status array', () => {
    const p = makeMockProvider('conn-test', 'ConnTest');
    registerProvider(p);
    const status = getConnectionStatus();
    assert.ok(Array.isArray(status));
    const entry = status.find(s => s.id === 'conn-test');
    assert.ok(entry);
    assert.equal(entry.name, 'ConnTest');
    assert.equal(entry.connected, false);
  });

  it('getConnectionStatus reflects authentication state', async () => {
    const p = makeMockProvider('conn-test2', 'ConnTest2');
    registerProvider(p);
    await authenticate('conn-test2');
    const status = getConnectionStatus();
    const entry = status.find(s => s.id === 'conn-test2');
    assert.ok(entry);
    assert.equal(entry.connected, true);
  });

  // ─── Error paths ──────────────────────────────────────────────────────
  it('listFiles throws for unknown provider', async () => {
    await assert.rejects(() => listFiles('unknown-xyz'), /Unknown provider/);
  });

  it('openFile throws for unknown provider', async () => {
    await assert.rejects(() => openFile('unknown-xyz', 'f1'), /Unknown provider/);
  });

  it('saveFile throws for unknown provider', async () => {
    await assert.rejects(() => saveFile('unknown-xyz', 'x.pdf', new ArrayBuffer(0)), /Unknown provider/);
  });

  it('getShareLink throws for unknown provider', async () => {
    await assert.rejects(() => getShareLink('unknown-xyz', 'f1'), /Unknown provider/);
  });

  it('signOut is a no-op for unknown provider', async () => {
    // Should not throw
    await signOut('unknown-xyz');
  });

  // ─── onStatusChange listener error handling ───────────────────────────
  it('onStatusChange listener errors are caught', () => {
    const unsub = onStatusChange(() => { throw new Error('boom'); });
    // Trigger status by registering a provider — should not throw
    registerProvider(makeMockProvider('err-listener-test'));
    unsub();
  });

  // ─── Provider stub methods ─────────────────────────────────────────────
  it('Google Drive provider stub methods work', async () => {
    const p = createGoogleDriveProvider();
    assert.equal(await p.authenticate(), false);
    assert.equal(p.isAuthenticated(), false);
    const files = await p.listFiles();
    assert.deepEqual(files, []);
    const data = await p.downloadFile('x');
    assert.ok(data instanceof ArrayBuffer);
    const uploaded = await p.uploadFile('test.pdf');
    assert.equal(uploaded.name, 'test.pdf');
    assert.equal(await p.getShareLink('x'), '');
    await p.signOut();
  });

  it('OneDrive provider stub methods work', async () => {
    const p = createOneDriveProvider();
    assert.equal(await p.authenticate(), false);
    assert.equal(p.isAuthenticated(), false);
    const files = await p.listFiles();
    assert.deepEqual(files, []);
    const data = await p.downloadFile('x');
    assert.ok(data instanceof ArrayBuffer);
    const uploaded = await p.uploadFile('test.pdf');
    assert.equal(uploaded.name, 'test.pdf');
    assert.equal(await p.getShareLink('x'), '');
    await p.signOut();
  });

  it('Dropbox provider stub methods work', async () => {
    const p = createDropboxProvider();
    assert.equal(await p.authenticate(), false);
    assert.equal(p.isAuthenticated(), false);
    const files = await p.listFiles();
    assert.deepEqual(files, []);
    const data = await p.downloadFile('x');
    assert.ok(data instanceof ArrayBuffer);
    const uploaded = await p.uploadFile('test.pdf');
    assert.equal(uploaded.name, 'test.pdf');
    assert.equal(await p.getShareLink('x'), '');
    await p.signOut();
  });

  // ─── openFile with encryption active ──────────────────────────────────
  it('openFile returns raw data when encryption is active but data has no envelope', async () => {
    await setEncryptionPassphrase('test-pass');
    const p = makeMockProvider('open-enc-test');
    registerProvider(p);
    // downloadFile returns plain ArrayBuffer(8) — no NRSE header, so decryption is skipped
    const result = await openFile('open-enc-test', 'f1');
    assert.ok(result.data instanceof ArrayBuffer);
    await setEncryptionPassphrase(null);
  });

  it('openFile handles decryption failure gracefully', async () => {
    await setEncryptionPassphrase('test-pass-2');
    // Create a provider that returns data with NRSE header but invalid ciphertext
    const fakeEnvelope = new Uint8Array(64);
    fakeEnvelope[0] = 0x4E; // N
    fakeEnvelope[1] = 0x52; // R
    fakeEnvelope[2] = 0x53; // S
    fakeEnvelope[3] = 0x45; // E
    const p = {
      id: 'open-enc-fail',
      name: 'EncFail',
      authenticate: async () => true,
      isAuthenticated: () => true,
      listFiles: async () => [],
      downloadFile: async () => fakeEnvelope.buffer,
      uploadFile: async (n) => ({ id: 'x', name: n, mimeType: '', size: 0, modifiedAt: '', provider: 'open-enc-fail' }),
      getShareLink: async () => '',
      signOut: async () => {},
    };
    registerProvider(p);
    // Should not throw — falls back to raw data
    const result = await openFile('open-enc-fail', 'f1');
    assert.ok(result.data);
    await setEncryptionPassphrase(null);
  });
});
