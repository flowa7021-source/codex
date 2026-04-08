// @ts-check
// ─── Web Share API ──────────────────────────────────────────────────────────
// Native sharing of documents via the Web Share API.
// Falls back to download when sharing is unavailable.

/**
 * Check whether the Web Share API is available.
 * @returns {boolean}
 */
export function isShareSupported() {
  return !!navigator.share;
}

/**
 * Check whether file sharing is supported for a given MIME type.
 * @param {string} [mimeType='application/pdf']
 * @returns {boolean}
 */
export function isFileShareSupported(mimeType) {
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
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ title?: string, text?: string }} [options]
 * @returns {Promise<boolean>} true if shared successfully
 */
export async function shareDocument(blob, filename, options) {
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
    console.warn('[web-share] share failed:', /** @type {Error} */ (err)?.message);
    downloadFallback(blob, filename);
    return false;
  }
}

/**
 * Share plain text via the Web Share API.
 * @param {string} text
 * @param {string} [title]
 * @returns {Promise<boolean>} true if shared successfully
 */
export async function shareText(text, title) {
  if (!navigator.share) return false;

  try {
    await navigator.share({ text, title });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return false;
    }
    console.warn('[web-share] shareText failed:', /** @type {Error} */ (err)?.message);
    return false;
  }
}

/**
 * Share a URL via the Web Share API.
 * @param {string} url
 * @param {string} [title]
 * @returns {Promise<boolean>} true if shared successfully
 */
export async function shareUrl(url, title) {
  if (!navigator.share) return false;

  try {
    await navigator.share({ url, title });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return false;
    }
    console.warn('[web-share] shareUrl failed:', /** @type {Error} */ (err)?.message);
    return false;
  }
}

/**
 * Fallback download using a temporary anchor element.
 * Always available regardless of browser support.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadFallback(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
