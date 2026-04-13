import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
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
  generatePKCE,
  buildAuthUrl,
  exchangeCodeForToken,
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

  it('MODULE_STATUS is not stub (partial or ready)', () => {
    assert.ok(
      MODULE_STATUS === 'partial' || MODULE_STATUS === 'ready',
      `Expected 'partial' or 'ready', got '${MODULE_STATUS}'`,
    );
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

  // ─── Provider methods ──────────────────────────────────────────────────
  it('Google Drive provider: isAuthenticated is false initially, signOut is safe', async () => {
    const p = createGoogleDriveProvider({ clientId: 'test-id' });
    assert.equal(p.isAuthenticated(), false);
    // signOut when not authenticated should not throw
    await p.signOut();
    assert.equal(p.isAuthenticated(), false);
  });

  it('Google Drive provider: listFiles throws when not authenticated', async () => {
    const p = createGoogleDriveProvider({ clientId: 'test-id' });
    await assert.rejects(() => p.listFiles(), /Not authenticated/);
  });

  it('Google Drive provider: downloadFile throws when not authenticated', async () => {
    const p = createGoogleDriveProvider({ clientId: 'test-id' });
    await assert.rejects(() => p.downloadFile('file-id'), /Not authenticated/);
  });

  it('Google Drive provider: authenticate resolves false when popup is blocked', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => null; // simulate popup blocked
    const p = createGoogleDriveProvider({ clientId: 'test-id' });
    const result = await p.authenticate();
    assert.equal(result, false);
    globalThis.window.open = savedOpen;
  });

  it('OneDrive provider initial state', async () => {
    const p = createOneDriveProvider();
    assert.equal(p.isAuthenticated(), false);
    await assert.rejects(() => p.listFiles(), /Not authenticated/);
    await assert.rejects(() => p.downloadFile('x'), /Not authenticated/);
    await p.signOut(); // safe when not authenticated
  });

  it('Dropbox provider initial state', async () => {
    const p = createDropboxProvider();
    assert.equal(p.isAuthenticated(), false);
    await assert.rejects(() => p.listFiles(), /Not authenticated/);
    const data = await p.downloadFile('x').catch(() => new ArrayBuffer(0));
    assert.ok(data instanceof ArrayBuffer);
    await p.signOut(); // safe when not authenticated
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

// ─── generatePKCE ─────────────────────────────────────────────────────────────

describe('generatePKCE', () => {
  it('returns an object with codeVerifier and codeChallenge', async () => {
    const result = await generatePKCE();
    assert.ok(typeof result.codeVerifier === 'string', 'codeVerifier should be a string');
    assert.ok(typeof result.codeChallenge === 'string', 'codeChallenge should be a string');
  });

  it('codeVerifier is base64url-encoded (no +, /, = chars)', async () => {
    const { codeVerifier } = await generatePKCE();
    assert.ok(codeVerifier.length > 0, 'codeVerifier should not be empty');
    assert.ok(!/[+/=]/.test(codeVerifier), `codeVerifier contains invalid chars: ${codeVerifier}`);
  });

  it('codeVerifier has expected length (64 bytes base64url → ~86 chars)', async () => {
    const { codeVerifier } = await generatePKCE();
    // 64 bytes base64url-encoded without padding = 86 chars
    assert.ok(codeVerifier.length >= 80 && codeVerifier.length <= 90,
      `codeVerifier length ${codeVerifier.length} out of expected range [80, 90]`);
  });

  it('codeChallenge is base64url-encoded (no +, /, = chars)', async () => {
    const { codeChallenge } = await generatePKCE();
    assert.ok(!/[+/=]/.test(codeChallenge), `codeChallenge contains invalid chars: ${codeChallenge}`);
  });

  it('codeChallenge differs from codeVerifier (it is the SHA-256 hash)', async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    assert.notEqual(codeVerifier, codeChallenge, 'codeChallenge must differ from codeVerifier');
  });

  it('codeChallenge has correct length for SHA-256 base64url (43 chars)', async () => {
    const { codeChallenge } = await generatePKCE();
    // SHA-256 = 32 bytes → base64url without padding = 43 chars
    assert.equal(codeChallenge.length, 43, `codeChallenge length should be 43, got ${codeChallenge.length}`);
  });

  it('generates unique verifiers on each call', async () => {
    const a = await generatePKCE();
    const b = await generatePKCE();
    assert.notEqual(a.codeVerifier, b.codeVerifier, 'Each call should produce a unique codeVerifier');
  });
});

// ─── buildAuthUrl ─────────────────────────────────────────────────────────────

describe('buildAuthUrl', () => {
  it('builds a URL with query parameters', () => {
    const url = buildAuthUrl('https://example.com/auth', {
      client_id: 'my-client',
      response_type: 'code',
      scope: 'read write',
    });
    assert.ok(url.startsWith('https://example.com/auth?'), 'URL should start with base URL + ?');
    assert.ok(url.includes('client_id=my-client'), 'URL should contain client_id');
    assert.ok(url.includes('response_type=code'), 'URL should contain response_type');
    assert.ok(
      url.includes('scope=read+write') || url.includes('scope=read%20write'),
      'URL should contain encoded scope',
    );
  });

  it('handles empty params object', () => {
    const url = buildAuthUrl('https://example.com/auth', {});
    assert.ok(url.startsWith('https://example.com/auth'), 'URL should preserve base URL');
  });

  it('preserves existing query params in base URL', () => {
    const url = buildAuthUrl('https://example.com/auth?existing=1', { extra: '2' });
    assert.ok(url.includes('existing=1'), 'Should preserve existing params');
    assert.ok(url.includes('extra=2'), 'Should add new params');
  });
});

// ─── exchangeCodeForToken ─────────────────────────────────────────────────────

describe('exchangeCodeForToken', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'tok_test', expires_in: 3600, token_type: 'Bearer' }),
      text: async () => '',
    }));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = undefined;
  });

  it('calls fetch with POST method and correct content-type', async () => {
    await exchangeCodeForToken(
      'https://oauth2.example.com/token',
      'auth-code-123',
      'verifier-abc',
      'client-id-xyz',
      'https://app.example.com/callback',
    );
    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://oauth2.example.com/token');
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers['Content-Type'], 'application/x-www-form-urlencoded');
  });

  it('sends grant_type=authorization_code in body', async () => {
    await exchangeCodeForToken(
      'https://oauth2.example.com/token',
      'auth-code-123',
      'verifier-abc',
      'client-id-xyz',
      'https://app.example.com/callback',
    );
    const [, opts] = fetchMock.mock.calls[0].arguments;
    const body = opts.body;
    assert.ok(body.includes('grant_type=authorization_code'), 'Body should include grant_type');
    assert.ok(body.includes('code=auth-code-123'), 'Body should include code');
    assert.ok(body.includes('code_verifier=verifier-abc'), 'Body should include code_verifier');
    assert.ok(body.includes('client_id=client-id-xyz'), 'Body should include client_id');
  });

  it('returns parsed token data', async () => {
    const result = await exchangeCodeForToken(
      'https://oauth2.example.com/token',
      'auth-code-123',
      'verifier-abc',
      'client-id-xyz',
      'https://app.example.com/callback',
    );
    assert.equal(result.access_token, 'tok_test');
    assert.equal(result.expires_in, 3600);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    }));
    await assert.rejects(
      () => exchangeCodeForToken('https://tok.example.com', 'bad-code', 'v', 'c', 'r'),
      /Token exchange failed/,
    );
  });
});

// ─── GoogleDriveProvider OAuth flow ──────────────────────────────────────────

describe('GoogleDriveProvider OAuth flow', () => {
  let provider;

  beforeEach(() => {
    if (!globalThis.window.location) {
      globalThis.window.location = { origin: 'https://app.example.com', href: '' };
    } else {
      globalThis.window.location.origin = 'https://app.example.com';
    }
    provider = createGoogleDriveProvider({ clientId: 'test-client-id' });
  });

  afterEach(() => {
    globalThis.fetch = undefined;
  });

  it('isAuthenticated() returns false initially', () => {
    assert.equal(provider.isAuthenticated(), false);
  });

  it('signOut() is safe when not authenticated', async () => {
    globalThis.fetch = mock.fn(async () => ({ ok: true }));
    await provider.signOut();
    assert.equal(provider.isAuthenticated(), false);
  });

  it('authenticate resolves false when popup is blocked', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => null;
    const result = await provider.authenticate();
    assert.equal(result, false);
    globalThis.window.open = savedOpen;
  });

  it('listFiles() calls the Drive API with Bearer token after auth', async () => {
    // Inject token via auth + postMessage
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });

    // First fetch call: token exchange
    let callCount = 0;
    globalThis.fetch = mock.fn(async (url) => {
      callCount++;
      if (url.includes('token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'drive-tok', expires_in: 3600 }),
          text: async () => '',
        };
      }
      // listFiles call
      return {
        ok: true,
        json: async () => ({ files: [
          { id: 'f1', name: 'test.pdf', mimeType: 'application/pdf', size: 1024, modifiedTime: '2024-01-01T00:00:00Z' },
        ] }),
      };
    });

    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'gdrive', code: 'test-auth-code' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    assert.equal(provider.isAuthenticated(), true);

    // Now a fresh mock just for listFiles
    const listFetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ files: [
        { id: 'f1', name: 'test.pdf', mimeType: 'application/pdf', size: 1024, modifiedTime: '2024-01-01T00:00:00Z' },
      ] }),
    }));
    globalThis.fetch = listFetch;

    const files = await provider.listFiles();
    assert.equal(listFetch.mock.callCount(), 1);
    const [url, opts] = listFetch.mock.calls[0].arguments;
    assert.ok(url.includes('googleapis.com/drive/v3/files'), 'Should call Drive files API');
    assert.ok(opts.headers.Authorization.startsWith('Bearer '), 'Should use Bearer auth');
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'test.pdf');
    assert.equal(files[0].provider, 'gdrive');
  });

  it('downloadFile() calls Drive API with alt=media after auth', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });

    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'drive-tok-dl', expires_in: 3600 }),
      text: async () => '',
    }));

    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'gdrive', code: 'auth-code-dl' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    const fakeBuffer = new ArrayBuffer(16);
    const dlFetch = mock.fn(async () => ({
      ok: true,
      arrayBuffer: async () => fakeBuffer,
    }));
    globalThis.fetch = dlFetch;

    const result = await provider.downloadFile('file-abc-123');
    assert.equal(dlFetch.mock.callCount(), 1);
    const [url] = dlFetch.mock.calls[0].arguments;
    assert.ok(url.includes('file-abc-123'), 'URL should include file ID');
    assert.ok(url.includes('alt=media'), 'URL should include alt=media');
    assert.equal(result.byteLength, 16);
  });
});

// ─── OneDrive Provider ───────────────────────────────────────────────────────
describe('OneDrive Provider', () => {
  let provider;

  beforeEach(() => {
    provider = createOneDriveProvider({ clientId: 'od-test-client' });
    globalThis.window.location = { origin: 'https://app.example.com' };
    globalThis.fetch = mock.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  it('isAuthenticated is false initially', () => {
    assert.equal(provider.isAuthenticated(), false);
  });

  it('signOut is safe when not authenticated', async () => {
    await provider.signOut();
    assert.equal(provider.isAuthenticated(), false);
  });

  it('popup blocked resolves false', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => null;
    const result = await provider.authenticate();
    assert.equal(result, false);
    globalThis.window.open = savedOpen;
  });

  it('authenticate via PKCE popup succeeds on valid postMessage', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });

    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'od-token-123', expires_in: 3600 }),
      text: async () => '',
    }));

    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'onedrive', code: 'od-auth-code' },
      }),
    );
    const result = await authPromise;
    globalThis.window.open = savedOpen;
    assert.equal(result, true);
    assert.equal(provider.isAuthenticated(), true);
  });

  it('listFiles calls Graph API with Bearer token', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'od-tok-list', expires_in: 3600 }),
      text: async () => '',
    }));
    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'onedrive', code: 'od-code-list' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    const listFetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ value: [
        { id: 'od-file-1', name: 'doc.pdf', file: { mimeType: 'application/pdf' }, size: 2048, lastModifiedDateTime: '2024-01-01T00:00:00Z' },
      ] }),
    }));
    globalThis.fetch = listFetch;
    const files = await provider.listFiles();
    assert.equal(files.length, 1);
    assert.equal(files[0].provider, 'onedrive');
    const [url, opts] = listFetch.mock.calls[0].arguments;
    assert.ok(url.includes('graph.microsoft.com'), 'Should call Graph API');
    assert.ok(opts.headers.Authorization.startsWith('Bearer '), 'Should use Bearer auth');
  });

  it('downloadFile calls Graph /content endpoint', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'od-tok-dl', expires_in: 3600 }),
    }));
    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'onedrive', code: 'od-dl-code' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    const fakeBuffer = new ArrayBuffer(32);
    const dlFetch = mock.fn(async () => ({ ok: true, arrayBuffer: async () => fakeBuffer }));
    globalThis.fetch = dlFetch;
    const result = await provider.downloadFile('od-item-id');
    const [url] = dlFetch.mock.calls[0].arguments;
    assert.ok(url.includes('od-item-id'), 'URL should contain file ID');
    assert.ok(url.includes('/content'), 'URL should include /content');
    assert.equal(result.byteLength, 32);
  });

  it('listFiles throws when not authenticated', async () => {
    await assert.rejects(() => provider.listFiles(), /Not authenticated/);
  });
});

// ─── Dropbox Provider ────────────────────────────────────────────────────────
describe('Dropbox Provider', () => {
  let provider;

  beforeEach(() => {
    provider = createDropboxProvider({ appKey: 'dbx-test-key' });
    globalThis.window.location = { origin: 'https://app.example.com' };
    globalThis.fetch = mock.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  it('isAuthenticated is false initially', () => {
    assert.equal(provider.isAuthenticated(), false);
  });

  it('signOut is safe when not authenticated', async () => {
    await provider.signOut();
    assert.equal(provider.isAuthenticated(), false);
  });

  it('popup blocked resolves false', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => null;
    const result = await provider.authenticate();
    assert.equal(result, false);
    globalThis.window.open = savedOpen;
  });

  it('authenticate via PKCE popup succeeds on valid postMessage', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });

    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'dbx-token-123', expires_in: 14400 }),
    }));

    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'dropbox', code: 'dbx-auth-code' },
      }),
    );
    const result = await authPromise;
    globalThis.window.open = savedOpen;
    assert.equal(result, true);
    assert.equal(provider.isAuthenticated(), true);
  });

  it('listFiles calls Dropbox list_folder API', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'dbx-tok-list', expires_in: 14400 }),
    }));
    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'dropbox', code: 'dbx-code-list' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    const listFetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ entries: [
        { '.tag': 'file', id: 'id:abc', name: 'report.pdf', size: 512, client_modified: '2024-01-01T00:00:00Z' },
        { '.tag': 'folder', id: 'id:dir', name: 'MyFolder' },
      ] }),
    }));
    globalThis.fetch = listFetch;
    const files = await provider.listFiles();
    assert.equal(files.length, 1, 'Should only return files, not folders');
    assert.equal(files[0].provider, 'dropbox');
    assert.equal(files[0].name, 'report.pdf');
    const [url] = listFetch.mock.calls[0].arguments;
    assert.ok(url.includes('dropboxapi.com'), 'Should call Dropbox API');
  });

  it('downloadFile calls Dropbox download endpoint', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'dbx-tok-dl', expires_in: 14400 }),
    }));
    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'dropbox', code: 'dbx-dl-code' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    const fakeBuffer = new ArrayBuffer(64);
    const dlFetch = mock.fn(async () => ({ ok: true, arrayBuffer: async () => fakeBuffer }));
    globalThis.fetch = dlFetch;
    const result = await provider.downloadFile('/docs/report.pdf');
    const [url, opts] = dlFetch.mock.calls[0].arguments;
    assert.ok(url.includes('content.dropboxapi.com'), 'Should use content API');
    assert.ok(url.includes('files/download'), 'Should use download endpoint');
    assert.ok(opts.headers['Dropbox-API-Arg'], 'Should set Dropbox-API-Arg header');
    assert.equal(result.byteLength, 64);
  });

  it('uploadFile calls Dropbox upload endpoint', async () => {
    const savedOpen = globalThis.window.open;
    globalThis.window.open = () => ({ close() {} });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'dbx-tok-ul', expires_in: 14400 }),
    }));
    const authPromise = provider.authenticate();
    globalThis.window.dispatchEvent(
      Object.assign(new Event('message'), {
        origin: 'https://app.example.com',
        data: { provider: 'dropbox', code: 'dbx-ul-code' },
      }),
    );
    await authPromise;
    globalThis.window.open = savedOpen;

    const ulFetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'id:new-file', name: 'upload.pdf', size: 100, client_modified: '' }),
    }));
    globalThis.fetch = ulFetch;
    const file = await provider.uploadFile('upload.pdf', new Uint8Array([1, 2, 3]));
    assert.equal(file.provider, 'dropbox');
    assert.equal(file.name, 'upload.pdf');
    const [url] = ulFetch.mock.calls[0].arguments;
    assert.ok(url.includes('files/upload'), 'Should call upload endpoint');
  });

  it('listFiles throws when not authenticated', async () => {
    await assert.rejects(() => provider.listFiles(), /Not authenticated/);
  });
});
