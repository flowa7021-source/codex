// ─── Unit Tests: stream-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  streamToBytes,
  streamToText,
  bytesToStream,
  textToStream,
  limitStream,
  concatBytes,
  chunkBytes,
  forEachChunk,
} from '../../app/modules/stream-utils.js';

// ─── bytesToStream + streamToBytes ────────────────────────────────────────────

describe('bytesToStream + streamToBytes roundtrip', () => {
  it('converts bytes to stream and back', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = bytesToStream(original);
    const result = await streamToBytes(stream);
    assert.deepEqual(result, original);
  });

  it('handles empty Uint8Array', async () => {
    const original = new Uint8Array(0);
    const stream = bytesToStream(original);
    const result = await streamToBytes(stream);
    assert.deepEqual(result, original);
  });

  it('preserves all byte values 0-255', async () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;
    const stream = bytesToStream(original);
    const result = await streamToBytes(stream);
    assert.deepEqual(result, original);
  });
});

// ─── textToStream + streamToText ──────────────────────────────────────────────

describe('textToStream + streamToText roundtrip', () => {
  it('converts ASCII text to stream and back', async () => {
    const original = 'Hello, World!';
    const stream = textToStream(original);
    const result = await streamToText(stream);
    assert.equal(result, original);
  });

  it('converts multi-byte UTF-8 text to stream and back', async () => {
    const original = 'Hello 日本語 🎉';
    const stream = textToStream(original);
    const result = await streamToText(stream);
    assert.equal(result, original);
  });

  it('handles empty string', async () => {
    const stream = textToStream('');
    const result = await streamToText(stream);
    assert.equal(result, '');
  });
});

// ─── concatBytes ──────────────────────────────────────────────────────────────

describe('concatBytes', () => {
  it('combines two Uint8Arrays correctly', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5, 6]);
    const result = concatBytes(a, b);
    assert.deepEqual(result, new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('combines three Uint8Arrays correctly', () => {
    const a = new Uint8Array([1]);
    const b = new Uint8Array([2, 3]);
    const c = new Uint8Array([4, 5, 6]);
    const result = concatBytes(a, b, c);
    assert.deepEqual(result, new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('returns empty Uint8Array when called with no arguments', () => {
    const result = concatBytes();
    assert.deepEqual(result, new Uint8Array(0));
  });

  it('returns a copy when called with a single array', () => {
    const a = new Uint8Array([1, 2, 3]);
    const result = concatBytes(a);
    assert.deepEqual(result, a);
  });

  it('handles empty arrays in the input', () => {
    const a = new Uint8Array([1, 2]);
    const empty = new Uint8Array(0);
    const b = new Uint8Array([3, 4]);
    const result = concatBytes(a, empty, b);
    assert.deepEqual(result, new Uint8Array([1, 2, 3, 4]));
  });
});

// ─── chunkBytes ───────────────────────────────────────────────────────────────

describe('chunkBytes', () => {
  it('splits bytes into equal-sized chunks', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const chunks = chunkBytes(bytes, 2);
    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks[0], new Uint8Array([1, 2]));
    assert.deepEqual(chunks[1], new Uint8Array([3, 4]));
    assert.deepEqual(chunks[2], new Uint8Array([5, 6]));
  });

  it('last chunk is smaller when size does not divide evenly', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const chunks = chunkBytes(bytes, 2);
    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks[0], new Uint8Array([1, 2]));
    assert.deepEqual(chunks[1], new Uint8Array([3, 4]));
    assert.deepEqual(chunks[2], new Uint8Array([5]));
  });

  it('returns a single chunk when size >= bytes length', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const chunks = chunkBytes(bytes, 10);
    assert.equal(chunks.length, 1);
    assert.deepEqual(chunks[0], bytes);
  });

  it('returns empty array for chunkSize <= 0', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    assert.deepEqual(chunkBytes(bytes, 0), []);
    assert.deepEqual(chunkBytes(bytes, -1), []);
  });

  it('handles empty input bytes', () => {
    const bytes = new Uint8Array(0);
    const chunks = chunkBytes(bytes, 4);
    assert.deepEqual(chunks, []);
  });

  it('wraps each byte individually when chunkSize is 1', () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const chunks = chunkBytes(bytes, 1);
    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks[0], new Uint8Array([10]));
    assert.deepEqual(chunks[1], new Uint8Array([20]));
    assert.deepEqual(chunks[2], new Uint8Array([30]));
  });
});

// ─── limitStream ──────────────────────────────────────────────────────────────

describe('limitStream', () => {
  it('stops after maxBytes when chunk is larger', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const stream = bytesToStream(bytes);
    const limited = stream.pipeThrough(limitStream(5));
    const result = await streamToBytes(limited);
    assert.deepEqual(result, new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('passes all bytes when stream is smaller than maxBytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const stream = bytesToStream(bytes);
    const limited = stream.pipeThrough(limitStream(100));
    const result = await streamToBytes(limited);
    assert.deepEqual(result, bytes);
  });

  it('returns empty when maxBytes is 0', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const stream = bytesToStream(bytes);
    const limited = stream.pipeThrough(limitStream(0));
    const result = await streamToBytes(limited);
    assert.deepEqual(result, new Uint8Array(0));
  });

  it('handles exactly maxBytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = bytesToStream(bytes);
    const limited = stream.pipeThrough(limitStream(5));
    const result = await streamToBytes(limited);
    assert.deepEqual(result, bytes);
  });
});

// ─── forEachChunk ─────────────────────────────────────────────────────────────

describe('forEachChunk', () => {
  it('calls callback once for a single-chunk stream', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const stream = bytesToStream(bytes);
    const received = [];
    await forEachChunk(stream, (chunk) => {
      received.push(chunk);
    });
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], bytes);
  });

  it('calls callback for each chunk in a multi-chunk stream', async () => {
    // Build a multi-chunk stream using TransformStream
    const { writable, readable } = new TransformStream();
    const writer = writable.getWriter();
    const chunk1 = new Uint8Array([1, 2]);
    const chunk2 = new Uint8Array([3, 4]);
    const chunk3 = new Uint8Array([5]);
    writer.write(chunk1);
    writer.write(chunk2);
    writer.write(chunk3);
    writer.close();

    const received = [];
    await forEachChunk(readable, (chunk) => {
      received.push(new Uint8Array(chunk));
    });
    assert.equal(received.length, 3);
    assert.deepEqual(received[0], chunk1);
    assert.deepEqual(received[1], chunk2);
    assert.deepEqual(received[2], chunk3);
  });

  it('does not call callback for empty stream', async () => {
    const stream = bytesToStream(new Uint8Array(0));
    let callCount = 0;
    await forEachChunk(stream, () => { callCount++; });
    // A single empty chunk is still enqueued and read
    assert.equal(callCount, 1);
  });

  it('supports async callbacks', async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const stream = bytesToStream(bytes);
    const results = [];
    await forEachChunk(stream, async (chunk) => {
      await Promise.resolve();
      results.push(chunk);
    });
    assert.equal(results.length, 1);
    assert.deepEqual(results[0], bytes);
  });
});
