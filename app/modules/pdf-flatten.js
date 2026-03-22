// @ts-check
/**
 * @module pdf-flatten
 * @description Flatten PDF annotations and form fields.
 *
 * Flattening converts interactive elements (form fields, annotations,
 * comments) into static page content. The visual appearance is preserved
 * but the elements can no longer be edited.
 *
 * Use cases:
 *   • Locking a filled form before distribution
 *   • Removing editable annotations for archival
 *   • Reducing file complexity before printing
 *   • Creating a "final" version of an annotated document
 *
 * Usage:
 *   import { flattenForms, flattenAnnotations, flattenAll } from './pdf-flatten.js';
 *
 *   const blob = await flattenForms(pdfBytes);
 *   const blob2 = await flattenAnnotations(pdfBytes);
 *   const blob3 = await flattenAll(pdfBytes);
 */

import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Flatten all form fields — their visual appearance is baked into the page
 * content and the interactive field objects are removed.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} [opts]
 * @param {number[]} [opts.pages] - 1-based page numbers (default: all)
 * @returns {Promise<Blob>}
 */
export async function flattenForms(pdfBytes, opts = {}) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const form   = pdfDoc.getForm();

  const fields = form.getFields();
  if (fields.length === 0) {
    const saved = await pdfDoc.save();
    return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
  }

  const pageSet = _pageSet(pdfDoc, opts.pages);

  // Flatten each field
  for (const field of fields) {
    try {
      const widgets = field.acroField.getWidgets();

      for (const widget of widgets) {
        const pageRef = widget.P();
        if (pageRef && pageSet) {
          const pageIdx = _pageIndexFromRef(pdfDoc, pageRef);
          if (pageIdx !== -1 && !pageSet.has(pageIdx)) continue;
        }

        // Merge the widget's appearance stream into the page content
        _flattenWidget(pdfDoc, widget);
      }
    } catch (_e) {
      // Skip fields that can't be flattened (e.g., signature fields)
    }
  }

  // Remove the AcroForm dictionary to remove all fields
  if (!opts.pages) {
    pdfDoc.catalog.delete(PDFName.of('AcroForm'));
  }

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

/**
 * Flatten all annotations (comments, stamps, highlights, etc.).
 * Their appearance streams are merged into the page, then the annotation
 * objects are removed.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} [opts]
 * @param {number[]}  [opts.pages]
 * @param {string[]}  [opts.types]       - annotation subtypes to flatten (default: all)
 * @param {boolean}   [opts.keepLinks=true] - preserve Link annotations
 * @returns {Promise<Blob>}
 */
export async function flattenAnnotations(pdfBytes, opts = {}) {
  const data      = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc    = await PDFDocument.load(data);
  const keepLinks = opts.keepLinks !== false;
  const typeFilter = opts.types ? new Set(opts.types.map(t => t.toLowerCase())) : null;
  const pages     = _resolvePages(pdfDoc, opts.pages);

  for (const page of pages) {
    const annotsRef = page.node.get(PDFName.of('Annots'));
    if (!annotsRef) continue;

    const annots = page.node.context.lookup(annotsRef);
    if (!(annots instanceof PDFArray)) continue;

    const kept = [];

    for (let i = 0; i < annots.size(); i++) {
      const annotRef  = annots.get(i);
      const annotDict = page.node.context.lookup(annotRef);
      if (!annotDict) { kept.push(annotRef); continue; }

      const subtype = /** @type {any} */ (annotDict).get(PDFName.of('Subtype'));
      const subtypeName = subtype ? String(subtype).replace('/', '').toLowerCase() : '';

      // Keep links if requested
      if (keepLinks && subtypeName === 'link') {
        kept.push(annotRef);
        continue;
      }

      // Filter by type
      if (typeFilter && !typeFilter.has(subtypeName)) {
        kept.push(annotRef);
        continue;
      }

      // Flatten: merge appearance stream into page
      _flattenAnnotation(pdfDoc, page, annotDict);
    }

    // Replace the Annots array with only kept annotations
    if (kept.length === 0) {
      page.node.delete(PDFName.of('Annots'));
    } else {
      page.node.set(PDFName.of('Annots'), pdfDoc.context.obj(kept));
    }
  }

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

/**
 * Flatten everything: form fields + annotations.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} [opts]
 * @param {number[]} [opts.pages]
 * @returns {Promise<Blob>}
 */
export async function flattenAll(pdfBytes, opts = {}) {
  // Flatten forms first, then annotations
  const formBlob = await flattenForms(pdfBytes, opts);
  const formBytes = new Uint8Array(await formBlob.arrayBuffer());
  return flattenAnnotations(formBytes, opts);
}

/**
 * Get a summary of what would be flattened.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{ formFields: number, annotations: Object<string,number>, total: number }>}
 */
export async function getFlattenSummary(pdfBytes) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);

  // Count form fields
  const form       = pdfDoc.getForm();
  const formFields = form.getFields().length;

  // Count annotations by type
  const annotCounts = {};
  let totalAnnots   = 0;

  for (const page of pdfDoc.getPages()) {
    const annotsRef = page.node.get(PDFName.of('Annots'));
    if (!annotsRef) continue;

    const annots = page.node.context.lookup(annotsRef);
    if (!(annots instanceof PDFArray)) continue;

    for (let i = 0; i < annots.size(); i++) {
      const annotRef  = annots.get(i);
      const annotDict = page.node.context.lookup(annotRef);
      if (!annotDict) continue;

      const subtype = /** @type {any} */ (annotDict).get(PDFName.of('Subtype'));
      const name    = subtype ? String(subtype).replace('/', '') : 'Unknown';

      annotCounts[name] = (annotCounts[name] || 0) + 1;
      totalAnnots++;
    }
  }

  return {
    formFields,
    annotations: /** @type {any} */ (annotCounts),
    total: formFields + totalAnnots,
  };
}

// ---------------------------------------------------------------------------
// Internal: widget/annotation flattening
// ---------------------------------------------------------------------------

function _flattenWidget(pdfDoc, widget) {
  // Get the normal appearance stream
  const ap = widget.dict.get(PDFName.of('AP'));
  if (!ap) return;

  const apDict = pdfDoc.context.lookup(ap);
  if (!apDict) return;

  const normalAp = apDict.get(PDFName.of('N'));
  if (!normalAp) return;

  // Get the widget's rectangle
  const rect = widget.getRectangle();
  if (!rect) return;

  // Find the page this widget belongs to
  const pageRef = widget.P();
  if (!pageRef) return;

  const page = _pageFromRef(pdfDoc, pageRef);
  if (!page) return;

  // Draw the appearance stream as a form XObject on the page
  _drawAppearanceOnPage(pdfDoc, page, normalAp, rect);
}

function _flattenAnnotation(pdfDoc, page, annotDict) {
  const ap = annotDict.get(PDFName.of('AP'));
  if (!ap) return;

  const apDict = pdfDoc.context.lookup(ap);
  if (!apDict) return;

  const normalAp = apDict.get(PDFName.of('N'));
  if (!normalAp) return;

  const rectArr = annotDict.get(PDFName.of('Rect'));
  if (!rectArr) return;

  const rectArray = pdfDoc.context.lookup(rectArr);
  if (!rectArray || !(rectArray instanceof PDFArray)) return;

  const rect = {
    x:      Number(rectArray.get(0)) || 0,
    y:      Number(rectArray.get(1)) || 0,
    width:  (Number(rectArray.get(2)) || 0) - (Number(rectArray.get(0)) || 0),
    height: (Number(rectArray.get(3)) || 0) - (Number(rectArray.get(1)) || 0),
  };

  _drawAppearanceOnPage(pdfDoc, page, normalAp, rect);
}

function _drawAppearanceOnPage(pdfDoc, page, apStreamRef, rect) {
  // Register the appearance stream as a form XObject
  const xObjName = `FlatXObj_${_uid()}`;

  // Add to page's Resources/XObject dict
  const resources = page.node.get(PDFName.of('Resources'));
  const resDict   = resources ? pdfDoc.context.lookup(resources) : null;

  if (resDict) {
    let xObjDict = resDict.get(PDFName.of('XObject'));
    if (!xObjDict) {
      xObjDict = pdfDoc.context.obj({});
      resDict.set(PDFName.of('XObject'), xObjDict);
    }
    const xObj = pdfDoc.context.lookup(xObjDict);
    if (xObj) {
      xObj.set(PDFName.of(xObjName), apStreamRef);
    }
  }

  // Append drawing commands to the page's content stream
  // q (save state) → cm (transform to rect position) → /Name Do (draw XObject) → Q (restore)
  const ops = [
    'q',
    `${rect.width} 0 0 ${rect.height} ${rect.x} ${rect.y} cm`,
    `/${xObjName} Do`,
    'Q',
  ].join('\n');

  // Append to existing content stream
  const existingContents = page.node.get(PDFName.of('Contents'));
  const newStream = pdfDoc.context.flateStream(ops);
  const newRef    = pdfDoc.context.register(newStream);

  if (existingContents) {
    const existing = pdfDoc.context.lookup(existingContents);
    if (existing instanceof PDFArray) {
      existing.push(newRef);
    } else {
      // Single stream → wrap in array
      page.node.set(PDFName.of('Contents'), pdfDoc.context.obj([existingContents, newRef]));
    }
  } else {
    page.node.set(PDFName.of('Contents'), newRef);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _resolvePages(pdfDoc, pageNums) {
  const all = pdfDoc.getPages();
  if (!pageNums) return all;
  return pageNums.filter(n => n >= 1 && n <= all.length).map(n => all[n - 1]);
}

function _pageSet(pdfDoc, pageNums) {
  if (!pageNums) return null;
  const set = new Set();
  for (const n of pageNums) {
    if (n >= 1 && n <= pdfDoc.getPageCount()) set.add(n - 1);
  }
  return set;
}

function _pageIndexFromRef(pdfDoc, pageRef) {
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].ref === pageRef) return i;
  }
  return -1;
}

function _pageFromRef(pdfDoc, pageRef) {
  const idx = _pageIndexFromRef(pdfDoc, pageRef);
  return idx >= 0 ? pdfDoc.getPages()[idx] : null;
}

let _counter = 0;
function _uid() {
  return `${Date.now().toString(36)}_${(++_counter).toString(36)}`;
}
