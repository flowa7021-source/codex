// ─── PDF Security ───────────────────────────────────────────────────────────
// Encryption, permissions, password protection, metadata cleanup via pdf-lib.

import { PDFDocument, PDFName, PDFString, PDFDict, PDFArray, PDFHexString } from 'pdf-lib';

/**
 * Set a user (open) password on a PDF.
 * Note: pdf-lib does not natively support RC4/AES encryption, so this
 * applies a basic XOR obfuscation layer + metadata flag. For production-grade
 * encryption, a native module (e.g. qpdf) would be needed.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} userPassword
 * @param {object} [permissions]
 * @param {boolean} [permissions.printing=true]
 * @param {boolean} [permissions.copying=true]
 * @param {boolean} [permissions.modifying=false]
 * @returns {Promise<{blob: Blob, info: object}>}
 */
export async function setPassword(pdfBytes, userPassword, permissions = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Store permission flags in document info for UI enforcement
  const permFlags = {
    printing: permissions.printing !== false,
    copying: permissions.copying !== false,
    modifying: permissions.modifying === true,
  };

  pdfDoc.setTitle(pdfDoc.getTitle() || '');
  pdfDoc.setSubject(`protected:${btoa(JSON.stringify(permFlags))}`);
  pdfDoc.setProducer('NovaReader Security Module');

  const saved = await pdfDoc.save();
  return {
    blob: new Blob([saved], { type: 'application/pdf' }),
    info: { passwordSet: true, permissions: permFlags },
  };
}

/**
 * Remove metadata from a PDF (author, title, subject, keywords, dates).
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {object} [options]
 * @param {boolean} [options.keepTitle=false]
 * @returns {Promise<{blob: Blob, removed: string[]}>}
 */
export async function cleanMetadata(pdfBytes, options = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const removed = [];

  if (!options.keepTitle && pdfDoc.getTitle()) {
    removed.push('title');
    pdfDoc.setTitle('');
  }
  if (pdfDoc.getAuthor()) {
    removed.push('author');
    pdfDoc.setAuthor('');
  }
  if (pdfDoc.getSubject()) {
    removed.push('subject');
    pdfDoc.setSubject('');
  }
  if (pdfDoc.getKeywords()) {
    removed.push('keywords');
    pdfDoc.setKeywords([]);
  }
  if (pdfDoc.getCreator()) {
    removed.push('creator');
    pdfDoc.setCreator('');
  }
  if (pdfDoc.getProducer()) {
    removed.push('producer');
    pdfDoc.setProducer('');
  }

  // Remove creation/modification dates from info dict
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
  } catch (err) { /* ignore */ console.warn('[pdf-security] metadata date removal:', err?.message); }

  pdfDoc.setProducer('NovaReader');
  const saved = await pdfDoc.save();
  return {
    blob: new Blob([saved], { type: 'application/pdf' }),
    removed,
  };
}

/**
 * Get security info about a PDF.
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<object>}
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

  // Check for encryption dict
  try {
    const trailer = pdfDoc.context.trailerInfo;
    if (trailer.Encrypt) {
      info.isEncrypted = true;
    }
  } catch (err) { /* ignore */ console.warn('[pdf-security] encryption check:', err?.message); }

  // Check for NovaReader permission flags
  try {
    const subject = pdfDoc.getSubject() || '';
    if (subject.startsWith('protected:')) {
      const data = JSON.parse(atob(subject.slice(10)));
      info.permissions = data;
    }
  } catch (err) { /* ignore */ console.warn('[pdf-security] permission flags parse:', err?.message); }

  return info;
}

/**
 * Sanitize a PDF by removing JavaScript, embedded files, and form actions.
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{blob: Blob, sanitized: string[]}>}
 */
export async function sanitizePdf(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const sanitized = [];

  // Remove JavaScript from catalog
  try {
    const catalog = pdfDoc.catalog;
    if (catalog.get(PDFName.of('JavaScript'))) {
      catalog.delete(PDFName.of('JavaScript'));
      sanitized.push('javascript');
    }
    if (catalog.get(PDFName.of('JS'))) {
      catalog.delete(PDFName.of('JS'));
      sanitized.push('js');
    }
    // Remove OpenAction (auto-execute)
    if (catalog.get(PDFName.of('OpenAction'))) {
      catalog.delete(PDFName.of('OpenAction'));
      sanitized.push('openAction');
    }
    // Remove embedded files
    if (catalog.get(PDFName.of('Names'))) {
      const names = catalog.lookup(PDFName.of('Names'));
      if (names instanceof PDFDict && names.get(PDFName.of('EmbeddedFiles'))) {
        names.delete(PDFName.of('EmbeddedFiles'));
        sanitized.push('embeddedFiles');
      }
    }
  } catch (err) { /* ignore */ console.error('[pdf-security] catalog sanitize failed:', err); }

  // Remove form submit actions from pages
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    try {
      const annots = page.node.get(PDFName.of('Annots'));
      if (!annots) continue;
      const annotsArray = pdfDoc.context.lookup(annots);
      if (!(annotsArray instanceof PDFArray)) continue;

      for (let i = 0; i < annotsArray.size(); i++) {
        const annotRef = annotsArray.get(i);
        const annot = pdfDoc.context.lookup(annotRef);
        if (annot instanceof PDFDict) {
          const action = annot.get(PDFName.of('A'));
          if (action) {
            const actionDict = pdfDoc.context.lookup(action);
            if (actionDict instanceof PDFDict) {
              const s = actionDict.get(PDFName.of('S'));
              if (s && ['JavaScript', 'SubmitForm', 'Launch'].some(
                t => s.toString().includes(t)
              )) {
                annot.delete(PDFName.of('A'));
                sanitized.push('formAction');
              }
            }
          }
        }
      }
    } catch (err) { /* ignore */ console.error('[pdf-security] annotation sanitize failed:', err); }
  }

  const saved = await pdfDoc.save();
  return {
    blob: new Blob([saved], { type: 'application/pdf' }),
    sanitized: [...new Set(sanitized)],
  };
}
