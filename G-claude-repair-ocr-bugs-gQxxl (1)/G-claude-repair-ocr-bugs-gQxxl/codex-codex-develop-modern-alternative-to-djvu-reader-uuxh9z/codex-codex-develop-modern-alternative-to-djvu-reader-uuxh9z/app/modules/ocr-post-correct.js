// ─── OCR Post-Correction ────────────────────────────────────────────────────
// Dictionary-based correction, n-gram analysis, paragraph structure recovery.

const COMMON_OCR_SUBSTITUTIONS = [
  // Character-level confusions
  ['rn', 'm'], ['cl', 'd'], ['li', 'h'], ['vv', 'w'],
  ['0', 'O'], ['1', 'l'], ['5', 'S'], ['8', 'B'],
  ['|', 'l'], ['!', 'l'], ['()', 'O'],
  // Russian OCR confusions
  ['3', 'З'], ['6', 'б'], ['п', 'н'],
];

const BIGRAM_FREQ_THRESHOLD = 0.0001;

/**
 * Build a dictionary Set from text (one word per line or space-separated).
 * @param {string} text
 * @returns {Set<string>}
 */
export function buildDictionary(text) {
  const words = text.toLowerCase().match(/[\p{L}]{2,}/gu) || [];
  return new Set(words);
}

/**
 * Compute character bigram frequencies from a corpus.
 * @param {string} text
 * @returns {Map<string, number>}
 */
export function computeBigramFreqs(text) {
  const clean = text.toLowerCase().replace(/[^\p{L}]/gu, ' ');
  const freqs = new Map();
  let total = 0;
  for (let i = 0; i < clean.length - 1; i++) {
    const bg = clean.slice(i, i + 2);
    if (bg.includes(' ')) continue;
    freqs.set(bg, (freqs.get(bg) || 0) + 1);
    total++;
  }
  if (total > 0) {
    for (const [k, v] of freqs) freqs.set(k, v / total);
  }
  return freqs;
}

/**
 * Score a word by its bigram plausibility.
 * @param {string} word
 * @param {Map<string, number>} bigramFreqs
 * @returns {number} Average bigram frequency (higher = more plausible)
 */
export function scoreBigrams(word, bigramFreqs) {
  const w = word.toLowerCase();
  if (w.length < 2) return 1;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < w.length - 1; i++) {
    const bg = w.slice(i, i + 2);
    sum += bigramFreqs.get(bg) || 0;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Generate candidate corrections for a word using common OCR substitutions.
 * @param {string} word
 * @returns {string[]}
 */
export function generateCandidates(word) {
  const candidates = new Set();
  const lower = word.toLowerCase();

  for (const [from, to] of COMMON_OCR_SUBSTITUTIONS) {
    // Forward substitution
    if (lower.includes(from)) {
      candidates.add(lower.replace(from, to));
    }
    // Reverse substitution
    if (lower.includes(to)) {
      candidates.add(lower.replace(to, from));
    }
  }

  // Single-character deletion
  for (let i = 0; i < lower.length; i++) {
    candidates.add(lower.slice(0, i) + lower.slice(i + 1));
  }

  // Single-character transposition
  for (let i = 0; i < lower.length - 1; i++) {
    const arr = [...lower];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    candidates.add(arr.join(''));
  }

  candidates.delete(lower);
  return [...candidates];
}

/**
 * Correct OCR text using a dictionary and bigram model.
 * @param {string} text - Raw OCR output
 * @param {Set<string>} dictionary
 * @param {Map<string, number>} [bigramFreqs]
 * @param {object} [options]
 * @param {number} [options.minWordLength=3]
 * @param {number} [options.maxCorrections=500]
 * @returns {{corrected: string, corrections: Array<{original: string, replacement: string, position: number}>}}
 */
export function correctOcrText(text, dictionary, bigramFreqs = null, options = {}) {
  const { minWordLength = 3, maxCorrections = 500 } = options;
  const corrections = [];
  let corrected = text;
  let offset = 0;

  const wordRegex = /[\p{L}]{2,}/gu;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    if (corrections.length >= maxCorrections) break;

    const word = match[0];
    if (word.length < minWordLength) continue;
    if (dictionary.has(word.toLowerCase())) continue;

    // Try candidates
    const candidates = generateCandidates(word);
    let bestCandidate = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      if (!dictionary.has(candidate)) continue;
      if (bigramFreqs) {
        const score = scoreBigrams(candidate, bigramFreqs);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      } else {
        bestCandidate = candidate;
        break;
      }
    }

    if (bestCandidate) {
      // Preserve original case
      const replacement = preserveCase(word, bestCandidate);
      const pos = match.index + offset;
      corrected = corrected.slice(0, pos) + replacement + corrected.slice(pos + word.length);
      offset += replacement.length - word.length;
      corrections.push({
        original: word,
        replacement,
        position: match.index,
      });
    }
  }

  return { corrected, corrections };
}

/**
 * Preserve the case pattern of the original word in the replacement.
 */
function preserveCase(original, replacement) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Recover paragraph structure from raw OCR text.
 * Merges lines that are part of the same paragraph and separates distinct paragraphs.
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.minParagraphGap=1.5] - Line height multiplier to detect paragraph breaks
 * @returns {string}
 */
export function recoverParagraphs(text, options = {}) {
  const lines = text.split('\n');
  if (lines.length === 0) return text;

  const paragraphs = [];
  let current = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
      continue;
    }

    // Heuristics for paragraph break:
    // 1. Previous line ends with sentence-ending punctuation and is short
    // 2. Current line starts with uppercase/indent
    if (current.length > 0) {
      const prevLine = current[current.length - 1];
      const endsWithPeriod = /[.!?»"]\s*$/.test(prevLine);
      const startsWithUpper = /^[A-ZА-ЯЁ]/.test(line);
      const prevIsShort = prevLine.length < 60;

      if (endsWithPeriod && startsWithUpper && prevIsShort) {
        paragraphs.push(current.join(' '));
        current = [line];
        continue;
      }
    }

    // Check if line ends with hyphenation
    if (line.endsWith('-') && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && /^[\p{Ll}]/u.test(nextLine)) {
        // Merge hyphenated word: join prefix with start of next line
        const firstSpaceIdx = nextLine.indexOf(' ');
        if (firstSpaceIdx === -1) {
          // Next line is a single word — concatenate entirely
          current.push(line.slice(0, -1) + nextLine);
        } else {
          // Concatenate prefix with first word, keep rest of next line
          current.push(line.slice(0, -1) + nextLine.slice(0, firstSpaceIdx));
          current.push(nextLine.slice(firstSpaceIdx + 1));
        }
        i++; // skip next line (already consumed)
        continue;
      }
    }

    current.push(line);
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs.join('\n\n');
}

/**
 * Compute text quality score (0-100) based on dictionary coverage.
 * @param {string} text
 * @param {Set<string>} dictionary
 * @returns {number}
 */
export function computeQualityScore(text, dictionary) {
  const words = text.match(/[\p{L}]{3,}/gu) || [];
  if (words.length === 0) return 100;
  const found = words.filter(w => dictionary.has(w.toLowerCase())).length;
  return Math.round((found / words.length) * 100);
}
