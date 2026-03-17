// ─── Enhanced DOCX Import with Formatting Preservation ──────────────────────

function extractFileFromDocxZip(bytes, targetName) {
  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4B && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const name = decoder.decode(bytes.slice(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      if (name === targetName) {
        return decoder.decode(bytes.slice(dataStart, dataStart + compSize));
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

function parseRunProperties(runXml) {
  const props = {};
  if (/<w:b[\s/>]/.test(runXml)) props.bold = true;
  if (/<w:i[\s/>]/.test(runXml)) props.italic = true;
  if (/<w:u[\s/>]/.test(runXml)) props.underline = true;
  if (/<w:strike[\s/>]/.test(runXml)) props.strikethrough = true;

  const sizeMatch = runXml.match(/<w:sz\s+w:val="(\d+)"/);
  if (sizeMatch) props.fontSize = parseInt(sizeMatch[1], 10) / 2; // half-points to points

  const colorMatch = runXml.match(/<w:color\s+w:val="([^"]+)"/);
  if (colorMatch && colorMatch[1] !== 'auto') props.color = `#${colorMatch[1]}`;

  const fontMatch = runXml.match(/<w:rFonts\s[^>]*w:ascii="([^"]+)"/);
  if (fontMatch) props.fontFamily = fontMatch[1];

  const highlightMatch = runXml.match(/<w:highlight\s+w:val="([^"]+)"/);
  if (highlightMatch) props.highlight = highlightMatch[1];

  return props;
}

function parseParagraphProperties(paraXml) {
  const props = {};

  const styleMatch = paraXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
  if (styleMatch) props.style = styleMatch[1];

  const alignMatch = paraXml.match(/<w:jc\s+w:val="([^"]+)"/);
  if (alignMatch) props.align = alignMatch[1];

  const indentMatch = paraXml.match(/<w:ind\s[^>]*w:left="(\d+)"/);
  if (indentMatch) props.indentLeft = parseInt(indentMatch[1], 10);

  const numMatch = paraXml.match(/<w:numId\s+w:val="(\d+)"/);
  if (numMatch) props.listId = parseInt(numMatch[1], 10);

  const lvlMatch = paraXml.match(/<w:ilvl\s+w:val="(\d+)"/);
  if (lvlMatch) props.listLevel = parseInt(lvlMatch[1], 10);

  return props;
}

function parseTable(tableXml) {
  const rows = [];
  const rowMatches = tableXml.split(/<w:tr[\s>]/);

  for (let i = 1; i < rowMatches.length; i++) {
    const rowXml = rowMatches[i];
    const cells = [];
    const cellMatches = rowXml.split(/<w:tc[\s>]/);

    for (let j = 1; j < cellMatches.length; j++) {
      const cellXml = cellMatches[j];
      const textParts = [];
      const textMatches = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      for (const m of textMatches) {
        const match = m.match(/>([^<]*)</);
        if (match) textParts.push(match[1]);
      }
      cells.push(textParts.join(''));
    }

    if (cells.length) rows.push(cells);
  }

  return rows;
}

export function parseDocxAdvanced(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  const documentXml = extractFileFromDocxZip(bytes, 'word/document.xml');
  if (!documentXml) throw new Error('Invalid DOCX: missing word/document.xml');

  const stylesXml = extractFileFromDocxZip(bytes, 'word/styles.xml');

  // Parse style definitions
  const styleMap = {};
  if (stylesXml) {
    const styleMatches = stylesXml.matchAll(/<w:style\s[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name\s+w:val="([^"]+)"[\s\S]*?<\/w:style>/g);
    for (const m of styleMatches) {
      styleMap[m[1]] = m[2];
    }
  }

  const result = {
    pages: [],
    formattedBlocks: [],
    tables: [],
    styles: styleMap,
    metadata: {},
  };

  // Parse body content
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return result;

  const bodyXml = bodyMatch[1];
  let currentPage = [];
  let currentBlocks = [];
  let pageIndex = 0;

  // Split by paragraph breaks and tables
  const elements = bodyXml.split(/(?=<w:p[\s>])|(?=<w:tbl[\s>])/);

  for (const element of elements) {
    const trimmed = element.trim();
    if (!trimmed) continue;

    // Check for page break
    if (trimmed.includes('w:type="page"') || trimmed.includes('w:lastRenderedPageBreak')) {
      if (currentPage.length || currentBlocks.length) {
        result.pages.push(currentPage.join('\n').trim());
        result.formattedBlocks.push(currentBlocks);
        currentPage = [];
        currentBlocks = [];
        pageIndex++;
      }
      continue;
    }

    // Tables
    if (trimmed.startsWith('<w:tbl')) {
      const table = parseTable(trimmed);
      if (table.length) {
        result.tables.push({ page: pageIndex, rows: table });
        currentBlocks.push({ type: 'table', rows: table });
        const tableText = table.map((row) => row.join('\t')).join('\n');
        currentPage.push(tableText);
      }
      continue;
    }

    // Paragraphs
    if (trimmed.startsWith('<w:p')) {
      const paraProps = parseParagraphProperties(trimmed);
      const runs = [];
      const runMatches = trimmed.split(/<w:r[\s>]/);

      for (let i = 1; i < runMatches.length; i++) {
        const runXml = runMatches[i];
        const runProps = parseRunProperties(runXml);

        const textParts = [];
        const textMatches = runXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        for (const m of textMatches) {
          const match = m.match(/>([^<]*)</);
          if (match) textParts.push(match[1]);
        }

        if (textParts.length) {
          runs.push({
            text: textParts.join(''),
            ...runProps,
          });
        }
      }

      const plainText = runs.map((r) => r.text).join('');
      if (plainText.trim()) {
        const block = {
          type: 'paragraph',
          text: plainText,
          runs,
          style: paraProps.style || null,
          styleName: styleMap[paraProps.style] || paraProps.style || null,
          align: paraProps.align || 'left',
          indent: paraProps.indentLeft || 0,
          listId: paraProps.listId || null,
          listLevel: paraProps.listLevel || null,
        };
        currentBlocks.push(block);
        currentPage.push(plainText);
      }
    }
  }

  if (currentPage.length || currentBlocks.length) {
    result.pages.push(currentPage.join('\n').trim());
    result.formattedBlocks.push(currentBlocks);
  }

  return result;
}

export function formattedBlocksToHtml(blocks) {
  const html = [];

  for (const block of blocks) {
    if (block.type === 'table') {
      html.push('<table border="1" cellpadding="4" cellspacing="0">');
      for (const row of block.rows) {
        html.push('<tr>');
        for (const cell of row) {
          html.push(`<td>${escapeHtml(cell)}</td>`);
        }
        html.push('</tr>');
      }
      html.push('</table>');
      continue;
    }

    if (block.type === 'paragraph') {
      const tag = getHtmlTag(block.styleName);
      const alignStyle = block.align && block.align !== 'left' ? ` style="text-align:${block.align}"` : '';
      const indentStyle = block.indent ? ` style="margin-left:${Math.round(block.indent / 20)}px"` : '';
      const style = alignStyle || indentStyle;

      html.push(`<${tag}${style}>`);
      for (const run of (block.runs || [])) {
        let text = escapeHtml(run.text);
        if (run.bold) text = `<b>${text}</b>`;
        if (run.italic) text = `<i>${text}</i>`;
        if (run.underline) text = `<u>${text}</u>`;
        if (run.strikethrough) text = `<s>${text}</s>`;
        if (run.color) text = `<span style="color:${run.color}">${text}</span>`;
        if (run.fontSize) text = `<span style="font-size:${run.fontSize}pt">${text}</span>`;
        html.push(text);
      }
      html.push(`</${tag}>`);
    }
  }

  return html.join('\n');
}

function getHtmlTag(styleName) {
  if (!styleName) return 'p';
  const lower = (styleName || '').toLowerCase();
  if (lower.includes('title')) return 'h1';
  if (lower.includes('heading 1') || lower === 'heading1') return 'h1';
  if (lower.includes('heading 2') || lower === 'heading2') return 'h2';
  if (lower.includes('heading 3') || lower === 'heading3') return 'h3';
  if (lower.includes('heading 4') || lower === 'heading4') return 'h4';
  return 'p';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mergeDocxIntoWorkspace(parsedDocx, existingPagesText, pageCount) {
  const pagesText = [...existingPagesText];
  let merged = 0;

  for (let i = 0; i < parsedDocx.pages.length && i < pageCount; i++) {
    const imported = parsedDocx.pages[i].trim();
    if (imported && imported !== (pagesText[i] || '').trim()) {
      pagesText[i] = imported;
      merged++;
    }
  }

  return { pagesText, merged, totalImported: parsedDocx.pages.length };
}
