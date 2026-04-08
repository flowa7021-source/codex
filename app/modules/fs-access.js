// @ts-check
// ─── File System Access API ─────────────────────────────────────────────────
// Native file handles for true edit-in-place workflow.
// Fallback: <input type="file"> for open, <a download> for save.

/**
 * @typedef {Object} FilePickerType
 * @property {string} description
 * @property {Record<string, string[]>} accept
 */

/**
 * @typedef {Object} OpenFilePickerOptions
 * @property {FilePickerType[]} [types]
 * @property {boolean} [multiple]
 */

/**
 * @typedef {Object} OpenResult
 * @property {File} file
 * @property {FileSystemFileHandle | null} handle
 */

/** @type {FileSystemFileHandle | null} */
let _lastHandle = null;

/** Default file types accepted by the picker */
const DEFAULT_TYPES = /** @type {FilePickerType[]} */ ([
  {
    description: 'Documents',
    accept: {
      'application/pdf': ['.pdf'],
      'image/vnd.djvu': ['.djvu'],
      'application/epub+zip': ['.epub'],
    },
  },
  {
    description: 'Images',
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tif', '.tiff'],
      'image/bmp': ['.bmp'],
    },
  },
]);

// ── Detection ───────────────────────────────────────────────────────────────

/**
 * Check whether the File System Access API is available.
 * @returns {boolean}
 */
export function isFsAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

// ── Open ────────────────────────────────────────────────────────────────────

/**
 * Build the accept string for the fallback `<input>` element.
 * @param {FilePickerType[]} types
 * @returns {string}
 */
function buildAcceptString(types) {
  const extensions = [];
  for (const t of types) {
    for (const exts of Object.values(t.accept)) {
      extensions.push(...exts);
    }
  }
  return extensions.join(',');
}

/**
 * Open a file picker and return selected files.
 *
 * Uses the native File System Access API when available, otherwise falls
 * back to a hidden `<input type="file">`.
 *
 * @param {OpenFilePickerOptions} [options]
 * @returns {Promise<OpenResult[]>}
 */
export async function openFilePicker(options) {
  const types = options?.types ?? DEFAULT_TYPES;
  const multiple = options?.multiple ?? false;

  // ── Native path ─────────────────────────────────────────────────────────
  if (isFsAccessSupported()) {
    try {
      const handles = await /** @type {any} */ (window).showOpenFilePicker({
        types,
        multiple,
      });
      /** @type {OpenResult[]} */
      const results = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        results.push({ file, handle });
      }
      if (results.length > 0) {
        _lastHandle = results[0].handle;
      }
      return results;
    } catch (err) {
      // User cancelled or API error — return empty
      if (/** @type {any} */ (err).name === 'AbortError') {
        return [];
      }
      throw err;
    }
  }

  // ── Fallback: hidden <input type="file"> ────────────────────────────────
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = buildAcceptString(types);
    if (multiple) {
      input.setAttribute('multiple', '');
    }

    input.addEventListener('change', () => {
      const fileList = /** @type {HTMLInputElement} */ (input).files;
      if (!fileList || fileList.length === 0) {
        resolve([]);
        return;
      }
      /** @type {OpenResult[]} */
      const results = [];
      for (let i = 0; i < fileList.length; i++) {
        results.push({ file: fileList[i], handle: null });
      }
      _lastHandle = null;
      resolve(results);
    });

    input.click();
  });
}

// ── Save ────────────────────────────────────────────────────────────────────

/**
 * Save a Blob to disk.
 *
 * Strategy (in order):
 * 1. If a stored handle exists, write via `handle.createWritable()`.
 * 2. If `showSaveFilePicker` is available, prompt a save dialog.
 * 3. Fallback: create an `<a>` with `URL.createObjectURL` and click it.
 *
 * @param {Blob} blob         Data to save.
 * @param {string} suggestedName  Default filename.
 * @param {Object} [options]
 * @param {FilePickerType[]} [options.types]
 * @returns {Promise<boolean>}  true if saved successfully.
 */
export async function saveFile(blob, suggestedName, options) {
  // ── 1. Re-save to existing handle ───────────────────────────────────────
  if (_lastHandle) {
    try {
      const writable = await /** @type {any} */ (_lastHandle).createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (_err) {
      // Fall through to other methods
    }
  }

  // ── 2. Native save picker ──────────────────────────────────────────────
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      /** @type {any} */
      const pickerOpts = { suggestedName };
      if (options?.types) {
        pickerOpts.types = options.types;
      }
      const handle = await /** @type {any} */ (window).showSaveFilePicker(pickerOpts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      _lastHandle = handle;
      return true;
    } catch (err) {
      if (/** @type {any} */ (err).name === 'AbortError') {
        return false;
      }
      throw err;
    }
  }

  // ── 3. Fallback: <a download> ──────────────────────────────────────────
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', suggestedName);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch (_err) {
    return false;
  }
}

// ── Handle management ───────────────────────────────────────────────────────

/**
 * Return the last stored `FileSystemFileHandle`, or null.
 * Useful for re-saving to the same file without prompting.
 * @returns {FileSystemFileHandle | null}
 */
export function getLastHandle() {
  return _lastHandle;
}

/**
 * Clear the stored file handle (e.g. after closing a document).
 */
export function clearHandle() {
  _lastHandle = null;
}
