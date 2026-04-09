// @ts-check
// ─── Stream Utilities ────────────────────────────────────────────────────────
// Utilities for working with Web Streams API.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Convert a ReadableStream to a Uint8Array (collect all chunks). */
export async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concatBytes(...chunks);
}

/** Convert a ReadableStream to a string (UTF-8). */
export async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const bytes = await streamToBytes(stream);
  return new TextDecoder().decode(bytes);
}

/** Convert a Uint8Array to a ReadableStream. */
export function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Convert a string to a ReadableStream (UTF-8). */
export function textToStream(text: string): ReadableStream<Uint8Array> {
  return bytesToStream(new TextEncoder().encode(text));
}

/** Create a TransformStream that limits bytes to a max size, then closes. */
export function limitStream(maxBytes: number): TransformStream<Uint8Array, Uint8Array> {
  let remaining = maxBytes;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (remaining <= 0) {
        controller.terminate();
        return;
      }
      if (chunk.byteLength <= remaining) {
        controller.enqueue(chunk);
        remaining -= chunk.byteLength;
      } else {
        controller.enqueue(chunk.slice(0, remaining));
        remaining = 0;
        controller.terminate();
      }
    },
  });
}

/** Concatenate multiple Uint8Arrays into one. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

/** Split a Uint8Array into chunks of a given size. */
export function chunkBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
  if (chunkSize <= 0) return [];
  const result: Uint8Array[] = [];
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    result.push(bytes.slice(i, i + chunkSize));
  }
  return result;
}

/** Read a ReadableStream chunk by chunk, calling callback for each chunk. */
export async function forEachChunk(
  stream: ReadableStream<Uint8Array>,
  callback: (chunk: Uint8Array) => void | Promise<void>
): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await callback(value);
    }
  } finally {
    reader.releaseLock();
  }
}
