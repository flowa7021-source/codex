// ─── Unit Tests: Protocol Codec ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProtocolCodec } from '../../app/modules/protocol-codec.js';

// ─── Basic encode / decode ────────────────────────────────────────────────────

describe('ProtocolCodec – construction', () => {
  it('creates a codec with message definitions', () => {
    const codec = new ProtocolCodec([
      { id: 1, name: 'Ping', fields: [] },
    ]);
    assert.ok(codec);
  });

  it('throws on duplicate message name', () => {
    assert.throws(() => new ProtocolCodec([
      { id: 1, name: 'Msg', fields: [] },
      { id: 2, name: 'Msg', fields: [] },
    ]), /Duplicate/i);
  });

  it('throws on duplicate message id', () => {
    assert.throws(() => new ProtocolCodec([
      { id: 1, name: 'A', fields: [] },
      { id: 1, name: 'B', fields: [] },
    ]), /Duplicate/i);
  });
});

describe('ProtocolCodec – integer fields', () => {
  const codec = new ProtocolCodec([{
    id: 2, name: 'Numbers', fields: [
      { name: 'u8', type: 'uint8' },
      { name: 'u16', type: 'uint16' },
      { name: 'u32', type: 'uint32' },
      { name: 'i8', type: 'int8' },
      { name: 'i16', type: 'int16' },
      { name: 'i32', type: 'int32' },
    ],
  }]);

  it('encodes and decodes uint8/uint16/uint32', () => {
    const buf = codec.encode('Numbers', { u8: 255, u16: 1000, u32: 100000, i8: -1, i16: -1000, i32: -50000 });
    const msg = codec.decode(buf);
    assert.equal(msg.messageName, 'Numbers');
    assert.equal(msg.data['u8'], 255);
    assert.equal(msg.data['u16'], 1000);
    assert.equal(msg.data['u32'], 100000);
    assert.equal(msg.data['i8'], -1);
    assert.equal(msg.data['i16'], -1000);
    assert.equal(msg.data['i32'], -50000);
  });
});

describe('ProtocolCodec – float fields', () => {
  const codec = new ProtocolCodec([{
    id: 3, name: 'Floats', fields: [
      { name: 'f32', type: 'float32' },
      { name: 'f64', type: 'float64' },
    ],
  }]);

  it('encodes and decodes float32 approximately', () => {
    const buf = codec.encode('Floats', { f32: 3.14, f64: Math.PI });
    const msg = codec.decode(buf);
    assert.ok(Math.abs(msg.data['f32'] - 3.14) < 0.001);
    assert.ok(Math.abs(msg.data['f64'] - Math.PI) < 1e-10);
  });
});

describe('ProtocolCodec – bool field', () => {
  const codec = new ProtocolCodec([{
    id: 4, name: 'Bool', fields: [
      { name: 'flag', type: 'bool' },
    ],
  }]);

  it('encodes and decodes true', () => {
    const buf = codec.encode('Bool', { flag: true });
    assert.equal(codec.decode(buf).data['flag'], true);
  });

  it('encodes and decodes false', () => {
    const buf = codec.encode('Bool', { flag: false });
    assert.equal(codec.decode(buf).data['flag'], false);
  });
});

describe('ProtocolCodec – string field', () => {
  const codec = new ProtocolCodec([{
    id: 5, name: 'Msg', fields: [
      { name: 'text', type: 'string', length: 100 },
    ],
  }]);

  it('encodes and decodes a string', () => {
    const buf = codec.encode('Msg', { text: 'hello world' });
    const msg = codec.decode(buf);
    assert.equal(msg.data['text'], 'hello world');
  });

  it('truncates at max length', () => {
    const long = 'a'.repeat(200);
    const buf = codec.encode('Msg', { text: long });
    const msg = codec.decode(buf);
    assert.equal(msg.data['text'].length, 100);
  });
});

describe('ProtocolCodec – empty message', () => {
  const codec = new ProtocolCodec([{ id: 10, name: 'Empty', fields: [] }]);

  it('round-trips an empty message', () => {
    const buf = codec.encode('Empty', {});
    const msg = codec.decode(buf);
    assert.equal(msg.messageName, 'Empty');
    assert.deepEqual(msg.data, {});
  });
});

describe('ProtocolCodec – error cases', () => {
  const codec = new ProtocolCodec([{ id: 1, name: 'A', fields: [] }]);

  it('throws when encoding unknown message name', () => {
    assert.throws(() => codec.encode('Unknown', {}), /Unknown/i);
  });
});
