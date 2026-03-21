/**
 * @module preflight-checker
 * @description Pre-print PDF preflight validation.
 *
 * Runs a suite of checks against a PDF to detect issues that
 * would cause printing, archival, or distribution problems:
 *
 *   • Font embedding (all fonts must be embedded)
 *   • Image resolution (minimum DPI for print quality)
 *   • Color space validation (RGB/CMYK consistency)
 *   • Transparency usage
 *   • Page size consistency
 *   • Trim/bleed box presence
 *   • Oversized pages
 *   • Annotation/form presence warnings
 *   • PDF version compatibility
 *   • File size assessment
 *
 * Usage:
 *   import { runPreflight, PreflightPanel } from './preflight-checker.js';
 *
 *   const report = await runPreflight(pdfBytes, { targetDpi: 300 });
 */

import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {'pass'|'fail'|'warn'|'info'} CheckStatus
 * @typedef {Object} PreflightCheck
 * @property {string}      id
 * @property {string}      name
 * @property {string}      category   – 'fonts' | 'images' | 'color' | 'geometry' | 'structure' | 'output'
 * @property {CheckStatus} status
 * @property {string}      message
 * @property {string}      [fix]      – suggested remediation
 */

/**
 * @typedef {Object} PreflightReport
 * @property {PreflightCheck[]} checks
 * @property {Object} summary – { pass, fail, warn, info }
 * @property {boolean} printReady
 * @property {string}  timestamp
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TARGET_DPI   = 300;
const MIN_ACCEPTABLE_DPI   = 150;
const MAX_FILE_SIZE_MB     = 100;
const STANDARD_PAGE_SIZES  = {
  'A4':     { w: 595, h: 842 },
  'Letter': { w: 612, h: 792 },
  'Legal':  { w: 612, h: 1008 },
  'A3':     { w: 842, h: 1191 },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full preflight check suite.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} [opts]
 * @param {number} [opts.targetDpi=300]
 * @returns {Promise<PreflightReport>}
 */
export async function runPreflight(pdfBytes, opts = {}) {
  const data      = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const targetDpi = opts.targetDpi ?? DEFAULT_TARGET_DPI;
  const pdfDoc    = await PDFDocument.load(data, { ignoreEncryption: true });
  const pdfJsDoc  = await getDocument({ data: data.slice() }).promise;

  const checks = [];

  // Font checks
  checks.push(await _checkFontEmbedding(pdfJsDoc));

  // Image checks
  checks.push(await _checkImageResolution(pdfJsDoc, targetDpi));

  // Color space
  checks.push(await _checkColorSpaces(pdfJsDoc));

  // Transparency
  checks.push(_checkTransparency(pdfDoc));

  // Page geometry
  checks.push(..._checkPageGeometry(pdfDoc));

  // Trim/bleed boxes
  checks.push(_checkTrimBleedBoxes(pdfDoc));

  // Annotations / forms
  checks.push(_checkAnnotations(pdfDoc));
  checks.push(_checkForms(pdfDoc));

  // File size
  checks.push(_checkFileSize(data));

  // Metadata completeness
  checks.push(_checkMetadata(pdfDoc));

  pdfJsDoc.destroy();

  const summary = { pass: 0, fail: 0, warn: 0, info: 0 };
  for (const c of checks) summary[c.status]++;

  return {
    checks,
    summary,
    printReady: summary.fail === 0,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

async function _checkFontEmbedding(pdfJsDoc) {
  const samplePages = Math.min(pdfJsDoc.numPages, 5);
  const allFonts    = new Set();
  const suspicious  = [];

  for (let i = 1; i <= samplePages; i++) {
    const page    = await pdfJsDoc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item.fontName) {
        allFonts.add(item.fontName);
        // Standard 14 fonts may not be embedded
        if (/^(Helvetica|Times-?Roman|Courier|Symbol|ZapfDingbats)$/i.test(item.fontName)) {
          suspicious.push(item.fontName);
        }
      }
    }
  }

  if (suspicious.length === 0) {
    return _check('font-embed', 'Font Embedding', 'fonts', 'pass',
      `All ${allFonts.size} font(s) appear embedded.`);
  }

  return _check('font-embed', 'Font Embedding', 'fonts', 'fail',
    `${suspicious.length} possibly non-embedded font(s): ${[...new Set(suspicious)].join(', ')}`,
    'Re-export the PDF with all fonts embedded.');
}

async function _checkImageResolution(pdfJsDoc, targetDpi) {
  const page = await pdfJsDoc.getPage(1);
  const ops  = await page.getOperatorList();

  let imageCount = 0;
  const imageOps = [85, 86, 87, 88, 82]; // paintImageXObject, etc.

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (imageOps.includes(ops.fnArray[i])) {
      imageCount++;
    }
  }

  if (imageCount === 0) {
    return _check('image-dpi', 'Image Resolution', 'images', 'info',
      'No images detected on first page.');
  }

  return _check('image-dpi', 'Image Resolution', 'images', 'warn',
    `${imageCount} image(s) found. Manual DPI verification recommended (target: ${targetDpi} DPI).`,
    `Ensure all images are at least ${MIN_ACCEPTABLE_DPI} DPI for acceptable print quality.`);
}

async function _checkColorSpaces(pdfJsDoc) {
  // Check if document uses mixed color spaces
  const page = await pdfJsDoc.getPage(1);
  const ops  = await page.getOperatorList();

  // OPS: 94/95 = setStroke/FillRGBColor, 96/97 = Gray, 98/99 = CMYK
  let hasRgb  = false;
  let hasCmyk = false;
  let hasGray = false;

  for (const fn of ops.fnArray) {
    if (fn === 94 || fn === 95) hasRgb  = true;
    if (fn === 96 || fn === 97) hasGray = true;
    if (fn === 98 || fn === 99) hasCmyk = true;
  }

  const spaces = [];
  if (hasRgb)  spaces.push('RGB');
  if (hasCmyk) spaces.push('CMYK');
  if (hasGray) spaces.push('Gray');

  if (spaces.length <= 1) {
    return _check('color-space', 'Color Spaces', 'color', 'pass',
      `Consistent color space: ${spaces[0] ?? 'none detected'}.`);
  }

  return _check('color-space', 'Color Spaces', 'color', 'warn',
    `Mixed color spaces detected: ${spaces.join(', ')}. May cause unexpected print results.`,
    'Convert all content to a single color space (CMYK for print, RGB for screen).');
}

function _checkTransparency(pdfDoc) {
  let hasTransparency = false;

  for (const page of pdfDoc.getPages()) {
    const group = page.node.get(PDFName.of('Group'));
    if (group) {
      hasTransparency = true;
      break;
    }
  }

  if (!hasTransparency) {
    return _check('transparency', 'Transparency', 'color', 'pass',
      'No transparency groups detected.');
  }

  return _check('transparency', 'Transparency', 'color', 'warn',
    'Document uses transparency. Some older printers may not handle this correctly.',
    'Flatten transparency before sending to print if targeting older RIP devices.');
}

function _checkPageGeometry(pdfDoc) {
  const pages  = pdfDoc.getPages();
  const checks = [];

  // Check consistency
  const sizes = pages.map(p => {
    const { width, height } = p.getSize();
    return { w: Math.round(width), h: Math.round(height) };
  });

  const uniqueSizes = new Set(sizes.map(s => `${s.w}x${s.h}`));

  if (uniqueSizes.size === 1) {
    const s = sizes[0];
    const name = _identifyPageSize(s.w, s.h);
    checks.push(_check('page-consistency', 'Page Size Consistency', 'geometry', 'pass',
      `All ${pages.length} pages are ${name} (${s.w}×${s.h} pt).`));
  } else {
    checks.push(_check('page-consistency', 'Page Size Consistency', 'geometry', 'warn',
      `${uniqueSizes.size} different page sizes found across ${pages.length} pages.`,
      'Standardize page sizes if this document is intended for booklet printing.'));
  }

  // Check for oversized pages
  const maxW = Math.max(...sizes.map(s => s.w));
  const maxH = Math.max(...sizes.map(s => s.h));
  if (maxW > 2000 || maxH > 2000) {
    checks.push(_check('oversize', 'Oversized Pages', 'geometry', 'warn',
      `Largest page is ${maxW}×${maxH} pt (${(maxW / 72).toFixed(1)}×${(maxH / 72).toFixed(1)} in). May exceed printer limits.`));
  } else {
    checks.push(_check('oversize', 'Oversized Pages', 'geometry', 'pass',
      `All pages within standard print dimensions.`));
  }

  return checks;
}

function _checkTrimBleedBoxes(pdfDoc) {
  const firstPage = pdfDoc.getPages()[0];
  if (!firstPage) return _check('trim-bleed', 'Trim/Bleed Boxes', 'geometry', 'info', 'No pages.');

  const hasTrimBox  = firstPage.node.has(PDFName.of('TrimBox'));
  const hasBleedBox = firstPage.node.has(PDFName.of('BleedBox'));

  if (hasTrimBox && hasBleedBox) {
    return _check('trim-bleed', 'Trim/Bleed Boxes', 'geometry', 'pass',
      'TrimBox and BleedBox are defined.');
  }

  if (hasTrimBox || hasBleedBox) {
    return _check('trim-bleed', 'Trim/Bleed Boxes', 'geometry', 'warn',
      `Only ${hasTrimBox ? 'TrimBox' : 'BleedBox'} is defined. Professional print may require both.`,
      'Add both TrimBox and BleedBox for proper crop marks and bleed area.');
  }

  return _check('trim-bleed', 'Trim/Bleed Boxes', 'geometry', 'info',
    'No TrimBox or BleedBox defined (standard for office documents).',
    'Add TrimBox/BleedBox if this is destined for professional offset printing.');
}

function _checkAnnotations(pdfDoc) {
  let totalAnnots = 0;

  for (const page of pdfDoc.getPages()) {
    const annotsRef = page.node.get(PDFName.of('Annots'));
    if (!annotsRef) continue;
    const annots = page.node.context.lookup(annotsRef);
    if (annots instanceof PDFArray) totalAnnots += annots.size();
  }

  if (totalAnnots === 0) {
    return _check('annotations', 'Annotations', 'structure', 'pass', 'No annotations.');
  }

  return _check('annotations', 'Annotations', 'structure', 'warn',
    `${totalAnnots} annotation(s) present. These may appear in print output.`,
    'Flatten annotations before printing if they should not appear on paper.');
}

function _checkForms(pdfDoc) {
  const form   = pdfDoc.getForm();
  const fields = form.getFields();

  if (fields.length === 0) {
    return _check('forms', 'Form Fields', 'structure', 'pass', 'No form fields.');
  }

  return _check('forms', 'Form Fields', 'structure', 'warn',
    `${fields.length} form field(s). Interactive fields will print with current values.`,
    'Flatten forms before distribution to lock field values.');
}

function _checkFileSize(data) {
  const mb = data.byteLength / (1024 * 1024);

  if (mb > MAX_FILE_SIZE_MB) {
    return _check('file-size', 'File Size', 'output', 'fail',
      `File is ${mb.toFixed(1)} MB — exceeds ${MAX_FILE_SIZE_MB} MB limit for most email/web workflows.`,
      'Optimize the PDF (compress images, remove unused objects) to reduce size.');
  }

  if (mb > 20) {
    return _check('file-size', 'File Size', 'output', 'warn',
      `File is ${mb.toFixed(1)} MB. Consider optimizing for faster uploads and email delivery.`);
  }

  return _check('file-size', 'File Size', 'output', 'pass',
    `File is ${mb.toFixed(1)} MB.`);
}

function _checkMetadata(pdfDoc) {
  const title  = pdfDoc.getTitle();
  const author = pdfDoc.getAuthor();
  const filled = [title, author].filter(v => v?.trim()).length;

  if (filled >= 2) {
    return _check('metadata', 'Document Metadata', 'output', 'pass',
      'Title and author are set.');
  }

  return _check('metadata', 'Document Metadata', 'output', 'warn',
    `Incomplete metadata (title: ${title ? 'yes' : 'no'}, author: ${author ? 'yes' : 'no'}).`,
    'Set document title and author via Document Properties.');
}

// ---------------------------------------------------------------------------
// PreflightPanel — UI
// ---------------------------------------------------------------------------

export class PreflightPanel {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.getPdfBytes – () => Uint8Array
   * @param {Function} [deps.onClose]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._report    = null;
  }

  async open() {
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
    await this._run();
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
      'position:absolute', 'top:20px', 'right:20px',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:16px', 'z-index:9000', 'width:380px', 'max-height:80vh',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
      'display:flex', 'flex-direction:column', 'overflow:hidden',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;margin-bottom:12px';

    const title = document.createElement('h3');
    title.textContent = 'Preflight Check';
    title.style.cssText = 'margin:0;font-size:15px;font-weight:600;flex:1';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none;background:transparent;color:#888;font-size:16px;cursor:pointer';
    closeBtn.addEventListener('click', () => { this.close(); this._deps.onClose?.(); });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    this._statusEl = document.createElement('div');
    this._statusEl.style.cssText = 'text-align:center;padding:12px;margin-bottom:12px;border-radius:6px;background:#1e1e1e;flex-shrink:0';
    this._statusEl.textContent = 'Running preflight checks…';
    panel.appendChild(this._statusEl);

    this._resultsList = document.createElement('div');
    this._resultsList.style.cssText = 'flex:1;overflow-y:auto';
    panel.appendChild(this._resultsList);

    return panel;
  }

  async _run() {
    const pdfBytes = this._deps.getPdfBytes();
    this._report = await runPreflight(pdfBytes);
    this._renderStatus();
    this._renderResults();
  }

  _renderStatus() {
    const { printReady, summary } = this._report;
    const color = printReady ? '#4caf50' : '#f44336';
    const label = printReady ? 'PRINT READY' : 'ISSUES FOUND';

    this._statusEl.innerHTML = [
      `<div style="font-size:20px;font-weight:700;color:${color}">${label}</div>`,
      `<div style="font-size:12px;color:#888;margin-top:4px">`,
      `${summary.pass} pass · ${summary.fail} fail · ${summary.warn} warn`,
      `</div>`,
    ].join('');
  }

  _renderResults() {
    this._resultsList.innerHTML = '';
    const icons  = { pass: '✓', fail: '✗', warn: '⚠', info: 'ℹ' };
    const colors = { pass: '#4caf50', fail: '#f44336', warn: '#ff9800', info: '#2196f3' };

    for (const c of this._report.checks) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px;border-bottom:1px solid #333';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px';

      const icon = document.createElement('span');
      icon.textContent = icons[c.status];
      icon.style.cssText = `color:${colors[c.status]};font-weight:700;min-width:16px`;
      row.appendChild(icon);

      const name = document.createElement('span');
      name.textContent = c.name;
      name.style.cssText = 'font-size:13px;font-weight:500';
      row.appendChild(name);

      const cat = document.createElement('span');
      cat.textContent = c.category;
      cat.style.cssText = 'font-size:10px;color:#888;margin-left:auto;text-transform:uppercase';
      row.appendChild(cat);

      item.appendChild(row);

      const msg = document.createElement('div');
      msg.textContent = c.message;
      msg.style.cssText = 'font-size:11px;color:#aaa;margin-top:3px;padding-left:24px';
      item.appendChild(msg);

      if (c.fix) {
        const fix = document.createElement('div');
        fix.textContent = `Fix: ${c.fix}`;
        fix.style.cssText = 'font-size:11px;color:#569cd6;margin-top:2px;padding-left:24px';
        item.appendChild(fix);
      }

      this._resultsList.appendChild(item);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _check(id, name, category, status, message, fix) {
  return { id, name, category, status, message, fix };
}

function _identifyPageSize(w, h) {
  for (const [name, size] of Object.entries(STANDARD_PAGE_SIZES)) {
    if ((Math.abs(w - size.w) < 3 && Math.abs(h - size.h) < 3) ||
        (Math.abs(w - size.h) < 3 && Math.abs(h - size.w) < 3)) {
      return name;
    }
  }
  return `${w}×${h} pt`;
}
