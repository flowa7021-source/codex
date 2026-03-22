// @ts-check
// ─── DOCX Export Sub-module ──────────────────────────────────────────────────
// DOCX XML builders, styles, numbering, settings, properties, and blob generation.
// Split from export-controller.js for maintainability.

// ─── Heading / list / formatting detection helpers for plain-text DOCX ──────

const _HEADING_PATTERNS = [
  /^(глава|chapter|teil|chapitre|capítulo)\s+\d/i,
  /^(раздел|section|abschnitt)\s+\d/i,
  /^(часть|part|partie|parte)\s+[IVXivx\d]/i,
  /^\d+\.\s+[А-ЯA-Z]/,
  /^\d+\.\d+\s+[А-ЯA-Z]/,
  /^(введение|заключение|приложение|содержание|оглавление|предисловие)/i,
  /^(introduction|conclusion|appendix|abstract|summary|preface|foreword|bibliography|references)/i,
  /^(table of contents|index|acknowledgements)/i,
];

const _BULLET_RE = /^([\u2022\u2023\u25E6\u25CF\u25CB•●○◦‣\-–—]\s)/;
const _NUM_LIST_RE = /^(\d{1,3}[.)]\s)/;
const _ALPHA_LIST_RE = /^([a-zA-Zа-яА-Я][.)]\s(?=[A-ZА-Я]))/;

function _isAllCapsLine(text) {
  const letters = text.replace(/[^а-яА-Яa-zA-ZÀ-ÿ]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function _detectListType(line) {
  if (_BULLET_RE.test(line)) return { type: 'bullet', clean: line.replace(_BULLET_RE, '').trim() };
  if (_NUM_LIST_RE.test(line)) return { type: 'numbered', clean: line.replace(_NUM_LIST_RE, '').trim() };
  if (_ALPHA_LIST_RE.test(line)) return { type: 'numbered', clean: line.replace(_ALPHA_LIST_RE, '').trim() };
  return null;
}

function _detectHeadingLevel(text) {
  const trimmed = text.trim();
  if (trimmed.length > 120 || trimmed.length < 2) return null;
  if (_HEADING_PATTERNS.some(p => p.test(trimmed))) return 'Heading2';
  if (_isAllCapsLine(trimmed) && trimmed.length < 80) return 'Heading3';
  return null;
}

function _measureLeadingSpaces(line) {
  const match = line.match(/^(\s+)/);
  if (!match) return 0;
  return Math.floor(match[1].length / 2);
}

function _buildListParagraph(escapeXml, text, listType, indentLevel) {
  const numId = listType === 'bullet' ? '1' : '2';
  const ilvl = Math.min(indentLevel, 2);
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function _buildFormattedParagraph(escapeXml, text, style, indent) {
  let pPr = '';
  if (style || indent > 0) {
    pPr = '<w:pPr>';
    if (style) pPr += `<w:pStyle w:val="${style}"/>`;
    if (indent > 0) pPr += `<w:ind w:left="${indent * 720}"/>`;
    pPr += '</w:pPr>';
  }
  // Detect inline bold (*text* or ALL CAPS short segments)
  const escaped = escapeXml(text);
  const isBold = style && style.startsWith('Heading');
  const rPr = isBold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

/** @param {any} title @param {any} pages @returns {any} */
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

      // Table detection: tab-separated or multiple large gaps or pipe-separated
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

      // List detection (bullet and numbered)
      const listInfo = _detectListType(trimmed);
      if (listInfo) {
        const indent = _measureLeadingSpaces(line);
        paragraphs.push(_buildListParagraph(escapeXml, listInfo.clean, listInfo.type, indent));
        continue;
      }

      // Heading detection from semantic patterns and ALL CAPS
      const headingStyle = _detectHeadingLevel(trimmed);
      if (headingStyle) {
        const indent = _measureLeadingSpaces(line);
        paragraphs.push(_buildFormattedParagraph(escapeXml, trimmed, headingStyle, indent));
        continue;
      }

      // Regular paragraph with indentation preservation
      const indent = _measureLeadingSpaces(line);
      paragraphs.push(_buildFormattedParagraph(escapeXml, trimmed, null, indent));
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

/** @param {any} rows @returns {any} */
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

/** @returns {any} */
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

/** @returns {any} */
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

/** @returns {any} */
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

/** @param {any} title @returns {any} */
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

/** @returns {any} */
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

/** @returns {any} */
export function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
}

/** @returns {any} */
export function buildWordRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;
}

// ─── CRC-32 & ZIP Blob Generation ───────────────────────────────────────────

/** @param {any} data @returns {any} */
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

/** @param {any} title @param {any} pages @returns {Promise<any>} */
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

// ─── DOCX Import ────────────────────────────────────────────────────────────

/** @param {any} bytes @returns {any} */
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

/** @param {any} xml @returns {any} */
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

/** @param {any} files @returns {any} */
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
