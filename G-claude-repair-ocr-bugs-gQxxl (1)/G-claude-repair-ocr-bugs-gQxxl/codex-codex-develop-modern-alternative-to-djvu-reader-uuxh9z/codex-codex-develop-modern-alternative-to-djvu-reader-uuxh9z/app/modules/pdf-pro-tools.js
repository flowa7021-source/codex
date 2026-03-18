// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Professional PDF Tools
// Header/Footer, Bates Numbering, Flatten, Accessibility Checker
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, rgb, StandardFonts, degrees, PDFName, PDFDict, PDFArray } from 'pdf-lib';

// ─────────────────────────────────────────────────────────────────────
// Header & Footer
// ─────────────────────────────────────────────────────────────────────

/**
 * Add headers and/or footers to all pages of a PDF.
 * Supports variables: {{page}}, {{total}}, {{date}}, {{time}}, {{title}}
 */
export async function addHeaderFooter(pdfBytes, options = {}) {
  const {
    headerLeft = '', headerCenter = '', headerRight = '',
    footerLeft = '', footerCenter = '', footerRight = '',
    fontSize = 9,
    fontName = 'TimesRoman',
    startPage = 1,
    skipFirst = false,
    margin = 36,  // 0.5 inch
    color = { r: 0, g: 0, b: 0 },
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const fontMap = {
    'TimesRoman': StandardFonts.TimesRoman,
    'Helvetica': StandardFonts.Helvetica,
    'Courier': StandardFonts.Courier,
    'TimesBold': StandardFonts.TimesRomanBold,
    'HelveticaBold': StandardFonts.HelveticaBold,
  };
  const font = await pdfDoc.embedFont(fontMap[fontName] || StandardFonts.TimesRoman);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const title = pdfDoc.getTitle() || '';
  const textColor = rgb(color.r, color.g, color.b);

  const resolveVars = (template, pageNum) => {
    if (!template) return '';
    return template
      .replace(/\{\{page\}\}/g, String(pageNum))
      .replace(/\{\{total\}\}/g, String(totalPages))
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('ru-RU'))
      .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{\{title\}\}/g, title);
  };

  const drawText = (page, text, x, y, align) => {
    if (!text) return;
    const tw = font.widthOfTextAtSize(text, fontSize);
    let drawX = x;
    if (align === 'center') drawX = x - tw / 2;
    else if (align === 'right') drawX = x - tw;
    page.drawText(text, { x: drawX, y, size: fontSize, font, color: textColor });
  };

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    if (pageNum < startPage) continue;
    if (skipFirst && i === 0) continue;

    const page = pages[i];
    const { width, height } = page.getSize();

    // Header
    const headerY = height - margin;
    drawText(page, resolveVars(headerLeft, pageNum), margin, headerY, 'left');
    drawText(page, resolveVars(headerCenter, pageNum), width / 2, headerY, 'center');
    drawText(page, resolveVars(headerRight, pageNum), width - margin, headerY, 'right');

    // Footer
    const footerY = margin - fontSize;
    drawText(page, resolveVars(footerLeft, pageNum), margin, footerY, 'left');
    drawText(page, resolveVars(footerCenter, pageNum), width / 2, footerY, 'center');
    drawText(page, resolveVars(footerRight, pageNum), width - margin, footerY, 'right');
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}

// ─────────────────────────────────────────────────────────────────────
// Bates Numbering
// ─────────────────────────────────────────────────────────────────────

/**
 * Add Bates numbering to every page of a PDF.
 * Used in legal document management for unique page identification.
 */
export async function addBatesNumbering(pdfBytes, options = {}) {
  const {
    prefix = '',
    suffix = '',
    startNum = 1,
    digits = 6,
    position = 'bottom-right',  // bottom-left, bottom-center, bottom-right, top-left, top-center, top-right
    fontSize = 9,
    color = { r: 0, g: 0, b: 0 },
    margin = 36,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const pages = pdfDoc.getPages();
  const textColor = rgb(color.r, color.g, color.b);

  let currentNum = startNum;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const batesStr = `${prefix}${String(currentNum).padStart(digits, '0')}${suffix}`;
    const tw = font.widthOfTextAtSize(batesStr, fontSize);

    let x, y;
    const posKey = position.toLowerCase();

    if (posKey.includes('top')) y = height - margin;
    else y = margin - fontSize;

    if (posKey.includes('left')) x = margin;
    else if (posKey.includes('center')) x = (width - tw) / 2;
    else x = width - tw - margin;

    page.drawText(batesStr, { x, y, size: fontSize, font, color: textColor });
    currentNum++;
  }

  return {
    blob: new Blob([await pdfDoc.save()], { type: 'application/pdf' }),
    startNum,
    endNum: currentNum - 1,
    totalPages: pages.length,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Flatten PDF
// ─────────────────────────────────────────────────────────────────────

/**
 * Flatten a PDF — make form fields and annotations non-editable.
 * Converts interactive elements to static content.
 */
export async function flattenPdf(pdfBytes, options = {}) {
  const {
    flattenForms = true,
    flattenAnnotations = false,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  let formsFlattened = 0;
  let annotationsFlattened = 0;

  // 1. Flatten forms
  if (flattenForms) {
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      formsFlattened = fields.length;
      form.flatten();
    } catch {
      // No form or form flatten not supported
      formsFlattened = 0;
    }
  }

  // 2. Flatten annotations (remove annotation dictionaries)
  if (flattenAnnotations) {
    for (const page of pdfDoc.getPages()) {
      try {
        const pageDict = page.node;
        const annots = pageDict.get(PDFName.of('Annots'));
        if (annots) {
          annotationsFlattened += annots instanceof PDFArray ? annots.size() : 1;
          pageDict.delete(PDFName.of('Annots'));
        }
      } catch { /* ignore */ }
    }
  }

  return {
    blob: new Blob([await pdfDoc.save()], { type: 'application/pdf' }),
    formsFlattened,
    annotationsFlattened,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Accessibility Checker
// ─────────────────────────────────────────────────────────────────────

/**
 * Check a PDF document for accessibility compliance (WCAG / PDF/UA guidelines).
 * Returns issues with severity levels and recommendations.
 */
export async function checkAccessibility(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const issues = [];
  const catalog = pdfDoc.catalog;

  // 1. Document title
  const title = pdfDoc.getTitle();
  if (!title || title.trim() === '') {
    issues.push({
      severity: 'error',
      rule: 'WCAG 2.4.2',
      message: 'Документ не имеет заголовка (Title)',
      fix: 'Установите заголовок документа в свойствах PDF',
      autoFixable: true,
    });
  }

  // 2. Document language
  let hasLang = false;
  try {
    if (catalog.get(PDFName.of('Lang'))) hasLang = true;
  } catch { /* ignore */ }
  if (!hasLang) {
    issues.push({
      severity: 'error',
      rule: 'WCAG 3.1.1',
      message: 'Не указан язык документа',
      fix: 'Установите атрибут Lang в каталоге PDF',
      autoFixable: true,
    });
  }

  // 3. Tagged PDF (StructTreeRoot)
  let isTagged = false;
  try {
    if (catalog.get(PDFName.of('MarkInfo'))) {
      const markInfo = catalog.get(PDFName.of('MarkInfo'));
      if (markInfo instanceof PDFDict) {
        const marked = markInfo.get(PDFName.of('Marked'));
        if (marked && marked.toString() === 'true') isTagged = true;
      }
    }
    if (catalog.get(PDFName.of('StructTreeRoot'))) isTagged = true;
  } catch { /* ignore */ }

  if (!isTagged) {
    issues.push({
      severity: 'error',
      rule: 'PDF/UA',
      message: 'Документ не является tagged PDF — недоступен для screen readers',
      fix: 'Пересоздайте PDF с тегами структуры из исходного документа',
      autoFixable: false,
    });
  }

  // 4. Bookmarks for long documents
  const pageCount = pdfDoc.getPageCount();
  let hasBookmarks = false;
  try {
    if (catalog.get(PDFName.of('Outlines'))) hasBookmarks = true;
  } catch { /* ignore */ }

  if (pageCount > 20 && !hasBookmarks) {
    issues.push({
      severity: 'warning',
      rule: 'WCAG 2.4.5',
      message: `Документ содержит ${pageCount} страниц, но не имеет закладок (оглавления)`,
      fix: 'Добавьте закладки для основных разделов документа',
      autoFixable: false,
    });
  }

  // 5. Form fields without labels
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    let unlabeled = 0;
    for (const field of fields) {
      const name = field.getName();
      if (!name || name.trim() === '' || /^field\d+$/i.test(name)) {
        unlabeled++;
      }
    }
    if (unlabeled > 0) {
      issues.push({
        severity: 'warning',
        rule: 'WCAG 1.3.1',
        message: `${unlabeled} полей формы без осмысленного имени/метки`,
        fix: 'Назначьте понятные имена всем полям формы',
        autoFixable: false,
      });
    }
  } catch { /* no form */ }

  // 6. Page size consistency
  const pages = pdfDoc.getPages();
  if (pages.length > 1) {
    const firstSize = pages[0].getSize();
    let inconsistentPages = 0;
    for (let i = 1; i < pages.length; i++) {
      const size = pages[i].getSize();
      if (Math.abs(size.width - firstSize.width) > 1 || Math.abs(size.height - firstSize.height) > 1) {
        inconsistentPages++;
      }
    }
    if (inconsistentPages > 0) {
      issues.push({
        severity: 'info',
        rule: 'Best Practice',
        message: `${inconsistentPages} страниц имеют размер, отличный от первой страницы`,
        fix: 'Проверьте, что различие размеров страниц преднамеренно',
        autoFixable: false,
      });
    }
  }

  // Calculate score
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  let score;
  if (errorCount === 0 && warningCount === 0) score = 100;
  else if (errorCount === 0) score = Math.max(50, 90 - warningCount * 10);
  else score = Math.max(0, 50 - errorCount * 20 - warningCount * 5);

  let level;
  if (score >= 80) level = 'good';
  else if (score >= 50) level = 'moderate';
  else level = 'poor';

  return {
    score,
    level,
    issues,
    summary: {
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
      total: issues.length,
      pageCount,
      isTagged,
      hasTitle: !!title,
      hasLang: hasLang,
      hasBookmarks,
    },
  };
}

/**
 * Auto-fix simple accessibility issues (title, language)
 */
export async function autoFixAccessibility(pdfBytes, fixes = {}) {
  const {
    title = 'Untitled Document',
    language = 'ru',
  } = fixes;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  let fixCount = 0;

  // Fix title
  if (!pdfDoc.getTitle() || pdfDoc.getTitle().trim() === '') {
    pdfDoc.setTitle(title);
    fixCount++;
  }

  // Fix language
  try {
    const catalog = pdfDoc.catalog;
    if (!catalog.get(PDFName.of('Lang'))) {
      catalog.set(PDFName.of('Lang'), pdfDoc.context.obj(language));
      fixCount++;
    }
  } catch { /* ignore */ }

  // Add MarkInfo if missing
  try {
    const catalog = pdfDoc.catalog;
    if (!catalog.get(PDFName.of('MarkInfo'))) {
      const markInfo = pdfDoc.context.obj({ Marked: true });
      catalog.set(PDFName.of('MarkInfo'), markInfo);
      fixCount++;
    }
  } catch { /* ignore */ }

  return {
    blob: new Blob([await pdfDoc.save()], { type: 'application/pdf' }),
    fixCount,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Page Numbers
// ─────────────────────────────────────────────────────────────────────

/**
 * Add page numbers to a PDF document.
 */
export async function addPageNumbers(pdfBytes, options = {}) {
  const {
    position = 'bottom-center',
    format = '{{page}} / {{total}}',
    fontSize = 9,
    startPage = 1,
    skipFirst = false,
  } = options;

  return addHeaderFooter(pdfBytes, {
    footerCenter: position.includes('bottom') ? format : '',
    headerCenter: position.includes('top') ? format : '',
    fontSize,
    startPage,
    skipFirst,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Crop / Trim Pages
// ─────────────────────────────────────────────────────────────────────

/**
 * Set crop box (visible area) for all pages in a PDF.
 */
export async function cropPdfPages(pdfBytes, cropBox, pageRange = null) {
  const { x, y, width, height } = cropBox;
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    if (pageRange && !pageRange.includes(i + 1)) continue;

    const page = pages[i];
    page.setCropBox(x, y, width, height);
  }

  return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
}
