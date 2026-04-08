// ─── Platform abstraction layer: Tauri desktop / browser fallback ──────────
//
// All platform-specific operations (file dialogs, filesystem access, shell,
// window management) go through this module. It auto-detects whether the app
// is running inside Tauri or a plain browser and routes accordingly.
//
// Usage:
//   import { initPlatform, isTauri, openFileDialog, readFileAsBytes } from './platform.js';
//   await initPlatform();

type FileFilter = { name: string; extensions: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _isTauri = false;
let _tauriDialog: any = null;
let _tauriFs: any = null;
let _tauriShell: any = null;
let _tauriInvoke: any = null;

let _initPromise: Promise<void> | null = null;

// ── Initialization ───────────────────────────────────────────────────────────

/**
 * Detect runtime environment and load Tauri APIs if available.
 * Must be called once at app startup before any other platform function.
 * Safe to call multiple times — subsequent calls return the first promise.
 */
export function initPlatform(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
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

async function ensurePlatformReady(): Promise<void> {
  if (_initPromise) await _initPromise;
}

/** @returns true if running inside Tauri, false if plain browser */
export function isTauri(): boolean {
  return _isTauri;
}

// ── File Dialogs ─────────────────────────────────────────────────────────────

export interface OpenFileDialogOptions {
  multiple?: boolean;
  title?: string;
  filters?: FileFilter[];
}

export interface SaveFileDialogOptions {
  defaultPath?: string;
  title?: string;
  filters?: FileFilter[];
}

/**
 * Show a native file-open dialog.
 * Tauri: returns file path(s) as string(s). Browser: returns File object(s).
 */
export async function openFileDialog(
  options: OpenFileDialogOptions = {},
): Promise<string | string[] | File | File[] | null> {
  await ensurePlatformReady();
  const filters: FileFilter[] = options.filters ?? [
    { name: 'Documents', extensions: ['pdf', 'djvu', 'djv', 'epub', 'cbz', 'xps'] },
    { name: 'PDF', extensions: ['pdf'] },
    { name: 'DjVu', extensions: ['djvu', 'djv'] },
    { name: 'ePub', extensions: ['epub'] },
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'webp'] },
    { name: 'All', extensions: ['*'] },
  ];

  if (_isTauri) {
    const result = await _tauriDialog.open({
      multiple: options.multiple ?? false,
      directory: false,
      filters,
      title: options.title ?? 'NovaReader',
    });
    return result;
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap(f => f.extensions.filter(e => e !== '*').map(e => `.${e}`)).join(',');
    input.multiple = options.multiple ?? false;
    input.onchange = () => {
      if (!input.files || input.files.length === 0) return resolve(null);
      resolve(options.multiple ? Array.from(input.files) : input.files[0]);
    };
    input.click();
  });
}

/**
 * Show a native file-save dialog.
 * Tauri: returns save path. Browser: returns null (use downloadBlob instead).
 */
export async function saveFileDialog(options: SaveFileDialogOptions = {}): Promise<string | null> {
  await ensurePlatformReady();
  if (_isTauri) {
    return _tauriDialog.save({
      filters: options.filters ?? [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'DOCX', extensions: ['docx'] },
      ],
      defaultPath: options.defaultPath,
      title: options.title ?? 'NovaReader',
    });
  }
  return null;
}

// ── File System ──────────────────────────────────────────────────────────────

/**
 * Read a file as bytes.
 * Tauri: accepts file path string. Browser: accepts File object.
 */
export async function readFileAsBytes(pathOrFile: string | File): Promise<Uint8Array> {
  await ensurePlatformReady();
  if (_isTauri && typeof pathOrFile === 'string') {
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

  if (pathOrFile instanceof File) {
    const buffer = await pathOrFile.arrayBuffer();
    return new Uint8Array(buffer);
  }

  throw new Error('readFileAsBytes: unsupported input type');
}

/**
 * Trigger a browser download for a Blob.
 * In Tauri, shows a native save dialog instead.
 */
export async function downloadBlob(blob: Blob, filename: string, filters?: FileFilter[]): Promise<void> {
  await ensurePlatformReady();
  if (_isTauri) {
    await saveOrDownload(blob, filename, filters);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  try { document.body.appendChild(a); } catch (_e) { /* test env */ }
  a.click();
  try { document.body.removeChild(a); } catch (_e) { /* test env */ }
  URL.revokeObjectURL(url);
}

/**
 * Unified save helper: shows native save dialog in Tauri, falls back to
 * browser blob download otherwise.
 * @returns true if saved/downloaded successfully
 */
export async function saveOrDownload(blob: Blob, filename: string, filters?: FileFilter[]): Promise<boolean> {
  await ensurePlatformReady();
  if (_isTauri) {
    const path = await saveFileDialog({ defaultPath: filename, filters });
    if (path) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeFileBytes(path, bytes);
      return true;
    }
    return false;
  }
  void downloadBlob(blob, filename);
  return true;
}

/**
 * Write raw bytes to a file path (Tauri only).
 */
export async function writeFileBytes(path: string, bytes: Uint8Array): Promise<void> {
  if (!_isTauri || !_tauriFs) {
    throw new Error('writeFileBytes: only available in Tauri');
  }
  await _tauriFs.writeFile(path, bytes);
}

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * Open a URL in the default system browser.
 */
export async function openExternal(url: string): Promise<void> {
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
 */
export async function setWindowTitle(title: string): Promise<void> {
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
 * Returns null in browser (use IndexedDB/localStorage instead).
 */
export async function getAppDataDir(): Promise<string | null> {
  if (_isTauri) {
    return _tauriInvoke('get_app_data_dir');
  }
  return null;
}
