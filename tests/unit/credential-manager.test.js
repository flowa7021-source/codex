// ─── Unit Tests: Credential Manager ──────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isCredentialManagementSupported,
  saveCredential,
  getCredential,
  removeCredential,
  listSupportedTypes,
} from '../../app/modules/credential-manager.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Minimal credential mock returned by navigator.credentials.get(). */
function makePasswordCredMock(id = 'user@example.com') {
  return { id, password: 's3cr3t', name: 'Test User', iconURL: undefined };
}

function makeFederatedCredMock(id = 'user@google.com') {
  return { id, provider: 'https://accounts.google.com', name: 'Google User', iconURL: undefined };
}

/** Install a mock navigator.credentials object. */
function installCredentialsMock(overrides = {}) {
  globalThis.navigator.credentials = {
    store: async () => {},
    get: async () => null,
    preventSilentAccess: async () => {},
    ...overrides,
  };
}

/** Remove navigator.credentials entirely. */
function removeCredentialsMock() {
  delete globalThis.navigator.credentials;
}

// ─── PasswordCredential / FederatedCredential constructor mocks ───────────────

function installConstructorMocks() {
  globalThis.PasswordCredential = function (data) {
    return { ...data, _type: 'PasswordCredential' };
  };
  globalThis.FederatedCredential = function (data) {
    return { ...data, _type: 'FederatedCredential' };
  };
}

function removeConstructorMocks() {
  delete globalThis.PasswordCredential;
  delete globalThis.FederatedCredential;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  installCredentialsMock();
  installConstructorMocks();
});

afterEach(() => {
  removeCredentialsMock();
  removeConstructorMocks();
});

// ─── isCredentialManagementSupported ─────────────────────────────────────────

describe('isCredentialManagementSupported', () => {
  it('returns a boolean', () => {
    const result = isCredentialManagementSupported();
    assert.equal(typeof result, 'boolean');
  });

  it('returns false when navigator.credentials is absent', () => {
    removeCredentialsMock();
    assert.equal(isCredentialManagementSupported(), false);
  });

  it('returns true when navigator.credentials is present', () => {
    installCredentialsMock();
    assert.equal(isCredentialManagementSupported(), true);
  });
});

// ─── saveCredential ───────────────────────────────────────────────────────────

describe('saveCredential', () => {
  it('returns false when API is absent', async () => {
    removeCredentialsMock();
    const result = await saveCredential({ id: 'x', type: 'password', password: 'pw' });
    assert.equal(result, false);
  });

  it('returns true for a password credential when API is present', async () => {
    let storedCred = null;
    installCredentialsMock({ store: async (c) => { storedCred = c; } });

    const result = await saveCredential({
      id: 'user@example.com',
      type: 'password',
      password: 'hunter2',
      name: 'Alice',
    });

    assert.equal(result, true);
    assert.ok(storedCred !== null, 'store() should have been called');
  });

  it('returns true for a federated credential when API is present', async () => {
    let storedCred = null;
    installCredentialsMock({ store: async (c) => { storedCred = c; } });

    const result = await saveCredential({
      id: 'user@google.com',
      type: 'federated',
      provider: 'https://accounts.google.com',
      name: 'Google User',
    });

    assert.equal(result, true);
    assert.ok(storedCred !== null, 'store() should have been called');
  });

  it('returns false (does not throw) when store() rejects', async () => {
    installCredentialsMock({ store: async () => { throw new Error('store failed'); } });

    const result = await saveCredential({ id: 'x', type: 'password', password: 'pw' });
    assert.equal(result, false);
  });

  it('returns false when PasswordCredential constructor is unavailable', async () => {
    removeConstructorMocks();
    const result = await saveCredential({ id: 'x', type: 'password', password: 'pw' });
    assert.equal(result, false);
  });

  it('returns false when FederatedCredential constructor is unavailable', async () => {
    removeConstructorMocks();
    const result = await saveCredential({
      id: 'user@google.com',
      type: 'federated',
      provider: 'https://accounts.google.com',
    });
    assert.equal(result, false);
  });
});

// ─── getCredential ────────────────────────────────────────────────────────────

describe('getCredential', () => {
  it('returns null when API is absent', async () => {
    removeCredentialsMock();
    const result = await getCredential('user@example.com');
    assert.equal(result, null);
  });

  it('returns null when navigator.credentials.get() returns null', async () => {
    installCredentialsMock({ get: async () => null });
    const result = await getCredential('user@example.com');
    assert.equal(result, null);
  });

  it('maps a password credential result to StoredCredential', async () => {
    const mock = makePasswordCredMock();
    installCredentialsMock({ get: async () => mock });

    const result = await getCredential(mock.id);

    assert.ok(result !== null);
    assert.equal(result.id, mock.id);
    assert.equal(result.type, 'password');
    assert.equal(result.password, mock.password);
    assert.equal(result.name, mock.name);
  });

  it('maps a federated credential result to StoredCredential', async () => {
    const mock = makeFederatedCredMock();
    installCredentialsMock({ get: async () => mock });

    const result = await getCredential(mock.id);

    assert.ok(result !== null);
    assert.equal(result.id, mock.id);
    assert.equal(result.type, 'federated');
    assert.equal(result.provider, mock.provider);
  });

  it('passes mediation option through to get()', async () => {
    let capturedOpts = null;
    installCredentialsMock({ get: async (opts) => { capturedOpts = opts; return null; } });

    await getCredential('x', { mediation: 'required' });
    assert.equal(capturedOpts?.mediation, 'required');
  });

  it('returns null (does not throw) when get() rejects', async () => {
    installCredentialsMock({ get: async () => { throw new Error('get failed'); } });
    const result = await getCredential('x');
    assert.equal(result, null);
  });
});

// ─── removeCredential ─────────────────────────────────────────────────────────

describe('removeCredential', () => {
  it('resolves without throwing when API is absent', async () => {
    removeCredentialsMock();
    await assert.doesNotReject(() => removeCredential());
  });

  it('calls preventSilentAccess() when API is present', async () => {
    let called = false;
    installCredentialsMock({ preventSilentAccess: async () => { called = true; } });

    await removeCredential();
    assert.equal(called, true);
  });

  it('resolves without throwing when preventSilentAccess() rejects', async () => {
    installCredentialsMock({
      preventSilentAccess: async () => { throw new Error('psa failed'); },
    });
    await assert.doesNotReject(() => removeCredential());
  });
});

// ─── listSupportedTypes ───────────────────────────────────────────────────────

describe('listSupportedTypes', () => {
  it('returns an array', () => {
    const result = listSupportedTypes();
    assert.ok(Array.isArray(result));
  });

  it('includes "password" when PasswordCredential constructor is present', () => {
    installConstructorMocks();
    const types = listSupportedTypes();
    assert.ok(types.includes('password'));
  });

  it('includes "federated" when FederatedCredential constructor is present', () => {
    installConstructorMocks();
    const types = listSupportedTypes();
    assert.ok(types.includes('federated'));
  });

  it('returns empty array when neither constructor is present', () => {
    removeConstructorMocks();
    const types = listSupportedTypes();
    assert.deepEqual(types, []);
  });

  it('contains only "password" when only PasswordCredential is available', () => {
    removeConstructorMocks();
    globalThis.PasswordCredential = function () {};
    const types = listSupportedTypes();
    assert.deepEqual(types, ['password']);
    delete globalThis.PasswordCredential;
  });

  it('contains only "federated" when only FederatedCredential is available', () => {
    removeConstructorMocks();
    globalThis.FederatedCredential = function () {};
    const types = listSupportedTypes();
    assert.deepEqual(types, ['federated']);
    delete globalThis.FederatedCredential;
  });
});
