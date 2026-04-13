// ─── Unit Tests: UUID ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  uuidV4,
  uuidV5,
  uuidV3,
  isValidUUID,
  parseUUID,
  UUID_NAMESPACE_DNS,
  UUID_NAMESPACE_URL,
  UUID_NAMESPACE_OID,
} from '../../app/modules/uuid.js';

// ─── Namespace constants ──────────────────────────────────────────────────────

describe('UUID – namespace constants', () => {
  it('UUID_NAMESPACE_DNS is a valid UUID', () => {
    assert.ok(isValidUUID(UUID_NAMESPACE_DNS));
  });

  it('UUID_NAMESPACE_URL is a valid UUID', () => {
    assert.ok(isValidUUID(UUID_NAMESPACE_URL));
  });

  it('UUID_NAMESPACE_OID is a valid UUID', () => {
    assert.ok(isValidUUID(UUID_NAMESPACE_OID));
  });

  it('namespace constants are distinct', () => {
    assert.notEqual(UUID_NAMESPACE_DNS, UUID_NAMESPACE_URL);
    assert.notEqual(UUID_NAMESPACE_DNS, UUID_NAMESPACE_OID);
    assert.notEqual(UUID_NAMESPACE_URL, UUID_NAMESPACE_OID);
  });
});

// ─── uuidV4 ───────────────────────────────────────────────────────────────────

describe('uuidV4', () => {
  it('returns a valid UUID string', () => {
    assert.ok(isValidUUID(uuidV4()));
  });

  it('has version 4 in the correct nibble', () => {
    const id = uuidV4();
    assert.equal(id[14], '4');
  });

  it('has RFC 4122 variant bits (8, 9, a, or b) in octet 8', () => {
    const id = uuidV4();
    const variantChar = id[19].toLowerCase();
    assert.ok(['8', '9', 'a', 'b'].includes(variantChar), `unexpected variant char: ${variantChar}`);
  });

  it('generates unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidV4()));
    assert.equal(ids.size, 1000);
  });

  it('matches canonical UUID format', () => {
    const id = uuidV4();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

// ─── uuidV5 ───────────────────────────────────────────────────────────────────

describe('uuidV5', () => {
  it('returns a valid UUID string', () => {
    assert.ok(isValidUUID(uuidV5(UUID_NAMESPACE_DNS, 'example.com')));
  });

  it('is deterministic for the same namespace + name', () => {
    const a = uuidV5(UUID_NAMESPACE_DNS, 'hello');
    const b = uuidV5(UUID_NAMESPACE_DNS, 'hello');
    assert.equal(a, b);
  });

  it('matches RFC 4122 reference: example.com in DNS namespace', () => {
    // RFC 4122 §Appendix B well-known value
    assert.equal(
      uuidV5(UUID_NAMESPACE_DNS, 'example.com'),
      'cfbff0d1-9375-5685-968c-48ce8b15ae17',
    );
  });

  it('has version nibble 5', () => {
    const id = uuidV5(UUID_NAMESPACE_URL, 'foo');
    assert.equal(id[14], '5');
  });

  it('differs for different names in the same namespace', () => {
    const a = uuidV5(UUID_NAMESPACE_DNS, 'alpha');
    const b = uuidV5(UUID_NAMESPACE_DNS, 'beta');
    assert.notEqual(a, b);
  });

  it('differs for same name in different namespaces', () => {
    const a = uuidV5(UUID_NAMESPACE_DNS, 'test');
    const b = uuidV5(UUID_NAMESPACE_URL, 'test');
    assert.notEqual(a, b);
  });

  it('throws on invalid namespace UUID', () => {
    assert.throws(() => uuidV5('not-a-uuid', 'name'), TypeError);
  });
});

// ─── uuidV3 ───────────────────────────────────────────────────────────────────

describe('uuidV3', () => {
  it('returns a valid UUID string', () => {
    assert.ok(isValidUUID(uuidV3(UUID_NAMESPACE_DNS, 'example.com')));
  });

  it('is deterministic for the same namespace + name', () => {
    const a = uuidV3(UUID_NAMESPACE_DNS, 'hello');
    const b = uuidV3(UUID_NAMESPACE_DNS, 'hello');
    assert.equal(a, b);
  });

  it('matches RFC 4122 reference: example.com in DNS namespace', () => {
    assert.equal(
      uuidV3(UUID_NAMESPACE_DNS, 'example.com'),
      '9073926b-929f-31c2-abc9-fad77ae3e8eb',
    );
  });

  it('has version nibble 3', () => {
    const id = uuidV3(UUID_NAMESPACE_URL, 'foo');
    assert.equal(id[14], '3');
  });

  it('differs from uuidV5 for the same inputs', () => {
    assert.notEqual(
      uuidV3(UUID_NAMESPACE_DNS, 'example.com'),
      uuidV5(UUID_NAMESPACE_DNS, 'example.com'),
    );
  });

  it('throws on invalid namespace UUID', () => {
    assert.throws(() => uuidV3('bad-ns', 'name'), TypeError);
  });
});

// ─── isValidUUID ──────────────────────────────────────────────────────────────

describe('isValidUUID', () => {
  it('accepts all-zero UUID', () => {
    assert.ok(isValidUUID('00000000-0000-0000-0000-000000000000'));
  });

  it('rejects empty string', () => {
    assert.equal(isValidUUID(''), false);
  });

  it('rejects UUID without hyphens', () => {
    assert.equal(isValidUUID('6ba7b8109dad11d180b400c04fd430c8'), false);
  });

  it('rejects UUID with wrong length', () => {
    assert.equal(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c'), false);
  });

  it('rejects UUID with invalid characters', () => {
    assert.equal(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430zz'), false);
  });

  it('accepts uppercase UUID', () => {
    assert.ok(isValidUUID('6BA7B810-9DAD-11D1-80B4-00C04FD430C8'));
  });
});

// ─── parseUUID ────────────────────────────────────────────────────────────────

describe('parseUUID', () => {
  it('returns null for an invalid UUID', () => {
    assert.equal(parseUUID('not-valid'), null);
  });

  it('parses version from a v4 UUID', () => {
    const parsed = parseUUID(uuidV4());
    assert.ok(parsed !== null);
    assert.equal(parsed.version, 4);
  });

  it('parses version from a v5 UUID', () => {
    const id = uuidV5(UUID_NAMESPACE_DNS, 'example.com');
    const parsed = parseUUID(id);
    assert.ok(parsed !== null);
    assert.equal(parsed.version, 5);
  });

  it('parses version from a v3 UUID', () => {
    const id = uuidV3(UUID_NAMESPACE_DNS, 'example.com');
    const parsed = parseUUID(id);
    assert.ok(parsed !== null);
    assert.equal(parsed.version, 3);
  });

  it('returns RFC 4122 variant (1) for standard UUIDs', () => {
    const parsed = parseUUID(uuidV4());
    assert.ok(parsed !== null);
    assert.equal(parsed.variant, 1);
  });

  it('returns a Uint8Array of exactly 16 bytes', () => {
    const parsed = parseUUID(UUID_NAMESPACE_DNS);
    assert.ok(parsed !== null);
    assert.ok(parsed.bytes instanceof Uint8Array);
    assert.equal(parsed.bytes.length, 16);
  });

  it('round-trips: bytes match original hex', () => {
    const id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const parsed = parseUUID(id);
    assert.ok(parsed !== null);
    const rebuilt = Array.from(parsed.bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    assert.equal(rebuilt, id.replace(/-/g, ''));
  });
});
