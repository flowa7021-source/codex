// @ts-check
// ─── File Utilities ──────────────────────────────────────────────────────────
// Browser-compatible File and Blob helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Read a File/Blob as text (UTF-8). */
export function readAsText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new (globalThis as any).FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob, 'utf-8');
  });
}

/** Read a File/Blob as ArrayBuffer. */
export function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new (globalThis as any).FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Read a File/Blob as a data URL. */
export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new (globalThis as any).FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Convert a Blob to Uint8Array. */
export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Create a Blob from text. */
export function textToBlob(text: string, mimeType = 'text/plain'): Blob {
  return new Blob([text], { type: mimeType });
}

/** Create a Blob from Uint8Array. */
export function bytesToBlob(bytes: Uint8Array, mimeType = 'application/octet-stream'): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: mimeType });
}

/** Download a Blob as a file in the browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Get file extension from filename. Returns '' if none. */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 1 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1);
}

/** Get filename without extension. */
export function getBasename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 1) return filename;
  return filename.slice(0, dot);
}

/** Format bytes as human-readable string (e.g., '1.5 MB'). */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const formatted = value % 1 === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${units[i]}`;
}

/** Check if a File's size is within limit (bytes). */
export function isFileSizeOk(file: { size: number }, maxBytes: number): boolean {
  return file.size <= maxBytes;
}
