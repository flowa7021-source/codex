// @ts-check
/**
 * @module platform
 * @description Platform abstraction layer: Tauri desktop / browser fallback.
 *
 * All platform-specific operations (file dialogs, filesystem access, shell,
 * window management) go through this module. It auto-detects whether the app
 * is running inside Tauri or a plain browser and routes accordingly.
 *
 * Usage:
 *   import { initPlatform, isTauri, openFileDialog, readFileAsBytes } from './platform.js';
 *   await initPlatform();
 */

let _isTauri = false;
let _tauriDialog = null;
let _tauriFs = null;
let _tauriShell = null;
let _tauriInvoke = null;

/** @type {Promise<void>|null} */
let _initPromise = null;

// ── Initialization ───────────────────────────────────────────────────────────

/**
 * Detect runtime environment and load Tauri APIs if available.
 * Must be called once at app startup before any other platform function.
 * Safe to call multiple times — subsequent calls return the first promise.
 */
export function initPlatform() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      if (/** @type {any} */ (window).__TAURI_INTERNALS__) {
        _isTauri = true;
        const { invoke } = await import('@tauri-apps/api/core');
        _tauriInvoke = invoke;
        _tauriDialog = await import('@tauri-apps/plugin-dialog');
        _tauriFs = await import('@tauri-apps/plugin-fs');
        _tauriShell = await import('@tauri-apps/plugin-shell');
      }
    } catch (err) {
      console.warn('[platform] Running in browser mode', err);
      _isTauri = false;
    }
  })();
  return _initPromise;
}

/**
 * Ensure platform is fully initialized before using Tauri APIs.
 * Returns immediately in browser mode.
 */
async function ensurePlatformReady() {
  if (_initPromise) await _initPromise;
}

/** @returns {boolean} true if running inside Tauri, false if plain browser */
export function isTauri() {
  return _isTauri;
}

// ── File Dialogs ─────────────────────────────────────────────────────────────

/**
 * Show a native file-open dialog.
 *
 * @param {Object} [options]
 * @param {boolean} [options.multiple=false]
 * @param {string}  [options.title]
 * @param {Array<{name:string, extensions:string[]}>} [options.filters]
 * @returns {Promise<string|string[]|File|File[]|null>}
 *   Tauri: file path(s) as string(s).  Browser: File object(s).
 */
export async function openFileDialog(options = {}) {
  await ensurePlatformReady();
  const filters = options.filters || [
    { name: 'Documents', extensions: ['pdf', 'djvu', 'djv', 'epub', 'cbz', 'xps'] },
    { name: 'PDF', extensions: ['pdf'] },
    { name: 'DjVu', extensions: ['djvu', 'djv'] },
    { name: 'ePub', extensions: ['epub'] },
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'webp'] },
    { name: 'All', extensions: ['*'] },
  ];

  if (_isTauri) {
    const result = await _tauriDialog.open({
      multiple: options.multiple || false,
      directory: false,
      filters,
      title: options.title || 'NovaReader',
    });
    return result;   // string (path) or string[] or null
  }

  // Browser fallback: <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = filters.flatMap(f => f.extensions.filter(e => e !== '*').map(e => `.${e}`)).join(',');
    input.multiple = options.multiple || false;
    input.onchange = () => {
      if (input.files.length === 0) return resolve(null);
      resolve(options.multiple ? Array.from(input.files) : input.files[0]);
    };
    input.click();
  });
}

/**
 * Show a native file-save dialog.
 *
 * @param {Object} [options]
 * @param {string} [options.defaultPath]
 * @param {string} [options.title]
 * @param {Array<{name:string, extensions:string[]}>} [options.filters]
 * @returns {Promise<string|null>}  Tauri: save path. Browser: null (download handled separately).
 */
export async function saveFileDialog(options = {}) {
  await ensurePlatformReady();
  if (_isTauri) {
    return _tauriDialog.save({
      filters: options.filters || [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'DOCX', extensions: ['docx'] },
      ],
      defaultPath: options.defaultPath,
      title: options.title || 'NovaReader',
    });
  }

  // Browser: return null — caller should use downloadBlob() instead
  return null;
}

// ── File System ──────────────────────────────────────────────────────────────

/**
 * Read a file as bytes.
 *
 * @param {string|File} pathOrFile – Tauri: file path string. Browser: File object.
 * @returns {Promise<Uint8Array>}
 */
export async function readFileAsBytes(pathOrFile) {
  await ensurePlatformReady();
  if (_isTauri && typeof pathOrFile === 'string') {
    // Try custom Rust command first (faster), fall back to FS plugin
    try {
      const bytes = await _tauriInvoke('read_file_bytes', { path: pathOrFile });
      return new Uint8Array(bytes);
    } catch (_e) {
      if (_tauriFs?.readFile) {
        return new Uint8Array(await _tauriFs.readFile(pathOrFile));
      }
      throw _e;
    }
  }

  // Browser: File object → ArrayBuffer
  if (pathOrFile instanceof File) {
    const buffer = await pathOrFile.arrayBuffer();
    return new Uint8Array(buffer);
  }

  throw new Error('readFileAsBytes: unsupported input type');
}


/**
 * Trigger a browser download for a Blob.
 * In Tauri, shows a native save dialog instead (the `<a download>` trick
 * does not work in Tauri's WebView — it has no browser download manager).
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {Array<{name:string, extensions:string[]}>} [filters]
 */
export async function downloadBlob(blob, filename, filters) {
  await ensurePlatformReady();
  if (_isTauri) {
    await saveOrDownload(blob, filename, filters);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  try { document.body.appendChild(a); } catch (_e) { /* test env */ }
  a.click();
  try { document.body.removeChild(a); } catch (_e) { /* test env */ }
  URL.revokeObjectURL(url);
}

/**
 * Unified save helper: shows native save dialog in Tauri, falls back to
 * browser blob download otherwise.
 *
 * @param {Blob} blob          - data to save
 * @param {string} filename    - suggested file name
 * @param {Array<{name:string, extensions:string[]}>} [filters] - file type filters for save dialog
 * @returns {Promise<boolean>} true if saved/downloaded successfully
 */
export async function saveOrDownload(blob, filename, filters) {
  await ensurePlatformReady();
  if (_isTauri) {
    const path = await saveFileDialog({ defaultPath: filename, filters });
    if (path) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeFileBytes(path, bytes);
      return true;
    }
    // User cancelled save dialog
    return false;
  }
  // Browser fallback
  downloadBlob(blob, filename);
  return true;
}

/**
 * Write raw bytes to a file path (Tauri only).
 *
 * @param {string} path
 * @param {Uint8Array} bytes
 * @returns {Promise<void>}
 */
export async function writeFileBytes(path, bytes) {
  if (!_isTauri || !_tauriFs) {
    throw new Error('writeFileBytes: only available in Tauri');
  }
  // Tauri v2 FS plugin: writeFile(path, data, options)
  // v1 had writeBinaryFile() which no longer exists in v2.
  await _tauriFs.writeFile(path, bytes);
}

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * Open a URL in the default system browser.
 * @param {string} url
 */
export async function openExternal(url) {
  // Only allow http(s) URLs to prevent javascript: / data: XSS vectors
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    console.warn('[platform] blocked openExternal for non-http URL:', url);
    return;
  }
  if (_isTauri) {
    await _tauriShell.open(url);
    return;
  }
  window.open(url, '_blank');
}

// ── Window ───────────────────────────────────────────────────────────────────

/**
 * Set the native window title.
 * @param {string} title
 */
export async function setWindowTitle(title) {
  if (_isTauri) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(title);
    return;
  }
  document.title = title;
}

// ── App Data Directory ───────────────────────────────────────────────────────

/**
 * Get the app data directory path (for persistent settings/cache).
 * @returns {Promise<string|null>} – null in browser (use IndexedDB/localStorage instead)
 */
export async function getAppDataDir() {
  if (_isTauri) {
    return _tauriInvoke('get_app_data_dir');
  }
  return null;
}
