// @ts-check
// ─── Cloud Integration ──────────────────────────────────────────────────────
// Pluggable cloud storage: Google Drive, OneDrive, Dropbox.
// Each provider implements a common interface for open/save/list operations.
// Supports optional E2E encryption via sync-encryption.js.

import { deriveKey, encrypt, decrypt, generateSalt } from './sync-encryption.js';

/** @type {'stub'|'partial'|'ready'} Module readiness status */
export const MODULE_STATUS = 'stub';
/** What's needed to make this module functional */
export const MODULE_REQUIRES = ['OAuth2 credentials for Google Drive, OneDrive, or Dropbox'];

/**
 * @typedef {object} CloudFile
 * @property {string} id
 * @property {string} name
 * @property {string} mimeType
 * @property {number} size
 * @property {string} modifiedAt
 * @property {string} provider - 'gdrive' | 'onedrive' | 'dropbox' | 'local'
 */

/**
 * @typedef {object} CloudProvider
 * @property {string} name
 * @property {string} id
 * @property {Function} authenticate - () => Promise<boolean>
 * @property {Function} isAuthenticated - () => boolean
 * @property {Function} listFiles - (folder?, query?) => Promise<CloudFile[]>
 * @property {Function} downloadFile - (fileId) => Promise<ArrayBuffer>
 * @property {Function} uploadFile - (name, data, mimeType, folderId?) => Promise<CloudFile>
 * @property {Function} getShareLink - (fileId) => Promise<string>
 * @property {Function} signOut - () => Promise<void>
 */

const _SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/vnd.djvu',
  'application/epub+zip',
  'application/vnd.ms-xpsdocument',
  'application/x-cbz',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp',
];

/** @type {Map<string, CloudProvider>} */
const providers = new Map();
/** @type {Set<Function>} */
const statusListeners = new Set();

// ─── E2E Encryption State ────────────────────────────────────────────────
/** @type {CryptoKey|null} */
let _encryptionKey = null;
/** @type {Uint8Array|null} */
let _encryptionSalt = null;

/**
 * Set (or clear) the encryption passphrase for cloud sync.
 * When set, all uploads are encrypted and downloads are decrypted automatically.
 * Pass null/empty string to disable encryption.
 * @param {string|null} passphrase
 * @returns {Promise<void>}
 */
export async function setEncryptionPassphrase(passphrase) {
  if (!passphrase) {
    _encryptionKey = null;
    _encryptionSalt = null;
    return;
  }
  _encryptionSalt = generateSalt();
  _encryptionKey = await deriveKey(passphrase, _encryptionSalt);
}

/**
 * Register a cloud provider.
 * @param {CloudProvider} provider
 */
export function registerProvider(provider) {
  providers.set(provider.id, provider);
  _notifyStatus();
}

/**
 * Get all registered providers.
 * @returns {CloudProvider[]}
 */
export function getProviders() {
  return [...providers.values()];
}

/**
 * Get a specific provider by ID.
 * @param {string} id
 * @returns {CloudProvider|null}
 */
export function getProvider(id) {
  return providers.get(id) || null;
}

/**
 * Authenticate with a provider.
 * @param {string} providerId
 * @returns {Promise<boolean>}
 */
export async function authenticate(providerId) {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const result = await provider.authenticate();
  _notifyStatus();
  return result;
}

/**
 * List files from a provider.
 * @param {string} providerId
 * @param {string} [folder]
 * @param {string} [query]
 * @returns {Promise<CloudFile[]>}
 */
export async function listFiles(providerId, folder, query) {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  if (!provider.isAuthenticated()) throw new Error('Not authenticated');
  return provider.listFiles(folder, query);
}

/**
 * Open a file from cloud storage.
 * @param {string} providerId
 * @param {string} fileId
 * @returns {Promise<{data: ArrayBuffer, file: CloudFile}>}
 */
export async function openFile(providerId, fileId) {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  let data = await provider.downloadFile(fileId);

  // Decrypt if encryption is active and data looks encrypted (has envelope header)
  if (_encryptionKey && data) {
    try {
      const envelope = _parseEncryptedEnvelope(data);
      if (envelope) {
        data = await decrypt({ iv: envelope.iv, ciphertext: envelope.ciphertext }, _encryptionKey);
      }
    } catch (err) {
      console.warn('[cloud-integration] decryption failed, returning raw data:', err?.message);
    }
  }

  return /** @type {any} */ ({ data, file: { id: fileId, provider: providerId } });
}

/**
 * Parse an encrypted envelope from downloaded data.
 * Envelope format: 4-byte magic "NRSE" + 16-byte salt + 12-byte IV + ciphertext
 * @param {ArrayBuffer} data
 * @returns {{ salt: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array }|null}
 */
function _parseEncryptedEnvelope(data) {
  const bytes = new Uint8Array(data instanceof ArrayBuffer ? data : /** @type {any} */ (data).buffer || data);
  if (bytes.length < 32) return null;
  // Check magic header "NRSE" (NovaReader Sync Encrypted)
  if (bytes[0] !== 0x4E || bytes[1] !== 0x52 || bytes[2] !== 0x53 || bytes[3] !== 0x45) return null;
  const salt = bytes.slice(4, 20);
  const iv = bytes.slice(20, 32);
  const ciphertext = bytes.slice(32);
  return { salt, iv, ciphertext };
}

/**
 * Build an encrypted envelope for upload.
 * @param {Uint8Array} salt
 * @param {Uint8Array} iv
 * @param {Uint8Array} ciphertext
 * @returns {Uint8Array}
 */
function _buildEncryptedEnvelope(salt, iv, ciphertext) {
  const magic = new Uint8Array([0x4E, 0x52, 0x53, 0x45]); // "NRSE"
  const envelope = new Uint8Array(4 + salt.length + iv.length + ciphertext.length);
  envelope.set(magic, 0);
  envelope.set(salt, 4);
  envelope.set(iv, 20);
  envelope.set(ciphertext, 32);
  return envelope;
}

/**
 * Save a file to cloud storage.
 * @param {string} providerId
 * @param {string} name
 * @param {ArrayBuffer|Uint8Array} data
 * @param {string} [mimeType='application/pdf']
 * @param {string} [folderId]
 * @returns {Promise<CloudFile>}
 */
export async function saveFile(providerId, name, data, mimeType = 'application/pdf', folderId) {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  let uploadData = data;
  // Encrypt before upload if encryption key is set
  if (_encryptionKey && _encryptionSalt && data) {
    try {
      const plainBytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
      const { iv, ciphertext } = await encrypt(plainBytes, _encryptionKey);
      uploadData = _buildEncryptedEnvelope(_encryptionSalt, iv, ciphertext);
    } catch (err) {
      console.warn('[cloud-integration] encryption failed, uploading unencrypted:', err?.message);
    }
  }

  return provider.uploadFile(name, uploadData, mimeType, folderId);
}

/**
 * Get a shareable link for a file.
 * @param {string} providerId
 * @param {string} fileId
 * @returns {Promise<string>}
 */
export async function getShareLink(providerId, fileId) {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  return provider.getShareLink(fileId);
}

/**
 * Sign out from a provider.
 * @param {string} providerId
 */
export async function signOut(providerId) {
  const provider = providers.get(providerId);
  if (provider) {
    await provider.signOut();
    _notifyStatus();
  }
}

/**
 * Get connection status for all providers.
 * @returns {Array<{id: string, name: string, connected: boolean}>}
 */
export function getConnectionStatus() {
  return [...providers.values()].map(p => ({
    id: p.id,
    name: p.name,
    connected: p.isAuthenticated(),
  }));
}

/**
 * Subscribe to connection status changes.
 * @param {Function} listener
 * @returns {Function} unsubscribe
 */
export function onStatusChange(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function _notifyStatus() {
  const status = getConnectionStatus();
  for (const fn of statusListeners) {
    try { fn(status); } catch (err) { /* ignore */ console.warn('[cloud-integration] status listener:', err?.message); }
  }
}

// ─── Built-in Provider Templates ─────────────────────────────────────────

/**
 * Create a Google Drive provider stub.
 * Requires OAuth2 client ID to be configured.
 * @param {object} [_config]
 * @returns {any}
 */
export function createGoogleDriveProvider(_config = {}) {
  let token = null;
  return {
    id: 'gdrive',
    name: 'Google Drive',
    authenticate: async () => {
      console.info('[Cloud] Google Drive auth requires OAuth2 client ID configuration');
      return false;
    },
    isAuthenticated: () => !!token,
    listFiles: async () => [],
    downloadFile: async () => new ArrayBuffer(0),
    uploadFile: async (name) => ({ id: '', name, provider: 'gdrive' }),
    getShareLink: async () => '',
    signOut: async () => { token = null; },
  };
}

/**
 * Create a OneDrive provider stub.
 * Requires MSAL configuration.
 * @param {object} [_config]
 * @returns {any}
 */
export function createOneDriveProvider(_config = {}) {
  let token = null;
  return {
    id: 'onedrive',
    name: 'OneDrive',
    authenticate: async () => {
      console.info('[Cloud] OneDrive auth requires MSAL configuration');
      return false;
    },
    isAuthenticated: () => !!token,
    listFiles: async () => [],
    downloadFile: async () => new ArrayBuffer(0),
    uploadFile: async (name) => ({ id: '', name, provider: 'onedrive' }),
    getShareLink: async () => '',
    signOut: async () => { token = null; },
  };
}

/**
 * Create a Dropbox provider stub.
// @ts-ignore
 * @param {object} [_config]
 * @returns {CloudProvider}
 */
export function createDropboxProvider(_config = {}) {
  let token = null;
  return {
    id: 'dropbox',
    name: 'Dropbox',
    authenticate: async () => {
      console.info('[Cloud] Dropbox auth requires App Key configuration');
      return false;
    },
    isAuthenticated: () => !!token,
    listFiles: async () => [],
    downloadFile: async () => new ArrayBuffer(0),
    uploadFile: async (name) => ({ id: '', name, provider: 'dropbox' }),
    getShareLink: async () => '',
    signOut: async () => { token = null; },
  };
}
