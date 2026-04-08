// ─── Web Share API ──────────────────────────────────────────────────────────
// Native sharing of documents via the Web Share API.
// Falls back to download when sharing is unavailable.

/**
 * Check whether the Web Share API is available.
 */
export function isShareSupported(): boolean {
  return !!navigator.share;
}

/**
 * Check whether file sharing is supported for a given MIME type.
 */
export function isFileShareSupported(mimeType?: string): boolean {
  try {
    if (!navigator.canShare) return false;
    const file = new File([], 'test', { type: mimeType || 'application/pdf' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Share a document file via the Web Share API.
 * Falls back to {@link downloadFallback} when sharing is unavailable or fails.
 */
export async function shareDocument(
  blob: Blob,
  filename: string,
  options?: { title?: string; text?: string }
): Promise<boolean> {
  const title = options?.title;
  const text = options?.text;

  if (!navigator.share) {
    downloadFallback(blob, filename);
    return false;
  }

  try {
    const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return false;
    }
    console.warn('[web-share] share failed:', (err as Error)?.message);
    downloadFallback(blob, filename);
    return false;
  }
}

/**
 * Share plain text via the Web Share API.
 */
export async function shareText(text: string, title?: string): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({ text, title });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return false;
    }
    console.warn('[web-share] shareText failed:', (err as Error)?.message);
    return false;
  }
}

/**
 * Share a URL via the Web Share API.
 */
export async function shareUrl(url: string, title?: string): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({ url, title });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return false;
    }
    console.warn('[web-share] shareUrl failed:', (err as Error)?.message);
    return false;
  }
}

/**
 * Fallback download using a temporary anchor element.
 * Always available regardless of browser support.
 */
export function downloadFallback(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
