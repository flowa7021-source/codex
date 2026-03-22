// @ts-check
/**
 * @module document-properties-editor
 * @description Edit PDF document metadata (properties / info dictionary).
 *
 * Supports reading and writing:
 *   • Title, Author, Subject, Keywords
 *   • Creator, Producer
 *   • Creation Date, Modification Date
 *   • Custom metadata fields
 *   • Page count, file size (read-only info)
 *
 * Usage:
 *   import { getDocumentProperties, setDocumentProperties, DocumentPropertiesPanel }
 *     from './document-properties-editor.js';
 *
 *   const props = await getDocumentProperties(pdfBytes);
 *   const blob  = await setDocumentProperties(pdfBytes, { title: 'New Title' });
 */

import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Public API — Read
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DocumentProperties
 * @property {string} title
 * @property {string} author
 * @property {string} subject
 * @property {string} keywords
 * @property {string} creator
 * @property {string} producer
 * @property {string} creationDate
 * @property {string} modificationDate
 * @property {number} pageCount
 * @property {number} fileSize       – bytes
 * @property {string} pdfVersion
 */

/**
 * Read all document properties from a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<DocumentProperties>}
 */
export async function getDocumentProperties(pdfBytes) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });

  return {
    title:            pdfDoc.getTitle()          ?? '',
    author:           pdfDoc.getAuthor()         ?? '',
    subject:          pdfDoc.getSubject()        ?? '',
    keywords:         pdfDoc.getKeywords()       ?? '',
    creator:          pdfDoc.getCreator()        ?? '',
    producer:         pdfDoc.getProducer()       ?? '',
    creationDate:     _dateToString(pdfDoc.getCreationDate()),
    modificationDate: _dateToString(pdfDoc.getModificationDate()),
    pageCount:        pdfDoc.getPageCount(),
    fileSize:         data.byteLength,
    pdfVersion:       '',   // pdf-lib doesn't expose version directly
  };
}

// ---------------------------------------------------------------------------
// Public API — Write
// ---------------------------------------------------------------------------

/**
 * Set document properties on a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Partial<DocumentProperties>} props – fields to set (omit to keep existing)
 * @returns {Promise<Blob>}
 */
export async function setDocumentProperties(pdfBytes, props) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);

  if (props.title     !== undefined) pdfDoc.setTitle(props.title);
  if (props.author    !== undefined) pdfDoc.setAuthor(props.author);
  if (props.subject   !== undefined) pdfDoc.setSubject(props.subject);
  if (props.keywords  !== undefined) pdfDoc.setKeywords(
    typeof props.keywords === 'string' ? props.keywords.split(',').map(k => k.trim()) : props.keywords,
  );
  if (props.creator   !== undefined) pdfDoc.setCreator(props.creator);
  if (props.producer  !== undefined) pdfDoc.setProducer(props.producer);

  if (props.creationDate !== undefined) {
    const d = new Date(props.creationDate);
    if (!isNaN(d.getTime())) pdfDoc.setCreationDate(d);
  }
  if (props.modificationDate !== undefined) {
    const d = new Date(props.modificationDate);
    if (!isNaN(d.getTime())) pdfDoc.setModificationDate(d);
  }

  // Always update modification date
  pdfDoc.setModificationDate(new Date());

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// DocumentPropertiesPanel — UI
// ---------------------------------------------------------------------------

export class DocumentPropertiesPanel {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.getPdfBytes – () => Uint8Array
   * @param {Function} deps.onApply    – (blob: Blob) => void
   * @param {Function} [deps.onCancel]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._props     = null;
  }

  async open() {
    const pdfBytes = this._deps.getPdfBytes();
    this._props = await getDocumentProperties(pdfBytes);
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
  }

  close() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:20px', 'z-index:9000', 'min-width:440px', 'max-height:85vh',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
      'overflow-y:auto',
    ].join(';');

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Document Properties';
    title.style.cssText = 'margin:0 0 14px;font-size:16px;font-weight:600';
    panel.appendChild(title);

    // Editable fields
    const fields = [
      { key: 'title',    label: 'Title' },
      { key: 'author',   label: 'Author' },
      { key: 'subject',  label: 'Subject' },
      { key: 'keywords', label: 'Keywords' },
      { key: 'creator',  label: 'Creator' },
      { key: 'producer', label: 'Producer' },
    ];

    const inputs = {};

    for (const f of fields) {
      const row = _row(f.label);
      const input = document.createElement('input');
      input.type  = 'text';
      input.value = this._props[f.key] ?? '';
      input.style.cssText = _inputStyle();
      row.appendChild(input);
      panel.appendChild(row);
      inputs[f.key] = input;
    }

    // Read-only info section
    panel.appendChild(_sectionSep());

    const infoItems = [
      ['Pages',        String(this._props.pageCount)],
      ['File Size',    _formatBytes(this._props.fileSize)],
      ['Created',      this._props.creationDate || '—'],
      ['Modified',     this._props.modificationDate || '—'],
    ];

    for (const [label, value] of infoItems) {
      const row = _row(label);
      const span = document.createElement('span');
      span.textContent  = value;
      span.style.cssText = 'font-size:13px;color:#aaa';
      row.appendChild(span);
      panel.appendChild(row);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:16px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = _btnStyle(false);
    cancelBtn.addEventListener('click', () => {
      this.close();
      this._deps.onCancel?.();
    });

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Save';
    applyBtn.style.cssText = _btnStyle(true);
    applyBtn.addEventListener('click', async () => {
      const newProps = {};
      for (const f of fields) {
        newProps[f.key] = inputs[f.key].value;
      }
      const pdfBytes = this._deps.getPdfBytes();
      const blob = await setDocumentProperties(pdfBytes, newProps);
      this._deps.onApply?.(blob);
      this.close();
    });

    btnRow.append(cancelBtn, applyBtn);
    panel.appendChild(btnRow);

    return panel;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _dateToString(date) {
  if (!date) return '';
  if (date instanceof Date) return date.toISOString();
  return String(date);
}

function _formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function _row(label) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
  const lbl = document.createElement('span');
  lbl.textContent  = label;
  lbl.style.cssText = 'font-size:13px;min-width:80px;color:#aaa';
  row.appendChild(lbl);
  return row;
}

function _inputStyle() {
  return 'flex:1;padding:5px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px';
}

function _sectionSep() {
  const sep = document.createElement('div');
  sep.style.cssText = 'border-top:1px solid #444;margin:14px 0 10px';
  return sep;
}

function _btnStyle(primary) {
  return primary
    ? 'padding:6px 14px;border:none;border-radius:4px;background:#0078d4;color:#fff;cursor:pointer;font-weight:600'
    : 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
}
