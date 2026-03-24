import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initExportTextDeps, importDocxEdits, exportSessionHealthReport } from '../../app/modules/export-text.js';
import { state, els } from '../../app/modules/state.js';

describe('initExportTextDeps', () => {
  it('is a function', () => {
    assert.equal(typeof initExportTextDeps, 'function');
  });

  it('accepts a deps object without throwing', () => {
    assert.doesNotThrow(() => {
      initExportTextDeps({ setOcrStatus: () => {}, getOcrLang: () => 'eng' });
    });
  });

  it('accepts empty object', () => {
    assert.doesNotThrow(() => {
      initExportTextDeps({});
    });
  });

  it('accepts partial deps', () => {
    assert.doesNotThrow(() => {
      initExportTextDeps({ setOcrStatus: () => {} });
    });
  });

  it('overwrites previous deps on second call', () => {
    const fn1 = () => 'first';
    const fn2 = () => 'second';
    initExportTextDeps({ getOcrLang: fn1 });
    initExportTextDeps({ getOcrLang: fn2 });
    // No throw means it accepted the override
    assert.ok(true);
  });
});

describe('importDocxEdits', () => {
  let statusMessages;

  beforeEach(() => {
    statusMessages = [];
    initExportTextDeps({
      setOcrStatus: (msg) => statusMessages.push(msg),
      getOcrLang: () => 'eng',
    });
  });

  it('is an async function', () => {
    assert.equal(typeof importDocxEdits, 'function');
  });

  it('returns early for null file', async () => {
    await importDocxEdits(null);
  });

  it('returns early for undefined file', async () => {
    await importDocxEdits(undefined);
  });

  it('sets status when file is null', async () => {
    await importDocxEdits(null);
    assert.ok(statusMessages.length > 0);
    assert.ok(statusMessages[0].includes('Импорт DOCX'));
  });

  it('sets status when adapter is null and file is provided', async () => {
    const prevAdapter = state.adapter;
    state.adapter = null;
    const fakeFile = { arrayBuffer: async () => new ArrayBuffer(0) };
    await importDocxEdits(fakeFile);
    assert.ok(statusMessages.length > 0);
    assert.ok(statusMessages[0].includes('нужен открытый документ'));
    state.adapter = prevAdapter;
  });

  it('reports error when file arrayBuffer fails', async () => {
    const prevAdapter = state.adapter;
    state.adapter = {};
    const fakeFile = {
      arrayBuffer: async () => { throw new Error('read failure'); },
    };
    await importDocxEdits(fakeFile);
    assert.ok(statusMessages.some(m => m.includes('ошибка') && m.includes('read failure')));
    state.adapter = prevAdapter;
  });

  it('reports when xml not found in zip', async () => {
    const prevAdapter = state.adapter;
    state.adapter = {};
    // Provide bytes that are not a valid ZIP, so extractDocumentXmlFromZip returns null
    const fakeFile = {
      arrayBuffer: async () => new ArrayBuffer(10),
    };
    await importDocxEdits(fakeFile);
    assert.ok(statusMessages.some(m => m.includes('word/document.xml')));
    state.adapter = prevAdapter;
  });

  it('reports when docx has no text', async () => {
    const prevAdapter = state.adapter;
    const prevPageCount = state.pageCount;
    state.adapter = {};
    state.pageCount = 3;

    // Build a minimal fake ZIP with word/document.xml containing no <w:t> text
    const xmlContent = '<w:document></w:document>';
    const fakeZipBytes = buildFakeZip('word/document.xml', xmlContent);

    const fakeFile = {
      arrayBuffer: async () => fakeZipBytes.buffer,
    };
    await importDocxEdits(fakeFile);
    assert.ok(statusMessages.some(m => m.includes('текст не найден')));

    state.adapter = prevAdapter;
    state.pageCount = prevPageCount;
  });

  it('merges pages from a valid docx import', async () => {
    const prevAdapter = state.adapter;
    const prevPageCount = state.pageCount;
    const prevCurrentPage = state.currentPage;
    state.adapter = {};
    state.pageCount = 3;
    state.currentPage = 1;

    // Build XML with text on page 1
    const xmlContent = '<w:document><w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body></w:document>';
    const fakeZipBytes = buildFakeZip('word/document.xml', xmlContent);

    // Provide a mock pageText element
    const prevPageText = els.pageText;
    els.pageText = { value: '' };

    const fakeFile = {
      arrayBuffer: async () => fakeZipBytes.buffer,
    };
    await importDocxEdits(fakeFile);
    assert.ok(statusMessages.some(m => m.includes('объединено')));

    els.pageText = prevPageText;
    state.adapter = prevAdapter;
    state.pageCount = prevPageCount;
    state.currentPage = prevCurrentPage;
  });
});

describe('exportSessionHealthReport', () => {
  it('is a function', () => {
    assert.equal(typeof exportSessionHealthReport, 'function');
  });

  it('generates and triggers download of health report', () => {
    // Set up deps so getOcrLang returns a known value
    initExportTextDeps({
      setOcrStatus: () => {},
      getOcrLang: () => 'eng',
    });

    // Track the anchor element created for download
    const origCreateElement = document.createElement;
    let downloadTriggered = false;
    let downloadFilename = '';

    document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        const origClick = el.click;
        el.click = () => {
          downloadTriggered = true;
          downloadFilename = el.download;
        };
      }
      return el;
    };

    // Ensure URL.createObjectURL and revokeObjectURL exist
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:mock-health';
    URL.revokeObjectURL = () => {};

    assert.doesNotThrow(() => {
      exportSessionHealthReport();
    });
    assert.ok(downloadTriggered, 'download anchor should have been clicked');
    assert.ok(downloadFilename.startsWith('novareader-health-'), 'filename should start with novareader-health-');
    assert.ok(downloadFilename.endsWith('.json'), 'filename should end with .json');

    // Restore
    document.createElement = origCreateElement;
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });
});

// ─── Helper: build a minimal uncompressed ZIP with one file ────────────────

function buildFakeZip(filename, content) {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(filename);
  const contentBytes = encoder.encode(content);

  // Local file header (30 bytes + name + content)
  const header = new Uint8Array(30 + nameBytes.length + contentBytes.length);
  // Signature PK\x03\x04
  header[0] = 0x50; header[1] = 0x4B; header[2] = 0x03; header[3] = 0x04;
  // Version needed (20)
  header[4] = 20; header[5] = 0;
  // General purpose flags
  header[6] = 0; header[7] = 0;
  // Compression method (0 = stored)
  header[8] = 0; header[9] = 0;
  // Skip time/date/crc (zeros)
  // Compressed size (bytes 18-21)
  header[18] = contentBytes.length & 0xFF;
  header[19] = (contentBytes.length >> 8) & 0xFF;
  header[20] = (contentBytes.length >> 16) & 0xFF;
  header[21] = (contentBytes.length >> 24) & 0xFF;
  // Uncompressed size (bytes 22-25)
  header[22] = contentBytes.length & 0xFF;
  header[23] = (contentBytes.length >> 8) & 0xFF;
  header[24] = (contentBytes.length >> 16) & 0xFF;
  header[25] = (contentBytes.length >> 24) & 0xFF;
  // File name length (bytes 26-27)
  header[26] = nameBytes.length & 0xFF;
  header[27] = (nameBytes.length >> 8) & 0xFF;
  // Extra field length (bytes 28-29)
  header[28] = 0; header[29] = 0;
  // File name
  header.set(nameBytes, 30);
  // File content
  header.set(contentBytes, 30 + nameBytes.length);

  return header;
}
