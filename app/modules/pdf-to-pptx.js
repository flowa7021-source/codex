// @ts-check
// ─── PDF → PPTX Converter ────────────────────────────────────────────────────
// Converts PDF pages to PowerPoint slides. Each page becomes a slide with
// a background image (rendered page) and text overlay boxes.
// PPTX is a ZIP archive containing XML parts (Office Open XML PresentationML).

import { zipSync } from 'fflate';

/**
 * @typedef {Object} PptxOptions
 * @property {number} [dpi=150]       - Render resolution for page images
 * @property {boolean} [textOverlay=true] - Include text boxes on slides
 */

/**
 * @typedef {Object} PptxResult
 * @property {Blob} blob
 * @property {number} slideCount
 */

/** @type {typeof import('pdfjs-dist') | null} */
let _pdfjsLib = null;

/**
 * Lazily load PDF.js.
 * @returns {Promise<typeof import('pdfjs-dist')>}
 */
async function loadPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist');
  }
  return _pdfjsLib;
}

/** Yield to UI thread. */
const yieldToUI = () => new Promise(r => setTimeout(r, 0));

/**
 * Encode a UTF-8 string to Uint8Array.
 * @param {string} str
 * @returns {Uint8Array}
 */
function encode(str) {
  return new TextEncoder().encode(str);
}

/**
 * Escape XML special characters.
 * @param {string} text
 * @returns {string}
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert EMU (English Metric Units) — 1 inch = 914400 EMU, 1 pt = 12700 EMU.
 * PDF coordinates are in points (1/72 inch).
 * @param {number} points
 * @returns {number}
 */
function ptToEmu(points) {
  return Math.round(points * 12700);
}

/**
 * Try to render a PDF page to a PNG base64 data URL.
 * Returns null if canvas is not available (e.g. Node.js).
 * @param {any} page - PDF.js page proxy
 * @param {number} dpi
 * @returns {Promise<{dataUrl: string, width: number, height: number} | null>}
 */
async function renderPageToImage(page, dpi) {
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });

  /** @type {HTMLCanvasElement | OffscreenCanvas | null} */
  let canvas = null;

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    } else if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
    }
  } catch {
    return null;
  }

  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    return null;
  }

  // Get data URL
  if (typeof /** @type {any} */ (canvas).toDataURL === 'function') {
    return {
      dataUrl: /** @type {any} */ (canvas).toDataURL('image/png'),
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height),
    };
  }

  // OffscreenCanvas path
  if (typeof /** @type {any} */ (canvas).convertToBlob === 'function') {
    try {
      const blob = await /** @type {any} */ (canvas).convertToBlob({ type: 'image/png' });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return {
        dataUrl: 'data:image/png;base64,' + btoa(binary),
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extract base64 data from a data URL.
 * @param {string} dataUrl
 * @returns {Uint8Array}
 */
function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Build slide XML for a single slide.
 * @param {number} slideIdx - 1-based slide index
 * @param {number} widthEmu - slide width in EMU
 * @param {number} heightEmu - slide height in EMU
 * @param {boolean} hasImage - whether the slide has a background image
 * @param {Array<{text: string, x: number, y: number, width: number, height: number, fontSize: number}>} textItems
 * @returns {string}
 */
function buildSlideXml(slideIdx, widthEmu, heightEmu, hasImage, textItems) {
  let shapes = '';

  if (hasImage) {
    shapes += `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Image ${slideIdx}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId2"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
  }

  let shapeId = 3;
  for (const item of textItems) {
    const xEmu = ptToEmu(item.x);
    const yEmu = ptToEmu(item.y);
    const wEmu = Math.max(ptToEmu(item.width), 914400);
    const hEmu = Math.max(ptToEmu(item.height), 228600);
    const fsHundredths = Math.round((item.fontSize || 12) * 100);

    shapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId}" name="TextBox ${shapeId}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${xEmu}" y="${yEmu}"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" sz="${fsHundredths}" dirty="0"/><a:t>${escapeXml(item.text)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>`;
    shapeId++;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    ${shapes}
  </p:spTree></p:cSld>
</p:sld>`;
}

/**
 * Build slide relationship XML.
 * @param {boolean} hasImage
 * @returns {string}
 */
function buildSlideRelsXml(hasImage) {
  let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`;

  if (hasImage) {
    rels += `
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image{IDX}.png"/>`;
  }

  rels += `
</Relationships>`;
  return rels;
}

/**
 * Convert a PDF to PPTX format.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes - Raw PDF content
 * @param {PptxOptions} [options]
 * @returns {Promise<PptxResult>}
 */
export async function convertPdfToPptx(pdfBytes, options = {}) {
  const { dpi = 150, textOverlay = true } = options;

  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  // Standard slide dimensions (10 x 7.5 inches in EMU)
  const defaultSlideW = 9144000;
  const defaultSlideH = 6858000;

  /** @type {Record<string, Uint8Array>} */
  const zipEntries = {};

  /** @type {string[]} */
  const slideRelEntries = [];
  /** @type {string[]} */
  const slideContentTypeEntries = [];
  /** @type {string[]} */
  const imageContentTypeEntries = [];

  let slideCount = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // Scale to fit standard slide dimensions
    const pageWPt = viewport.width;
    const pageHPt = viewport.height;
    const slideWEmu = defaultSlideW;
    const slideHEmu = defaultSlideH;

    // Extract text items
    /** @type {Array<{text: string, x: number, y: number, width: number, height: number, fontSize: number}>} */
    const textItems = [];

    if (textOverlay) {
      try {
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const tx = item.transform;
          const fontSize = Math.abs(tx[3]) || 12;
          // PDF coords: origin bottom-left. Convert to top-left for slide.
          const x = tx[4];
          const y = pageHPt - tx[5] - fontSize;
          // Scale from page coords to slide EMU, then back to "points in slide space"
          const scaleX = (slideWEmu / ptToEmu(pageWPt));
          const scaleY = (slideHEmu / ptToEmu(pageHPt));
          textItems.push({
            text: item.str,
            x: x * scaleX,
            y: y * scaleY,
            width: (item.width || fontSize * item.str.length * 0.6),
            height: fontSize * 1.2,
            fontSize,
          });
        }
      } catch {
        // Text extraction failed — continue without text
      }
    }

    // Try to render page to image
    const rendered = await renderPageToImage(page, dpi);
    const hasImage = rendered !== null;

    slideCount++;
    const slideIdx = slideCount;

    // Store image
    if (hasImage && rendered) {
      const imageBytes = dataUrlToBytes(rendered.dataUrl);
      zipEntries[`ppt/media/image${slideIdx}.png`] = imageBytes;
    }

    // Build slide XML
    const slideXml = buildSlideXml(slideIdx, slideWEmu, slideHEmu, hasImage, textItems);
    zipEntries[`ppt/slides/slide${slideIdx}.xml`] = encode(slideXml);

    // Build slide rels
    let slideRels = buildSlideRelsXml(hasImage);
    slideRels = slideRels.replace('{IDX}', String(slideIdx));
    zipEntries[`ppt/slides/_rels/slide${slideIdx}.xml.rels`] = encode(slideRels);

    slideRelEntries.push(
      `<Relationship Id="rId${slideIdx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideIdx}.xml"/>`,
    );
    slideContentTypeEntries.push(
      `<Override PartName="/ppt/slides/slide${slideIdx}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    );
    if (hasImage) {
      imageContentTypeEntries.push(
        `<Override PartName="/ppt/media/image${slideIdx}.png" ContentType="image/png"/>`,
      );
    }

    page.cleanup();
    if (pageNum % 5 === 0) await yieldToUI();
  }

  // ─── Build supporting XML ──────────────────────────────────────────────

  // [Content_Types].xml
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  ${slideContentTypeEntries.join('\n  ')}
  ${imageContentTypeEntries.join('\n  ')}
</Types>`;
  zipEntries['[Content_Types].xml'] = encode(contentTypes);

  // _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  zipEntries['_rels/.rels'] = encode(rootRels);

  // ppt/presentation.xml
  const slideListXml = Array.from({ length: slideCount }, (_, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`,
  ).join('\n    ');

  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideListXml}
  </p:sldIdLst>
  <p:sldSz cx="${defaultSlideW}" cy="${defaultSlideH}"/>
  <p:notesSz cx="${defaultSlideH}" cy="${defaultSlideW}"/>
</p:presentation>`;
  zipEntries['ppt/presentation.xml'] = encode(presentation);

  // ppt/_rels/presentation.xml.rels
  const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRelEntries.join('\n  ')}
</Relationships>`;
  zipEntries['ppt/_rels/presentation.xml.rels'] = encode(presRels);

  // Slide layout
  const slideLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="blank">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
</p:sldLayout>`;
  zipEntries['ppt/slideLayouts/slideLayout1.xml'] = encode(slideLayout);

  // Slide layout rels
  const slideLayoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  zipEntries['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = encode(slideLayoutRels);

  // Slide master
  const slideMaster = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
  zipEntries['ppt/slideMasters/slideMaster1.xml'] = encode(slideMaster);

  // Slide master rels
  const slideMasterRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  zipEntries['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = encode(slideMasterRels);

  // ─── ZIP it up ─────────────────────────────────────────────────────────
  const zipped = zipSync(zipEntries);
  const blob = new Blob([/** @type {any} */ (zipped)], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  return { blob, slideCount };
}
