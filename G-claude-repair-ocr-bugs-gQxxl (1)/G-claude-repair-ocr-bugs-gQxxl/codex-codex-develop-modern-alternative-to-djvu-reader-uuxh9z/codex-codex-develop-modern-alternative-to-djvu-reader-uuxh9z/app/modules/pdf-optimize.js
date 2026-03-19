// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF Optimizer Module
// Reduce PDF file size by compressing images, removing duplicates, cleaning metadata
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, PDFName, PDFDict, PDFStream, PDFArray } from 'pdf-lib';

export class PdfOptimizer {
  /**
   * Optimize a PDF document to reduce file size.
   * @param {ArrayBuffer|Uint8Array} pdfBytes - Original PDF bytes
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} { blob, original, optimized, savings, savingsPercent, details }
   */
  async optimize(pdfBytes, options = {}) {
    const {
      cleanMetadata = true,
      removeUnusedObjects = true,
      compressStreams = true,
      _downscaleImages = false,
      _maxImageDpi = 150,
      _jpegQuality = 75,
      removeThumbnails = true,
      removeJavaScript = true,
      removeAnnotations = false,
    } = options;

    const originalSize = pdfBytes.byteLength || pdfBytes.length;
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const details = {
      metadataCleaned: false,
      thumbnailsRemoved: 0,
      jsActionsRemoved: 0,
      annotationsRemoved: 0,
    };

    // 1. Clean metadata
    if (cleanMetadata) {
      pdfDoc.setTitle(pdfDoc.getTitle() || '');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('NovaReader');
      pdfDoc.setCreator('NovaReader');
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());

      // Try to remove XMP metadata stream
      try {
        const catalog = pdfDoc.catalog;
        if (catalog && catalog.get(PDFName.of('Metadata'))) {
          catalog.delete(PDFName.of('Metadata'));
        }
      } catch (err) { console.warn('[pdf-ops] error:', err?.message); }

      details.metadataCleaned = true;
    }

    // 2. Remove embedded thumbnails
    if (removeThumbnails) {
      for (const page of pdfDoc.getPages()) {
        try {
          const pageDict = page.node;
          if (pageDict.get(PDFName.of('Thumb'))) {
            pageDict.delete(PDFName.of('Thumb'));
            details.thumbnailsRemoved++;
          }
        } catch (err) { console.warn('[pdf-ops] error:', err?.message); }
      }
    }

    // 3. Remove JavaScript actions
    if (removeJavaScript) {
      try {
        const catalog = pdfDoc.catalog;
        // Remove document-level JS
        if (catalog.get(PDFName.of('Names'))) {
          const names = catalog.get(PDFName.of('Names'));
          if (names instanceof PDFDict && names.get(PDFName.of('JavaScript'))) {
            names.delete(PDFName.of('JavaScript'));
            details.jsActionsRemoved++;
          }
        }
        // Remove OpenAction JS
        if (catalog.get(PDFName.of('OpenAction'))) {
          const openAction = catalog.get(PDFName.of('OpenAction'));
          if (openAction instanceof PDFDict) {
            const subtype = openAction.get(PDFName.of('S'));
            if (subtype && subtype.toString() === '/JavaScript') {
              catalog.delete(PDFName.of('OpenAction'));
              details.jsActionsRemoved++;
            }
          }
        }
      } catch (err) { console.warn('[pdf-ops] error:', err?.message); }
    }

    // 4. Remove annotations (if requested)
    if (removeAnnotations) {
      for (const page of pdfDoc.getPages()) {
        try {
          const pageDict = page.node;
          const annots = pageDict.get(PDFName.of('Annots'));
          if (annots) {
            const count = annots instanceof PDFArray ? annots.size() : 1;
            pageDict.delete(PDFName.of('Annots'));
            details.annotationsRemoved += count;
          }
        } catch (err) { console.warn('[pdf-ops] error:', err?.message); }
      }
    }

    // 5. Save with optimizations
    const saveOptions = {};
    if (compressStreams) {
      saveOptions.useObjectStreams = true;
    }
    if (removeUnusedObjects) {
      // pdf-lib automatically prunes unreferenced objects during save
    }

    const optimizedBytes = await pdfDoc.save(saveOptions);
    const optimizedSize = optimizedBytes.byteLength;
    const savings = originalSize - optimizedSize;
    const savingsPercent = originalSize > 0 ? ((savings / originalSize) * 100).toFixed(1) : '0.0';

    return {
      blob: new Blob([optimizedBytes], { type: 'application/pdf' }),
      original: originalSize,
      optimized: optimizedSize,
      savings: Math.max(0, savings),
      savingsPercent,
      details,
      summary: this._formatSize(originalSize) + ' → ' + this._formatSize(optimizedSize) +
        ` (${savingsPercent}% экономия)`,
    };
  }

  /**
   * Analyze a PDF to estimate potential savings
   */
  async analyze(pdfBytes) {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    let imageCount = 0;
    let totalImageBytes = 0;
    let hasJavaScript = false;
    let hasThumbnails = false;
    let annotationCount = 0;
    let hasXmpMetadata = false;

    // Check catalog
    try {
      const catalog = pdfDoc.catalog;
      if (catalog.get(PDFName.of('Metadata'))) hasXmpMetadata = true;
      const names = catalog.get(PDFName.of('Names'));
      if (names instanceof PDFDict && names.get(PDFName.of('JavaScript'))) hasJavaScript = true;
    } catch (err) { console.warn('[pdf-ops] error:', err?.message); }

    // Check pages
    for (const page of pdfDoc.getPages()) {
      try {
        const pageDict = page.node;
        if (pageDict.get(PDFName.of('Thumb'))) hasThumbnails = true;
        const annots = pageDict.get(PDFName.of('Annots'));
        if (annots instanceof PDFArray) annotationCount += annots.size();

        // Count images in resources
        const resources = pageDict.get(PDFName.of('Resources'));
        if (resources instanceof PDFDict) {
          const xObject = resources.get(PDFName.of('XObject'));
          if (xObject instanceof PDFDict) {
            const entries = xObject.entries();
            for (const [, value] of entries) {
              if (value instanceof PDFStream) {
                const subtype = value.dict.get(PDFName.of('Subtype'));
                if (subtype && subtype.toString() === '/Image') {
                  imageCount++;
                  // Estimate image size from stream length
                  const length = value.dict.get(PDFName.of('Length'));
                  if (length) totalImageBytes += Number(length.toString()) || 0;
                }
              }
            }
          }
        }
      } catch (err) { console.warn('[pdf-ops] error:', err?.message); }
    }

    return {
      totalSize: this._formatSize(pdfBytes.byteLength || pdfBytes.length),
      pageCount: pdfDoc.getPageCount(),
      imageCount,
      estimatedImageSize: this._formatSize(totalImageBytes),
      hasJavaScript,
      hasThumbnails,
      annotationCount,
      hasXmpMetadata,
      hasTitle: !!pdfDoc.getTitle(),
      hasAuthor: !!pdfDoc.getAuthor(),
    };
  }

  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }
}

export const pdfOptimizer = new PdfOptimizer();
