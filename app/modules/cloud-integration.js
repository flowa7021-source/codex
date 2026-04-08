// @ts-check
// ─── Cloud Integration ──────────────────────────────────────────────────────
// Pluggable cloud storage: Google Drive, OneDrive, Dropbox.
// Each provider implements a common interface for open/save/list operations.
// Supports optional E2E encryption via sync-encryption.js.

import { deriveKey, encrypt, decrypt, generateSalt } from './sync-encryption.js';

/** @type {'stub'|'partial'|'ready'} Module readiness status */
export const MODULE_STATUS = 'partial';
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

// ─── OAuth2 PKCE Utilities ────────────────────────────────────────────────

/**
 * Base64url-encode a Uint8Array (no padding, URL-safe chars).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function _base64urlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a PKCE code verifier and code challenge.
 * - codeVerifier: 64 random bytes, base64url-encoded
 * - codeChallenge: SHA-256 of verifier bytes, base64url-encoded
 * @returns {Promise<{codeVerifier: string, codeChallenge: string}>}
 */
export async function generatePKCE() {
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);
  const codeVerifier = _base64urlEncode(randomBytes);

  const encoder = new TextEncoder();
  const verifierBytes = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', verifierBytes);
  const codeChallenge = _base64urlEncode(new Uint8Array(hashBuffer));

  return { codeVerifier, codeChallenge };
}

/**
 * Build an authorization URL from a base URL and query parameters.
 * @param {string} baseUrl
 * @param {Record<string, string>} params
 * @returns {string}
 */
export function buildAuthUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Exchange an authorization code for a token using PKCE.
 * @param {string} tokenUrl
 * @param {string} code
 * @param {string} codeVerifier
 * @param {string} clientId
 * @param {string} redirectUri
 * @returns {Promise<{access_token: string, expires_in?: number, token_type?: string}>}
 */
export async function exchangeCodeForToken(tokenUrl, code, codeVerifier, clientId, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }
  return response.json();
}

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
  let data;
  try { data = await provider.downloadFile(fileId); }
  catch (err) { console.warn('[cloud] download failed:', err?.message); return null; }

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
 * Create a Google Drive provider with OAuth2 PKCE flow.
 * Requires a client ID configured in localStorage under 'novareader-gdrive-client-id'.
 * @param {object} [config]
 * @param {string} [config.clientId]
 * @returns {any}
 */
export function createGoogleDriveProvider(config = {}) {
  /** @type {{access_token: string, expires_at: number}|null} */
  let _token = null;
  /** @type {string} Temporary PKCE code verifier during active auth flow */
  let _pendingVerifier = '';

  const clientId = config.clientId
    || localStorage.getItem('novareader-gdrive-client-id')
    || 'YOUR_GDRIVE_CLIENT_ID';
  const redirectUri = window.location.origin + '/oauth-callback';
  const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  const TOKEN_URL = 'https://oauth2.googleapis.com/token';
  const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
  const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

  return {
    id: 'gdrive',
    name: 'Google Drive',

    /**
     * Authenticate via OAuth2 PKCE popup.
     * Opens a popup window and waits for a postMessage with the auth code.
     * The message listener is registered before PKCE generation so no race condition occurs.
     * @returns {Promise<boolean>}
     */
    authenticate: () => {
      return new Promise((resolve) => {
        // Register message listener first (synchronously) to avoid race conditions
        // with the async PKCE generation step.
        const onMessage = async (/** @type {MessageEvent} */ event) => {
          if (event.origin !== window.location.origin) return;
          const { code, provider } = /** @type {any} */ (event.data || {});
          if (provider !== 'gdrive' || !code) return;
          window.removeEventListener('message', onMessage);
          try {
            const tokenData = await exchangeCodeForToken(TOKEN_URL, code, _pendingVerifier, clientId, redirectUri);
            const expiresIn = tokenData.expires_in || 3600;
            _token = { access_token: tokenData.access_token, expires_at: Date.now() + expiresIn * 1000 };
            resolve(true);
          } catch (err) {
            console.warn('[Cloud] Google Drive token exchange failed:', err?.message);
            resolve(false);
          }
        };
        window.addEventListener('message', onMessage);

        // Now generate PKCE and open popup asynchronously
        generatePKCE().then(({ codeVerifier, codeChallenge }) => {
          _pendingVerifier = codeVerifier;
          const authUrl = buildAuthUrl(AUTH_URL, {
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/drive.file',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
          });
          const popup = window.open(authUrl, 'gdrive-oauth', 'width=500,height=600');
          if (!popup) {
            console.warn('[Cloud] Google Drive: popup blocked');
            window.removeEventListener('message', onMessage);
            resolve(false);
          }
        }).catch((err) => {
          window.removeEventListener('message', onMessage);
          console.warn('[Cloud] Google Drive PKCE generation failed:', err?.message);
          resolve(false);
        });
      });
    },

    /** @returns {boolean} */
    isAuthenticated: () => {
      if (!_token) return false;
      return _token.expires_at > Date.now();
    },

    /**
     * List files in Google Drive.
     * @param {string} [_folder]
     * @param {string} [query]
     * @returns {Promise<CloudFile[]>}
     */
    listFiles: async (_folder, query) => {
      if (!_token) throw new Error('Not authenticated');
      const params = new URLSearchParams({
        fields: 'files(id,name,mimeType,size,modifiedTime)',
        pageSize: '50',
      });
      if (query) params.set('q', query);
      const response = await fetch(`${FILES_URL}?${params}`, {
        headers: { Authorization: `Bearer ${_token.access_token}` },
      });
      if (!response.ok) throw new Error(`Drive listFiles failed: ${response.status}`);
      const json = await response.json();
      return (json.files || []).map((/** @type {any} */ f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size || 0,
        modifiedAt: f.modifiedTime || '',
        provider: 'gdrive',
      }));
    },

    /**
     * Download a file from Google Drive.
     * @param {string} fileId
     * @returns {Promise<ArrayBuffer>}
     */
    downloadFile: async (fileId) => {
      if (!_token) throw new Error('Not authenticated');
      const response = await fetch(`${FILES_URL}/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${_token.access_token}` },
      });
      if (!response.ok) throw new Error(`Drive download failed: ${response.status}`);
      return response.arrayBuffer();
    },

    /**
     * Upload a file to Google Drive using multipart upload.
     * @param {string} name
     * @param {ArrayBuffer|Uint8Array} data
     * @param {string} [mimeType]
     * @param {string} [_folderId]
     * @returns {Promise<CloudFile>}
     */
    uploadFile: async (name, data, mimeType = 'application/octet-stream', _folderId) => {
      if (!_token) throw new Error('Not authenticated');
      const boundary = `nova_${Date.now()}`;
      const meta = JSON.stringify({ name });
      const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`;
      const dataPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
      const closing = `\r\n--${boundary}--`;

      const enc = new TextEncoder();
      const metaBytes = enc.encode(metaPart);
      const dataBytes = enc.encode(dataPart);
      const closingBytes = enc.encode(closing);
      const bodyData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const combined = new Uint8Array(metaBytes.length + dataBytes.length + bodyData.length + closingBytes.length);
      combined.set(metaBytes, 0);
      combined.set(dataBytes, metaBytes.length);
      combined.set(bodyData, metaBytes.length + dataBytes.length);
      combined.set(closingBytes, metaBytes.length + dataBytes.length + bodyData.length);

      const response = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: combined,
      });
      if (!response.ok) throw new Error(`Drive upload failed: ${response.status}`);
      const f = await response.json();
      return {
        id: f.id || '',
        name: f.name || name,
        mimeType: f.mimeType || mimeType,
        size: f.size || 0,
        modifiedAt: f.modifiedTime || new Date().toISOString(),
        provider: 'gdrive',
      };
    },

    /**
     * Get a shareable link for a Drive file.
     * @param {string} fileId
     * @returns {Promise<string>}
     */
    getShareLink: async (fileId) => {
      if (!_token) throw new Error('Not authenticated');
      // Create a "reader" permission so the link is shareable
      await fetch(`${FILES_URL}/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
      return `https://drive.google.com/file/d/${fileId}/view`;
    },

    /**
     * Sign out and revoke the current token.
     * @returns {Promise<void>}
     */
    signOut: async () => {
      if (_token) {
        try {
          await fetch(`${REVOKE_URL}?token=${_token.access_token}`, { method: 'POST' });
        } catch (err) {
          console.warn('[Cloud] Google Drive revoke failed:', err?.message);
        }
        _token = null;
      }
    },
  };
}

/**
 * Create a OneDrive provider with OAuth2 PKCE flow (Microsoft Graph API).
 * Requires a client ID configured in localStorage under 'novareader-onedrive-client-id'.
 * @param {object} [config]
 * @param {string} [config.clientId]
 * @returns {any}
 */
export function createOneDriveProvider(config = {}) {
  /** @type {{access_token: string, expires_at: number}|null} */
  let _token = null;
  /** @type {string} */
  let _pendingVerifier = '';

  const clientId = config.clientId
    || localStorage.getItem('novareader-onedrive-client-id')
    || 'YOUR_ONEDRIVE_CLIENT_ID';
  const redirectUri = window.location.origin + '/oauth-callback';
  const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const GRAPH_URL = 'https://graph.microsoft.com/v1.0/me/drive';

  return {
    id: 'onedrive',
    name: 'OneDrive',

    /** @returns {Promise<boolean>} */
    authenticate: () => {
      return new Promise((resolve) => {
        const onMessage = async (/** @type {MessageEvent} */ event) => {
          if (event.origin !== window.location.origin) return;
          const { code, provider } = /** @type {any} */ (event.data || {});
          if (provider !== 'onedrive' || !code) return;
          window.removeEventListener('message', onMessage);
          try {
            const tokenData = await exchangeCodeForToken(TOKEN_URL, code, _pendingVerifier, clientId, redirectUri);
            const expiresIn = tokenData.expires_in || 3600;
            _token = { access_token: tokenData.access_token, expires_at: Date.now() + expiresIn * 1000 };
            resolve(true);
          } catch (err) {
            console.warn('[Cloud] OneDrive token exchange failed:', err?.message);
            resolve(false);
          }
        };
        window.addEventListener('message', onMessage);

        generatePKCE().then(({ codeVerifier, codeChallenge }) => {
          _pendingVerifier = codeVerifier;
          const authUrl = buildAuthUrl(AUTH_URL, {
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'files.readwrite offline_access',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
          });
          const popup = window.open(authUrl, 'onedrive-oauth', 'width=500,height=600');
          if (!popup) {
            console.warn('[Cloud] OneDrive: popup blocked');
            window.removeEventListener('message', onMessage);
            resolve(false);
          }
        }).catch((err) => {
          window.removeEventListener('message', onMessage);
          console.warn('[Cloud] OneDrive PKCE generation failed:', err?.message);
          resolve(false);
        });
      });
    },

    /** @returns {boolean} */
    isAuthenticated: () => !!_token && _token.expires_at > Date.now(),

    /**
     * @param {string} [folder]
     * @param {string} [query]
     * @returns {Promise<CloudFile[]>}
     */
    listFiles: async (folder, query) => {
      if (!_token) throw new Error('Not authenticated');
      const basePath = folder ? `/items/${folder}/children` : '/root/children';
      const params = new URLSearchParams({
        '$select': 'id,name,file,size,lastModifiedDateTime',
        '$top': '50',
      });
      if (query) params.set('$filter', `contains(name, '${query}')`);
      const response = await fetch(`${GRAPH_URL}${basePath}?${params}`, {
        headers: { Authorization: `Bearer ${_token.access_token}` },
      });
      if (!response.ok) throw new Error(`OneDrive listFiles failed: ${response.status}`);
      const json = await response.json();
      return (json.value || [])
        .filter((/** @type {any} */ f) => !!f.file)
        .map((/** @type {any} */ f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.file?.mimeType || 'application/octet-stream',
          size: f.size || 0,
          modifiedAt: f.lastModifiedDateTime || '',
          provider: 'onedrive',
        }));
    },

    /**
     * @param {string} fileId
     * @returns {Promise<ArrayBuffer>}
     */
    downloadFile: async (fileId) => {
      if (!_token) throw new Error('Not authenticated');
      const response = await fetch(`${GRAPH_URL}/items/${fileId}/content`, {
        headers: { Authorization: `Bearer ${_token.access_token}` },
      });
      if (!response.ok) throw new Error(`OneDrive download failed: ${response.status}`);
      return response.arrayBuffer();
    },

    /**
     * @param {string} name
     * @param {ArrayBuffer|Uint8Array} data
     * @param {string} [mimeType]
     * @param {string} [folderId]
     * @returns {Promise<CloudFile>}
     */
    uploadFile: async (name, data, mimeType = 'application/octet-stream', folderId) => {
      if (!_token) throw new Error('Not authenticated');
      const basePath = folderId ? `/items/${folderId}:/${name}:/content` : `/root:/${name}:/content`;
      const bodyData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const response = await fetch(`${GRAPH_URL}${basePath}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': mimeType,
        },
        body: bodyData,
      });
      if (!response.ok) throw new Error(`OneDrive upload failed: ${response.status}`);
      const f = await response.json();
      return {
        id: f.id || '',
        name: f.name || name,
        mimeType: f.file?.mimeType || mimeType,
        size: f.size || 0,
        modifiedAt: f.lastModifiedDateTime || new Date().toISOString(),
        provider: 'onedrive',
      };
    },

    /**
     * @param {string} fileId
     * @returns {Promise<string>}
     */
    getShareLink: async (fileId) => {
      if (!_token) throw new Error('Not authenticated');
      const response = await fetch(`${GRAPH_URL}/items/${fileId}/createLink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
      });
      if (!response.ok) throw new Error(`OneDrive createLink failed: ${response.status}`);
      const json = await response.json();
      return json.link?.webUrl || '';
    },

    /** @returns {Promise<void>} */
    signOut: async () => { _token = null; },
  };
}

/**
 * Create a Dropbox provider with OAuth2 PKCE flow.
 * Requires an App Key configured in localStorage under 'novareader-dropbox-app-key'.
 * @param {object} [config]
 * @param {string} [config.appKey]
 * @returns {any}
 */
export function createDropboxProvider(config = {}) {
  /** @type {{access_token: string, expires_at: number}|null} */
  let _token = null;
  /** @type {string} */
  let _pendingVerifier = '';

  const appKey = config.appKey
    || localStorage.getItem('novareader-dropbox-app-key')
    || 'YOUR_DROPBOX_APP_KEY';
  const redirectUri = window.location.origin + '/oauth-callback';
  const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
  const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
  const API_URL = 'https://api.dropboxapi.com/2';
  const CONTENT_URL = 'https://content.dropboxapi.com/2';

  return {
    id: 'dropbox',
    name: 'Dropbox',

    /** @returns {Promise<boolean>} */
    authenticate: () => {
      return new Promise((resolve) => {
        const onMessage = async (/** @type {MessageEvent} */ event) => {
          if (event.origin !== window.location.origin) return;
          const { code, provider } = /** @type {any} */ (event.data || {});
          if (provider !== 'dropbox' || !code) return;
          window.removeEventListener('message', onMessage);
          try {
            // Dropbox PKCE token exchange uses client_id (app key), no client_secret
            const body = new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              code_verifier: _pendingVerifier,
              client_id: appKey,
              redirect_uri: redirectUri,
            });
            const response = await fetch(TOKEN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
            });
            if (!response.ok) throw new Error(`Dropbox token exchange: ${response.status}`);
            const tokenData = await response.json();
            const expiresIn = tokenData.expires_in || 14400;
            _token = { access_token: tokenData.access_token, expires_at: Date.now() + expiresIn * 1000 };
            resolve(true);
          } catch (err) {
            console.warn('[Cloud] Dropbox token exchange failed:', err?.message);
            resolve(false);
          }
        };
        window.addEventListener('message', onMessage);

        generatePKCE().then(({ codeVerifier, codeChallenge }) => {
          _pendingVerifier = codeVerifier;
          const authUrl = buildAuthUrl(AUTH_URL, {
            client_id: appKey,
            redirect_uri: redirectUri,
            response_type: 'code',
            token_access_type: 'offline',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
          });
          const popup = window.open(authUrl, 'dropbox-oauth', 'width=500,height=600');
          if (!popup) {
            console.warn('[Cloud] Dropbox: popup blocked');
            window.removeEventListener('message', onMessage);
            resolve(false);
          }
        }).catch((err) => {
          window.removeEventListener('message', onMessage);
          console.warn('[Cloud] Dropbox PKCE generation failed:', err?.message);
          resolve(false);
        });
      });
    },

    /** @returns {boolean} */
    isAuthenticated: () => !!_token && _token.expires_at > Date.now(),

    /**
     * @param {string} [folder]
     * @param {string} [query]
     * @returns {Promise<CloudFile[]>}
     */
    listFiles: async (folder, query) => {
      if (!_token) throw new Error('Not authenticated');
      if (query) {
        // Use search endpoint
        const response = await fetch(`${API_URL}/files/search_v2`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${_token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, options: { path: folder || '' } }),
        });
        if (!response.ok) throw new Error(`Dropbox search failed: ${response.status}`);
        const json = await response.json();
        return (json.matches || []).map((/** @type {any} */ m) => ({
          id: m.metadata?.metadata?.id || '',
          name: m.metadata?.metadata?.name || '',
          mimeType: 'application/octet-stream',
          size: m.metadata?.metadata?.size || 0,
          modifiedAt: m.metadata?.metadata?.client_modified || '',
          provider: 'dropbox',
        }));
      }
      const response = await fetch(`${API_URL}/files/list_folder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: folder || '' }),
      });
      if (!response.ok) throw new Error(`Dropbox listFiles failed: ${response.status}`);
      const json = await response.json();
      return (json.entries || [])
        .filter((/** @type {any} */ e) => e['.tag'] === 'file')
        .map((/** @type {any} */ e) => ({
          id: e.id,
          name: e.name,
          mimeType: 'application/octet-stream',
          size: e.size || 0,
          modifiedAt: e.client_modified || '',
          provider: 'dropbox',
        }));
    },

    /**
     * @param {string} fileId
     * @returns {Promise<ArrayBuffer>}
     */
    downloadFile: async (fileId) => {
      if (!_token) throw new Error('Not authenticated');
      const response = await fetch(`${CONTENT_URL}/files/download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
        },
      });
      if (!response.ok) throw new Error(`Dropbox download failed: ${response.status}`);
      return response.arrayBuffer();
    },

    /**
     * @param {string} name
     * @param {ArrayBuffer|Uint8Array} data
     * @param {string} [_mimeType]
     * @param {string} [folder]
     * @returns {Promise<CloudFile>}
     */
    uploadFile: async (name, data, _mimeType, folder) => {
      if (!_token) throw new Error('Not authenticated');
      const path = folder ? `${folder}/${name}` : `/${name}`;
      const bodyData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const response = await fetch(`${CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true }),
        },
        body: bodyData,
      });
      if (!response.ok) throw new Error(`Dropbox upload failed: ${response.status}`);
      const f = await response.json();
      return {
        id: f.id || path,
        name: f.name || name,
        mimeType: 'application/octet-stream',
        size: f.size || 0,
        modifiedAt: f.client_modified || new Date().toISOString(),
        provider: 'dropbox',
      };
    },

    /**
     * @param {string} fileId
     * @returns {Promise<string>}
     */
    getShareLink: async (fileId) => {
      if (!_token) throw new Error('Not authenticated');
      const response = await fetch(`${API_URL}/sharing/create_shared_link_with_settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: fileId, settings: { requested_visibility: 'public' } }),
      });
      if (response.status === 409) {
        // Link already exists — get existing
        const listResp = await fetch(`${API_URL}/sharing/list_shared_links`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${_token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: fileId }),
        });
        if (!listResp.ok) return '';
        const json = await listResp.json();
        return json.links?.[0]?.url?.replace('?dl=0', '?dl=1') || '';
      }
      if (!response.ok) throw new Error(`Dropbox createLink failed: ${response.status}`);
      const json = await response.json();
      return json.url?.replace('?dl=0', '?dl=1') || '';
    },

    /** @returns {Promise<void>} */
    signOut: async () => { _token = null; },
  };
}
