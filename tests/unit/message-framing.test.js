// ─── Unit Tests: Message Framing ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LengthPrefixFramer,
  DelimiterFramer,
  FixedSizeFramer,
  TypedFramer,
} from '../../app/modules/message-framing.js';

// ─── LengthPrefixFramer ──────────────────────────────────────────────────────

describe('LengthPrefixFramer', () => {
  it('encode produces a 4-byte prefix followed by payload', () => {
    const framer = new LengthPrefixFramer();
    const payload = Buffer.from('hello');
    const encoded = framer.encode(payload);
    assert.equal(encoded.length, 4 + payload.length);
    assert.equal(encoded.readUInt32BE(0), payload.length);
    assert.deepEqual(encoded.subarray(4), payload);
  });

  it('encode + feed round-trips a single frame', () => {
    const framer = new LengthPrefixFramer();
    const payload = Buffer.from('hello world');
    const encoded = framer.encode(payload);
    const frames = framer.feed(encoded);
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], payload);
  });

  it('round-trips an empty payload', () => {
    const framer = new LengthPrefixFramer();
    const payload = Buffer.alloc(0);
    const frames = framer.feed(framer.encode(payload));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], payload);
  });

  it('accumulates partial data across multiple feed calls', () => {
    const framer = new LengthPrefixFramer();
    const payload = Buffer.from('partial');
    const encoded = framer.encode(payload);

    // Feed one byte at a time — should produce no frames until the last byte.
    const allFrames = [];
    for (let i = 0; i < encoded.length - 1; i++) {
      const frames = framer.feed(encoded.subarray(i, i + 1));
      assert.equal(frames.length, 0, `unexpected frame at byte ${i}`);
    }
    // Feed the last byte.
    const last = framer.feed(encoded.subarray(encoded.length - 1));
    allFrames.push(...last);

    assert.equal(allFrames.length, 1);
    assert.deepEqual(allFrames[0], payload);
  });

  it('returns multiple frames when fed all at once', () => {
    const framer = new LengthPrefixFramer();
    const a = framer.encode(Buffer.from('aaa'));
    const b = framer.encode(Buffer.from('bbb'));
    const c = framer.encode(Buffer.from('ccc'));
    const frames = framer.feed(Buffer.concat([a, b, c]));
    assert.equal(frames.length, 3);
    assert.deepEqual(frames[0], Buffer.from('aaa'));
    assert.deepEqual(frames[1], Buffer.from('bbb'));
    assert.deepEqual(frames[2], Buffer.from('ccc'));
  });

  it('reset clears the internal buffer', () => {
    const framer = new LengthPrefixFramer();
    const payload = Buffer.from('data');
    const encoded = framer.encode(payload);

    // Feed only the length prefix, no payload yet.
    framer.feed(encoded.subarray(0, 4));
    framer.reset();

    // Now feed a complete fresh frame — should decode cleanly.
    const frames = framer.feed(framer.encode(Buffer.from('fresh')));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], Buffer.from('fresh'));
  });

  it('handles binary payload correctly', () => {
    const framer = new LengthPrefixFramer();
    const payload = Buffer.from([0x00, 0x01, 0xfe, 0xff, 0x7f, 0x80]);
    const frames = framer.feed(framer.encode(payload));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], payload);
  });
});

// ─── DelimiterFramer ─────────────────────────────────────────────────────────

describe('DelimiterFramer', () => {
  it('default newline delimiter: encode + feed round-trip', () => {
    const framer = new DelimiterFramer();
    const encoded = framer.encode('hello');
    const frames = framer.feed(encoded);
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], Buffer.from('hello'));
  });

  it('default newline delimiter: delimiter not included in payload', () => {
    const framer = new DelimiterFramer();
    const encoded = framer.encode(Buffer.from('line'));
    assert.equal(encoded[encoded.length - 1], 0x0a); // '\n'
    const frames = framer.feed(encoded);
    assert.equal(frames[0].length, 4); // 'line' only, no newline
  });

  it('custom string delimiter', () => {
    const framer = new DelimiterFramer('|||');
    const a = framer.encode('foo');
    const b = framer.encode('bar');
    const frames = framer.feed(Buffer.concat([a, b]));
    assert.equal(frames.length, 2);
    assert.deepEqual(frames[0], Buffer.from('foo'));
    assert.deepEqual(frames[1], Buffer.from('bar'));
  });

  it('custom Buffer delimiter', () => {
    const delim = Buffer.from([0x00, 0xff]);
    const framer = new DelimiterFramer(delim);
    const encoded = framer.encode(Buffer.from([0x01, 0x02, 0x03]));
    const frames = framer.feed(encoded);
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], Buffer.from([0x01, 0x02, 0x03]));
  });

  it('accumulates split messages across multiple feeds', () => {
    const framer = new DelimiterFramer();
    const encoded = framer.encode('split message');

    // Feed in two halves.
    const mid = Math.floor(encoded.length / 2);
    const partial = framer.feed(encoded.subarray(0, mid));
    assert.equal(partial.length, 0);

    const complete = framer.feed(encoded.subarray(mid));
    assert.equal(complete.length, 1);
    assert.deepEqual(complete[0], Buffer.from('split message'));
  });

  it('handles multiple messages split across feed calls', () => {
    const framer = new DelimiterFramer();
    const all = Buffer.concat([
      framer.encode('msg1'),
      framer.encode('msg2'),
      framer.encode('msg3'),
    ]);

    // Deliver in three uneven chunks.
    const chunk1 = all.subarray(0, 3);
    const chunk2 = all.subarray(3, 9);
    const chunk3 = all.subarray(9);

    const f1 = framer.feed(chunk1);
    const f2 = framer.feed(chunk2);
    const f3 = framer.feed(chunk3);

    const frames = [...f1, ...f2, ...f3];
    assert.equal(frames.length, 3);
    assert.deepEqual(frames[0], Buffer.from('msg1'));
    assert.deepEqual(frames[1], Buffer.from('msg2'));
    assert.deepEqual(frames[2], Buffer.from('msg3'));
  });

  it('handles empty payload', () => {
    const framer = new DelimiterFramer();
    const frames = framer.feed(framer.encode(''));
    assert.equal(frames.length, 1);
    assert.equal(frames[0].length, 0);
  });

  it('reset clears the internal buffer', () => {
    const framer = new DelimiterFramer();
    framer.feed(Buffer.from('half'));
    framer.reset();
    const frames = framer.feed(framer.encode('clean'));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], Buffer.from('clean'));
  });
});

// ─── FixedSizeFramer ─────────────────────────────────────────────────────────

describe('FixedSizeFramer', () => {
  it('throws for non-positive frame size', () => {
    assert.throws(() => new FixedSizeFramer(0), RangeError);
    assert.throws(() => new FixedSizeFramer(-1), RangeError);
  });

  it('encode of exact-size payload returns one frame', () => {
    const framer = new FixedSizeFramer(4);
    const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const frames = framer.encode(payload);
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], payload);
  });

  it('encode of shorter payload zero-pads the frame', () => {
    const framer = new FixedSizeFramer(8);
    const payload = Buffer.from([0x01, 0x02]);
    const frames = framer.encode(payload);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].length, 8);
    assert.deepEqual(frames[0].subarray(0, 2), payload);
    assert.deepEqual(frames[0].subarray(2), Buffer.alloc(6));
  });

  it('encode of larger payload splits into multiple frames', () => {
    const framer = new FixedSizeFramer(4);
    // 10 bytes → 3 frames (4, 4, 2 padded to 4)
    const payload = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const frames = framer.encode(payload);
    assert.equal(frames.length, 3);
    assert.deepEqual(frames[0], Buffer.from([1, 2, 3, 4]));
    assert.deepEqual(frames[1], Buffer.from([5, 6, 7, 8]));
    assert.deepEqual(frames[2], Buffer.from([9, 10, 0, 0]));
  });

  it('feed accumulates partial data until a full frame is available', () => {
    const framer = new FixedSizeFramer(4);
    const empty1 = framer.feed(Buffer.from([0x01]));
    const empty2 = framer.feed(Buffer.from([0x02, 0x03]));
    assert.equal(empty1.length, 0);
    assert.equal(empty2.length, 0);

    const done = framer.feed(Buffer.from([0x04]));
    assert.equal(done.length, 1);
    assert.deepEqual(done[0], Buffer.from([0x01, 0x02, 0x03, 0x04]));
  });

  it('feed returns multiple frames when a lot of data arrives', () => {
    const framer = new FixedSizeFramer(3);
    const data = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const frames = framer.feed(data);
    assert.equal(frames.length, 3);
    assert.deepEqual(frames[0], Buffer.from([1, 2, 3]));
    assert.deepEqual(frames[1], Buffer.from([4, 5, 6]));
    assert.deepEqual(frames[2], Buffer.from([7, 8, 9]));
  });

  it('leftover bytes carry over to the next feed call', () => {
    const framer = new FixedSizeFramer(4);
    // Feed 6 bytes: should yield 1 frame, 2 bytes remain.
    const f1 = framer.feed(Buffer.from([1, 2, 3, 4, 5, 6]));
    assert.equal(f1.length, 1);

    // Feed 2 more bytes: completes the second frame.
    const f2 = framer.feed(Buffer.from([7, 8]));
    assert.equal(f2.length, 1);
    assert.deepEqual(f2[0], Buffer.from([5, 6, 7, 8]));
  });

  it('reset clears leftover bytes', () => {
    const framer = new FixedSizeFramer(4);
    framer.feed(Buffer.from([1, 2])); // partial
    framer.reset();
    const frames = framer.feed(Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]));
  });

  it('encode empty payload returns one zero-padded frame', () => {
    const framer = new FixedSizeFramer(4);
    const frames = framer.encode(Buffer.alloc(0));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], Buffer.alloc(4));
  });
});

// ─── TypedFramer ─────────────────────────────────────────────────────────────

describe('TypedFramer', () => {
  it('encode produces a 6-byte header followed by payload', () => {
    const framer = new TypedFramer();
    const payload = Buffer.from('typed');
    const encoded = framer.encode(1, payload);
    assert.equal(encoded.length, 6 + payload.length);
    assert.equal(encoded.readUInt8(1), 1);   // type
    assert.equal(encoded.readUInt32BE(2), payload.length);
    assert.deepEqual(encoded.subarray(6), payload);
  });

  it('encode + feed round-trip preserves type and payload', () => {
    const framer = new TypedFramer();
    const payload = Buffer.from('hello typed world');
    const encoded = framer.encode(42, payload);
    const frames = framer.feed(encoded);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].type, 42);
    assert.equal(frames[0].flags, 0);
    assert.deepEqual(frames[0].payload, payload);
  });

  it('encode + feed round-trip preserves flags', () => {
    const framer = new TypedFramer();
    const payload = Buffer.from([0xde, 0xad]);
    const encoded = framer.encode(7, payload, 0b10110101);
    const frames = framer.feed(encoded);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].type, 7);
    assert.equal(frames[0].flags, 0b10110101);
    assert.deepEqual(frames[0].payload, payload);
  });

  it('handles empty payload', () => {
    const framer = new TypedFramer();
    const frames = framer.feed(framer.encode(0, Buffer.alloc(0)));
    assert.equal(frames.length, 1);
    assert.equal(frames[0].type, 0);
    assert.equal(frames[0].payload.length, 0);
  });

  it('accumulates partial header across multiple feed calls', () => {
    const framer = new TypedFramer();
    const payload = Buffer.from('partial header');
    const encoded = framer.encode(3, payload);

    // Feed 3 bytes of the 6-byte header.
    const f1 = framer.feed(encoded.subarray(0, 3));
    assert.equal(f1.length, 0);

    // Feed the rest of the header only.
    const f2 = framer.feed(encoded.subarray(3, 6));
    assert.equal(f2.length, 0);

    // Feed the payload.
    const f3 = framer.feed(encoded.subarray(6));
    assert.equal(f3.length, 1);
    assert.equal(f3[0].type, 3);
    assert.deepEqual(f3[0].payload, payload);
  });

  it('accumulates partial payload across multiple feed calls', () => {
    const framer = new TypedFramer();
    const payload = Buffer.alloc(100, 0xab);
    const encoded = framer.encode(5, payload);

    // Feed header + 50 bytes of payload.
    const f1 = framer.feed(encoded.subarray(0, 56));
    assert.equal(f1.length, 0);

    // Feed remaining 50 bytes.
    const f2 = framer.feed(encoded.subarray(56));
    assert.equal(f2.length, 1);
    assert.deepEqual(f2[0].payload, payload);
  });

  it('returns multiple frames when all arrive together', () => {
    const framer = new TypedFramer();
    const e1 = framer.encode(1, Buffer.from('one'));
    const e2 = framer.encode(2, Buffer.from('two'));
    const e3 = framer.encode(3, Buffer.from('three'));
    const frames = framer.feed(Buffer.concat([e1, e2, e3]));
    assert.equal(frames.length, 3);
    assert.equal(frames[0].type, 1);
    assert.equal(frames[1].type, 2);
    assert.equal(frames[2].type, 3);
    assert.deepEqual(frames[0].payload, Buffer.from('one'));
    assert.deepEqual(frames[1].payload, Buffer.from('two'));
    assert.deepEqual(frames[2].payload, Buffer.from('three'));
  });

  it('type and flags are masked to 8-bit range', () => {
    const framer = new TypedFramer();
    const encoded = framer.encode(0x1ff, Buffer.from('x'), 0x1aa);
    const frames = framer.feed(encoded);
    assert.equal(frames[0].type, 0xff);
    assert.equal(frames[0].flags, 0xaa);
  });

  it('reset clears partial state', () => {
    const framer = new TypedFramer();
    framer.feed(Buffer.alloc(3)); // partial header
    framer.reset();
    const frames = framer.feed(framer.encode(9, Buffer.from('clean')));
    assert.equal(frames.length, 1);
    assert.equal(frames[0].type, 9);
  });
});
