/**
 * Layer 4: DOCX Builder
 *
 * Takes SemanticSection[] from Layer 3 (semantic-enricher) and generates a
 * complete DOCX document using the `docx` library.
 *
 * Input:  SemanticSection[]  – sections with enriched semantic blocks
 *         options            – title, header/footer flags, image callback, mode
 *
 * Output: Blob               – ready-to-download DOCX file
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, HeadingLevel, AlignmentType, BorderStyle, WidthType,
  Header, Footer, PageNumber,
  ShadingType, ExternalHyperlink, PageOrientation,
} from 'docx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Points → twips (1 pt = 20 twips). */
const PT = 20;

/** Map semantic alignment strings to docx AlignmentType. */
const ALIGNMENT_MAP = {
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
  center: AlignmentType.CENTER,
  justified: AlignmentType.JUSTIFIED,
};

/** Map heading levels (1-based) to docx HeadingLevel constants. */
const HEADING_LEVEL_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

/** PDF font family → DOCX-safe font. */
const FONT_MAP = {
  'serif': 'Times New Roman',
  'sans-serif': 'Arial',
  'monospace': 'Courier New',
  'Helvetica': 'Arial',
  'Times-Roman': 'Times New Roman',
  'Courier': 'Courier New',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a DOCX document from semantic sections.
 *
 * @param {import('./semantic-enricher.js').SemanticSection[]} semanticSections
 * @param {Object} options
 * @param {string}          options.title
 * @param {boolean}         options.includeHeader
 * @param {boolean}         options.includeFooter
 * @param {Function|null}   options.capturePageImage
 * @param {'text'|'text+images'|'layout'|'images-only'} options.mode
 * @returns {Promise<Blob>}
 */
export async function buildDocxDocument(semanticSections, options = {}) {
  const {
    title = 'NovaReader Export',
    includeHeader = false,
    includeFooter = true,
    capturePageImage = null,
    mode = 'text',
  } = options;

  const sections = [];

  for (const section of semanticSections) {
    const children = [];

    // --- images-only mode: render each page as a full-page image -----------
    if (mode === 'images-only') {
      if (capturePageImage) {
        for (let p = section.startPage; p <= section.endPage; p++) {
          const imgData = await capturePageImage(p);
          if (imgData) {
            children.push(new Paragraph({
              children: [new ImageRun({
                data: imgData,
                transformation: { width: 595, height: 842 },
                type: 'png',
              })],
              alignment: AlignmentType.CENTER,
            }));
          }
        }
      }
    } else {
      // --- text / text+images / layout modes ------------------------------
      const blocks = section.blocks || [];
      let prevPageNum = section.startPage;

      for (const block of blocks) {
        // Insert page break when page number changes
        if (block.pageNumber && block.pageNumber > prevPageNum) {
          children.push(new Paragraph({
            children: [new TextRun({ break: 1 })],
            pageBreakBefore: true,
          }));
          prevPageNum = block.pageNumber;
        }

        switch (block.type) {
          case 'heading':
            children.push(buildHeading(block));
            break;

          case 'paragraph':
            children.push(buildParagraph(block));
            break;

          case 'list-item':
            children.push(buildListItem(block));
            break;

          case 'footnote':
            children.push(buildFootnote(block));
            break;

          case 'formula':
            children.push(buildFormula(block));
            break;

          case 'toc-entry':
            children.push(buildTocEntry(block));
            break;

          case 'caption':
            children.push(buildCaption(block));
            break;

          case 'image':
            children.push(buildImage(block));
            break;

          case 'table':
            children.push(buildTable(block));
            break;

          case 'page-break':
            children.push(new Paragraph({
              children: [new TextRun({ break: 1 })],
              pageBreakBefore: true,
            }));
            break;

          default:
            // Unknown block type — render as plain paragraph
            children.push(buildParagraph(block));
            break;
        }
      }

      // Append page images in text+images mode
      if (mode === 'text+images' && capturePageImage) {
        for (let p = section.startPage; p <= section.endPage; p++) {
          const imgData = await capturePageImage(p);
          if (imgData) {
            children.push(new Paragraph({ spacing: { before: 200 } }));
            children.push(new Paragraph({
              children: [new ImageRun({
                data: imgData,
                transformation: { width: 500, height: 700 },
                type: 'png',
              })],
              alignment: AlignmentType.CENTER,
            }));
          }
        }
      }
    }

    // Ensure at least one child (DOCX sections must not be empty)
    if (!children.length) {
      children.push(new Paragraph({ text: '' }));
    }

    // --- Section properties -----------------------------------------------
    const pageSize = section.pageSize || {};
    const isLandscape = section.orientation === 'landscape';
    const rawW = pageSize.width || 595;
    const rawH = pageSize.height || 842;
    const pgWidth = Math.round(rawW * PT);
    const pgHeight = Math.round(rawH * PT);

    const margins = section.margins || {};
    const sectionProperties = {
      page: {
        size: {
          width: isLandscape ? Math.max(pgWidth, pgHeight) : pgWidth,
          height: isLandscape ? Math.min(pgWidth, pgHeight) : pgHeight,
          orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
        margin: {
          top: Math.round((margins.top || 72) * PT),
          bottom: Math.round((margins.bottom || 72) * PT),
          left: Math.round((margins.left || 72) * PT),
          right: Math.round((margins.right || 72) * PT),
        },
      },
    };

    // Multi-column support
    if (section.columns && section.columns > 1) {
      sectionProperties.column = {
        count: section.columns,
        space: 720,
        separate: true,
      };
    }

    // --- Headers / footers ------------------------------------------------
    const sectionObj = {
      properties: sectionProperties,
      children,
    };

    if (includeHeader) {
      const headerContent = section.header && section.header.length
        ? buildRunsFromContentLines(section.header)
        : [new TextRun({ text: title || 'NovaReader', font: 'Arial', size: 16, color: '999999' })];

      sectionObj.headers = {
        default: new Header({
          children: [new Paragraph({
            children: headerContent,
            alignment: AlignmentType.RIGHT,
          })],
        }),
      };
    }

    if (includeFooter) {
      const footerChildren = [];

      if (section.footer && section.footer.length) {
        footerChildren.push(...buildRunsFromContentLines(section.footer));
      } else {
        footerChildren.push(
          new TextRun({ text: 'Стр. ', font: 'Arial', size: 16, color: '999999' }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '999999' }),
          new TextRun({ text: ' из ', font: 'Arial', size: 16, color: '999999' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: '999999' }),
        );
      }

      sectionObj.footers = {
        default: new Footer({
          children: [new Paragraph({
            children: footerChildren,
            alignment: AlignmentType.CENTER,
          })],
        }),
      };
    }

    sections.push(sectionObj);
  }

  // --- Assemble full document ---------------------------------------------
  const doc = new Document({
    title: title || 'NovaReader Export',
    creator: 'NovaReader',
    description: `Converted from PDF: ${title || 'unknown'}`,
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24 },
          paragraph: { spacing: { line: 276 } },
        },
      },
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', run: { font: 'Arial', size: 24 } },
        {
          id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 48, font: 'Arial' },
          paragraph: { spacing: { before: 480, after: 240 } },
        },
        {
          id: 'Heading2', name: 'heading 2', basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 36, font: 'Arial' },
          paragraph: { spacing: { before: 360, after: 160 } },
        },
        {
          id: 'Heading3', name: 'heading 3', basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 28, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
      ],
      characterStyles: [
        { id: 'Hyperlink', name: 'Hyperlink', run: { color: '0563C1', underline: { type: 'single' } } },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            { level: 0, format: 'bullet', text: '\u2022', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: 'bullet', text: '\u25CB', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: 'bullet', text: '\u25AA', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
        {
          reference: 'numbered-list',
          levels: [
            { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: 'lowerLetter', text: '%2)', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: 'lowerRoman', text: '%3.', alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections,
  });

  return Packer.toBlob(doc);
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

/** Build a heading paragraph. */
function buildHeading(block) {
  const level = HEADING_LEVEL_MAP[block.headingLevel] || HeadingLevel.HEADING_2;
  const runs = extractRuns(block);
  return new Paragraph({
    heading: level,
    children: buildFormattedRuns(runs, { bold: true }),
    spacing: { before: 240, after: 120 },
    alignment: resolveAlignment(block),
  });
}

/** Build a body paragraph. */
function buildParagraph(block) {
  const content = block.content || {};
  const runs = extractRuns(block);
  const indent = {};

  if (content.firstLineIndent) {
    indent.firstLine = Math.round(content.firstLineIndent * PT);
  }
  if (content.leftIndent) {
    indent.left = Math.round(content.leftIndent * PT);
  }

  return new Paragraph({
    children: buildFormattedRuns(runs),
    spacing: {
      before: Math.round((content.spaceBefore || 0) * PT),
      after: Math.round((content.spaceAfter || 0) * PT),
    },
    indent: (indent.firstLine || indent.left) ? indent : undefined,
    alignment: resolveAlignment(block),
  });
}

/** Build a list item (bullet or numbered). */
function buildListItem(block) {
  const listInfo = block.listInfo || {};
  const isBullet = listInfo.type === 'bullet';
  const level = listInfo.level || 0;
  const runs = extractRuns(block);

  return new Paragraph({
    children: buildFormattedRuns(runs),
    numbering: {
      reference: isBullet ? 'bullet-list' : 'numbered-list',
      level: Math.min(level, 2),
    },
    spacing: { after: 40 },
    alignment: resolveAlignment(block),
  });
}

/** Build a footnote paragraph (smaller text, indented). */
function buildFootnote(block) {
  const runs = extractRuns(block);
  const children = [];

  // Prepend footnote marker if available
  if (block.footnoteId) {
    children.push(new TextRun({
      text: block.footnoteId + ' ',
      superScript: true,
      font: 'Arial',
      size: 16,
    }));
  }
  children.push(...buildFormattedRuns(runs, { maxSize: 18 }));

  return new Paragraph({
    children,
    spacing: { before: 40, after: 20 },
    indent: { left: 360, hanging: 360 },
  });
}

/** Build a formula paragraph (monospace, centered). */
function buildFormula(block) {
  const runs = extractRuns(block);
  return new Paragraph({
    children: buildFormattedRuns(runs, { fontOverride: 'Cambria Math' }),
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
  });
}

/** Build a TOC entry paragraph (with right-aligned page number via tab). */
function buildTocEntry(block) {
  const runs = extractRuns(block);
  const content = block.content || {};
  const indent = {};
  if (content.leftIndent) {
    indent.left = Math.round(content.leftIndent * PT);
  }

  return new Paragraph({
    children: buildFormattedRuns(runs),
    spacing: { after: 20 },
    indent: indent.left ? indent : undefined,
  });
}

/** Build a caption paragraph (italic, centered, smaller). */
function buildCaption(block) {
  const runs = extractRuns(block);
  return new Paragraph({
    children: buildFormattedRuns(runs, { italic: true, maxSize: 20 }),
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
  });
}

/** Build an image paragraph. */
function buildImage(block) {
  const content = block.content || {};
  const imageData = content.data || content.imageData;

  if (!imageData) {
    // No image data — render alt text as placeholder
    return new Paragraph({
      children: [new TextRun({
        text: `[Image: ${block.altText || content.altText || 'image'}]`,
        italics: true,
        color: '888888',
        font: 'Arial',
        size: 20,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
    });
  }

  const bbox = block.bbox || {};
  const imgWidth = Math.min(bbox.w || content.width || 400, 500);
  const imgHeight = Math.min(bbox.h || content.height || 300, 700);

  return new Paragraph({
    children: [new ImageRun({
      data: imageData,
      transformation: { width: imgWidth, height: imgHeight },
      type: content.mimeType === 'image/jpeg' ? 'jpg' : 'png',
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
  });
}

/** Build a table from semantic block rows. */
function buildTable(block) {
  const rows = block.rows || [];
  if (!rows.length) {
    return new Paragraph({ text: '' });
  }

  // Determine column count from the widest row
  const maxCols = Math.max(...rows.map(r => {
    if (Array.isArray(r.cells)) return r.cells.length;
    if (Array.isArray(r)) return r.length;
    return 1;
  }), 1);

  const colWidth = Math.floor(9000 / maxCols);

  const tableRows = rows.map((row, rowIdx) => {
    const cells = [];
    const rowCells = Array.isArray(row.cells) ? row.cells : (Array.isArray(row) ? row : []);

    for (let c = 0; c < maxCols; c++) {
      const cellData = rowCells[c];
      const cellChildren = [];

      if (cellData && cellData.runs && cellData.runs.length) {
        cellChildren.push(...buildFormattedRuns(cellData.runs));
      } else if (cellData && cellData.lines) {
        // Cell with lines (from layout analyzer)
        const cellRuns = [];
        for (const line of cellData.lines) {
          if (line.runs) cellRuns.push(...line.runs);
        }
        if (cellRuns.length) {
          cellChildren.push(...buildFormattedRuns(cellRuns));
        } else {
          cellChildren.push(new TextRun({ text: '', font: 'Arial', size: 20 }));
        }
      } else {
        const cellText = (cellData && typeof cellData === 'object')
          ? (cellData.text || '')
          : (typeof cellData === 'string' ? cellData : '');
        cellChildren.push(new TextRun({
          text: cellText,
          font: 'Arial',
          size: 20,
          bold: rowIdx === 0,
        }));
      }

      const cellProps = {
        children: [new Paragraph({ children: cellChildren })],
        width: { size: colWidth, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
        },
      };

      // Header row shading
      if (rowIdx === 0) {
        cellProps.shading = { type: ShadingType.CLEAR, fill: 'E8E8E8' };
      }

      // Cell spanning
      if (cellData && cellData.colSpan && cellData.colSpan > 1) {
        cellProps.columnSpan = cellData.colSpan;
      }
      if (cellData && cellData.rowSpan && cellData.rowSpan > 1) {
        cellProps.rowSpan = cellData.rowSpan;
      }

      cells.push(new TableCell(cellProps));
    }

    return new TableRow({ children: cells });
  });

  return new Table({
    rows: tableRows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

// ---------------------------------------------------------------------------
// Run formatting helpers
// ---------------------------------------------------------------------------

/**
 * Extract flat array of text runs from a semantic block.
 * Blocks store content in content.lines[].runs[].
 */
function extractRuns(block) {
  const content = block.content || {};
  if (!content.lines) return [];

  const runs = [];
  for (const line of content.lines) {
    if (line.runs) {
      runs.push(...line.runs);
    }
  }
  return runs;
}

/**
 * Convert an array of raw runs into docx TextRun / ExternalHyperlink objects,
 * inserting space runs between them.
 */
function buildFormattedRuns(runs, opts = {}) {
  if (!runs.length) return [new TextRun({ text: '' })];

  const result = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.url) {
      result.push(makeHyperlink(run));
    } else {
      result.push(makeTextRun(run, opts));
    }

    // Insert space between runs
    if (i < runs.length - 1) {
      const font = resolveFont(run.fontFamily);
      const size = Math.round((run.fontSize || 12) * 2);
      result.push(new TextRun({ text: ' ', font, size }));
    }
  }
  return result;
}

/** Create a single TextRun from a raw run object. */
function makeTextRun(run, opts = {}) {
  const fontSize = run.fontSize || 12;
  const clampedSize = Math.min(opts.maxSize || 72, Math.max(opts.minSize || 8, fontSize));
  const font = opts.fontOverride || resolveFont(run.fontFamily);

  const props = {
    text: run.text || '',
    bold: opts.bold ?? run.bold,
    italics: opts.italic ?? run.italic,
    font,
    size: Math.round(clampedSize * 2), // half-points
  };

  if (run.underline) {
    props.underline = { type: 'single' };
  }
  if (run.strikethrough) {
    props.strike = true;
  }
  if (run.superscript) {
    props.superScript = true;
  } else if (run.subscript) {
    props.subScript = true;
  }

  // Color (skip black as it's the default)
  const color = run.color;
  if (color && color !== '000000' && color !== '#000000') {
    const c = color.startsWith('#') ? color.slice(1) : color;
    if (/^[0-9a-fA-F]{6}$/.test(c)) props.color = c;
  }
  if (opts.color) props.color = opts.color;

  // Character spacing
  if (run.charSpacing && run.charSpacing !== 0) {
    props.characterSpacing = Math.round(run.charSpacing * 20);
  }

  return new TextRun(props);
}

/** Create a hyperlink from a run with a url property. */
function makeHyperlink(run) {
  const font = resolveFont(run.fontFamily);
  return new ExternalHyperlink({
    children: [new TextRun({
      text: run.text || '',
      style: 'Hyperlink',
      color: '0563C1',
      underline: { type: 'single' },
      font,
      size: Math.round((run.fontSize || 12) * 2),
    })],
    link: run.url,
  });
}

/** Map a font family hint to a concrete DOCX font name. */
function resolveFont(fontFamily) {
  if (!fontFamily) return 'Arial';
  return FONT_MAP[fontFamily] || fontFamily;
}

/** Resolve alignment from a block's content. */
function resolveAlignment(block) {
  const alignment = block.content?.alignment || 'left';
  return ALIGNMENT_MAP[alignment] || AlignmentType.LEFT;
}

/**
 * Build TextRun[] from header/footer content arrays.
 * Each item in the array is a region with .lines[].runs[].
 */
function buildRunsFromContentLines(regions) {
  const result = [];
  for (const region of regions) {
    if (region.lines) {
      for (const line of region.lines) {
        if (line.runs) {
          for (const run of line.runs) {
            result.push(makeTextRun(run, { maxSize: 18 }));
          }
        }
      }
    }
  }
  if (!result.length) {
    result.push(new TextRun({ text: '', font: 'Arial', size: 16 }));
  }
  return result;
}
