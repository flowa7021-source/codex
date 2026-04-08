import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

const {
  listAttachments,
  addAttachment,
  extractAttachment,
  deleteAttachment,
  AttachmentPanel,
} = await import('../../app/modules/attachment-manager.js');

async function makeBlankPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  return doc.save();
}

describe('attachment-manager', () => {
  it('listAttachments returns empty array for a blank PDF', async () => {
    const pdfBytes = await makeBlankPdf();
    const result = await listAttachments(pdfBytes);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('addAttachment embeds a file and returns a Blob', async () => {
    const pdfBytes = await makeBlankPdf();
    const fileData = new Uint8Array([1, 2, 3, 4]);
    const blob = await addAttachment(pdfBytes, 'test.txt', fileData, 'text/plain', 'A test file');
    assert.ok(blob instanceof Blob);
  });

  it('listAttachments finds an added attachment', async () => {
    const pdfBytes = await makeBlankPdf();
    const fileData = new Uint8Array([10, 20, 30]);
    const blob = await addAttachment(pdfBytes, 'data.bin', fileData, 'application/octet-stream');
    const modifiedBytes = new Uint8Array(await blob.arrayBuffer());
    const attachments = await listAttachments(modifiedBytes);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].name, 'data.bin');
    assert.equal(attachments[0].index, 0);
  });

  it('addAttachment can add multiple attachments', async () => {
    let pdfBytes = await makeBlankPdf();
    const blob1 = await addAttachment(pdfBytes, 'a.txt', new Uint8Array([1]));
    const bytes1 = new Uint8Array(await blob1.arrayBuffer());
    const blob2 = await addAttachment(bytes1, 'b.txt', new Uint8Array([2]));
    const bytes2 = new Uint8Array(await blob2.arrayBuffer());
    const list = await listAttachments(bytes2);
    assert.equal(list.length, 2);
  });

  it('extractAttachment retrieves embedded file data', async () => {
    const pdfBytes = await makeBlankPdf();
    const fileData = new Uint8Array([42, 43, 44]);
    const blob = await addAttachment(pdfBytes, 'extract-me.bin', fileData);
    const modifiedBytes = new Uint8Array(await blob.arrayBuffer());
    const result = await extractAttachment(modifiedBytes, 0);
    assert.ok(result !== null);
    assert.equal(result.name, 'extract-me.bin');
    assert.ok(result.data instanceof Uint8Array);
    assert.ok(result.data.length > 0);
  });

  it('extractAttachment returns null for out-of-range index', async () => {
    const pdfBytes = await makeBlankPdf();
    const result = await extractAttachment(pdfBytes, 99);
    assert.equal(result, null);
  });

  it('deleteAttachment removes an attachment', async () => {
    const pdfBytes = await makeBlankPdf();
    const blob1 = await addAttachment(pdfBytes, 'del.txt', new Uint8Array([1, 2]));
    const bytes1 = new Uint8Array(await blob1.arrayBuffer());
    // Confirm it exists
    const before = await listAttachments(bytes1);
    assert.equal(before.length, 1);
    // Delete it
    const blob2 = await deleteAttachment(bytes1, 0);
    const bytes2 = new Uint8Array(await blob2.arrayBuffer());
    const after = await listAttachments(bytes2);
    assert.equal(after.length, 0);
  });

  it('deleteAttachment with invalid index returns unchanged PDF', async () => {
    const pdfBytes = await makeBlankPdf();
    const blob = await deleteAttachment(pdfBytes, 999);
    assert.ok(blob instanceof Blob);
  });

  it('listAttachments accepts ArrayBuffer input', async () => {
    const pdfBytes = await makeBlankPdf();
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const result = await listAttachments(ab);
    assert.ok(Array.isArray(result));
  });

  it('AttachmentPanel constructor initializes', () => {
    const container = globalThis.document.createElement('div');
    const panel = new AttachmentPanel(container, {
      getPdfBytes: () => new Uint8Array(0),
      onApply: () => {},
    });
    assert.ok(panel);
    assert.equal(panel._panel, null);
  });

  it('AttachmentPanel close is safe when not open', () => {
    const container = globalThis.document.createElement('div');
    const panel = new AttachmentPanel(container, {
      getPdfBytes: () => new Uint8Array(0),
      onApply: () => {},
    });
    assert.doesNotThrow(() => panel.close());
  });
});

describe('AttachmentPanel – _extractFile', () => {
  it('downloads file by creating and revoking object URL', async () => {
    const pdfBytes = await makeBlankPdf();
    const fileData = new Uint8Array([10, 20, 30, 40]);
    const blob = await addAttachment(pdfBytes, 'download.txt', fileData, 'text/plain');
    const modifiedBytes = new Uint8Array(await blob.arrayBuffer());

    const createdUrls = [];
    const revokedUrls = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (b) => { const u = 'blob:test-' + createdUrls.length; createdUrls.push(u); return u; };
    URL.revokeObjectURL = (u) => { revokedUrls.push(u); };

    const container = document.createElement('div');
    const ap = new AttachmentPanel(container, {
      getPdfBytes: () => modifiedBytes,
      onApply: () => {},
    });

    try {
      await ap._extractFile(0);
      assert.ok(createdUrls.length > 0, 'createObjectURL should be called');
      assert.ok(revokedUrls.length > 0, 'revokeObjectURL should be called');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it('does nothing when extractAttachment returns null (out-of-bounds index)', async () => {
    const pdfBytes = await makeBlankPdf();
    const container = document.createElement('div');
    const ap = new AttachmentPanel(container, {
      getPdfBytes: () => pdfBytes,
      onApply: () => {},
    });
    // Index 999 is out of bounds; should return early without error
    await assert.doesNotReject(() => ap._extractFile(999));
  });
});

describe('AttachmentPanel – _deleteFile', () => {
  it('deletes attachment and calls onApply', async () => {
    const pdfBytes = await makeBlankPdf();
    const blob = await addAttachment(pdfBytes, 'del.txt', new Uint8Array([5, 6, 7]));
    const modifiedBytes = new Uint8Array(await blob.arrayBuffer());

    let appliedBlob = null;
    const container = document.createElement('div');
    const ap = new AttachmentPanel(container, {
      getPdfBytes: () => modifiedBytes,
      onApply: (b) => { appliedBlob = b; },
    });

    await ap._deleteFile(0);
    assert.ok(appliedBlob instanceof Blob, 'onApply should be called with Blob');
  });
});

describe('AttachmentPanel – _formatBytes via open()', () => {
  it('shows KB size for attachment >= 1024 bytes', async () => {
    const pdfBytes = await makeBlankPdf();
    const fileData = new Uint8Array(2048).fill(0xAA); // 2 KB
    const blob = await addAttachment(pdfBytes, 'big.bin', fileData, 'application/octet-stream');
    const modifiedBytes = new Uint8Array(await blob.arrayBuffer());

    const container = document.createElement('div');
    const ap = new AttachmentPanel(container, {
      getPdfBytes: () => modifiedBytes,
      onApply: () => {},
    });

    // open() calls _buildPanel() which calls _formatBytes() on the file size
    await ap.open();
    // If no error, KB branch was exercised
    ap.close();
  });

  it('shows MB size for attachment >= 1MB bytes', async () => {
    const pdfBytes = await makeBlankPdf();
    const fileData = new Uint8Array(1100000).fill(0xBB); // ~1 MB
    const blob = await addAttachment(pdfBytes, 'huge.bin', fileData, 'application/octet-stream');
    const modifiedBytes = new Uint8Array(await blob.arrayBuffer());

    const container = document.createElement('div');
    const ap = new AttachmentPanel(container, {
      getPdfBytes: () => modifiedBytes,
      onApply: () => {},
    });

    await ap.open();
    ap.close();
  });
});
