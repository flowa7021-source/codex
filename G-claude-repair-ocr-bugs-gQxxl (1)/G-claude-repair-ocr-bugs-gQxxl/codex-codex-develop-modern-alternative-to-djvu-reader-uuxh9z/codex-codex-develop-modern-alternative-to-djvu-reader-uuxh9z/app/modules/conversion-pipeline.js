/**
 * @module conversion-pipeline
 * @description Integration module that wires all five layers of the PDF→DOCX
 * conversion pipeline together and exposes a single, progress-aware entry
 * point ({@link convertPdfToDocxV2}).
 *
 * Pipeline layers:
 *   1. **pdf-content-extractor** – raw content extraction (text runs, images,
 *      annotations) from each PDF page.
 *   2. **layout-analyzer** – spatial analysis, column detection, reading-order
 *      inference, table / figure recognition.
 *   3. **semantic-enricher** – heading hierarchy, list detection, footnote /
 *      caption pairing, section segmentation.
 *   4. **docx-builder** – OpenXML generation via the `docx` library.
 *   5. **conversion-qa** – text-fidelity metrics (CER / WER) and composite
 *      layout score.
 *
 * A backward-compatible wrapper ({@link convertPdfToDocxCompat}) is provided
 * so that existing call-sites can migrate incrementally.
 */

import { extractPageContent } from './pdf-content-extractor.js';
import { analyzeLayout, analyzeMultiPageLayout } from './layout-analyzer.js';
import { enrichSemantics } from './semantic-enricher.js';
import { buildDocxDocument } from './docx-builder.js';
import { validateConversion, computeTextCER } from './conversion-qa.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Semver string identifying this pipeline revision. */
export const PIPELINE_VERSION = '2.0.0';

/**
 * Human-readable names for each pipeline stage, used in progress callbacks.
 * @private
 */
const STAGE_LABELS = {
  extract: 'Content Extraction',
  layout: 'Layout Analysis',
  semantic: 'Semantic Enrichment',
  build: 'DOCX Generation',
  qa: 'Quality Assurance',
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ConvertOptions
 * @property {string}    [title='NovaReader Export'] - Document title embedded
 *   in the DOCX metadata.
 * @property {number[]|null} [pageRange=null] - 1-based page numbers to
 *   convert.  Pass `null` (the default) to convert every page.
 * @property {'text'|'text+images'|'layout'|'images-only'} [mode='text'] -
 *   Conversion mode controlling which content types are included.
 * @property {boolean}   [includeHeader=false] - Whether to generate DOCX
 *   headers.
 * @property {boolean}   [includeFooter=true] - Whether to generate DOCX
 *   footers.
 * @property {Function|null} [capturePageImage=null] - Async callback
 *   `(pageNum: number) => Promise<Uint8Array>` that renders a page to a
 *   PNG image.  Required for `text+images`, `layout`, and `images-only`
 *   modes.
 * @property {Map|null}  [ocrWordCache=null] - Shared OCR word cache passed
 *   through to the content extractor for deduplication.
 * @property {Function}  [onProgress] - Progress callback invoked as
 *   `(stage: string, percent: number, message: string) => void`.
 * @property {boolean}   [runQA=false] - When `true`, the pipeline runs
 *   Layer 5 (quality assurance) and returns metrics alongside the DOCX blob.
 */

/**
 * @typedef {Object} ConvertResult
 * @property {Blob}        blob - The generated DOCX file as a `Blob`.
 * @property {Object|null} qa   - Quality-assurance metrics (only present when
 *   `options.runQA` is `true`).
 */

/**
 * Run the full 5-layer PDF→DOCX conversion pipeline.
 *
 * The function streams progress updates via `options.onProgress` so that the
 * UI can display a stage-aware progress bar.
 *
 * @param {Object} pdfDoc   - A pdf.js `PDFDocumentProxy` instance.
 * @param {ConvertOptions} [options={}]
 * @returns {Promise<ConvertResult>}
 *
 * @example
 * const { blob, qa } = await convertPdfToDocxV2(pdfDoc, {
 *   title: 'My Report',
 *   mode: 'text+images',
 *   runQA: true,
 *   onProgress(stage, pct, msg) { console.log(`[${stage}] ${pct}% – ${msg}`); },
 * });
 */
export async function convertPdfToDocxV2(pdfDoc, options = {}) {
  const {
    title = 'NovaReader Export',
    pageRange = null,
    mode = 'text',
    includeHeader = false,
    includeFooter = true,
    capturePageImage = null,
    ocrWordCache = null,
    onProgress = _noop,
    runQA = false,
  } = options;

  const pageCount = pdfDoc.numPages;
  const pagesToConvert =
    pageRange || Array.from({ length: pageCount }, (_, i) => i + 1);

  // -----------------------------------------------------------------------
  // Stage 1 – Extract content from every requested page
  // -----------------------------------------------------------------------
  onProgress('extract', 0, 'Extracting PDF content...');
  const extractedPages = [];

  for (let i = 0; i < pagesToConvert.length; i++) {
    const pageNum = pagesToConvert[i];
    const pdfPage = await pdfDoc.getPage(pageNum);
    const extracted = await extractPageContent(pdfPage, { ocrWordCache });
    extractedPages.push(extracted);

    const pct = ((i + 1) / pagesToConvert.length) * 100;
    onProgress('extract', pct, `Page ${pageNum}/${pageCount}`);
  }

  // -----------------------------------------------------------------------
  // Stage 2 – Layout analysis
  // -----------------------------------------------------------------------
  onProgress('layout', 0, 'Analyzing layout...');
  const layoutPages = analyzeMultiPageLayout(extractedPages);
  onProgress('layout', 100, 'Layout analysis complete');

  // -----------------------------------------------------------------------
  // Stage 3 – Semantic enrichment
  // -----------------------------------------------------------------------
  onProgress('semantic', 0, 'Detecting document structure...');

  let pdfOutline = null;
  try {
    pdfOutline = await pdfDoc.getOutline();
  } catch (_err) {
    // Outline is optional – many PDFs omit it.
  }

  const semanticSections = enrichSemantics(layoutPages, pdfOutline);
  onProgress('semantic', 100, 'Structure detection complete');

  // -----------------------------------------------------------------------
  // Stage 4 – DOCX generation
  // -----------------------------------------------------------------------
  onProgress('build', 0, 'Building DOCX document...');

  const blob = await buildDocxDocument(semanticSections, {
    title,
    includeHeader,
    includeFooter,
    capturePageImage,
    mode,
  });

  onProgress('build', 100, 'DOCX generation complete');

  // -----------------------------------------------------------------------
  // Stage 5 – Quality assurance (optional)
  // -----------------------------------------------------------------------
  let qa = null;

  if (runQA) {
    onProgress('qa', 0, 'Running quality checks...');

    // Build a plain-text representation of the DOCX by concatenating the
    // text content of every semantic block.  This avoids having to parse the
    // actual OOXML – the semantic sections already carry all text.
    const docxText = semanticSections
      .flatMap((section) =>
        (section.blocks || []).map((block) => {
          if (block.content?.lines) {
            return block.content.lines
              .flatMap((line) => (line.runs || []).map((r) => r.text))
              .join(' ');
          }
          return '';
        }),
      )
      .join('\n');

    // Likewise reconstruct the raw PDF text from extracted pages.
    const pdfText = extractedPages
      .map((p) => (p.textRuns || []).map((r) => r.text).join(' '))
      .join('\n');

    const textMetrics = computeTextCER(pdfText, docxText);

    qa = {
      textMetrics,
      pipelineVersion: PIPELINE_VERSION,
    };

    onProgress(
      'qa',
      100,
      `Quality score: CER=${(textMetrics.cer * 100).toFixed(1)}%`,
    );
  }

  return { blob, qa };
}

// ---------------------------------------------------------------------------
// Backward-compatible wrapper
// ---------------------------------------------------------------------------

/**
 * Backward-compatible wrapper that matches the legacy `convertPdfToDocx`
 * call signature (`pdfDoc, title, pageCount, options`).
 *
 * Internally it delegates to {@link convertPdfToDocxV2}.  If the V2 pipeline
 * throws for any reason the function falls back to the original V1
 * implementation (loaded via a dynamic `import()` to avoid circular
 * dependencies).
 *
 * @param {Object} pdfDoc    - A pdf.js `PDFDocumentProxy` instance.
 * @param {string} title     - Document title.
 * @param {number} pageCount - Total page count (ignored by V2 – obtained
 *   directly from `pdfDoc.numPages`).
 * @param {Object} [options={}] - Additional options forwarded to
 *   {@link convertPdfToDocxV2}.
 * @returns {Promise<Blob>} The generated DOCX file as a `Blob`.
 */
export async function convertPdfToDocxCompat(
  pdfDoc,
  title,
  pageCount,
  options = {},
) {
  try {
    const result = await convertPdfToDocxV2(pdfDoc, { ...options, title });
    return result.blob;
  } catch (err) {
    console.warn('[conversion-pipeline] V2 failed, falling back to V1:', err);

    // Dynamic import keeps the V1 module out of the critical path and
    // avoids circular dependency issues.
    const { convertPdfToDocx } = await import('./docx-converter.js');
    return convertPdfToDocx(pdfDoc, title, pageCount, options);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * No-op function used as the default `onProgress` callback.
 * @private
 */
function _noop() {}
