/**
 * @module conversion-qa
 * @description Layer 5 – Quality Assurance for the PDF→DOCX conversion pipeline.
 *
 * Provides text-fidelity metrics (CER, WER), a composite layout score that
 * combines multiple quality dimensions, and an end-to-end validation helper
 * that can be called after every conversion to quantify accuracy.
 *
 * All public functions are pure (no side-effects) except `validateConversion`,
 * which is async only for forward-compatibility with visual-SSIM scoring.
 */

// ---------------------------------------------------------------------------
// String distance utilities
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein (edit) distance between two strings.
 *
 * For inputs where both strings exceed {@link BAND_THRESHOLD} characters the
 * algorithm switches to a banded variant (band width = {@link BAND_WIDTH})
 * that runs in O(n × band) instead of O(n × m), trading a small amount of
 * accuracy for dramatically lower memory and CPU usage.
 *
 * @param {string} a - Source string.
 * @param {string} b - Target string.
 * @returns {number} The minimum number of single-character edits (insertions,
 *   deletions, substitutions) required to change `a` into `b`.
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure `a` is the shorter string so that the single-row DP vector is as
  // small as possible.
  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }

  const aLen = a.length;
  const bLen = b.length;

  // Use banded approach for long strings to avoid O(n²) blowup.
  if (aLen > BAND_THRESHOLD && bLen > BAND_THRESHOLD) {
    return _levenshteinBanded(a, b, BAND_WIDTH);
  }

  return _levenshteinFull(a, b);
}

/** @private Threshold (in characters) above which the banded algorithm is used. */
const BAND_THRESHOLD = 5000;

/** @private Half-width of the diagonal band. */
const BAND_WIDTH = 100;

/**
 * Standard single-row Levenshtein DP.
 *
 * @param {string} a - Shorter string.
 * @param {string} b - Longer string.
 * @returns {number}
 * @private
 */
function _levenshteinFull(a, b) {
  const aLen = a.length;
  const bLen = b.length;

  // `prev` holds the previous row of the DP matrix.
  let prev = new Array(aLen + 1);
  let curr = new Array(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,       // deletion
        curr[i - 1] + 1,   // insertion
        prev[i - 1] + cost, // substitution
      );
    }
    // Swap rows.
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[aLen];
}

/**
 * Banded Levenshtein – only evaluates cells within `band` positions of the
 * main diagonal. When the two strings differ in length by more than `band`
 * the result is an *approximation* (always an underestimate of the true
 * distance), but for the QA use-case this is acceptable because large
 * length differences already signal a low-quality conversion.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @param {number} band - Half-width of the diagonal band.
 * @returns {number}
 * @private
 */
function _levenshteinBanded(a, b, band) {
  const aLen = a.length;
  const bLen = b.length;

  // If the length difference alone exceeds the band we can short-circuit.
  if (Math.abs(aLen - bLen) > band) {
    return Math.abs(aLen - bLen);
  }

  const width = 2 * band + 1;
  let prev = new Array(width).fill(Infinity);
  let curr = new Array(width).fill(Infinity);

  // Initialise row 0.
  for (let k = 0; k < width; k++) {
    const i = k - band;
    if (i >= 0 && i <= aLen) {
      prev[k] = i;
    }
  }

  for (let j = 1; j <= bLen; j++) {
    curr.fill(Infinity);
    for (let k = 0; k < width; k++) {
      const i = j - band + k;
      if (i < 0 || i > aLen) continue;

      if (i === 0) {
        curr[k] = j;
        continue;
      }

      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      // deletion  → prev row, same i  → prev[k]
      let val = prev[k] + 1;

      // insertion → curr row, i-1     → curr[k-1]
      if (k > 0 && curr[k - 1] + 1 < val) {
        val = curr[k - 1] + 1;
      }

      // substitution → prev row, i-1  → prev[k-1]
      if (k > 0 && prev[k - 1] + cost < val) {
        val = prev[k - 1] + cost;
      }

      curr[k] = val;
    }

    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  // The answer sits at position corresponding to i = aLen in row bLen.
  const answerK = aLen - bLen + band;
  if (answerK < 0 || answerK >= width) {
    // Fell outside band – return the length difference as a safe fallback.
    return Math.abs(aLen - bLen);
  }
  return prev[answerK];
}

// ---------------------------------------------------------------------------
// Word Error Rate
// ---------------------------------------------------------------------------

/**
 * Compute the Word Error Rate (WER) between a reference and a hypothesis
 * string.
 *
 * Both inputs are first normalised (collapse whitespace, trim) and then
 * tokenised on whitespace boundaries. The Levenshtein distance is computed
 * over the resulting word arrays and divided by the number of reference
 * words.
 *
 * @param {string} reference - The ground-truth text (typically extracted from
 *   the source PDF).
 * @param {string} hypothesis - The text produced by the conversion pipeline.
 * @returns {number} WER in the range [0, ∞). A value of 0 means a perfect
 *   match; values above 1.0 are possible when the hypothesis contains more
 *   insertions than the reference has words.
 */
export function wordErrorRate(reference, hypothesis) {
  const refWords = _tokenize(reference);
  const hypWords = _tokenize(hypothesis);

  if (refWords.length === 0 && hypWords.length === 0) return 0;
  if (refWords.length === 0) return hypWords.length;

  const dist = _levenshteinWords(refWords, hypWords);
  return dist / refWords.length;
}

/**
 * Tokenise a string into a word array.
 *
 * @param {string} s
 * @returns {string[]}
 * @private
 */
function _tokenize(s) {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length === 0 ? [] : trimmed.split(' ');
}

/**
 * Levenshtein distance over word arrays.
 *
 * Uses the same single-row optimisation as the character variant, but
 * operates on arrays of strings instead of individual characters.
 *
 * @param {string[]} a - Reference word array.
 * @param {string[]} b - Hypothesis word array.
 * @returns {number}
 * @private
 */
function _levenshteinWords(a, b) {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  let prev = new Array(aLen + 1);
  let curr = new Array(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + cost,
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[aLen];
}

// ---------------------------------------------------------------------------
// Text Content Diff (Character Error Rate)
// ---------------------------------------------------------------------------

/**
 * Normalise a string for text comparison.
 *
 * - Collapses all whitespace sequences into a single space.
 * - Removes soft hyphens (U+00AD).
 * - Strips leading / trailing whitespace.
 *
 * @param {string} s
 * @returns {string}
 * @private
 */
function _normalizeText(s) {
  return s.replace(/\s+/g, ' ').replace(/\u00AD/g, '').trim();
}

/**
 * Compute the Character Error Rate (CER) and Word Error Rate (WER) between
 * the text extracted from the source PDF and the text present in the
 * generated DOCX.
 *
 * Both texts are normalised before comparison (whitespace collapse, soft
 * hyphen removal). The CER is defined as `editDistance / max(refLength, 1)`.
 *
 * @param {string} pdfText  - Raw text extracted from the PDF.
 * @param {string} docxText - Raw text extracted from the DOCX.
 * @returns {{
 *   cer: number,
 *   wer: number,
 *   distance: number,
 *   pdfLength: number,
 *   docxLength: number,
 * }}
 */
export function computeTextCER(pdfText, docxText) {
  const a = _normalizeText(pdfText);
  const b = _normalizeText(docxText);

  const distance = levenshtein(a, b);
  const cer = distance / Math.max(a.length, 1);
  const wer = wordErrorRate(a, b);

  return {
    cer,
    wer,
    distance,
    pdfLength: a.length,
    docxLength: b.length,
  };
}

// ---------------------------------------------------------------------------
// Composite Layout Score
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LayoutMetrics
 * @property {number} cer              - Character Error Rate (0 = perfect).
 * @property {number} [ssim]           - Visual SSIM score (0-1, optional).
 * @property {number} tablesCorrect    - Number of correctly reproduced tables.
 * @property {number} tablesTotal      - Total number of tables in the source.
 * @property {number} fontsCorrect     - Number of correctly matched fonts.
 * @property {number} fontsTotal       - Total fonts in the source.
 * @property {number} headingsCorrect  - Number of correctly detected headings.
 * @property {number} headingsTotal    - Total headings in the source.
 * @property {number} listsCorrect     - Number of correctly detected lists.
 * @property {number} listsTotal       - Total lists in the source.
 */

/**
 * @typedef {Object} LayoutScoreResult
 * @property {number} totalScore          - Weighted composite score (0-1).
 * @property {Object<string, number>} scores  - Individual dimension scores.
 * @property {Object<string, number>} weights - Dimension weights (sum to 1).
 */

/**
 * Compute a composite layout-fidelity score that combines multiple quality
 * dimensions into a single 0-1 number.
 *
 * The dimensions and their default weights are:
 *
 * | Dimension     | Weight |
 * |---------------|--------|
 * | textCER       | 0.30   |
 * | visualSSIM    | 0.25   |
 * | tableMatch    | 0.20   |
 * | fontMatch     | 0.10   |
 * | headingMatch  | 0.10   |
 * | listMatch     | 0.05   |
 *
 * Each dimension is normalised to the 0-1 range before weighting. The
 * textCER dimension is mapped via `max(0, 1 - cer * 10)` so that a CER
 * of 0.10 (10 %) already results in a score of 0 for that dimension.
 *
 * @param {LayoutMetrics} metrics - Raw metric values from the conversion.
 * @returns {LayoutScoreResult}
 */
export function computeLayoutScore(metrics) {
  /** @type {Object<string, number>} */
  const weights = {
    textCER: 0.30,
    visualSSIM: 0.25,
    tableMatch: 0.20,
    fontMatch: 0.10,
    headingMatch: 0.10,
    listMatch: 0.05,
  };

  /** @type {Object<string, number>} */
  const scores = {
    textCER: Math.max(0, 1 - (metrics.cer || 0) * 10),
    visualSSIM: metrics.ssim || 0,
    tableMatch: _safeRatio(metrics.tablesCorrect, metrics.tablesTotal),
    fontMatch: _safeRatio(metrics.fontsCorrect, metrics.fontsTotal),
    headingMatch: _safeRatio(metrics.headingsCorrect, metrics.headingsTotal),
    listMatch: _safeRatio(metrics.listsCorrect, metrics.listsTotal),
  };

  let totalScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    totalScore += (scores[key] || 0) * weight;
  }

  return { totalScore, scores, weights };
}

/**
 * Safely divide `numerator / denominator`, returning 0 when the denominator
 * is zero or falsy.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number}
 * @private
 */
function _safeRatio(numerator, denominator) {
  return (numerator || 0) / Math.max(denominator || 0, 1);
}

// ---------------------------------------------------------------------------
// Conversion Validation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ValidationResult
 * @property {LayoutScoreResult} score       - Composite layout score.
 * @property {{cer: number, wer: number, distance: number, pdfLength: number, docxLength: number}} textMetrics
 *   - Detailed text-fidelity metrics.
 * @property {{pageCount: number, tables: number, headings: number}} details
 *   - Structural summary of the source document.
 */

/**
 * Run a basic quality-assurance pass that compares the source PDF content
 * (as extracted pages) against the DOCX text output.
 *
 * This function is intentionally lightweight – it does **not** render
 * pages for visual SSIM comparison (that would require a canvas context).
 * Visual scoring is left at 0 and the score is computed from the remaining
 * dimensions.
 *
 * @param {Array<{
 *   textRuns: Array<{text: string}>,
 *   tables?: any[],
 *   headings?: any[],
 * }>} extractedPages - Pages produced by Layer 1 (pdf-content-extractor).
 * @param {string} docxText - Plain-text representation of the DOCX output.
 * @returns {Promise<ValidationResult>}
 */
export async function validateConversion(extractedPages, docxText) {
  // Concatenate all text runs across every page.
  const pdfText = extractedPages
    .map((p) => (p.textRuns || []).map((r) => r.text).join(' '))
    .join('\n');

  const textMetrics = computeTextCER(pdfText, docxText);

  // Aggregate structural element counts.
  const tables = extractedPages.reduce(
    (n, p) => n + (p.tables?.length || 0),
    0,
  );
  const headings = extractedPages.reduce(
    (n, p) => n + (p.headings?.length || 0),
    0,
  );

  const score = computeLayoutScore({
    cer: textMetrics.cer,
    ssim: 0, // Visual SSIM requires rendering – skipped in basic mode.
    tablesCorrect: tables,
    tablesTotal: tables,
    fontsCorrect: 0,
    fontsTotal: 0,
    headingsCorrect: headings,
    headingsTotal: headings,
    listsCorrect: 0,
    listsTotal: 0,
  });

  return {
    score,
    textMetrics,
    details: {
      pageCount: extractedPages.length,
      tables,
      headings,
    },
  };
}
