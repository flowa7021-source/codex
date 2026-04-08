import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTransferables,
  isDetached,
  viewSlice,
  cloneBuffer,
  concatBuffers,
  chunkBuffer,
} from '../../app/modules/worker-transfer.js';

describe('extractTransferables', () => {
  it('returns empty array for primitives', () => {
    assert.deepEqual(extractTransferables(null), []);
    assert.deepEqual(extractTransferables(undefined), []);
    assert.deepEqual(extractTransferables(42), []);
    assert.deepEqual(extractTransferables('hello'), []);
  });

  it('extracts ArrayBuffer directly', () => {
    const buf = new ArrayBuffer(8);
    const result = extractTransferables(buf);
    assert.equal(result.length, 1);
    assert.strictEqual(result[0], buf);
  });

  it('extracts buffer from Uint8Array', () => {
    const arr = new Uint8Array([1, 2, 3]);
    const result = extractTransferables(arr);
    assert.equal(result.length, 1);
    assert.strictEqual(result[0], arr.buffer);
  });

  it('extracts buffer from Float32Array', () => {
    const arr = new Float32Array(4);
    const result = extractTransferables(arr);
    assert.equal(result.length, 1);
    assert.strictEqual(result[0], arr.buffer);
  });

  it('extracts from nested object', () => {
    const buf = new ArrayBuffer(4);
    const obj = { image: { data: new Uint8Array(buf) }, name: 'test' };
    const result = extractTransferables(obj);
    assert.equal(result.length, 1);
    assert.strictEqual(result[0], buf);
  });

  it('extracts from array of buffers', () => {
    const bufs = [new ArrayBuffer(4), new ArrayBuffer(8)];
    const result = extractTransferables(bufs);
    assert.equal(result.length, 2);
  });

  it('deduplicates shared buffers (same buffer referenced twice)', () => {
    const buf = new ArrayBuffer(4);
    const arr1 = new Uint8Array(buf);
    const arr2 = new Uint8Array(buf);
    const result = extractTransferables([arr1, arr2]);
    assert.equal(result.length, 1, 'Same buffer should appear once');
  });

  it('handles circular references without infinite loop', () => {
    const obj = { a: new ArrayBuffer(4) };
    obj.self = obj; // circular ref
    const result = extractTransferables(obj);
    assert.equal(result.length, 1);
  });

  it('returns empty for plain objects with no buffers', () => {
    assert.deepEqual(extractTransferables({ x: 1, y: 'hello' }), []);
  });
});

describe('isDetached', () => {
  it('returns false for live buffer', () => {
    assert.equal(isDetached(new ArrayBuffer(8)), false);
  });

  it('returns true for zero-size buffer (simulates detached)', () => {
    assert.equal(isDetached(new ArrayBuffer(0)), true);
  });
});

describe('viewSlice', () => {
  it('returns a view with correct range', () => {
    const src = new Uint8Array([10, 20, 30, 40, 50]);
    const view = viewSlice(src, 1, 4);
    assert.equal(view.length, 3);
    assert.equal(view[0], 20);
    assert.equal(view[1], 30);
    assert.equal(view[2], 40);
  });

  it('shares the same buffer (no copy)', () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    const view = viewSlice(src, 0, 4);
    assert.strictEqual(view.buffer, src.buffer);
  });

  it('defaults to end of array when end not given', () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    const view = viewSlice(src, 2);
    assert.equal(view.length, 2);
  });
});

describe('cloneBuffer', () => {
  it('produces independent copy', () => {
    const original = new ArrayBuffer(4);
    new Uint8Array(original).set([1, 2, 3, 4]);
    const clone = cloneBuffer(original);
    assert.notStrictEqual(clone, original);
    assert.deepEqual(new Uint8Array(clone), new Uint8Array(original));
    // Modify clone, original unchanged
    new Uint8Array(clone)[0] = 99;
    assert.equal(new Uint8Array(original)[0], 1);
  });

  it('clones empty buffer', () => {
    const clone = cloneBuffer(new ArrayBuffer(0));
    assert.equal(clone.byteLength, 0);
  });
});

describe('concatBuffers', () => {
  it('concatenates two buffers', () => {
    const a = new Uint8Array([1, 2]).buffer;
    const b = new Uint8Array([3, 4, 5]).buffer;
    const result = new Uint8Array(concatBuffers([a, b]));
    assert.deepEqual([...result], [1, 2, 3, 4, 5]);
  });

  it('handles empty array', () => {
    assert.equal(concatBuffers([]).byteLength, 0);
  });

  it('handles single buffer', () => {
    const buf = new Uint8Array([7, 8, 9]).buffer;
    const result = concatBuffers([buf]);
    assert.deepEqual(new Uint8Array(result), new Uint8Array([7, 8, 9]));
  });
});

describe('chunkBuffer', () => {
  it('splits buffer into even chunks', () => {
    const buf = new ArrayBuffer(6);
    const chunks = chunkBuffer(buf, 2);
    assert.equal(chunks.length, 3);
    for (const chunk of chunks) assert.equal(chunk.byteLength, 2);
  });

  it('last chunk has remaining bytes', () => {
    const buf = new ArrayBuffer(10);
    const chunks = chunkBuffer(buf, 3);
    assert.equal(chunks.length, 4);
    assert.equal(chunks[3].byteLength, 1);
  });

  it('returns single chunk for buffer smaller than chunkSize', () => {
    const buf = new ArrayBuffer(5);
    const chunks = chunkBuffer(buf, 1024 * 1024);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].byteLength, 5);
  });

  it('empty buffer returns empty array', () => {
    assert.equal(chunkBuffer(new ArrayBuffer(0)).length, 0);
  });
});
