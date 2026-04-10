// @ts-check
// ─── Message Framing ──────────────────────────────────────────────────────────
// Framing protocols for byte streams: length-prefix, delimiter, fixed-size,
// and typed (WebSocket-inspired) framers.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A typed frame with optional flags (WebSocket-inspired). */
export interface Frame {
  type: number;
  flags: number;
  payload: Buffer;
}

// ─── LengthPrefixFramer ───────────────────────────────────────────────────────

/**
 * Length-prefix framing: each message is preceded by a 4-byte big-endian
 * unsigned integer indicating the payload length.
 *
 * Wire format: [ length (4 bytes BE) ][ payload (length bytes) ]
 */
export class LengthPrefixFramer {
  #buf: Buffer = Buffer.alloc(0);

  /**
   * Encode a payload into a framed buffer.
   * Prepends a 4-byte big-endian length prefix.
   */
  encode(payload: Buffer): Buffer {
    const frame = Buffer.allocUnsafe(4 + payload.length);
    frame.writeUInt32BE(payload.length, 0);
    payload.copy(frame, 4);
    return frame;
  }

  /**
   * Feed raw bytes into the framer.
   * Returns an array of complete payload buffers decoded from the stream.
   */
  feed(data: Buffer): Buffer[] {
    this.#buf = Buffer.concat([this.#buf, data]);
    const frames: Buffer[] = [];

    while (this.#buf.length >= 4) {
      const payloadLen = this.#buf.readUInt32BE(0);
      if (this.#buf.length < 4 + payloadLen) break;

      const payload = this.#buf.subarray(4, 4 + payloadLen);
      frames.push(Buffer.from(payload));
      this.#buf = this.#buf.subarray(4 + payloadLen);
    }

    return frames;
  }

  /** Reset internal buffer state. */
  reset(): void {
    this.#buf = Buffer.alloc(0);
  }
}

// ─── DelimiterFramer ─────────────────────────────────────────────────────────

/**
 * Delimiter-based framing, similar to newline-delimited JSON (NDJSON).
 * The delimiter itself is NOT included in the returned payload buffers.
 */
export class DelimiterFramer {
  #delimiter: Buffer;
  #buf: Buffer = Buffer.alloc(0);

  constructor(delimiter: Buffer | string = '\n') {
    this.#delimiter =
      typeof delimiter === 'string'
        ? Buffer.from(delimiter, 'utf8')
        : delimiter;
  }

  /**
   * Encode a payload by appending the delimiter.
   */
  encode(payload: Buffer | string): Buffer {
    const payBuf =
      typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    return Buffer.concat([payBuf, this.#delimiter]);
  }

  /**
   * Feed raw bytes into the framer.
   * Returns an array of complete payload buffers (delimiter stripped).
   */
  feed(data: Buffer): Buffer[] {
    this.#buf = Buffer.concat([this.#buf, data]);
    const frames: Buffer[] = [];
    const delimLen = this.#delimiter.length;

    let idx: number;
    while ((idx = indexOfBuffer(this.#buf, this.#delimiter)) !== -1) {
      frames.push(Buffer.from(this.#buf.subarray(0, idx)));
      this.#buf = this.#buf.subarray(idx + delimLen);
    }

    return frames;
  }

  /** Reset internal buffer state. */
  reset(): void {
    this.#buf = Buffer.alloc(0);
  }
}

// ─── FixedSizeFramer ──────────────────────────────────────────────────────────

/**
 * Fixed-size framing: every frame is exactly `frameSize` bytes.
 * Encoding pads with zeros if the payload is shorter, or splits if longer.
 * Decoding returns raw fixed-size chunks (including any padding).
 */
export class FixedSizeFramer {
  #frameSize: number;
  #buf: Buffer = Buffer.alloc(0);

  constructor(frameSize: number) {
    if (frameSize <= 0 || !Number.isInteger(frameSize)) {
      throw new RangeError('frameSize must be a positive integer');
    }
    this.#frameSize = frameSize;
  }

  /**
   * Encode a payload into one or more fixed-size frames.
   * The last frame is zero-padded if necessary.
   */
  encode(payload: Buffer): Buffer[] {
    if (payload.length === 0) {
      // Return a single zero-padded empty frame.
      return [Buffer.alloc(this.#frameSize)];
    }

    const frames: Buffer[] = [];
    let offset = 0;

    while (offset < payload.length) {
      const chunk = payload.subarray(offset, offset + this.#frameSize);
      if (chunk.length === this.#frameSize) {
        frames.push(Buffer.from(chunk));
      } else {
        // Last chunk — pad with zeros.
        const padded = Buffer.alloc(this.#frameSize);
        chunk.copy(padded);
        frames.push(padded);
      }
      offset += this.#frameSize;
    }

    return frames;
  }

  /**
   * Feed raw bytes into the framer.
   * Returns complete fixed-size frames.
   */
  feed(data: Buffer): Buffer[] {
    this.#buf = Buffer.concat([this.#buf, data]);
    const frames: Buffer[] = [];

    while (this.#buf.length >= this.#frameSize) {
      frames.push(Buffer.from(this.#buf.subarray(0, this.#frameSize)));
      this.#buf = this.#buf.subarray(this.#frameSize);
    }

    return frames;
  }

  /** Reset internal buffer state. */
  reset(): void {
    this.#buf = Buffer.alloc(0);
  }
}

// ─── TypedFramer ─────────────────────────────────────────────────────────────

/**
 * WebSocket-inspired typed framer.
 *
 * Wire format: [ flags (1 byte) ][ type (1 byte) ][ length (4 bytes BE) ][ payload ]
 *
 * Header is always 6 bytes total.
 */
export class TypedFramer {
  #buf: Buffer = Buffer.alloc(0);

  static readonly HEADER_SIZE = 6;

  /**
   * Encode a typed frame.
   * @param type  - message type byte (0–255)
   * @param payload - payload bytes
   * @param flags - optional flags byte (default 0)
   */
  encode(type: number, payload: Buffer, flags: number = 0): Buffer {
    const frame = Buffer.allocUnsafe(TypedFramer.HEADER_SIZE + payload.length);
    frame.writeUInt8(flags & 0xff, 0);
    frame.writeUInt8(type & 0xff, 1);
    frame.writeUInt32BE(payload.length, 2);
    payload.copy(frame, TypedFramer.HEADER_SIZE);
    return frame;
  }

  /**
   * Feed raw bytes into the framer.
   * Returns complete typed frames.
   */
  feed(data: Buffer): Frame[] {
    this.#buf = Buffer.concat([this.#buf, data]);
    const frames: Frame[] = [];

    while (this.#buf.length >= TypedFramer.HEADER_SIZE) {
      const payloadLen = this.#buf.readUInt32BE(2);
      if (this.#buf.length < TypedFramer.HEADER_SIZE + payloadLen) break;

      const flags = this.#buf.readUInt8(0);
      const type = this.#buf.readUInt8(1);
      const payload = Buffer.from(
        this.#buf.subarray(TypedFramer.HEADER_SIZE, TypedFramer.HEADER_SIZE + payloadLen),
      );
      frames.push({ flags, type, payload });
      this.#buf = this.#buf.subarray(TypedFramer.HEADER_SIZE + payloadLen);
    }

    return frames;
  }

  /** Reset internal buffer state. */
  reset(): void {
    this.#buf = Buffer.alloc(0);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Find the first occurrence of `needle` in `haystack`.
 * Returns -1 if not found.
 */
function indexOfBuffer(haystack: Buffer, needle: Buffer): number {
  if (needle.length === 0) return 0;
  if (needle.length > haystack.length) return -1;

  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
