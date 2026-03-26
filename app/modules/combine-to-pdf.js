// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Combine Files to PDF
// Merge multiple file types into a single PDF document
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} InputFile
 * @property {string} name
 * @property {Uint8Array|ArrayBuffer} bytes
 * @property {'pdf'|'image'|'txt'|'html'} type
 */

/**
 * @typedef {Object} SourceInfo
 * @property {string} name
 * @property {number} startPage
 * @property {number} pageCount
 */

/**
 * Convert a single file to PDF pages embedded in a PDFDocument.
 * @param {any} PDFDocument - pdf-lib PDFDocument class
 * @param {any} StandardFonts - pdf-lib StandardFonts
 * @param {any} rgb - pdf-lib rgb function
 * @param {InputFile} file
 * @returns {Promise<{doc: any, pageCount: number}>}
 */
async function fileToPdf(PDFDocument, StandardFonts, rgb, file) {
  const data = file.bytes instanceof Uint8Array
    ? file.bytes
    : new Uint8Array(file.bytes);

  switch (file.type) {
    case 'pdf': {
      const doc = await PDFDocument.load(data, { ignoreEncryption: true });
      return { doc, pageCount: doc.getPageCount() };
    }

    case 'image': {
      const doc = await PDFDocument.create();
      let img;
      // Detect image type from header bytes
      if (data[0] === 0x89 && data[1] === 0x50) {
        img = await doc.embedPng(data);
      } else {
        img = await doc.embedJpg(data);
      }

      const dims = img.scale(1);
      const page = doc.addPage([dims.width, dims.height]);
      page.drawImage(img, { x: 0, y: 0, width: dims.width, height: dims.height });
      return { doc, pageCount: 1 };
    }

    case 'txt': {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Courier);
      const text = new TextDecoder().decode(data);
      const lines = text.split('\n');
      const fontSize = 10;
      const lineHeight = fontSize * 1.3;
      const pageW = 612;
      const pageH = 792;
      const margin = 50;
      const maxLines = Math.floor((pageH - 2 * margin) / lineHeight);

      for (let i = 0; i < lines.length; i += maxLines) {
        const page = doc.addPage([pageW, pageH]);
        const chunk = lines.slice(i, i + maxLines);
        let y = pageH - margin;

        for (const line of chunk) {
          y -= lineHeight;
          page.drawText(line.slice(0, 100), {
            x: margin, y, size: fontSize, font, color: rgb(0, 0, 0),
          });
        }
      }

      if (doc.getPageCount() === 0) doc.addPage([612, 792]);
      return { doc, pageCount: doc.getPageCount() };
    }

    case 'html': {
      // Basic HTML to text conversion
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const htmlStr = new TextDecoder().decode(data);
      const plainText = htmlStr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const fontSize = 11;
      const lineHeight = fontSize * 1.4;
      const pageW = 612;
      const pageH = 792;
      const margin = 50;
      const charsPerLine = Math.floor((pageW - 2 * margin) / (fontSize * 0.5));
      const words = plainText.split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        if (line.length + word.length + 1 > charsPerLine && line) {
          lines.push(line);
          line = word;
        } else {
          line = line ? line + ' ' + word : word;
        }
      }
      if (line) lines.push(line);

      const maxLines = Math.floor((pageH - 2 * margin) / lineHeight);
      for (let i = 0; i < lines.length; i += maxLines) {
        const page = doc.addPage([pageW, pageH]);
        const chunk = lines.slice(i, i + maxLines);
        let y = pageH - margin;
        for (const l of chunk) {
          y -= lineHeight;
          page.drawText(l, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        }
      }

      if (doc.getPageCount() === 0) doc.addPage([612, 792]);
      return { doc, pageCount: doc.getPageCount() };
    }

    default: {
      // Unknown type — create a blank page with filename
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([612, 792]);
      page.drawText(`Unsupported file: ${file.name}`, {
        x: 50, y: 700, size: 14, font, color: rgb(0.5, 0, 0),
      });
      return { doc, pageCount: 1 };
    }
  }
}

/**
 * Combine multiple files into a single PDF document.
 *
 * @param {InputFile[]} files
 * @param {object} [options]
 * @param {boolean} [options.addBookmarks]
 * @param {string} [options.title]
 * @returns {Promise<{blob: Blob, pageCount: number, sources: SourceInfo[]}>}
 */
export async function combineFilesToPdf(files, options = {}) {
  const { addBookmarks = false, title = 'Combined Document' } = options;
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFNumber } = await import('pdf-lib');

  const merged = await PDFDocument.create();
  merged.setTitle(title);
  merged.setProducer('NovaReader File Combiner');

  /** @type {SourceInfo[]} */
  const sources = [];
  let currentPage = 1;

  for (const file of files) {
    const { doc, pageCount } = await fileToPdf(PDFDocument, StandardFonts, rgb, file);
    const copiedPages = await merged.copyPages(doc, doc.getPageIndices());

    for (const page of copiedPages) {
      merged.addPage(page);
    }

    sources.push({
      name: file.name,
      startPage: currentPage,
      pageCount,
    });

    currentPage += pageCount;
  }

  // Ensure at least one page
  if (merged.getPageCount() === 0) {
    merged.addPage([612, 792]);
  }

  // Add bookmarks if requested
  if (addBookmarks && sources.length > 0) {
    try {
      const ctx = merged.context;
      const pageRefs = merged.getPages().map(p => p.ref);
      const outlinesDict = ctx.obj({ Type: 'Outlines' });
      const outlinesRef = ctx.register(outlinesDict);

      const refs = sources.map(src => {
        const pageIdx = Math.min(src.startPage - 1, pageRefs.length - 1);
        const dict = ctx.obj({});
        dict.set(PDFName.of('Title'), PDFString.of(src.name));
        dict.set(PDFName.of('Parent'), outlinesRef);
        dict.set(PDFName.of('Dest'), ctx.obj([pageRefs[pageIdx], PDFName.of('Fit')]));
        return ctx.register(dict);
      });

      for (let i = 0; i < refs.length; i++) {
        const dict = ctx.lookup(refs[i]);
        if (i > 0) /** @type {any} */ (dict).set(PDFName.of('Prev'), refs[i - 1]);
        if (i < refs.length - 1) /** @type {any} */ (dict).set(PDFName.of('Next'), refs[i + 1]);
      }

      outlinesDict.set(PDFName.of('First'), refs[0]);
      outlinesDict.set(PDFName.of('Last'), refs[refs.length - 1]);
      outlinesDict.set(PDFName.of('Count'), PDFNumber.of(refs.length));
      merged.catalog.set(PDFName.of('Outlines'), outlinesRef);
    } catch (_e) {
      // Bookmark creation failed — continue without bookmarks
    }
  }

  const bytes = await merged.save();
  const blob = new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' });

  return {
    blob,
    pageCount: merged.getPageCount(),
    sources,
  };
}
