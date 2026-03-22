// @ts-check
/**
 * @module attachment-manager
 * @description Embed, list, extract, and delete file attachments in PDF documents.
 *
 * PDF supports embedding arbitrary files (EmbeddedFiles) inside the document.
 * This module provides both programmatic API and a sidebar UI for managing them.
 *
 * Usage:
 *   import { listAttachments, addAttachment, extractAttachment, AttachmentPanel }
 *     from './attachment-manager.js';
 *
 *   const items = await listAttachments(pdfBytes);
 *   const blob  = await addAttachment(pdfBytes, 'report.xlsx', fileBytes, 'application/xlsx');
 */

import { PDFDocument, PDFName, PDFDict, PDFString, PDFArray, PDFHexString } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AttachmentInfo
 * @property {string}  name        – file name
 * @property {string}  description
 * @property {number}  size        – bytes (0 if unknown)
 * @property {string}  mimeType
 * @property {number}  index       – 0-based position in the Names array
 */

// ---------------------------------------------------------------------------
// Public API — List
// ---------------------------------------------------------------------------

/**
 * List all file attachments in a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<AttachmentInfo[]>}
 */
export async function listAttachments(pdfBytes) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
  const ctx    = pdfDoc.context;

  const namesDict = _getEmbeddedFilesNames(pdfDoc);
  if (!namesDict) return [];

  const namesArray = namesDict.get(PDFName.of('Names'));
  if (!namesArray) return [];

  const arr    = ctx.lookup(namesArray);
  if (!(arr instanceof PDFArray)) return [];

  const result = [];
  // Names array is [string, filespec, string, filespec, ...]
  for (let i = 0; i < arr.size() - 1; i += 2) {
    const nameObj    = ctx.lookup(arr.get(i));
    const fileSpecRef = arr.get(i + 1);
    const fileSpec   = ctx.lookup(fileSpecRef);

    const name = _pdfStringToJs(nameObj) || `file_${i / 2}`;

    let size     = 0;
    let mimeType = 'application/octet-stream';
    let desc     = '';

    if (fileSpec instanceof PDFDict) {
      const descObj = fileSpec.get(PDFName.of('Desc'));
      if (descObj) desc = _pdfStringToJs(ctx.lookup(descObj)) || '';

      const efDict = fileSpec.get(PDFName.of('EF'));
      if (efDict) {
        const ef = ctx.lookup(efDict);
        if (ef instanceof PDFDict) {
          const fStream = ef.get(PDFName.of('F'));
          if (fStream) {
            const stream = ctx.lookup(fStream);
            if (/** @type {any} */ (stream)?.dict) {
              const params = /** @type {any} */ (stream).dict.get(PDFName.of('Params'));
              if (params) {
                const p = ctx.lookup(params);
                if (p instanceof PDFDict) {
                  const sizeObj = p.get(PDFName.of('Size'));
                  if (sizeObj) size = Number(sizeObj) || 0;
                }
              }
              const subtypeObj = /** @type {any} */ (stream).dict.get(PDFName.of('Subtype'));
              if (subtypeObj) mimeType = String(subtypeObj).replace('/', '');
            }
          }
        }
      }
    }

    result.push({ name, description: desc, size, mimeType, index: i / 2 });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API — Add
// ---------------------------------------------------------------------------

/**
 * Embed a file attachment into the PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} fileName        – display name for the attachment
 * @param {Uint8Array|ArrayBuffer} fileData – raw file content
 * @param {string} [mimeType='application/octet-stream']
 * @param {string} [description='']
 * @returns {Promise<Blob>}
 */
export async function addAttachment(pdfBytes, fileName, fileData, mimeType, description) {
  const data    = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const fileBuf = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
  const pdfDoc  = await PDFDocument.load(data);
  const ctx     = pdfDoc.context;

  // Create the embedded file stream
  const stream = ctx.flateStream(fileBuf, {
    Type:    'EmbeddedFile',
    Subtype: mimeType ?? 'application/octet-stream',
    Params:  ctx.obj({ Size: fileBuf.byteLength }),
  });
  const streamRef = ctx.register(stream);

  // Create the file specification dictionary
  const fileSpec = ctx.obj({
    Type: 'Filespec',
    F:    PDFString.of(fileName),
    UF:   PDFHexString.fromText(fileName),
    EF:   ctx.obj({ F: streamRef }),
    Desc: PDFString.of(description ?? ''),
  });
  const fileSpecRef = ctx.register(fileSpec);

  // Get or create the Names/EmbeddedFiles entry in the catalog
  const namesDict = _getOrCreateEmbeddedFilesNames(pdfDoc);
  const namesArray = namesDict.get(PDFName.of('Names'));
  let arr;

  if (namesArray) {
    arr = ctx.lookup(namesArray);
    if (!(arr instanceof PDFArray)) {
      arr = ctx.obj([]);
      namesDict.set(PDFName.of('Names'), arr);
    }
  } else {
    arr = ctx.obj([]);
    namesDict.set(PDFName.of('Names'), arr);
  }

  // Append [name, filespec]
  arr.push(PDFString.of(fileName));
  arr.push(fileSpecRef);

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Extract
// ---------------------------------------------------------------------------

/**
 * Extract an attachment by index.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} index – 0-based attachment index
 * @returns {Promise<{ name: string, data: Uint8Array, mimeType: string } | null>}
 */
export async function extractAttachment(pdfBytes, index) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
  const ctx    = pdfDoc.context;

  const namesDict = _getEmbeddedFilesNames(pdfDoc);
  if (!namesDict) return null;

  const namesArray = namesDict.get(PDFName.of('Names'));
  if (!namesArray) return null;

  const arr = ctx.lookup(namesArray);
  if (!(arr instanceof PDFArray)) return null;

  const nameIdx    = index * 2;
  const specIdx    = index * 2 + 1;
  if (specIdx >= arr.size()) return null;

  const nameObj  = ctx.lookup(arr.get(nameIdx));
  const fileSpec = ctx.lookup(arr.get(specIdx));
  const name     = _pdfStringToJs(nameObj) || `file_${index}`;

  if (!(fileSpec instanceof PDFDict)) return null;

  const efDict = fileSpec.get(PDFName.of('EF'));
  if (!efDict) return null;

  const ef = ctx.lookup(efDict);
  if (!(ef instanceof PDFDict)) return null;

  const fStreamRef = ef.get(PDFName.of('F'));
  if (!fStreamRef) return null;

  const stream = ctx.lookup(fStreamRef);
  if (!stream) return null;

  const contents = /** @type {any} */ (stream).getContents?.() ?? /** @type {any} */ (stream).contents;
  if (!contents) return null;

  const subtypeObj = /** @type {any} */ (stream).dict?.get(PDFName.of('Subtype'));
  const mimeType   = subtypeObj ? String(subtypeObj).replace('/', '') : 'application/octet-stream';

  return { name, data: new Uint8Array(contents), mimeType };
}

// ---------------------------------------------------------------------------
// Public API — Delete
// ---------------------------------------------------------------------------

/**
 * Remove an attachment by index.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} index
 * @returns {Promise<Blob>}
 */
export async function deleteAttachment(pdfBytes, index) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const ctx    = pdfDoc.context;

  const namesDict  = _getEmbeddedFilesNames(pdfDoc);
  if (!namesDict) return new Blob([/** @type {any} */ (data)], { type: 'application/pdf' });

  const namesArray = namesDict.get(PDFName.of('Names'));
  if (!namesArray) return new Blob([/** @type {any} */ (data)], { type: 'application/pdf' });

  const arr = ctx.lookup(namesArray);
  if (!(arr instanceof PDFArray)) return new Blob([/** @type {any} */ (data)], { type: 'application/pdf' });

  const nameIdx = index * 2;
  const specIdx = index * 2 + 1;
  if (specIdx >= arr.size()) return new Blob([/** @type {any} */ (data)], { type: 'application/pdf' });

  // Rebuild array without the removed entry
  const newItems = [];
  for (let i = 0; i < arr.size(); i++) {
    if (i === nameIdx || i === specIdx) continue;
    newItems.push(arr.get(i));
  }

  namesDict.set(PDFName.of('Names'), ctx.obj(newItems));

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// AttachmentPanel — UI
// ---------------------------------------------------------------------------

export class AttachmentPanel {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.getPdfBytes – () => Uint8Array
   * @param {Function} deps.onApply    – (blob: Blob) => void
   * @param {Function} [deps.onClose]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._items     = [];
  }

  async open() {
    const pdfBytes = this._deps.getPdfBytes();
    this._items = await listAttachments(pdfBytes);
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
  }

  close() {
    if (this._panel) { this._panel.remove(); this._panel = null; }
  }

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute', 'top:20px', 'right:20px',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:16px', 'z-index:9000', 'width:300px', 'max-height:70vh',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
      'display:flex', 'flex-direction:column',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;margin-bottom:10px';

    const title = document.createElement('h3');
    title.textContent = `Attachments (${this._items.length})`;
    title.style.cssText = 'margin:0;font-size:14px;font-weight:600;flex:1';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none;background:transparent;color:#888;font-size:16px;cursor:pointer';
    closeBtn.addEventListener('click', () => { this.close(); this._deps.onClose?.(); });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Attach File';
    addBtn.style.cssText = 'padding:5px 12px;border:1px solid #555;border-radius:3px;background:#3c3c3c;color:#ddd;font-size:12px;cursor:pointer;margin-bottom:8px;align-self:flex-start';
    addBtn.addEventListener('click', () => this._addFile());
    panel.appendChild(addBtn);

    // List
    const list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto';

    for (const item of this._items) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 8px;border-bottom:1px solid #333;display:flex;align-items:center;gap:8px';

      const name = document.createElement('span');
      name.textContent = item.name;
      name.style.cssText = 'flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      row.appendChild(name);

      const size = document.createElement('span');
      size.textContent = _formatBytes(item.size);
      size.style.cssText = 'font-size:10px;color:#888';
      row.appendChild(size);

      // Extract button
      const extractBtn = document.createElement('span');
      extractBtn.textContent = '↓';
      extractBtn.title = 'Extract';
      extractBtn.style.cssText = 'cursor:pointer;color:#569cd6;font-size:14px';
      extractBtn.addEventListener('click', () => this._extractFile(item.index));
      row.appendChild(extractBtn);

      // Delete button
      const delBtn = document.createElement('span');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'cursor:pointer;color:#888;font-size:11px';
      delBtn.addEventListener('click', () => this._deleteFile(item.index));
      row.appendChild(delBtn);

      list.appendChild(row);
    }

    if (this._items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No attachments.';
      empty.style.cssText = 'color:#888;font-size:12px;text-align:center;padding:20px';
      list.appendChild(empty);
    }

    panel.appendChild(list);
    return panel;
  }

  _addFile() {
    const input = document.createElement('input');
    input.type  = 'file';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fileData = new Uint8Array(await file.arrayBuffer());
      const pdfBytes = this._deps.getPdfBytes();
      const blob = await addAttachment(pdfBytes, file.name, fileData, file.type);
      this._deps.onApply(blob);
      this.close();
    });
    input.click();
  }

  async _extractFile(index) {
    const pdfBytes = this._deps.getPdfBytes();
    const result = await extractAttachment(pdfBytes, index);
    if (!result) return;

    const blob = new Blob([/** @type {any} */ (result.data)], { type: result.mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = result.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async _deleteFile(index) {
    const pdfBytes = this._deps.getPdfBytes();
    const blob = await deleteAttachment(pdfBytes, index);
    this._deps.onApply(blob);
    this.close();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _getEmbeddedFilesNames(pdfDoc) {
  const catalog = pdfDoc.catalog;
  const names   = catalog.get(PDFName.of('Names'));
  if (!names) return null;

  const namesObj = pdfDoc.context.lookup(names);
  if (!(namesObj instanceof PDFDict)) return null;

  const efNames = namesObj.get(PDFName.of('EmbeddedFiles'));
  if (!efNames) return null;

  return pdfDoc.context.lookup(efNames);
}

function _getOrCreateEmbeddedFilesNames(pdfDoc) {
  const ctx     = pdfDoc.context;
  const catalog = pdfDoc.catalog;

  // Ensure Names dict exists
  const namesRef = catalog.get(PDFName.of('Names'));
  let namesObj;

  if (namesRef) {
    namesObj = ctx.lookup(namesRef);
  } else {
    namesObj = ctx.obj({});
    catalog.set(PDFName.of('Names'), namesObj);
  }

  // Ensure EmbeddedFiles dict exists
  const efRef = namesObj.get(PDFName.of('EmbeddedFiles'));
  let efObj;

  if (efRef) {
    efObj = ctx.lookup(efRef);
  } else {
    efObj = ctx.obj({ Names: ctx.obj([]) });
    const ref = ctx.register(efObj);
    namesObj.set(PDFName.of('EmbeddedFiles'), ref);
  }

  return efObj;
}

function _pdfStringToJs(obj) {
  if (!obj) return '';
  if (obj instanceof PDFString) return obj.asString();
  if (obj instanceof PDFHexString) return obj.decodeText();
  return String(obj);
}

function _formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
