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
});
