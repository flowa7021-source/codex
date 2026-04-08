// @ts-check
// ─── OPFS Storage ───────────────────────────────────────────────────────────
// Origin Private File System for fast binary storage (thumbnails, autosave).
// Fallback: IndexedDB via persistence-facade.js when OPFS is unavailable.

/**
 * Check whether OPFS is supported in the current environment.
 * @returns {Promise<boolean>}
 */
export async function isOpfsSupported() {
  try {
    if (!navigator.storage?.getDirectory) return false;
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

/**
 * Split a slash-separated path into directory segments and a file name.
 * @param {string} path - e.g. 'thumbnails/page-1.png'
 * @returns {{ dirs: string[], fileName: string }}
 */
function parsePath(path) {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.pop() ?? '';
  return { dirs: parts, fileName };
}

/**
 * Navigate (and optionally create) nested directory handles.
 * @param {FileSystemDirectoryHandle} root
 * @param {string[]} dirs
 * @param {{ create?: boolean }} [opts]
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
async function resolveDir(root, dirs, opts = {}) {
  let current = root;
  for (const name of dirs) {
    current = await current.getDirectoryHandle(name, { create: !!opts.create });
  }
  return current;
}

/**
 * Write binary data to an OPFS file path, creating directories as needed.
 * @param {string} path - e.g. 'thumbnails/page-1.png'
 * @param {Uint8Array | ArrayBuffer | Blob} data
 * @returns {Promise<void>}
 */
export async function writeFile(path, data) {
  const { dirs, fileName } = parsePath(path);
  const root = await navigator.storage.getDirectory();
  const dir = await resolveDir(root, dirs, { create: true });
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(/** @type {any} */ (data));
  } finally {
    await writable.close();
  }
}

/**
 * Read a file from OPFS. Returns null if the file does not exist.
 * @param {string} path
 * @returns {Promise<Uint8Array | null>}
 */
export async function readFile(path) {
  try {
    const { dirs, fileName } = parsePath(path);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, dirs);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

/**
 * Delete a file from OPFS. Returns true if deleted, false if not found.
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function deleteFile(path) {
  try {
    const { dirs, fileName } = parsePath(path);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, dirs);
    await dir.removeEntry(fileName);
    return true;
  } catch {
    return false;
  }
}

/**
 * List file names in an OPFS directory. Returns empty array if dir not found.
 * @param {string} dirPath
 * @returns {Promise<string[]>}
 */
export async function listFiles(dirPath) {
  try {
    const parts = dirPath.split('/').filter(Boolean);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, parts);
    const names = [];
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        names.push(entry.name);
      }
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * Get the byte size of a file. Returns -1 if not found.
 * @param {string} path
 * @returns {Promise<number>}
 */
export async function getFileSize(path) {
  try {
    const { dirs, fileName } = parsePath(path);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, dirs);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.size;
  } catch {
    return -1;
  }
}

/**
 * Remove all files in a directory. Returns count of files removed.
 * @param {string} dirPath
 * @returns {Promise<number>}
 */
export async function clearDirectory(dirPath) {
  try {
    const parts = dirPath.split('/').filter(Boolean);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, parts);
    let count = 0;
    /** @type {string[]} */
    const names = [];
    for await (const entry of dir.values()) {
      names.push(entry.name);
    }
    for (const name of names) {
      await dir.removeEntry(name);
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}
