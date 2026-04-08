// ─── Unit Tests: Digital Signature TSA / OCSP ───────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Minimal crypto.subtle mock for Node.js (SHA-1, SHA-256)
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = /** @type {any} */ (webcrypto);
}

// reflect-metadata is needed by @peculiar/x509 (loaded by the module under test)
// The import inside digital-signature-tsa.js handles this.

const {
  buildTsaRequest,
  requestTimestamp,
  extractAiaUrls,
  extractAiaUrlsFull,
  PUBLIC_TSA_URLS,
} = await import('../../app/modules/digital-signature-tsa.js');

// ─── buildTsaRequest ────────────────────────────────────────────────────────

describe('buildTsaRequest', () => {
  it('produces a valid DER-encoded TimeStampReq for SHA-256 hash', () => {
    const hash = new Uint8Array(32).fill(0xAB);
    const req = buildTsaRequest(hash);

    assert.ok(req instanceof Uint8Array);
    // Outer SEQUENCE tag
    assert.equal(req[0], 0x30);
    // Version INTEGER 1 bytes: 02 01 01
    assert.equal(req[2], 0x02);
    assert.equal(req[3], 0x01);
    assert.equal(req[4], 0x01);
    // certReq BOOLEAN TRUE: 01 01 FF at the end
    assert.equal(req[req.length - 3], 0x01);
    assert.equal(req[req.length - 2], 0x01);
    assert.equal(req[req.length - 1], 0xFF);
  });

  it('embeds the hash bytes in the request', () => {
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) hash[i] = i;
    const req = buildTsaRequest(hash);

    // Find the OCTET STRING (0x04 0x20) prefix that holds the hash
    let found = false;
    for (let i = 0; i < req.length - 33; i++) {
      if (req[i] === 0x04 && req[i + 1] === 0x20) {
        const slice = req.slice(i + 2, i + 34);
        assert.deepEqual(Array.from(slice), Array.from(hash));
        found = true;
        break;
      }
    }
    assert.ok(found, 'hash not found in TSA request');
  });

  it('throws if hash is not 32 bytes', () => {
    assert.throws(() => buildTsaRequest(new Uint8Array(20)), /32 bytes/);
  });
});

// ─── requestTimestamp ───────────────────────────────────────────────────────

describe('requestTimestamp', () => {
  let fetchMock;

  // Minimal valid TimeStampResp DER:
  // SEQUENCE { PKIStatusInfo SEQUENCE { INTEGER 0 } ContentInfo SEQUENCE }
  // RFC 3161: PKIStatus ::= INTEGER (tag 0x02), not ENUMERATED
  function _makeResp(includeToken, statusCode = 0) {
    // PKIStatusInfo: 30 03 02 01 <status>
    const statusInfo = new Uint8Array([0x30, 0x03, 0x02, 0x01, statusCode]);
    // Minimal ContentInfo (just outer SEQUENCE with one byte)
    const token = includeToken
      ? new Uint8Array([0x30, 0x03, 0x06, 0x01, 0x00])  // dummy ContentInfo
      : new Uint8Array([]);
    const inner = new Uint8Array([...statusInfo, ...token]);
    return new Uint8Array([0x30, inner.length, ...inner]);
  }

  beforeEach(() => {
    fetchMock = mock.fn(async () => ({
      ok: true,
      arrayBuffer: async () => _makeResp(true).buffer,
    }));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => { delete globalThis.fetch; });

  it('sends POST to tsaUrl with correct content-type', async () => {
    const hash = new Uint8Array(32).fill(1);
    await requestTimestamp(hash, 'http://test.tsa.example.com').catch(() => {});
    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'http://test.tsa.example.com');
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers['content-type'], 'application/timestamp-query');
  });

  it('returns token bytes on granted response', async () => {
    const hash = new Uint8Array(32).fill(2);
    const token = await requestTimestamp(hash, 'http://test.tsa.example.com');
    assert.ok(token instanceof Uint8Array);
    assert.ok(token.length > 0);
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }));
    const hash = new Uint8Array(32);
    await assert.rejects(() => requestTimestamp(hash, 'http://test.tsa.example.com'), /503/);
  });

  it('throws when response status is not granted (non-zero)', async () => {
    // PKIStatusInfo with status = 2 (internalError); RFC 3161 uses INTEGER (0x02 tag)
    const statusInfo = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x02]);
    const resp = new Uint8Array([0x30, statusInfo.length, ...statusInfo]);
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      arrayBuffer: async () => resp.buffer,
    }));
    const hash = new Uint8Array(32);
    await assert.rejects(
      () => requestTimestamp(hash, 'http://test.tsa.example.com'),
      /non-granted/,
    );
  });
});

// ─── PUBLIC_TSA_URLS ─────────────────────────────────────────────────────────

describe('PUBLIC_TSA_URLS', () => {
  it('is a non-empty array of URL strings', () => {
    assert.ok(Array.isArray(PUBLIC_TSA_URLS));
    assert.ok(PUBLIC_TSA_URLS.length > 0);
    for (const url of PUBLIC_TSA_URLS) {
      assert.ok(typeof url === 'string');
      assert.ok(url.startsWith('http'), `Expected HTTP URL: ${url}`);
    }
  });
});
