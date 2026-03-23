// ─── Unit Tests: Digital Signature Crypto ───────────────────────────────────
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  generateSelfSignedCert,
  signPdf,
  verifySignatures,
  hasSig,
  SignatureManager,
} from '../../app/modules/digital-signature-crypto.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestPdf(pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

// ─── generateSelfSignedCert ─────────────────────────────────────────────────

describe('generateSelfSignedCert', () => {
  it('generates an RSA-2048 cert by default', async () => {
    const cert = await generateSelfSignedCert({ commonName: 'Test User' });
    assert.ok(cert);
    assert.equal(cert.commonName, 'Test User');
    assert.equal(cert.algorithm, 'RSA-2048');
    assert.ok(cert.keyPair);
    assert.ok(cert.keyPair.privateKey);
    assert.ok(cert.keyPair.publicKey);
    assert.ok(cert.certDer instanceof Uint8Array);
    assert.ok(cert.certDer.length > 0);
  });

  it('generates an ECDSA-P256 cert', async () => {
    const cert = await generateSelfSignedCert({
      commonName: 'EC User',
      algorithm: 'ECDSA-P256',
    });
    assert.equal(cert.algorithm, 'ECDSA-P256');
    assert.ok(cert.keyPair);
    assert.ok(cert.certDer instanceof Uint8Array);
  });

  it('uses default commonName and organization', async () => {
    const cert = await generateSelfSignedCert({});
    assert.equal(cert.commonName, 'NovaReader User');
    assert.ok(cert.issuer.includes('NovaReader'));
  });

  it('sets custom organization', async () => {
    const cert = await generateSelfSignedCert({
      commonName: 'User',
      organization: 'MyOrg',
    });
    assert.ok(cert.issuer.includes('MyOrg'));
  });

  it('sets validity dates based on validDays', async () => {
    const cert = await generateSelfSignedCert({
      commonName: 'Test',
      validDays: 30,
    });
    const diff = cert.notAfter.getTime() - cert.notBefore.getTime();
    const days = diff / 86400000;
    assert.ok(days >= 29 && days <= 31);
  });

  it('defaults to 365 days validity', async () => {
    const cert = await generateSelfSignedCert({ commonName: 'Test' });
    const diff = cert.notAfter.getTime() - cert.notBefore.getTime();
    const days = diff / 86400000;
    assert.ok(days >= 364 && days <= 366);
  });

  it('generates a unique serial number', async () => {
    const cert1 = await generateSelfSignedCert({ commonName: 'A' });
    const cert2 = await generateSelfSignedCert({ commonName: 'B' });
    assert.notEqual(cert1.serialNumber, cert2.serialNumber);
  });

  it('issuer includes CN and O', async () => {
    const cert = await generateSelfSignedCert({
      commonName: 'John',
      organization: 'Acme',
    });
    assert.equal(cert.issuer, 'CN=John, O=Acme');
  });
});

// ─── signPdf ────────────────────────────────────────────────────────────────

describe('signPdf', () => {
  let pdfBytes;
  let cert;

  before(async () => {
    pdfBytes = await createTestPdf(2);
    cert = await generateSelfSignedCert({ commonName: 'Signer' });
  });

  it('returns a Blob', async () => {
    const result = await signPdf(pdfBytes, cert);
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
  });

  it('produces a valid PDF', async () => {
    const result = await signPdf(pdfBytes, cert);
    const bytes = new Uint8Array(await result.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    assert.equal(doc.getPageCount(), 2);
  });

  it('accepts reason and location', async () => {
    const result = await signPdf(pdfBytes, cert, {
      reason: 'Approval',
      location: 'Office',
      contactInfo: 'test@example.com',
    });
    assert.ok(result instanceof Blob);
  });

  it('accepts custom pageNum', async () => {
    const result = await signPdf(pdfBytes, cert, { pageNum: 2 });
    assert.ok(result instanceof Blob);
  });

  it('accepts custom rect', async () => {
    const result = await signPdf(pdfBytes, cert, {
      rect: { x: 50, y: 50, width: 200, height: 50 },
    });
    assert.ok(result instanceof Blob);
  });

  it('accepts ArrayBuffer input', async () => {
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const result = await signPdf(ab, cert);
    assert.ok(result instanceof Blob);
  });

  it('signs with ECDSA-P256 cert', async () => {
    const ecCert = await generateSelfSignedCert({
      commonName: 'EC Signer',
      algorithm: 'ECDSA-P256',
    });
    const result = await signPdf(pdfBytes, ecCert);
    assert.ok(result instanceof Blob);
  });
});

// ─── verifySignatures ───────────────────────────────────────────────────────

describe('verifySignatures', () => {
  it('returns empty array for unsigned PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const sigs = await verifySignatures(pdfBytes);
    assert.ok(Array.isArray(sigs));
    assert.equal(sigs.length, 0);
  });

  it('detects signature after signing', async () => {
    const pdfBytes = await createTestPdf(1);
    const cert = await generateSelfSignedCert({ commonName: 'Verifier' });
    const signedBlob = await signPdf(pdfBytes, cert, {
      reason: 'Test',
      location: 'Lab',
    });
    const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
    const sigs = await verifySignatures(signedBytes);
    assert.ok(sigs.length >= 1);
    assert.equal(sigs[0].isSigned, true);
    assert.equal(sigs[0].status, 'valid');
  });

  it('returns signer name from signed PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const cert = await generateSelfSignedCert({ commonName: 'Alice' });
    const signedBlob = await signPdf(pdfBytes, cert);
    const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
    const sigs = await verifySignatures(signedBytes);
    assert.ok(sigs.length >= 1);
    assert.equal(sigs[0].signer, 'Alice');
  });

  it('returns reason and location', async () => {
    const pdfBytes = await createTestPdf(1);
    const cert = await generateSelfSignedCert({ commonName: 'Bob' });
    const signedBlob = await signPdf(pdfBytes, cert, {
      reason: 'Approval',
      location: 'NYC',
    });
    const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
    const sigs = await verifySignatures(signedBytes);
    assert.equal(sigs[0].reason, 'Approval');
    assert.equal(sigs[0].location, 'NYC');
  });

  it('returns signDate as Date object', async () => {
    const pdfBytes = await createTestPdf(1);
    const cert = await generateSelfSignedCert({ commonName: 'Carol' });
    const signedBlob = await signPdf(pdfBytes, cert);
    const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
    const sigs = await verifySignatures(signedBytes);
    assert.ok(sigs[0].signDate instanceof Date);
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createTestPdf(1);
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const sigs = await verifySignatures(ab);
    assert.ok(Array.isArray(sigs));
  });
});

// ─── hasSig ─────────────────────────────────────────────────────────────────

describe('hasSig', () => {
  it('returns false for unsigned PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await hasSig(pdfBytes);
    assert.equal(result, false);
  });

  it('returns true for signed PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const cert = await generateSelfSignedCert({ commonName: 'Sig' });
    const signedBlob = await signPdf(pdfBytes, cert);
    const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
    const result = await hasSig(signedBytes);
    assert.equal(result, true);
  });
});

// ─── SignatureManager ───────────────────────────────────────────────────────

describe('SignatureManager', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('constructs without errors', () => {
    const mgr = new SignatureManager(container, {
      getPdfBytes: () => new Uint8Array(),
      onApply: () => {},
    });
    assert.ok(mgr);
  });

  it('open() builds panel and appends to container', async () => {
    const pdfBytes = await createTestPdf(1);
    const mgr = new SignatureManager(container, {
      getPdfBytes: () => pdfBytes,
      onApply: () => {},
    });
    await mgr.open();
    assert.equal(container.children.length, 1);
    assert.ok(container.querySelector('h3')?.textContent.includes('Digital Signatures'));
  });

  it('close() removes the panel', async () => {
    const pdfBytes = await createTestPdf(1);
    const mgr = new SignatureManager(container, {
      getPdfBytes: () => pdfBytes,
      onApply: () => {},
    });
    await mgr.open();
    mgr.close();
    assert.equal(container.children.length, 0);
  });

  it('close() when not open is safe', () => {
    const mgr = new SignatureManager(container, {
      getPdfBytes: () => new Uint8Array(),
      onApply: () => {},
    });
    mgr.close();
    assert.equal(container.children.length, 0);
  });

  it('shows "No digital signatures" for unsigned PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const mgr = new SignatureManager(container, {
      getPdfBytes: () => pdfBytes,
      onApply: () => {},
    });
    await mgr.open();
    assert.ok(container.textContent.includes('No digital signatures'));
  });

  it('close button triggers onClose callback', async () => {
    let closed = false;
    const pdfBytes = await createTestPdf(1);
    const mgr = new SignatureManager(container, {
      getPdfBytes: () => pdfBytes,
      onApply: () => {},
      onClose: () => { closed = true; },
    });
    await mgr.open();
    const closeBtn = container.querySelector('button');
    closeBtn.click();
    assert.ok(closed);
  });
});
