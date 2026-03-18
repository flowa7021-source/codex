// ─── Cloud Integration ──────────────────────────────────────────────────────
// Pluggable cloud storage: Google Drive, OneDrive, Dropbox.
// Each provider implements a common interface for open/save/list operations.

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

const SUPPORTED_MIME_TYPES = [
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
  const data = await provider.downloadFile(fileId);
  return { data, file: { id: fileId, provider: providerId } };
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
  return provider.uploadFile(name, data, mimeType, folderId);
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
 * @param {object} config
 * @param {string} config.clientId
 * @returns {CloudProvider}
 */
export function createGoogleDriveProvider(config = {}) {
  let token = null;
  return {
    id: 'gdrive',
    name: 'Google Drive',
    authenticate: async () => {
      // Placeholder: real implementation would use Google OAuth2
      console.info('[Cloud] Google Drive auth requires OAuth2 client configuration');
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
 * @param {object} config
 * @returns {CloudProvider}
 */
export function createOneDriveProvider(config = {}) {
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
 * @param {object} config
 * @returns {CloudProvider}
 */
export function createDropboxProvider(config = {}) {
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
