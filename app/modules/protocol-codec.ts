// @ts-check
// ─── Protocol Codec ───────────────────────────────────────────────────────────
// A simple binary protocol codec for encoding/decoding structured messages.
//
// Wire format per message:
//   [ message id (2 bytes BE) ][ field data … ]
//
// Field wire formats:
//   uint8   : 1 byte
//   uint16  : 2 bytes BE
//   uint32  : 4 bytes BE
//   int8    : 1 byte (signed)
//   int16   : 2 bytes BE (signed)
//   int32   : 4 bytes BE (signed)
//   float32 : 4 bytes (IEEE 754)
//   float64 : 8 bytes (IEEE 754)
//   bool    : 1 byte (0 = false, nonzero = true)
//   string  : 2-byte BE length prefix + UTF-8 bytes (max `length` bytes)
//   bytes   : 2-byte BE length prefix + raw bytes   (max `length` bytes)

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'float32'
  | 'float64'
  | 'string'
  | 'bytes'
  | 'bool';

export interface FieldDef {
  name: string;
  type: FieldType;
  /** For string/bytes: maximum content length in bytes. */
  length?: number;
}

export interface MessageDef {
  id: number;
  name: string;
  fields: FieldDef[];
}

// ─── ProtocolCodec ────────────────────────────────────────────────────────────

export class ProtocolCodec {
  #byName: Map<string, MessageDef> = new Map();
  #byId: Map<number, MessageDef> = new Map();

  constructor(messages: MessageDef[]) {
    for (const msg of messages) {
      if (this.#byName.has(msg.name)) {
        throw new Error(`Duplicate message name: ${msg.name}`);
      }
      if (this.#byId.has(msg.id)) {
        throw new Error(`Duplicate message id: ${msg.id}`);
      }
      this.#byName.set(msg.name, msg);
      this.#byId.set(msg.id, msg);
    }
  }

  /**
   * Encode a message by name, returning a Buffer ready for transmission.
   * Throws if the message name is unknown.
   */
  encode(messageName: string, data: Record<string, unknown>): Buffer {
    const def = this.#byName.get(messageName);
    if (!def) throw new Error(`Unknown message: ${messageName}`);

    // Calculate required byte length.
    let size = 2; // message id (uint16 BE)
    for (const field of def.fields) {
      size += fieldSize(field, data[field.name]);
    }

    const buf = Buffer.allocUnsafe(size);
    let offset = 0;

    buf.writeUInt16BE(def.id, offset);
    offset += 2;

    for (const field of def.fields) {
      offset = writeField(buf, offset, field, data[field.name]);
    }

    return buf;
  }

  /**
   * Decode a buffer into `{ messageName, data }`.
   * Throws if the message id is unknown or the buffer is malformed.
   */
  decode(buffer: Buffer): { messageName: string; data: Record<string, unknown> } {
    if (buffer.length < 2) {
      throw new Error('Buffer too short: missing message id');
    }

    const id = buffer.readUInt16BE(0);
    const def = this.#byId.get(id);
    if (!def) throw new Error(`Unknown message id: ${id}`);

    let offset = 2;
    const data: Record<string, unknown> = {};

    for (const field of def.fields) {
      const result = readField(buffer, offset, field);
      data[field.name] = result.value;
      offset = result.offset;
    }

    return { messageName: def.name, data };
  }
}

// ─── Fixed field sizes ────────────────────────────────────────────────────────

const FIXED_SIZES: Partial<Record<FieldType, number>> = {
  uint8: 1,
  uint16: 2,
  uint32: 4,
  int8: 1,
  int16: 2,
  int32: 4,
  float32: 4,
  float64: 8,
  bool: 1,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fieldSize(field: FieldDef, value: unknown): number {
  const fixed = FIXED_SIZES[field.type];
  if (fixed !== undefined) return fixed;

  // string / bytes — 2-byte length prefix + content
  if (field.type === 'string') {
    const str = String(value ?? '');
    const byteLen = Buffer.byteLength(str, 'utf8');
    return 2 + byteLen;
  }

  if (field.type === 'bytes') {
    const buf = value instanceof Buffer ? value : Buffer.alloc(0);
    return 2 + buf.length;
  }

  throw new Error(`Unknown field type: ${field.type}`);
}

function writeField(
  buf: Buffer,
  offset: number,
  field: FieldDef,
  value: unknown,
): number {
  switch (field.type) {
    case 'uint8':
      buf.writeUInt8((value as number) >>> 0, offset);
      return offset + 1;
    case 'uint16':
      buf.writeUInt16BE((value as number) >>> 0, offset);
      return offset + 2;
    case 'uint32':
      buf.writeUInt32BE((value as number) >>> 0, offset);
      return offset + 4;
    case 'int8':
      buf.writeInt8(Math.trunc(value as number), offset);
      return offset + 1;
    case 'int16':
      buf.writeInt16BE(Math.trunc(value as number), offset);
      return offset + 2;
    case 'int32':
      buf.writeInt32BE(Math.trunc(value as number), offset);
      return offset + 4;
    case 'float32':
      buf.writeFloatBE(value as number, offset);
      return offset + 4;
    case 'float64':
      buf.writeDoubleBE(value as number, offset);
      return offset + 8;
    case 'bool':
      buf.writeUInt8((value as boolean) ? 1 : 0, offset);
      return offset + 1;
    case 'string': {
      const str = String(value ?? '');
      const encoded = Buffer.from(str, 'utf8');
      const len = field.length !== undefined
        ? Math.min(encoded.length, field.length)
        : encoded.length;
      buf.writeUInt16BE(len, offset);
      encoded.copy(buf, offset + 2, 0, len);
      return offset + 2 + len;
    }
    case 'bytes': {
      const src = value instanceof Buffer ? value : Buffer.alloc(0);
      const len = field.length !== undefined
        ? Math.min(src.length, field.length)
        : src.length;
      buf.writeUInt16BE(len, offset);
      src.copy(buf, offset + 2, 0, len);
      return offset + 2 + len;
    }
    default:
      throw new Error(`Unknown field type: ${field.type}`);
  }
}

function readField(
  buf: Buffer,
  offset: number,
  field: FieldDef,
): { value: unknown; offset: number } {
  switch (field.type) {
    case 'uint8':
      return { value: buf.readUInt8(offset), offset: offset + 1 };
    case 'uint16':
      return { value: buf.readUInt16BE(offset), offset: offset + 2 };
    case 'uint32':
      return { value: buf.readUInt32BE(offset), offset: offset + 4 };
    case 'int8':
      return { value: buf.readInt8(offset), offset: offset + 1 };
    case 'int16':
      return { value: buf.readInt16BE(offset), offset: offset + 2 };
    case 'int32':
      return { value: buf.readInt32BE(offset), offset: offset + 4 };
    case 'float32':
      return { value: buf.readFloatBE(offset), offset: offset + 4 };
    case 'float64':
      return { value: buf.readDoubleBE(offset), offset: offset + 8 };
    case 'bool':
      return { value: buf.readUInt8(offset) !== 0, offset: offset + 1 };
    case 'string': {
      const len = buf.readUInt16BE(offset);
      const str = buf.toString('utf8', offset + 2, offset + 2 + len);
      return { value: str, offset: offset + 2 + len };
    }
    case 'bytes': {
      const len = buf.readUInt16BE(offset);
      const bytes = Buffer.from(buf.subarray(offset + 2, offset + 2 + len));
      return { value: bytes, offset: offset + 2 + len };
    }
    default:
      throw new Error(`Unknown field type: ${field.type}`);
  }
}
