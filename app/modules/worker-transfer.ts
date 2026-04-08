// ─── Worker Transfer Utilities ──────────────────────────────────────────────
// Helpers for zero-copy data transfer between main thread and workers using
// Transferable objects (ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas).
//
// Usage:
//   const transferables = extractTransferables(payload);
//   pool.submit('ocr', payload, { transfer: transferables });
//   // After submit, payload.buffer.byteLength === 0 (transferred, not copied)

/**
 * Recursively extract all Transferable objects from a value.
 * Handles: ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas, ReadableStream,
 * WritableStream, TransformStream, Uint8Array (extracts buffer), nested objects/arrays.
 *
 * @param value - Any value to extract transferables from
 * @param seen - Internal: visited set to avoid circular references
 * @returns Array of unique Transferable objects found
 */
export function extractTransferables(value: unknown, seen = new Set<unknown>()): Transferable[] {
  if (value === null || value === undefined) return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const result: Transferable[] = [];

  // ArrayBuffer — the primary transferable for binary data
  if (value instanceof ArrayBuffer) {
    result.push(value);
    return result;
  }

  // TypedArrays — extract their underlying buffer
  if (ArrayBuffer.isView(value)) {
    const buf = value.buffer;
    if (buf instanceof ArrayBuffer && !seen.has(buf)) {
      seen.add(buf);
      result.push(buf);
    }
    return result;
  }

  // MessagePort
  if (typeof MessagePort !== 'undefined' && value instanceof MessagePort) {
    result.push(value);
    return result;
  }

  // ImageBitmap
  if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) {
    result.push(value);
    return result;
  }

  // OffscreenCanvas (may not be in all TS libs)
  if (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas) {
    result.push(value as unknown as Transferable);
    return result;
  }

  // ReadableStream / WritableStream / TransformStream (transferable in workers)
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) {
    result.push(value as unknown as Transferable);
    return result;
  }
  if (typeof WritableStream !== 'undefined' && value instanceof WritableStream) {
    result.push(value as unknown as Transferable);
    return result;
  }

  // Arrays — recurse into elements
  if (Array.isArray(value)) {
    for (const item of value) {
      for (const t of extractTransferables(item, seen)) {
        result.push(t);
      }
    }
    return result;
  }

  // Plain objects — recurse into values (skip prototype methods)
  if (typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[key];
      for (const t of extractTransferables(child, seen)) {
        result.push(t);
      }
    }
  }

  return result;
}

/**
 * Check whether an ArrayBuffer has been transferred (detached).
 * After transfer, byteLength === 0 and reads throw TypeError.
 */
export function isDetached(buf: ArrayBuffer): boolean {
  return buf.byteLength === 0;
}

/**
 * Create a zero-copy view of a Uint8Array slice without copying data.
 * Returns a new Uint8Array that shares memory (no copy).
 * Use transferTransferables() to move ownership across threads.
 */
export function viewSlice(source: Uint8Array, start: number, end?: number): Uint8Array {
  return new Uint8Array(source.buffer, source.byteOffset + start, (end ?? source.length) - start);
}

/**
 * Clone an ArrayBuffer by copying bytes. Useful when you need to keep
 * a local copy while transferring the original.
 */
export function cloneBuffer(buf: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(new Uint8Array(buf));
  return copy;
}

/**
 * Concatenate multiple ArrayBuffers into one without intermediate copies.
 */
export function concatBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new ArrayBuffer(totalLength);
  const view = new Uint8Array(result);
  let offset = 0;
  for (const buf of buffers) {
    view.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result;
}

/**
 * Wrap a worker's onmessage handler so that ArrayBuffer results are
 * automatically transferred back to the main thread (zero-copy).
 *
 * Use in worker scripts:
 *   self.onmessage = wrapWorkerHandler(async (payload) => {
 *     const result = await processImage(payload.imageData);
 *     return result; // ArrayBuffers inside are auto-transferred
 *   });
 */
export function wrapWorkerHandler(
  fn: (payload: unknown) => Promise<unknown> | unknown,
): (event: MessageEvent) => void {
  return async (event: MessageEvent) => {
    const { id, payload } = event.data;
    try {
      const result = await fn(payload);
      const transfer = extractTransferables(result);
      (self as unknown as Worker).postMessage({ id, result }, transfer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      (self as unknown as Worker).postMessage({ id, error: message });
    }
  };
}

/**
 * Split a large ArrayBuffer into chunks for streaming transfer.
 * Useful for sending large files across multiple postMessage calls.
 *
 * @param buffer - Source buffer
 * @param chunkSize - Size of each chunk in bytes (default 1MB)
 * @returns Array of ArrayBuffer chunks (sliced, not copied)
 */
export function chunkBuffer(buffer: ArrayBuffer, chunkSize = 1024 * 1024): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  let offset = 0;
  while (offset < buffer.byteLength) {
    const end = Math.min(offset + chunkSize, buffer.byteLength);
    chunks.push(buffer.slice(offset, end));
    offset = end;
  }
  return chunks;
}
