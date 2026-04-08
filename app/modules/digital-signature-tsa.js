// @ts-check
// ─── Digital Signature TSA / OCSP ───────────────────────────────────────────
// RFC 3161 Timestamp Authority (TSA) requests and OCSP revocation checking
// for PDF digital signatures.  Uses @peculiar/x509 for certificate parsing
// and @peculiar/asn1-{schema,x509} for ASN.1 encoding/decoding.
//
// Public API:
//   buildTsaRequest(hash)              — build RFC 3161 TimeStampReq DER
//   requestTimestamp(hash, tsaUrl)     — POST to TSA, returns token DER
//   checkOcsp(certDer, issuerDer)      — OCSP revocation check
//   extractAiaUrls(certDer)            — get OCSP + caIssuers URLs from AIA
//   verifyCertChain(certDers)          — chain building via X509ChainBuilder

// @peculiar/x509 relies on tsyringe DI which requires reflect-metadata.
import 'reflect-metadata';
import { X509Certificate, X509ChainBuilder, AuthorityInfoAccessExtension } from '@peculiar/x509';
import { AsnConvert, AsnParser } from '@peculiar/asn1-schema';
import { Certificate } from '@peculiar/asn1-x509';

// OID strings (from RFC 5280 / PKIX)
const _OID_OCSP         = '1.3.6.1.5.5.7.48.1';
const _OID_CA_ISSUERS   = '1.3.6.1.5.5.7.48.2';
const _OID_TIMESTAMPING = '1.3.6.1.5.5.7.48.3';

// ─── DER encoding helpers ────────────────────────────────────────────────────

/** Concatenate Uint8Array instances. */
function _cat(...arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/** DER length encoding (BER short/long form). */
function _derLen(n) {
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x100) return new Uint8Array([0x81, n]);
  return new Uint8Array([0x82, (n >> 8) & 0xFF, n & 0xFF]);
}

/** Wrap bytes with a DER tag-length prefix. */
function _tlv(tag, value) {
  return _cat(new Uint8Array([tag]), _derLen(value.length), value);
}

/** Parse a DER length field starting at `off`, returning { len, lenBytes }. */
function _parseDerLen(bytes, off) {
  const b = bytes[off];
  if (b < 0x80) return { len: b, lenBytes: 1 };
  const n = b & 0x7F;
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | bytes[off + 1 + i];
  return { len, lenBytes: 1 + n };
}

// AlgorithmIdentifier for SHA-1 (OID 1.3.14.3.2.26) + NULL
const _SHA1_ALG_ID = _tlv(0x30, _cat(
  new Uint8Array([0x06, 0x05, 0x2B, 0x0E, 0x03, 0x02, 0x1A]),
  new Uint8Array([0x05, 0x00]),
));

// AlgorithmIdentifier for SHA-256 (OID 2.16.840.1.101.3.4.2.1) + NULL
const _SHA256_ALG_ID = _tlv(0x30, _cat(
  new Uint8Array([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]),
  new Uint8Array([0x05, 0x00]),
));

// ─── TSA (RFC 3161) ──────────────────────────────────────────────────────────

/**
 * Build a RFC 3161 TimeStampReq DER byte array.
 * Algorithm is always SHA-256; certReq is always true (include TSA certificate).
 *
 * @param {Uint8Array} hash - 32-byte SHA-256 hash of the content to timestamp
 * @returns {Uint8Array}
 */
export function buildTsaRequest(hash) {
  if (hash.length !== 32) throw new TypeError('[tsa] hash must be 32 bytes (SHA-256)');
  const messageImprint = _tlv(0x30, _cat(
    _SHA256_ALG_ID,
    _tlv(0x04, hash),   // hashedMessage OCTET STRING
  ));
  const version  = new Uint8Array([0x02, 0x01, 0x01]);  // INTEGER 1
  const certReq  = new Uint8Array([0x01, 0x01, 0xFF]);  // BOOLEAN TRUE
  return _tlv(0x30, _cat(version, messageImprint, certReq));
}

/**
 * Extract the TimeStampToken (ContentInfo) from a raw TimeStampResp DER.
 * Returns null if the response status is not 0 (granted).
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array|null}
 */
function _extractTsaToken(bytes) {
  if (bytes[0] !== 0x30) return null;

  // Skip outer SEQUENCE header
  let off = 1;
  const outer = _parseDerLen(bytes, off);
  off += outer.lenBytes;

  // PKIStatusInfo SEQUENCE
  if (bytes[off] !== 0x30) return null;
  const statusInfo = _parseDerLen(bytes, off + 1);

  // First INTEGER inside PKIStatusInfo is the status value
  const statusBodyOff = off + 1 + statusInfo.lenBytes;
  if (bytes[statusBodyOff] !== 0x02) return null; // not INTEGER
  const statusLen = bytes[statusBodyOff + 1];
  let statusVal = 0;
  for (let i = 0; i < statusLen; i++) {
    statusVal = (statusVal << 8) | bytes[statusBodyOff + 2 + i];
  }
  if (statusVal !== 0) return null; // not 'granted'

  // Skip past PKIStatusInfo
  off += 1 + statusInfo.lenBytes + statusInfo.len;

  if (off >= bytes.length) return null; // no token
  return bytes.slice(off); // ContentInfo (TimeStampToken)
}

/**
 * POST a RFC 3161 timestamp request to a TSA and return the TimeStampToken.
 * Returns null if the TSA response indicates failure (not 'granted').
 *
 * @param {Uint8Array} contentHash - 32-byte SHA-256 hash of the content to timestamp
 * @param {string} tsaUrl - e.g. 'http://timestamp.digicert.com'
 * @returns {Promise<Uint8Array|null>}
 */
export async function requestTimestamp(contentHash, tsaUrl) {
  const reqDer = buildTsaRequest(contentHash);

  const resp = await fetch(tsaUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/timestamp-query',
      'accept': 'application/timestamp-reply',
    },
    body: reqDer,
  });

  if (!resp.ok) {
    throw new Error(`[tsa] HTTP ${resp.status}: ${resp.statusText}`);
  }

  const bytes = new Uint8Array(await resp.arrayBuffer());
  const token = _extractTsaToken(bytes);
  if (!token) throw new Error('[tsa] TSA returned non-granted status or empty token');
  return token;
}

// ─── AIA (Authority Information Access) ─────────────────────────────────────

/**
 * Extract OCSP and caIssuers URLs from a certificate's AuthorityInfoAccess extension.
 *
 * @param {Uint8Array|ArrayBuffer} certDer
 * @returns {{ ocsp: string[], caIssuers: string[] }}
 */
export function extractAiaUrls(certDer) {
  const cert = new X509Certificate(certDer);
  const aia = cert.getExtension(AuthorityInfoAccessExtension);
  const result = { ocsp: /** @type {string[]} */ ([]), caIssuers: /** @type {string[]} */ ([]) };
  if (!aia) return result;

  for (const ad of aia.value) {
    const url = ad.accessLocation.uniformResourceIdentifier;
    if (!url) continue;
    if (ad.accessMethod === _OID_OCSP) {
      result.ocsp.push(url);
    } else if (ad.accessMethod === _OID_TIMESTAMPING) {
      result.caIssuers.push(url);
    }
  }
  return result;
}

/**
 * Extract all AIA URLs including caIssuers (not timeStamping).
 * Returns OCSP responder URLs and CA certificate URLs separately.
 *
 * @param {Uint8Array|ArrayBuffer} certDer
 * @returns {{ ocsp: string[], caIssuers: string[] }}
 */
export function extractAiaUrlsFull(certDer) {
  const cert = new X509Certificate(certDer);
  const aia = cert.getExtension(AuthorityInfoAccessExtension);
  const result = { ocsp: /** @type {string[]} */ ([]), caIssuers: /** @type {string[]} */ ([]) };
  if (!aia) return result;

  for (const ad of aia.value) {
    const url = ad.accessLocation.uniformResourceIdentifier;
    if (!url) continue;
    if (ad.accessMethod === _OID_OCSP) {
      result.ocsp.push(url);
    } else if (ad.accessMethod === _OID_CA_ISSUERS) {
      result.caIssuers.push(url);
    }
  }
  return result;
}

// ─── OCSP (RFC 2560) ─────────────────────────────────────────────────────────

/**
 * Build an OCSPRequest DER for the given certificate and its issuer.
 * Uses SHA-1 for CertID hash fields (required by RFC 2560).
 *
 * @param {Uint8Array} certDer    - Target certificate
 * @param {Uint8Array} issuerDer  - Issuer certificate
 * @returns {Promise<Uint8Array>}
 */
export async function buildOcspRequest(certDer, issuerDer) {
  // Parse issuer cert via asn1-x509 to get raw subject and SPKI DER
  const issuerAsn = AsnParser.parse(
    issuerDer instanceof Uint8Array ? issuerDer.buffer : issuerDer,
    Certificate,
  );
  const subjectDer = new Uint8Array(AsnConvert.serialize(issuerAsn.tbsCertificate.subject));
  const issuerNameHash = new Uint8Array(await crypto.subtle.digest('SHA-1', subjectDer));

  // For issuerKeyHash: hash only the BIT STRING value (the public key octets)
  const spkiAsn = issuerAsn.tbsCertificate.subjectPublicKeyInfo;
  const pubKeyBits = new Uint8Array(spkiAsn.subjectPublicKey);
  const issuerKeyHash = new Uint8Array(await crypto.subtle.digest('SHA-1', pubKeyBits));

  // Serial number from target cert (big-endian integer bytes)
  const targetAsn = AsnParser.parse(
    certDer instanceof Uint8Array ? certDer.buffer : certDer,
    Certificate,
  );
  const serialBytes = new Uint8Array(targetAsn.tbsCertificate.serialNumber);

  // CertID ::= SEQUENCE { hashAlgorithm, issuerNameHash, issuerKeyHash, serialNumber }
  const certId = _tlv(0x30, _cat(
    _SHA1_ALG_ID,
    _tlv(0x04, issuerNameHash),
    _tlv(0x04, issuerKeyHash),
    _tlv(0x02, serialBytes),   // INTEGER
  ));

  // Request ::= SEQUENCE { reqCert CertID }
  const request = _tlv(0x30, certId);

  // OCSPRequest ::= SEQUENCE { tbsRequest }
  // TBSRequest ::= SEQUENCE { requestList SEQUENCE OF Request }
  const requestList = _tlv(0x30, request);
  const tbsRequest = _tlv(0x30, requestList);
  return _tlv(0x30, tbsRequest);
}

/**
 * @typedef {object} OcspStatus
 * @property {'good'|'revoked'|'unknown'|'error'} status
 * @property {Date|null} revokedAt    - set when status === 'revoked'
 * @property {string|null} reason     - CRL reason string when revoked
 * @property {string|null} message    - diagnostic message
 */

/**
 * Check certificate revocation status via OCSP.
 *
 * @param {Uint8Array} certDer    - Target certificate DER
 * @param {Uint8Array} issuerDer  - Issuer certificate DER
 * @param {string} [ocspUrl]      - OCSP responder URL (auto-detected from AIA if omitted)
 * @returns {Promise<OcspStatus>}
 */
export async function checkOcsp(certDer, issuerDer, ocspUrl) {
  try {
    // Resolve OCSP URL from AIA extension if not provided
    if (!ocspUrl) {
      const aia = extractAiaUrlsFull(certDer);
      ocspUrl = aia.ocsp[0];
    }
    if (!ocspUrl) {
      return { status: 'unknown', revokedAt: null, reason: null, message: 'No OCSP URL found in certificate AIA' };
    }

    const reqDer = await buildOcspRequest(certDer, issuerDer);

    const resp = await fetch(ocspUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/ocsp-request',
        'accept': 'application/ocsp-response',
      },
      body: reqDer,
    });

    if (!resp.ok) {
      return { status: 'unknown', revokedAt: null, reason: null, message: `OCSP HTTP ${resp.status}` };
    }

    const bytes = new Uint8Array(await resp.arrayBuffer());
    return _parseOcspResponse(bytes);
  } catch (err) {
    return { status: 'error', revokedAt: null, reason: null, message: /** @type {Error} */ (err).message };
  }
}

/**
 * Minimal OCSP response parser.
 * Extracts the first SingleResponse status from an OCSPResponse DER.
 *
 * @param {Uint8Array} bytes
 * @returns {OcspStatus}
 */
function _parseOcspResponse(bytes) {
  try {
    // OCSPResponse ::= SEQUENCE { responseStatus ENUMERATED, responseBytes [0] OPTIONAL }
    // responseStatus: 0=successful, 1=malformedRequest, 2=internalError, 3=tryLater,
    //                 5=sigRequired, 6=unauthorized
    if (bytes[0] !== 0x30) return { status: 'error', revokedAt: null, reason: null, message: 'Invalid OCSP response' };
    let off = 1 + _parseDerLen(bytes, 1).lenBytes;

    // ENUMERATED responseStatus
    if (bytes[off] !== 0x0A) return { status: 'error', revokedAt: null, reason: null, message: 'Missing responseStatus' };
    const statusCode = bytes[off + 2];
    if (statusCode !== 0) {
      return { status: 'error', revokedAt: null, reason: null, message: `OCSP responseStatus: ${statusCode}` };
    }
    off += 3; // skip ENUMERATED TLV (0x0A 0x01 0x00)

    // Walk into responseBytes [0] EXPLICIT → responseType + response
    // [0] tag = 0xA0
    if (off >= bytes.length || bytes[off] !== 0xA0) {
      return { status: 'unknown', revokedAt: null, reason: null, message: 'No responseBytes in OCSP response' };
    }
    const rbLen = _parseDerLen(bytes, off + 1);
    off += 1 + rbLen.lenBytes;

    // ResponseBytes ::= SEQUENCE { responseType OID, response OCTET STRING }
    if (bytes[off] !== 0x30) return { status: 'error', revokedAt: null, reason: null, message: 'Invalid ResponseBytes' };
    const rbSeqLen = _parseDerLen(bytes, off + 1);
    off += 1 + rbSeqLen.lenBytes;

    // Skip responseType OID
    if (bytes[off] !== 0x06) return { status: 'error', revokedAt: null, reason: null, message: 'Missing responseType OID' };
    const oidLen = _parseDerLen(bytes, off + 1);
    off += 1 + oidLen.lenBytes + oidLen.len;

    // response OCTET STRING containing BasicOCSPResponse DER
    if (bytes[off] !== 0x04) return { status: 'error', revokedAt: null, reason: null, message: 'Missing response OCTET STRING' };
    const respOctLen = _parseDerLen(bytes, off + 1);
    off += 1 + respOctLen.lenBytes;
    const basicBytes = bytes.slice(off, off + respOctLen.len);

    return _parseBasicOcspResponse(basicBytes);
  } catch (err) {
    return { status: 'error', revokedAt: null, reason: null, message: /** @type {Error} */ (err).message };
  }
}

/**
 * Minimal parser for BasicOCSPResponse to extract the first certificate status.
 *
 * @param {Uint8Array} bytes
 * @returns {OcspStatus}
 */
function _parseBasicOcspResponse(bytes) {
  try {
    // BasicOCSPResponse ::= SEQUENCE { tbsResponseData ResponseData, ... }
    // ResponseData ::= SEQUENCE { ... responses SEQUENCE OF SingleResponse ... }
    // SingleResponse ::= SEQUENCE { certID, certStatus, thisUpdate, ... }
    // certStatus: [0] IMPLICIT → good, [1] IMPLICIT → revoked, [2] IMPLICIT → unknown

    // Walk: BasicOCSPResponse SEQUENCE
    if (bytes[0] !== 0x30) return { status: 'unknown', revokedAt: null, reason: null, message: 'Invalid BasicOCSPResponse' };
    const off = 1 + _parseDerLen(bytes, 1).lenBytes;

    // ResponseData SEQUENCE
    if (bytes[off] !== 0x30) return { status: 'unknown', revokedAt: null, reason: null, message: 'Invalid ResponseData' };
    const rdLen = _parseDerLen(bytes, off + 1);
    const rdOff = off + 1 + rdLen.lenBytes;
    let rdCur = rdOff;
    const rdEnd = rdOff + rdLen.len;

    // Skip optional [1] (responderID) and generalized time
    while (rdCur < rdEnd) {
      const tag = bytes[rdCur];
      const lenInfo = _parseDerLen(bytes, rdCur + 1);
      const totalLen = 1 + lenInfo.lenBytes + lenInfo.len;

      if (tag === 0x30) {
        // This is the 'responses' SEQUENCE OF SingleResponse
        const responsesLen = lenInfo;
        const rOff = rdCur + 1 + responsesLen.lenBytes;
        const rEnd = rOff + responsesLen.len;

        // Parse first SingleResponse
        while (rOff < rEnd) {
          if (bytes[rOff] !== 0x30) break;
          const srLen = _parseDerLen(bytes, rOff + 1);
          let srOff = rOff + 1 + srLen.lenBytes;
          const srEnd = srOff + srLen.len;

          // Skip CertID SEQUENCE
          if (bytes[srOff] === 0x30) {
            const cidLen = _parseDerLen(bytes, srOff + 1);
            srOff += 1 + cidLen.lenBytes + cidLen.len;
          }

          // certStatus: [0] IMPLICIT NULL (good), [1] SEQUENCE (revoked), [2] IMPLICIT NULL (unknown)
          if (srOff >= srEnd) break;
          const statusTag = bytes[srOff];
          if (statusTag === 0x80) {
            // good: [0] IMPLICIT (0 bytes)
            return { status: 'good', revokedAt: null, reason: null, message: null };
          } else if (statusTag === 0xA1) {
            // revoked: [1] EXPLICIT SEQUENCE { revokedAt GeneralizedTime, ... }
            const revLen = _parseDerLen(bytes, srOff + 1);
            const revOff = srOff + 1 + revLen.lenBytes;
            let revokedAt = null;
            if (bytes[revOff] === 0x18) {
              // GeneralizedTime
              const gtLen = bytes[revOff + 1];
              const gtStr = new TextDecoder().decode(bytes.slice(revOff + 2, revOff + 2 + gtLen));
              revokedAt = _parseGeneralizedTime(gtStr);
            }
            return { status: 'revoked', revokedAt, reason: null, message: null };
          } else {
            return { status: 'unknown', revokedAt: null, reason: null, message: null };
          }
        }
        break;
      }
      rdCur += totalLen;
    }

    return { status: 'unknown', revokedAt: null, reason: null, message: 'Could not parse OCSP response' };
  } catch (err) {
    return { status: 'error', revokedAt: null, reason: null, message: /** @type {Error} */ (err).message };
  }
}

/**
 * Parse a GeneralizedTime string (e.g. "20241201120000Z") to a Date.
 * @param {string} s
 * @returns {Date|null}
 */
function _parseGeneralizedTime(s) {
  try {
    // Format: YYYYMMDDHHMMSSZ or YYYYMMDDHHMMSS.fffZ
    const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
    const h = s.slice(8, 10), mi = s.slice(10, 12), sec = s.slice(12, 14);
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}Z`);
  } catch (_e) { return null; }
}

// ─── Certificate chain verification ─────────────────────────────────────────

/**
 * @typedef {object} ChainResult
 * @property {boolean} valid
 * @property {string[]} chain    - Common names in chain order (leaf → root)
 * @property {string|null} error
 */

/**
 * Build and verify an X.509 certificate chain using @peculiar/x509 X509ChainBuilder.
 *
 * @param {Uint8Array[]} certDers - Certificate chain DER bytes (index 0 = leaf)
 * @param {Uint8Array[]} [trustedDers] - Additional trusted root DER bytes
 * @returns {Promise<ChainResult>}
 */
export async function verifyCertChain(certDers, trustedDers = []) {
  try {
    const certs = certDers.map(d => new X509Certificate(d));
    const trusted = trustedDers.map(d => new X509Certificate(d));

    const builder = new X509ChainBuilder({
      certificates: [...certs.slice(1), ...trusted],
    });

    const chain = await builder.build(certs[0]);
    const names = chain.map(c => c.subjectName.getField('CN')?.[0] || c.subject);

    return { valid: chain.length > 0, chain: names, error: null };
  } catch (err) {
    return { valid: false, chain: [], error: /** @type {Error} */ (err).message };
  }
}

// ─── Well-known public TSA endpoints ────────────────────────────────────────

/**
 * Known free/public TSA endpoints.
 * Users can supply their own; these are provided as convenient defaults.
 */
export const PUBLIC_TSA_URLS = /** @type {const} */ ([
  'http://timestamp.digicert.com',
  'http://timestamp.sectigo.com',
  'http://tsa.starfieldtech.com',
  'http://timestamp.globalsign.com/scripts/timestamp.dll',
]);
