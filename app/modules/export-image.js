// ─── Image Export Sub-module ─────────────────────────────────────────────────
// DOCX image embedding, page capture, and image-enriched DOCX generation.
// Split from export-controller.js for maintainability.

import { state } from './state.js';
import {
  buildDocxTable, buildDocxStyles, buildDocxNumbering, buildDocxSettings,
  buildCoreProperties, buildRels, createZipBlob, generateDocxBlob,
} from './export-docx.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// Shared with export-controller; injected via initExportImageDeps.
const _deps = {
  getCachedPage: () => null,
  _ocrWordCache: new Map(),
};

/**
 * Inject runtime dependencies.
 * Called from export-controller's initExportControllerDeps.
 */
export function initExportImageDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── DOCX Image Embedding ──────────────────────────────────────────────────

export async function capturePageAsImageData(pageNum) {
  // Use a higher zoom factor (2x) for better image quality in DOCX export
  const EXPORT_ZOOM = 2;

  const cachedEntry = _deps.getCachedPage(pageNum);
  if (cachedEntry && cachedEntry.canvas && cachedEntry.canvas.width > 0) {
    // If cached canvas is high-res already, use it directly
    if (cachedEntry.canvas.width >= 800) {
      return cachedEntry.canvas.toDataURL('image/png', 1.0).split(',')[1];
    }
    // Otherwise re-render at higher quality below
  }
  if (!state.adapter) return null;
  const tempCanvas = document.createElement('canvas');
  try {
    await state.adapter.renderPage(pageNum, tempCanvas, { zoom: EXPORT_ZOOM, rotation: 0 });
    // Use quality 1.0 for lossless PNG output
    const base64 = tempCanvas.toDataURL('image/png', 1.0).split(',')[1];
    return base64;
  } catch (err) {
    console.warn('[export-controller] error:', err?.message);
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

// ─── Word grouping helpers ──────────────────────────────────────────────────

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

// ─── Word-level font name helpers for XML builder ───────────────────────────

function _isBoldFromFont(fontName) {
  return /bold|black|heavy|demi(?!-?italic)/i.test(fontName || '');
}

function _isItalicFromFont(fontName) {
  return /italic|oblique|slant/i.test(fontName || '');
}

function _buildRunXml(escapeXml, text, opts = {}) {
  let rPr = '';
  const parts = [];
  if (opts.bold) parts.push('<w:b/>');
  if (opts.italic) parts.push('<w:i/>');
  if (opts.fontSize) parts.push(`<w:sz w:val="${opts.fontSize}"/><w:szCs w:val="${opts.fontSize}"/>`);
  if (opts.fontFamily) parts.push(`<w:rFonts w:ascii="${escapeXml(opts.fontFamily)}" w:hAnsi="${escapeXml(opts.fontFamily)}"/>`);
  if (parts.length) rPr = `<w:rPr>${parts.join('')}</w:rPr>`;
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

// Build runs from word-level data, grouping by font formatting
function _buildWordRunsXml(escapeXml, lineWords) {
  if (!lineWords.length) return '';
  const runs = [];
  let currentRun = { texts: [lineWords[0].text], bold: false, italic: false, fontName: '' };

  // Check if word has font info (from OCR bbox data)
  const getWordFont = (w) => w.fontName || w.font || '';
  const firstFont = getWordFont(lineWords[0]);
  currentRun.bold = _isBoldFromFont(firstFont);
  currentRun.italic = _isItalicFromFont(firstFont);
  currentRun.fontName = firstFont;

  for (let wi = 1; wi < lineWords.length; wi++) {
    const w = lineWords[wi];
    const font = getWordFont(w);
    const bold = _isBoldFromFont(font);
    const italic = _isItalicFromFont(font);
    if (bold === currentRun.bold && italic === currentRun.italic) {
      currentRun.texts.push(w.text);
    } else {
      runs.push(currentRun);
      currentRun = { texts: [w.text], bold, italic, fontName: font };
    }
  }
  runs.push(currentRun);

  return runs.map(r => _buildRunXml(escapeXml, r.texts.join(' '), {
    bold: r.bold, italic: r.italic,
  })).join('');
}

// ─── Heading / list detection (duplicated from export-docx for image variant) ──

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
  const escaped = escapeXml(text);
  const isBold = style && style.startsWith('Heading');
  const rPr = isBold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

// ─── DOCX XML with Images ──────────────────────────────────────────────────

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

      // Compute left margin from all word positions for indentation detection
      const allXPositions = words.filter(w => w.bbox).map(w => w.bbox.x0);
      const leftMargin = allXPositions.length ? Math.min(...allXPositions) : 0;

      // Detect paragraphs by line spacing
      let prevLineBottom = 0;
      let inTable = false;
      let tableRows = [];

      for (const lineWords of lineGroups) {
        if (!lineWords.length) continue;
        const lineTop = Math.min(...lineWords.map(w => w.bbox?.y0 || 0));
        const lineBottom = Math.max(...lineWords.map(w => w.bbox?.y1 || 0));
        const lineHeight = lineBottom - lineTop;
        const gap = lineTop - prevLineBottom;

        const lineText = lineWords.map(w => w.text).join(' ').trim();
        if (!lineText) { prevLineBottom = lineBottom; continue; }

        // Flush table on large gap
        if (inTable && tableRows.length && gap > avgFontSize * 1.5) {
          paragraphs.push(buildDocxTable(tableRows));
          tableRows = [];
          inTable = false;
        }

        // Table detection: tab-separated or pipe-separated or multiple large x-gaps
        const cells = lineText.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
        const sortedByX = [...lineWords].sort((a, b) => (a.bbox?.x0 || 0) - (b.bbox?.x0 || 0));
        const hasLargeGap = sortedByX.some((w, idx) => idx > 0 &&
          (w.bbox?.x0 || 0) - ((sortedByX[idx - 1].bbox?.x1 || sortedByX[idx - 1].bbox?.x0 || 0) +
          (sortedByX[idx - 1].text?.length || 1) * avgFontSize * 0.3) > avgFontSize * 2);

        if ((cells.length >= 2 && cells.length <= 20) || (lineWords.length >= 2 && hasLargeGap && cells.length >= 2)) {
          inTable = true;
          tableRows.push(cells);
          prevLineBottom = lineBottom;
          continue;
        }

        if (inTable && tableRows.length) {
          paragraphs.push(buildDocxTable(tableRows));
          tableRows = [];
          inTable = false;
        }

        // Compute x-based indentation
        const lineX = Math.min(...lineWords.map(w => w.bbox?.x0 || 0));
        const indentLevel = avgFontSize > 0 ? Math.max(0, Math.round((lineX - leftMargin) / (avgFontSize * 2))) : 0;
        const indentTwips = indentLevel * 720;

        // List detection from text content
        const listInfo = _detectListType(lineText);
        if (listInfo) {
          const numId = listInfo.type === 'bullet' ? '1' : '2';
          const ilvl = Math.min(indentLevel, 2);
          paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${_buildWordRunsXml(escapeXml, lineWords)}</w:p>`);
          prevLineBottom = lineBottom;
          continue;
        }

        // Heading detection: larger font, semantic patterns, or ALL CAPS
        const lineAvgHeight = lineHeight;
        const sizeRatio = lineAvgHeight / avgFontSize;
        const isHeading = (sizeRatio > 1.3 && lineText.length < 100) ||
          _HEADING_PATTERNS.some(p => p.test(lineText)) ||
          (_isAllCapsLine(lineText) && lineText.length < 80 && lineText.length > 2);

        const sz = Math.round(Math.min(36, Math.max(10, lineAvgHeight * 0.65)) * 2);

        if (isHeading) {
          let headingStyle = 'Heading2';
          if (sizeRatio > 1.8) headingStyle = 'Heading1';
          else if (sizeRatio > 1.4) headingStyle = 'Heading2';
          else headingStyle = 'Heading3';
          paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="${headingStyle}"/></w:pPr>${_buildWordRunsXml(escapeXml, lineWords)}</w:p>`);
        } else {
          // Regular paragraph with font formatting and indentation
          const isParagraphBreak = gap > lineHeight * 1.5;
          let pPr = '<w:pPr>';
          if (isParagraphBreak && prevLineBottom > 0) pPr += '<w:spacing w:before="120"/>';
          if (indentTwips > 0) pPr += `<w:ind w:left="${indentTwips}"/>`;
          pPr += '</w:pPr>';

          const runsXml = _buildWordRunsXml(escapeXml, lineWords);
          // If no special run formatting, fall back to sized run
          if (runsXml.includes('<w:rPr>')) {
            paragraphs.push(`<w:p>${pPr}${runsXml}</w:p>`);
          } else {
            paragraphs.push(`<w:p>${pPr}<w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
          }
        }
        prevLineBottom = lineBottom;
      }

      if (inTable && tableRows.length) {
        paragraphs.push(buildDocxTable(tableRows));
      }
    } else if (text) {
      // Fallback: text-only layout with full structure detection
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

        // List detection
        const listInfo = _detectListType(trimmed);
        if (listInfo) {
          const indent = _measureLeadingSpaces(line);
          paragraphs.push(_buildListParagraph(escapeXml, listInfo.clean, listInfo.type, indent));
          continue;
        }

        // Heading detection
        const headingStyle = _detectHeadingLevel(trimmed);
        if (headingStyle) {
          const indent = _measureLeadingSpaces(line);
          paragraphs.push(_buildFormattedParagraph(escapeXml, trimmed, headingStyle, indent));
          continue;
        }

        // Regular paragraph with indentation
        const indent = _measureLeadingSpaces(line);
        paragraphs.push(_buildFormattedParagraph(escapeXml, trimmed, null, indent));
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
