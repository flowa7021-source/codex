// ─── Web NFC API ──────────────────────────────────────────────────────────────
// Web NFC API wrapper for reading and writing NFC tags via NDEFReader.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Web NFC API is supported (NDEFReader available).
 */
export function isNFCSupported(): boolean {
  return typeof (globalThis as any).NDEFReader !== 'undefined';
}

/**
 * Request NFC permission. Returns true if granted, false otherwise.
 */
export async function requestNFCPermission(): Promise<boolean> {
  if (!isNFCSupported()) return false;
  try {
    const result = await navigator.permissions.query({ name: 'nfc' as PermissionName });
    return result.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * Read NFC tags. Returns a stop function.
 * Calls onRead with each NdefMessage, calls onError on errors.
 */
export async function startNFCRead(
  onRead: (message: any) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  if (!isNFCSupported()) return () => {};
  const NDEFReaderClass = (globalThis as any).NDEFReader;
  const reader: any = new NDEFReaderClass();

  const handleReading = (event: any) => {
    onRead(event.message);
  };
  const handleError = (event: any) => {
    if (onError) onError(event.error ?? new Error('NFC read error'));
  };

  reader.addEventListener('reading', handleReading);
  reader.addEventListener('readingerror', handleError);

  await reader.scan();

  return () => {
    reader.removeEventListener('reading', handleReading);
    reader.removeEventListener('readingerror', handleError);
  };
}

/**
 * Write an NDEF text record to an NFC tag.
 * Returns true on success, false on failure.
 */
export async function writeNFCText(text: string, lang?: string): Promise<boolean> {
  if (!isNFCSupported()) return false;
  try {
    const NDEFReaderClass = (globalThis as any).NDEFReader;
    const writer: any = new NDEFReaderClass();
    await writer.write({
      records: [{ recordType: 'text', data: text, lang: lang ?? 'en' }],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Write an NDEF URL record to an NFC tag.
 * Returns true on success, false on failure.
 */
export async function writeNFCURL(url: string): Promise<boolean> {
  if (!isNFCSupported()) return false;
  try {
    const NDEFReaderClass = (globalThis as any).NDEFReader;
    const writer: any = new NDEFReaderClass();
    await writer.write({
      records: [{ recordType: 'url', data: url }],
    });
    return true;
  } catch {
    return false;
  }
}
