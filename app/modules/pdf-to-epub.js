// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF to ePub Converter
// Converts PDF documents to ePub 2.0 format with chapter detection
// ═══════════════════════════════════════════════════════════════════════

import { zipSync } from 'fflate';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEADING_FONT_RATIO = 1.3;
const MIMETYPE_CONTENT = 'application/epub+zip';
const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const STYLE_CSS = `body { font-family: serif; margin: 1em; line-height: 1.6; }
h1, h2, h3 { font-family: sans-serif; margin-top: 1.5em; }
p { margin: 0.5em 0; text-indent: 1em; }`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an XHTML chapter file.
 * @param {string} title
 * @param {string} bodyHtml
 * @returns {string}
 */
function buildChapterXhtml(title, bodyHtml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>${escapeXml(title)}</h1>
${bodyHtml}
</body>
</html>`;
}

/**
 * Escape XML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build the content.opf manifest.
 * @param {object} meta
 * @param {string} meta.title
 * @param {string} meta.author
 * @param {string} meta.language
 * @param {string} meta.uid
 * @param {{id: string, href: string, mediaType: string}[]} manifestItems
 * @param {string[]} spineIds
 * @returns {string}
 */
function buildContentOpf(meta, manifestItems, spineIds) {
  const manifestLines = manifestItems
    .map(i => `    <item id="${i.id}" href="${i.href}" media-type="${i.mediaType}"/>`)
    .join('\n');
  const spineLines = spineIds
    .map(id => `    <itemref idref="${id}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(meta.title)}</dc:title>
    <dc:creator opf:role="aut">${escapeXml(meta.author)}</dc:creator>
    <dc:language>${meta.language}</dc:language>
    <dc:identifier id="BookId">urn:uuid:${meta.uid}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
${manifestLines}
  </manifest>
  <spine toc="ncx">
${spineLines}
  </spine>
</package>`;
}

/**
 * Build the toc.ncx navigation.
 * @param {string} uid
 * @param {string} title
 * @param {{label: string, src: string}[]} navPoints
 * @returns {string}
 */
function buildTocNcx(uid, title, navPoints) {
  const points = navPoints
    .map((np, i) => `    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(np.label)}</text></navLabel>
      <content src="${np.src}"/>
    </navPoint>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${points}
  </navMap>
</ncx>`;
}

/**
 * Generate a simple UUID v4.
 * @returns {string}
 */
function generateUuid() {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return [
    hex.slice(0, 8), hex.slice(8, 12), '4' + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ---------------------------------------------------------------------------
// Text extraction via PDF.js (lazy import)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TextItem
 * @property {string} str
 * @property {number} fontSize
 */

/**
 * Extract text items with font size from a PDF.
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{pages: {items: TextItem[]}[]}>}
 */
async function extractTextFromPdf(pdfBytes) {
  const { getDocument } = await import('pdfjs-dist/build/pdf.mjs');
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await getDocument({ data: data.slice() }).promise;

  const pages = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.map(/** @param {any} item */ item => ({
      str: item.str ?? '',
      fontSize: Math.abs(item.transform?.[0] ?? 12),
    }));
    pages.push({ items });
  }

  pdfDoc.destroy();
  return { pages };
}

/**
 * Detect headings by checking if font size > average * HEADING_FONT_RATIO.
 * Split text into chapters at heading boundaries.
 * @param {{items: TextItem[]}[]} pages
 * @param {boolean} splitByHeadings
 * @returns {{title: string, content: string}[]}
 */
function buildChapters(pages, splitByHeadings) {
  // Compute average font size across all items
  let totalSize = 0;
  let count = 0;
  for (const page of pages) {
    for (const item of page.items) {
      if (item.str.trim()) {
        totalSize += item.fontSize;
        count++;
      }
    }
  }
  const avgSize = count > 0 ? totalSize / count : 12;
  const headingThreshold = avgSize * HEADING_FONT_RATIO;

  /** @type {{title: string, paragraphs: string[]}[]} */
  const chapters = [];
  let currentChapter = { title: 'Chapter 1', paragraphs: /** @type {string[]} */ ([]) };

  for (const page of pages) {
    let pageText = '';
    for (const item of page.items) {
      if (splitByHeadings && item.fontSize >= headingThreshold && item.str.trim()) {
        // Start a new chapter
        if (currentChapter.paragraphs.length > 0 || chapters.length === 0) {
          if (currentChapter.paragraphs.length > 0) {
            chapters.push(currentChapter);
          }
          currentChapter = { title: item.str.trim().slice(0, 120), paragraphs: [] };
        } else {
          currentChapter.title = item.str.trim().slice(0, 120);
        }
      } else {
        pageText += item.str;
      }
    }
    if (pageText.trim()) {
      currentChapter.paragraphs.push(pageText.trim());
    }
  }

  // Push the last chapter
  if (currentChapter.paragraphs.length > 0 || chapters.length === 0) {
    chapters.push(currentChapter);
  }

  return chapters.map(ch => ({
    title: ch.title,
    content: ch.paragraphs.map(p => `<p>${escapeXml(p)}</p>`).join('\n'),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert PDF to ePub format.
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {object} [options]
 * @param {boolean} [options.splitByHeadings]
 * @param {boolean} [options.embedImages]
 * @param {string} [options.title]
 * @param {string} [options.author]
 * @param {string} [options.language]
 * @returns {Promise<{blob: Blob, chapterCount: number}>}
 */
export async function convertPdfToEpub(pdfBytes, options = {}) {
  const {
    title = 'Untitled',
    author = 'Unknown',
    language = 'en',
    splitByHeadings = true,
  } = options;

  // 1. Extract text with font info
  const extracted = await extractTextFromPdf(pdfBytes);

  // 2. Detect headings and split into chapters
  const chapters = buildChapters(extracted.pages, splitByHeadings);

  // Ensure at least one chapter
  if (chapters.length === 0) {
    chapters.push({ title: 'Chapter 1', content: '<p></p>' });
  }

  const uid = generateUuid();
  const enc = new TextEncoder();

  // 3. Build ePub file entries
  /** @type {Record<string, Uint8Array>} */
  const files = {};

  // mimetype — must be first, stored without compression
  files['mimetype'] = enc.encode(MIMETYPE_CONTENT);

  // META-INF/container.xml
  files['META-INF/container.xml'] = enc.encode(CONTAINER_XML);

  // OEBPS/style.css
  files['OEBPS/style.css'] = enc.encode(STYLE_CSS);

  // Chapter files
  const manifestItems = [];
  const spineIds = [];
  const navPoints = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const filename = `chapter_${i + 1}.xhtml`;
    const id = `chapter${i + 1}`;
    const xhtml = buildChapterXhtml(ch.title, ch.content);

    files[`OEBPS/${filename}`] = enc.encode(xhtml);
    manifestItems.push({ id, href: filename, mediaType: 'application/xhtml+xml' });
    spineIds.push(id);
    navPoints.push({ label: ch.title, src: filename });
  }

  // OEBPS/content.opf
  const contentOpf = buildContentOpf({ title, author, language, uid }, manifestItems, spineIds);
  files['OEBPS/content.opf'] = enc.encode(contentOpf);

  // OEBPS/toc.ncx
  const tocNcx = buildTocNcx(uid, title, navPoints);
  files['OEBPS/toc.ncx'] = enc.encode(tocNcx);

  // 4. ZIP with fflate
  // mimetype must be first and stored (no compression)
  /** @type {any} */
  const zipInput = {};
  for (const [path, data] of Object.entries(files)) {
    if (path === 'mimetype') {
      zipInput[path] = [data, { level: 0 }];
    } else {
      zipInput[path] = data;
    }
  }

  const zipped = zipSync(zipInput);
  const blob = new Blob([/** @type {any} */ (zipped)], { type: 'application/epub+zip' });

  return { blob, chapterCount: chapters.length };
}

// Exported for testing
export { buildChapters, escapeXml, buildContentOpf, buildTocNcx, generateUuid };
