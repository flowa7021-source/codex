// ─── OPFS Storage ───────────────────────────────────────────────────────────
// Origin Private File System for fast binary storage (thumbnails, autosave).
// Fallback: IndexedDB via persistence-facade.js when OPFS is unavailable.

/**
 * Check whether OPFS is supported in the current environment.
 */
export async function isOpfsSupported(): Promise<boolean> {
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
 */
function parsePath(path: string): { dirs: string[]; fileName: string } {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.pop() ?? '';
  return { dirs: parts, fileName };
}

/**
 * Navigate (and optionally create) nested directory handles.
 */
async function resolveDir(
  root: FileSystemDirectoryHandle,
  dirs: string[],
  opts: { create?: boolean } = {}
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const name of dirs) {
    current = await current.getDirectoryHandle(name, { create: !!opts.create });
  }
  return current;
}

/**
 * Write binary data to an OPFS file path, creating directories as needed.
 */
export async function writeFile(path: string, data: Uint8Array | ArrayBuffer | Blob): Promise<void> {
  const { dirs, fileName } = parsePath(path);
  const root = await navigator.storage.getDirectory();
  const dir = await resolveDir(root, dirs, { create: true });
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(data as FileSystemWriteChunkType);
  } finally {
    await writable.close();
  }
}

/**
 * Read a file from OPFS. Returns null if the file does not exist.
 */
export async function readFile(path: string): Promise<Uint8Array | null> {
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
 */
export async function deleteFile(path: string): Promise<boolean> {
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
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const parts = dirPath.split('/').filter(Boolean);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, parts);
    const names: string[] = [];
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
 */
export async function getFileSize(path: string): Promise<number> {
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
 */
export async function clearDirectory(dirPath: string): Promise<number> {
  try {
    const parts = dirPath.split('/').filter(Boolean);
    const root = await navigator.storage.getDirectory();
    const dir = await resolveDir(root, parts);
    let count = 0;
    const names: string[] = [];
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
