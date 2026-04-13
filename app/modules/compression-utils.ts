// @ts-check
// ─── Compression Utilities ───────────────────────────────────────────────────
// Compression/decompression using the Web Compression Streams API.
// Requires CompressionStream / DecompressionStream (browsers + Node.js 18+).

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect all chunks from a ReadableStream into a single Uint8Array. */
async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Check if CompressionStream is supported in the current environment. */
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/** Compress a Uint8Array using the given format (default: 'gzip'). */
export async function compress(
  data: Uint8Array,
  format: CompressionFormat = 'gzip',
): Promise<Uint8Array> {
  if (!isCompressionSupported()) {
    throw new Error('CompressionStream is not supported in this environment');
  }
  const stream = new CompressionStream(format);
  const writer = stream.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  return collectStream(stream.readable);
}

/** Decompress a Uint8Array using the given format (default: 'gzip'). */
export async function decompress(
  data: Uint8Array,
  format: CompressionFormat = 'gzip',
): Promise<Uint8Array> {
  if (!isCompressionSupported()) {
    throw new Error('DecompressionStream is not supported in this environment');
  }
  const stream = new DecompressionStream(format);
  const writer = stream.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  return collectStream(stream.readable);
}

/** Compress a UTF-8 string to Uint8Array. */
export async function compressText(
  text: string,
  format: CompressionFormat = 'gzip',
): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(text);
  return compress(encoded, format);
}

/** Decompress a Uint8Array to a UTF-8 string. */
export async function decompressText(
  data: Uint8Array,
  format: CompressionFormat = 'gzip',
): Promise<string> {
  const decompressed = await decompress(data, format);
  return new TextDecoder().decode(decompressed);
}

/** Compress a Uint8Array and encode the result as a base64 string. */
export async function compressToBase64(
  data: Uint8Array,
  format: CompressionFormat = 'gzip',
): Promise<string> {
  const compressed = await compress(data, format);
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary);
}

/** Decode a base64 string and decompress the result. */
export async function decompressFromBase64(
  b64: string,
  format: CompressionFormat = 'gzip',
): Promise<Uint8Array> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return decompress(bytes, format);
}
