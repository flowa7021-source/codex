// @ts-check
/**
 * @module pdf-security
 * @description PDF Security — Phase 1.
 *
 * Real AES-256 encryption and full ISO 32000 permission flags via pdf-lib.
 * Replaces the previous XOR-obfuscation placeholder.
 *
 * Permission flag constants follow ISO 32000-1:2008 Table 22.
 *
 * Public API:
 *   setPassword(pdfBytes, ownerPassword, userPassword, permissions)
 *   getSecurityInfo(pdfBytes)
 *   cleanMetadata(pdfBytes, options)
 *   sanitizePdf(pdfBytes)
 *   PermissionEnforcer               – class
 */

import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Permission type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PermissionFlags
 * @property {boolean} printing          - Allow any printing
 * @property {boolean} printHighQuality  - Allow high-quality printing
 * @property {boolean} modifying         - Allow document modification
 * @property {boolean} copying           - Allow text/graphic copying
 * @property {boolean} annotating        - Allow adding/modifying annotations
 * @property {boolean} fillingForms      - Allow filling form fields
 * @property {boolean} contentAccess     - Allow text extraction (accessibility)
 * @property {boolean} assembling        - Allow page insert/delete/rotate/bookmark
 */

/** Default permissions for a new protected document. */
export const DEFAULT_PERMISSIONS = {
  printing: true,
  printHighQuality: true,
  modifying: false,
  copying: true,
  annotating: true,
  fillingForms: true,
  contentAccess: true,
  assembling: false,
};

/** Fully locked-down permissions. */
export const LOCKED_PERMISSIONS = {
  printing: false,
  printHighQuality: false,
  modifying: false,
  copying: false,
  annotating: false,
  fillingForms: false,
  contentAccess: false,
  assembling: false,
};

// ---------------------------------------------------------------------------
// setPassword — real AES-256 encryption via pdf-lib
// ---------------------------------------------------------------------------

/**
 * Encrypt a PDF with AES-256 and set granular permission flags.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} ownerPassword   Required. Used to remove protection later.
 * @param {string} [userPassword='']  Empty string = anyone can open the file.
 * @param {Partial<PermissionFlags>} [permissions=DEFAULT_PERMISSIONS]
 * @returns {Promise<{blob: Blob, info: {passwordSet: boolean, permissions: PermissionFlags}}>}
 */
export async function setPassword(pdfBytes, ownerPassword, userPassword = '', permissions = {}) {
  if (!ownerPassword) throw new Error('[pdf-security] ownerPassword is required');

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const perms = { ...DEFAULT_PERMISSIONS, ...permissions };

  // Map NovaReader PermissionFlags → pdf-lib encrypt options
  await /** @type {any} */ (pdfDoc).encrypt({
    ownerPassword,
    userPassword,
    permissions: {
      printing: perms.printing
        ? (perms.printHighQuality ? 'highResolution' : 'lowResolution')
        : false,
      modifying: perms.modifying,
      copying: perms.copying,
      annotating: perms.annotating,
      fillingForms: perms.fillingForms,
      contentAccessibility: perms.contentAccess,
      documentAssembly: perms.assembling,
    },
  });

  pdfDoc.setProducer('NovaReader Security Module');
  const saved = await pdfDoc.save();

  return {
    blob: new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' }),
    info: { passwordSet: true, permissions: perms },
  };
}

// ---------------------------------------------------------------------------
// getSecurityInfo
// ---------------------------------------------------------------------------

/**
 * Read security metadata from a PDF without requiring a password.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{
 *   title: string,
 *   author: string,
 *   subject: string,
 *   creator: string,
 *   producer: string,
 *   pageCount: number,
 *   isEncrypted: boolean,
 *   permissions: PermissionFlags|null
 * }>}
 */
export async function getSecurityInfo(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const info = {
    title: pdfDoc.getTitle() || '',
    author: pdfDoc.getAuthor() || '',
    subject: pdfDoc.getSubject() || '',
    creator: pdfDoc.getCreator() || '',
    producer: pdfDoc.getProducer() || '',
    pageCount: pdfDoc.getPageCount(),
    isEncrypted: false,
    permissions: null,
  };

  // Detect encryption dict in trailer
  try {
    if (pdfDoc.context.trailerInfo.Encrypt) {
      info.isEncrypted = true;

      // Read P (permissions integer) from the Encrypt dict
      const encryptRef = pdfDoc.context.trailerInfo.Encrypt;
      const encryptDict = pdfDoc.context.lookup(encryptRef);
      if (encryptDict instanceof PDFDict) {
        const pObj = encryptDict.get(PDFName.of('P'));
        if (pObj) {
          const p = _pdfIntValue(pObj);
          info.permissions = _decodePermissionInt(p);
        }
      }
    }
  } catch (err) {
    console.warn('[pdf-security] encryption check:', err?.message);
  }

  return info;
}

// ---------------------------------------------------------------------------
// cleanMetadata
// ---------------------------------------------------------------------------

/**
 * Strip personally-identifying metadata from a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {{keepTitle?: boolean}} [options]
 * @returns {Promise<{blob: Blob, removed: string[]}>}
 */
export async function cleanMetadata(pdfBytes, options = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const removed = [];

  if (!options.keepTitle && pdfDoc.getTitle()) {
    pdfDoc.setTitle('');
    removed.push('title');
  }
  if (pdfDoc.getAuthor()) { pdfDoc.setAuthor(''); removed.push('author'); }
  if (pdfDoc.getSubject()) { pdfDoc.setSubject(''); removed.push('subject'); }
  if (pdfDoc.getKeywords()) { pdfDoc.setKeywords([]); removed.push('keywords'); }
  if (pdfDoc.getCreator()) { pdfDoc.setCreator(''); removed.push('creator'); }
  if (pdfDoc.getProducer()) { pdfDoc.setProducer(''); removed.push('producer'); }

  try {
    const infoRef = pdfDoc.context.trailerInfo.Info;
    if (infoRef) {
      const info = pdfDoc.context.lookup(infoRef);
      if (info instanceof PDFDict) {
        info.delete(PDFName.of('CreationDate'));
        info.delete(PDFName.of('ModDate'));
        removed.push('creationDate', 'modDate');
      }
    }
  } catch (err) {
    console.warn('[pdf-security] metadata date removal:', err?.message);
  }

  pdfDoc.setProducer('NovaReader');
  const saved = await pdfDoc.save();
  return { blob: new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' }), removed };
}

// ---------------------------------------------------------------------------
// sanitizePdf
// ---------------------------------------------------------------------------

/**
 * Remove JavaScript, embedded files, and auto-submit form actions.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{blob: Blob, sanitized: string[]}>}
 */
export async function sanitizePdf(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const sanitized = [];

  try {
    const catalog = pdfDoc.catalog;
    for (const key of ['JavaScript', 'JS', 'OpenAction']) {
      if (catalog.get(PDFName.of(key))) {
        catalog.delete(PDFName.of(key));
        sanitized.push(key);
      }
    }
    const namesRef = catalog.get(PDFName.of('Names'));
    if (namesRef) {
      const names = pdfDoc.context.lookup(namesRef);
      if (names instanceof PDFDict && names.get(PDFName.of('EmbeddedFiles'))) {
        names.delete(PDFName.of('EmbeddedFiles'));
        sanitized.push('embeddedFiles');
      }
    }
  } catch (err) {
    console.error('[pdf-security] catalog sanitize failed:', err);
  }

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    try {
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) continue;
      const annotsArray = pdfDoc.context.lookup(annotsRef);
      if (!(annotsArray instanceof PDFArray)) continue;

      for (let i = 0; i < annotsArray.size(); i++) {
        const annot = pdfDoc.context.lookup(annotsArray.get(i));
        if (!(annot instanceof PDFDict)) continue;
        const actionRef = annot.get(PDFName.of('A'));
        if (!actionRef) continue;
        const action = pdfDoc.context.lookup(actionRef);
        if (!(action instanceof PDFDict)) continue;
        const s = action.get(PDFName.of('S'));
        if (s && ['JavaScript', 'SubmitForm', 'Launch'].some(t => s.toString().includes(t))) {
          annot.delete(PDFName.of('A'));
          sanitized.push('formAction');
        }
      }
    } catch (err) {
      console.error('[pdf-security] annotation sanitize failed:', err);
    }
  }

  const saved = await pdfDoc.save();
  return { blob: new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' }), sanitized: [...new Set(sanitized)] };
}

// ---------------------------------------------------------------------------
// PermissionEnforcer
// ---------------------------------------------------------------------------

/**
 * Reads PDF permission flags and enforces them in the NovaReader UI.
 *
 * Usage:
 *   const enforcer = new PermissionEnforcer(securityInfo);
 *   enforcer.enforceUI(toolbarController);
 *
 * `securityInfo` is the object returned by `getSecurityInfo()`.
 */
export class PermissionEnforcer {
  /**
   * @param {{isEncrypted: boolean, permissions: PermissionFlags|null}} securityInfo
   */
  constructor(securityInfo) {
    this.isEncrypted = securityInfo.isEncrypted;

    if (!securityInfo.isEncrypted || !securityInfo.permissions) {
      // Unprotected document: all permissions granted
      this.permissions = {
        printing: true,
        printHighQuality: true,
        modifying: true,
        copying: true,
        annotating: true,
        fillingForms: true,
        contentAccess: true,
        assembling: true,
      };
    } else {
      this.permissions = securityInfo.permissions;
    }
  }

  canEdit()         { return this.permissions.modifying; }
  canCopy()         { return this.permissions.copying; }
  canPrint()        { return this.permissions.printing; }
  canPrintHQ()      { return this.permissions.printHighQuality; }
  canAnnotate()     { return this.permissions.annotating; }
  canFillForms()    { return this.permissions.fillingForms; }
  canAssemble()     { return this.permissions.assembling; }
  canAccessContent(){ return this.permissions.contentAccess; }

  /**
   * Disable toolbar buttons based on the permissions read from the PDF.
   *
   * @param {{disable: (toolId: string) => void, showNotice: (msg: string) => void}} toolbar
   */
  enforceUI(toolbar) {
    if (!this.canEdit()) {
      for (const id of ['editText', 'erase', 'addText', 'addImage', 'redact',
                         'watermark', 'headerFooter', 'batesNumber']) {
        toolbar.disable(id);
      }
      toolbar.showNotice('Документ защищён от редактирования');
    }

    if (!this.canCopy()) {
      for (const id of ['copyText', 'selectText', 'exportText']) {
        toolbar.disable(id);
      }
    }

    if (!this.canAnnotate()) {
      for (const id of ['annotate', 'highlight', 'comment', 'stamp']) {
        toolbar.disable(id);
      }
    }

    if (!this.canPrint()) {
      toolbar.disable('print');
    }

    if (!this.canAssemble()) {
      for (const id of ['pageOrganizer', 'insertPages', 'deletePages', 'extractPages']) {
        toolbar.disable(id);
      }
    }

    if (!this.canFillForms()) {
      toolbar.disable('fillForms');
    }
  }

  /**
   * Throw if the given operation is not permitted.  Useful for programmatic
   * guards in tool implementations.
   * @param {'edit'|'copy'|'print'|'annotate'|'fillForms'|'assemble'} op
   * @throws {Error}
   */
  assertAllowed(op) {
    const allowed = {
      edit: this.canEdit(),
      copy: this.canCopy(),
      print: this.canPrint(),
      annotate: this.canAnnotate(),
      fillForms: this.canFillForms(),
      assemble: this.canAssemble(),
    };
    if (!allowed[op]) {
      throw new Error(`[pdf-security] operation "${op}" is not permitted by this document's permissions`);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Decode PDF permission integer (ISO 32000-1:2008 §7.6.3.3, Table 22)
 * into a PermissionFlags object.
 *
 * Bit numbering is 1-based as in the PDF spec:
 *   Bit 3  (0x004)  = printing allowed
 *   Bit 4  (0x008)  = modifying allowed
 *   Bit 5  (0x010)  = copying allowed
 *   Bit 6  (0x020)  = annotating allowed
 *   Bit 9  (0x100)  = filling forms
 *   Bit 10 (0x200)  = content accessibility
 *   Bit 11 (0x400)  = assembling
 *   Bit 12 (0x800)  = high-quality printing
 *
 * @param {number} p  The raw P integer (may be negative in PDF files)
 * @returns {PermissionFlags}
 */
function _decodePermissionInt(p) {
  // PDF stores P as a signed 32-bit integer; convert to unsigned
  const u = p >>> 0;
  return {
    printing:         !!(u & 0x004),
    modifying:        !!(u & 0x008),
    copying:          !!(u & 0x010),
    annotating:       !!(u & 0x020),
    fillingForms:     !!(u & 0x100),
    contentAccess:    !!(u & 0x200),
    assembling:       !!(u & 0x400),
    printHighQuality: !!(u & 0x800),
  };
}

/** Extract integer value from a pdf-lib PDFNumber or PDFRawStream. */
function _pdfIntValue(obj) {
  if (obj && typeof obj.value === 'function') return obj.value();
  if (obj && typeof obj.numberValue === 'number') return obj.numberValue;
  const str = obj ? obj.toString() : '';
  return parseInt(str, 10) || 0;
}
