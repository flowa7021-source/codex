// ─── Export Controller ──────────────────────────────────────────────────────
// DOCX generation, page edits, OCR export, DOCX import, and session health.
// Extracted from app.js as part of module decomposition.

import { state, els } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { getSessionHealth, getRecentErrors } from './crash-telemetry.js';
import { getPerfSummary } from './perf.js';
import { getTesseractStatus } from './tesseract-adapter.js';
import { getSupportedLanguages, getLanguageName } from './ocr-languages.js';
import { APP_VERSION } from './constants.js';
import { loadOcrTextData, saveOcrTextData } from './workspace-controller.js';

// ─── PDF Edit State (module-local) ─────────────────────────────────────────
export const pdfEditState = {
  edits: new Map(),
  undoStack: [],
  redoStack: [],
  maxHistory: 100,
  dirty: false,
};

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  setOcrStatus: () => {},
  getCachedPage: () => null,
  getOcrLang: () => 'rus',
  _ocrWordCache: new Map(),
};

/**
 * Inject runtime dependencies that live in app.js.
 * Must be called once during startup before any export functions are used.
 */
export function initExportControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Page Edit Functions ────────────────────────────────────────────────────

export function getPageEdits(pageNum) {
  return pdfEditState.edits.get(pageNum) || '';
}

export function setPageEdits(pageNum, text) {
  const oldText = pdfEditState.edits.get(pageNum) || '';
  if (oldText === text) return;

  pdfEditState.undoStack.push({ page: pageNum, text: oldText, ts: Date.now() });
  if (pdfEditState.undoStack.length > pdfEditState.maxHistory) {
    pdfEditState.undoStack.shift();
  }
  pdfEditState.redoStack = [];

  pdfEditState.edits.set(pageNum, text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.change', { page: pageNum, length: text.length });
}

export function undoPageEdit() {
  if (!pdfEditState.undoStack.length) return null;
  const action = pdfEditState.undoStack.pop();
  const currentText = pdfEditState.edits.get(action.page) || '';
  pdfEditState.redoStack.push({ page: action.page, text: currentText, ts: Date.now() });
  pdfEditState.edits.set(action.page, action.text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.undo', { page: action.page });
  return action;
}

export function redoPageEdit() {
  if (!pdfEditState.redoStack.length) return null;
  const action = pdfEditState.redoStack.pop();
  const currentText = pdfEditState.edits.get(action.page) || '';
  pdfEditState.undoStack.push({ page: action.page, text: currentText, ts: Date.now() });
  pdfEditState.edits.set(action.page, action.text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.redo', { page: action.page });
  return action;
}

export function getEditHistory() {
  return {
    undoCount: pdfEditState.undoStack.length,
    redoCount: pdfEditState.redoStack.length,
    editedPages: [...pdfEditState.edits.keys()],
    dirty: pdfEditState.dirty,
  };
}

export function clearEditHistory() {
  pdfEditState.undoStack = [];
  pdfEditState.redoStack = [];
  pdfEditState.dirty = false;
}

export function persistEdits() {
  if (!state.docName) return;
  const key = `nr-edits-${state.docName}`;
  const payload = {
    edits: Object.fromEntries(pdfEditState.edits),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    pdfEditState.dirty = false;
  } catch (err) { console.warn('[app] storage quota exceeded:', err?.message); }
}

export function loadPersistedEdits() {
  if (!state.docName) return;
  const key = `nr-edits-${state.docName}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.edits && typeof parsed.edits === 'object') {
      for (const [page, text] of Object.entries(parsed.edits)) {
        pdfEditState.edits.set(Number(page), text);
      }
    }
  } catch (err) { console.warn('[app] non-critical error:', err?.message); }
}

// ─── DOCX XML Builders ─────────────────────────────────────────────────────

export function buildDocxXml(title, pages) {
  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const docTitle = escapeXml(title);

  const paragraphs = [];
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${docTitle}</w:t></w:r></w:p>`);

  for (let i = 0; i < pages.length; i++) {
    const text = String(pages[i] || '').trim();
    if (!text) continue;

    paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Страница ${i + 1}</w:t></w:r></w:p>`);

    const lines = text.split('\n');
    let inTable = false;
    let tableRows = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inTable && tableRows.length) {
          paragraphs.push(buildDocxTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        continue;
      }

      const cells = trimmed.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2 && cells.length <= 20) {
        inTable = true;
        tableRows.push(cells);
        continue;
      }

      if (inTable && tableRows.length) {
        paragraphs.push(buildDocxTable(tableRows));
        tableRows = [];
        inTable = false;
      }

      const escapedLine = escapeXml(trimmed);
      paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapedLine}</w:t></w:r></w:p>`);
    }

    if (inTable && tableRows.length) {
      paragraphs.push(buildDocxTable(tableRows));
    }

    if (i < pages.length - 1) {
      paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
  }

  const body = paragraphs.join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;
}

export function buildDocxTable(rows) {
  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const maxCols = Math.max(...rows.map(r => r.length));
  const colWidth = Math.floor(9000 / maxCols);

  let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>';
  xml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '</w:tblBorders></w:tblPr>';

  xml += '<w:tblGrid>';
  for (let c = 0; c < maxCols; c++) xml += `<w:gridCol w:w="${colWidth}"/>`;
  xml += '</w:tblGrid>';

  for (const row of rows) {
    xml += '<w:tr>';
    for (let c = 0; c < maxCols; c++) {
      const cellText = escapeXml(row[c] || '');
      xml += `<w:tc><w:p><w:r><w:t xml:space="preserve">${cellText}</w:t></w:r></w:p></w:tc>`;
    }
    xml += '</w:tr>';
  }
  xml += '</w:tbl>';
  return xml;
}

export function buildDocxStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="300"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FootnoteText">
    <w:name w:val="footnote text"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:ind w:left="720" w:right="720"/><w:spacing w:before="200" w:after="200"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="404040"/></w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="FootnoteReference">
    <w:name w:val="footnote reference"/>
    <w:rPr><w:vertAlign w:val="superscript"/><w:sz w:val="18"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders></w:tblPr>
  </w:style>
</w:styles>`;
}

export function buildDocxNumbering() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u25CB"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u25AA"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%3."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
}

export function buildDocxSettings() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:o="urn:schemas-microsoft-com:office:office">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`;
}

export function buildCoreProperties(title) {
  const now = new Date().toISOString();
  const escapeXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title || 'NovaReader Export')}</dc:title>
  <dc:creator>NovaReader</dc:creator>
  <dc:description>Converted from PDF by NovaReader</dc:description>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

export function buildContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
}

export function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
}

export function buildWordRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;
}

// ─── CRC-32 & DOCX Blob Generation ─────────────────────────────────────────

export function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export async function generateDocxBlob(title, pages) {
  const docXml = buildDocxXml(title, pages);
  const stylesXml = buildDocxStyles();
  const contentTypesXml = buildContentTypes();
  const relsXml = buildRels();
  const wordRelsXml = buildWordRels();

  // Build ZIP manually (minimal PKZIP implementation)
  const encoder = new TextEncoder();
  const numberingXml = buildDocxNumbering();
  const settingsXml = buildDocxSettings();
  const coreXml = buildCoreProperties(title);

  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(relsXml) },
    { name: 'word/document.xml', data: encoder.encode(docXml) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'word/numbering.xml', data: encoder.encode(numberingXml) },
    { name: 'word/settings.xml', data: encoder.encode(settingsXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(wordRelsXml) },
    { name: 'docProps/core.xml', data: encoder.encode(coreXml) },
  ];

  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    // Local file header
    const header = new Uint8Array(30 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true);  // signature
    hv.setUint16(4, 20, true);           // version needed
    hv.setUint16(6, 0, true);            // flags
    hv.setUint16(8, 0, true);            // compression (stored)
    hv.setUint16(10, 0, true);           // mod time
    hv.setUint16(12, 0, true);           // mod date
    const fileCrc = crc32(file.data);
    hv.setUint32(14, fileCrc, true);         // crc-32
    hv.setUint32(18, file.data.length, true);  // compressed size
    hv.setUint32(22, file.data.length, true);  // uncompressed size
    hv.setUint16(26, nameBytes.length, true);  // name length
    hv.setUint16(28, 0, true);           // extra field length
    header.set(nameBytes, 30);

    parts.push(header, file.data);

    // Central directory entry
    const cde = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cde.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, fileCrc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    cde.set(nameBytes, 46);
    centralDir.push(cde);

    offset += header.length + file.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cde of centralDir) cdSize += cde.length;

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  ev.setUint16(20, 0, true);

  const allParts = [...parts, ...centralDir, eocd];
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }

  return new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─── DOCX Image Embedding ──────────────────────────────────────────────────

export async function capturePageAsImageData(pageNum) {
  const cachedEntry = _deps.getCachedPage(pageNum);
  if (cachedEntry && cachedEntry.canvas && cachedEntry.canvas.width > 0) {
    return cachedEntry.canvas.toDataURL('image/png').split(',')[1];
  }
  if (!state.adapter) return null;
  const tempCanvas = document.createElement('canvas');
  try {
    await state.adapter.renderPage(pageNum, tempCanvas, { zoom: 1, rotation: 0 });
    const base64 = tempCanvas.toDataURL('image/png').split(',')[1];
    return base64;
  } catch {
    return null;
  } finally {
    tempCanvas.width = 0;
    tempCanvas.height = 0;
  }
}

export function buildDocxImageParagraph(rId, widthEmu, heightEmu) {
  return `<w:p><w:r>
<w:drawing>
  <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
    <wp:docPr id="1" name="Page Image"/>
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:nvPicPr><pic:cNvPr id="0" name="image.png"/><pic:cNvPicPr/></pic:nvPicPr>
          <pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
          <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>
</w:r></w:p>`;
}

export async function generateDocxWithImages(title, pages, includeImages) {
  if (!includeImages) return generateDocxBlob(title, pages);

  const encoder = new TextEncoder();
  const imageFiles = [];
  const imageRels = [];

  for (let i = 0; i < pages.length; i++) {
    if (!pages[i] && !includeImages) continue;
    const imgData = await capturePageAsImageData(i + 1);
    if (imgData) {
      const imgBytes = Uint8Array.from(atob(imgData), c => c.charCodeAt(0));
      const rId = `rId${10 + i}`;
      imageFiles.push({ name: `word/media/page${i + 1}.png`, data: imgBytes });
      imageRels.push({ rId, target: `media/page${i + 1}.png` });
    }
  }

  const docXml = buildDocxXmlWithImages(title, pages, imageRels);
  const stylesXml = buildDocxStyles();
  const contentTypesXml = buildContentTypesWithImages(imageFiles.length > 0);
  const relsXml = buildRels();
  const wordRelsXml = buildWordRelsWithImages(imageRels);
  const numberingXml = buildDocxNumbering();
  const settingsXml = buildDocxSettings();
  const coreXml = buildCoreProperties(title);

  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(relsXml) },
    { name: 'word/document.xml', data: encoder.encode(docXml) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'word/numbering.xml', data: encoder.encode(numberingXml) },
    { name: 'word/settings.xml', data: encoder.encode(settingsXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(wordRelsXml) },
    { name: 'docProps/core.xml', data: encoder.encode(coreXml) },
    ...imageFiles,
  ];

  return createZipBlob(files);
}

export function _groupWordsIntoLines(words) {
  if (!words || !words.length) return [];
  const sorted = [...words].filter(w => w.bbox).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    const avgH = ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) / 2;
    return Math.abs(dy) < avgH * 0.5 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].bbox.y0;
  const threshold = Math.abs(sorted[0].bbox.y1 - sorted[0].bbox.y0) * 0.5;

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    if (Math.abs(word.bbox.y0 - currentY) <= threshold) {
      currentLine.push(word);
    } else {
      lines.push(currentLine);
      currentLine = [word];
      currentY = word.bbox.y0;
    }
  }
  if (currentLine.length) lines.push(currentLine);
  return lines;
}

export function buildDocxXmlWithImages(title, pages, imageRels) {
  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const paragraphs = [];
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>`);

  for (let i = 0; i < pages.length; i++) {
    const text = String(pages[i] || '').trim();
    const imgRel = imageRels.find(r => r.target === `media/page${i + 1}.png`);

    // Use word-level data for structured paragraphs if available
    const words = _deps._ocrWordCache.get(i + 1);
    const useWordLayout = words && words.length > 0 && text.length > 0;

    if (useWordLayout) {
      // Group words into lines based on Y-coordinate proximity
      const lineGroups = _groupWordsIntoLines(words);
      const fontSizes = words.map(w => w.bbox ? Math.abs(w.bbox.y1 - w.bbox.y0) : 12);
      const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / Math.max(1, fontSizes.length);

      // Detect paragraphs by line spacing
      let prevLineBottom = 0;
      for (const lineWords of lineGroups) {
        if (!lineWords.length) continue;
        const lineTop = Math.min(...lineWords.map(w => w.bbox?.y0 || 0));
        const lineBottom = Math.max(...lineWords.map(w => w.bbox?.y1 || 0));
        const lineHeight = lineBottom - lineTop;
        const gap = lineTop - prevLineBottom;

        // Detect heading: larger font or significant gap before line
        const lineAvgHeight = lineHeight;
        const isHeading = lineAvgHeight > avgFontSize * 1.3 && gap > avgFontSize * 0.5;
        const isParagraphBreak = gap > lineHeight * 1.5;

        const lineText = lineWords.map(w => w.text).join(' ').trim();
        if (!lineText) continue;

        // Check if this line looks like a table row
        const cells = lineText.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2 && cells.length <= 20) {
          // Will be handled in next pass
          paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
        } else if (isHeading) {
          const sz = Math.round(Math.min(36, Math.max(14, lineAvgHeight * 0.75)) * 2);
          paragraphs.push(`<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
        } else {
          const sz = Math.round(Math.min(28, Math.max(10, lineAvgHeight * 0.55)) * 2);
          if (isParagraphBreak && prevLineBottom > 0) {
            paragraphs.push(`<w:p><w:pPr><w:spacing w:before="120"/></w:pPr><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
          } else {
            paragraphs.push(`<w:p><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
          }
        }
        prevLineBottom = lineBottom;
      }
    } else if (text) {
      // Fallback: text-only layout with table detection
      const lines = text.split('\n');
      let inTable = false;
      let tableRows = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (inTable && tableRows.length) {
            paragraphs.push(buildDocxTable(tableRows));
            tableRows = [];
            inTable = false;
          }
          paragraphs.push('<w:p/>'); // Empty paragraph for spacing
          continue;
        }
        const cells = trimmed.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2 && cells.length <= 20) {
          inTable = true;
          tableRows.push(cells);
          continue;
        }
        if (inTable && tableRows.length) {
          paragraphs.push(buildDocxTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(trimmed)}</w:t></w:r></w:p>`);
      }
      if (inTable && tableRows.length) paragraphs.push(buildDocxTable(tableRows));
    }

    // Add page image AFTER text (as supplementary, not primary content)
    if (imgRel && !useWordLayout) {
      const widthEmu = 5800000;
      const heightEmu = 7500000;
      paragraphs.push(buildDocxImageParagraph(imgRel.rId, widthEmu, heightEmu));
    }

    if (i < pages.length - 1) {
      paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  mc:Ignorable="w14 wp14">
<w:body>
${paragraphs.join('\n')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`;
}

export function buildContentTypesWithImages(hasImages) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>`;
  if (hasImages) xml += '\n  <Default Extension="png" ContentType="image/png"/>';
  xml += `
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
  return xml;
}

export function buildWordRelsWithImages(imageRels) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>`;
  for (const rel of imageRels) {
    xml += `\n  <Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${rel.target}"/>`;
  }
  xml += '\n</Relationships>';
  return xml;
}

export function createZipBlob(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const header = new Uint8Array(30 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true);
    hv.setUint16(4, 20, true);
    hv.setUint16(8, 0, true);
    const fileCrc = crc32(file.data);
    hv.setUint32(14, fileCrc, true);
    hv.setUint32(18, file.data.length, true);
    hv.setUint32(22, file.data.length, true);
    hv.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    parts.push(header, file.data);

    const cde = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cde.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, fileCrc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    cde.set(nameBytes, 46);
    centralDir.push(cde);
    offset += header.length + file.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cde of centralDir) cdSize += cde.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);

  const allParts = [...parts, ...centralDir, eocd];
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) { result.set(part, pos); pos += part.length; }
  return new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─── DOCX Import ────────────────────────────────────────────────────────────

export async function importDocxEdits(file) {
  if (!file || !state.adapter) {
    _deps.setOcrStatus('Импорт DOCX: нужен открытый документ');
    return;
  }

  try {
    _deps.setOcrStatus('Импорт DOCX: чтение файла...');
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const xmlContent = extractDocumentXmlFromZip(bytes);
    if (!xmlContent) {
      _deps.setOcrStatus('Импорт DOCX: не удалось найти word/document.xml');
      return;
    }

    const pages = parseDocxTextByPages(xmlContent);
    if (!pages.length) {
      _deps.setOcrStatus('Импорт DOCX: текст не найден в документе');
      return;
    }

    const cache = loadOcrTextData();
    const pagesText = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : new Array(state.pageCount).fill('');

    let merged = 0;
    for (let i = 0; i < pages.length && i < state.pageCount; i++) {
      const imported = pages[i].trim();
      if (imported && imported !== pagesText[i]) {
        pagesText[i] = imported;
        setPageEdits(i + 1, imported);
        merged++;
      }
    }

    saveOcrTextData({
      pagesText,
      source: 'docx-import',
      scannedPages: pages.length,
      totalPages: state.pageCount,
      updatedAt: new Date().toISOString(),
    });
    persistEdits();

    if (state.currentPage <= pages.length && pages[state.currentPage - 1]) {
      els.pageText.value = pages[state.currentPage - 1];
    }

    _deps.setOcrStatus(`Импорт DOCX: объединено ${merged} страниц из ${pages.length}`);
    pushDiagnosticEvent('docx.import', { pages: pages.length, merged });
  } catch (error) {
    _deps.setOcrStatus(`Импорт DOCX: ошибка — ${error.message}`);
    pushDiagnosticEvent('docx.import.error', { message: error.message }, 'error');
  }
}

export function extractDocumentXmlFromZip(bytes) {
  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0x50 && bytes[pos+1] === 0x4B && bytes[pos+2] === 0x03 && bytes[pos+3] === 0x04) {
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const name = decoder.decode(bytes.slice(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      if (name === 'word/document.xml') {
        return decoder.decode(bytes.slice(dataStart, dataStart + compSize));
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

export function parseDocxTextByPages(xml) {
  const pages = [];
  let currentPage = [];

  const paragraphs = xml.split(/<w:p[\s>]/);
  for (const para of paragraphs) {
    if (para.includes('w:type="page"')) {
      pages.push(currentPage.join('\n').trim());
      currentPage = [];
      continue;
    }

    const textMatches = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      const line = textMatches.map(m => {
        const match = m.match(/>([^<]*)</);
        return match ? match[1] : '';
      }).join('');
      if (line.trim()) currentPage.push(line);
    }
  }

  if (currentPage.length) pages.push(currentPage.join('\n').trim());
  return pages.filter(p => p.length > 0);
}

// ─── Session Health Report ──────────────────────────────────────────────────

export function exportSessionHealthReport() {
  const health = getSessionHealth();
  const perfSummary = getPerfSummary();
  const tessStatus = getTesseractStatus();
  const report = {
    app: 'NovaReader',
    version: APP_VERSION,
    ...health,
    perfMetrics: perfSummary,
    recentErrors: getRecentErrors(20),
    ocr: {
      engine: tessStatus,
      supportedLanguages: getSupportedLanguages().map((l) => ({ code: l, name: getLanguageName(l) })),
      currentLang: _deps.getOcrLang(),
    },
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novareader-health-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  pushDiagnosticEvent('health.export', health);
}
