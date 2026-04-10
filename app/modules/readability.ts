// @ts-check
// ─── Readability ─────────────────────────────────────────────────────────────
// Standard readability formulae: Flesch-Kincaid, Gunning Fog, SMOG,
// Automated Readability Index, Coleman-Liau, and a combined text summary.
// No DOM dependencies — pure computation.

import {
  wordCount,
  sentenceCount,
  characterCount,
  tokenize,
} from './text-statistics.js';

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Count vowel groups (syllable nuclei) in a single lower-cased word. */
function countVowelGroups(word: string): number {
  return (word.toLowerCase().match(/[aeiouy]+/g) || []).length;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Approximate syllable count for a single word.
 *
 * Algorithm:
 *  1. Lower-case and strip non-alpha characters.
 *  2. Count vowel groups.
 *  3. Subtract silent trailing-e.
 *  4. Ensure at least 1 syllable per non-empty word.
 */
export function syllableCount(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length === 0) return 0;
  let count = countVowelGroups(clean);
  // Subtract silent trailing 'e' (e.g. "cake" → 1, not 2)
  if (clean.endsWith('e') && clean.length > 2) {
    count -= 1;
  }
  return Math.max(1, count);
}

/**
 * Count words with 3 or more syllables ("complex" words for Gunning Fog).
 * Proper nouns, hyphenated words and common suffixes (-es, -ed, -ing) are
 * included without adjustment (keeps the function simple and predictable).
 */
export function complexWordCount(text: string): number {
  return tokenize(text).filter((w) => syllableCount(w) >= 3).length;
}

/**
 * Count total syllables across all word tokens in `text`.
 * Internal helper — exported for convenience / testing.
 */
export function totalSyllableCount(text: string): number {
  return tokenize(text).reduce((sum, w) => sum + syllableCount(w), 0);
}

/**
 * Flesch-Kincaid readability scores.
 *
 * - `readingEase`: 0–100 scale; higher = easier.
 * - `gradeLevel` : US school grade level; lower = easier.
 */
export function fleschKincaid(
  text: string,
): { readingEase: number; gradeLevel: number } {
  const wc = wordCount(text);
  const sc = sentenceCount(text);
  const syl = totalSyllableCount(text);

  if (wc === 0 || sc === 0) return { readingEase: 0, gradeLevel: 0 };

  const asl = wc / sc; // average sentence length (words)
  const asw = syl / wc; // average syllables per word

  const readingEase = 206.835 - 1.015 * asl - 84.6 * asw;
  const gradeLevel = 0.39 * asl + 11.8 * asw - 15.59;

  return {
    readingEase: Math.round(readingEase * 10) / 10,
    gradeLevel: Math.round(gradeLevel * 10) / 10,
  };
}

/**
 * Gunning Fog Index — approximate US grade level.
 * Formula: 0.4 × ((words / sentences) + 100 × (complexWords / words))
 */
export function gunningFog(text: string): number {
  const wc = wordCount(text);
  const sc = sentenceCount(text);
  const cw = complexWordCount(text);

  if (wc === 0 || sc === 0) return 0;

  const fog = 0.4 * (wc / sc + 100 * (cw / wc));
  return Math.round(fog * 10) / 10;
}

/**
 * SMOG Index — grade level based on polysyllabic words.
 * Requires at least 30 sentences for accuracy; works on shorter texts too.
 * Formula: 3 + √(polysyllable_count × (30 / sentence_count))
 */
export function smogIndex(text: string): number {
  const sc = sentenceCount(text);
  if (sc === 0) return 0;

  const poly = complexWordCount(text);
  const smog = 3 + Math.sqrt(poly * (30 / sc));
  return Math.round(smog * 10) / 10;
}

/**
 * Automated Readability Index (ARI).
 * Formula: 4.71 × (chars / words) + 0.5 × (words / sentences) − 21.43
 */
export function automatedReadabilityIndex(text: string): number {
  const wc = wordCount(text);
  const sc = sentenceCount(text);
  // characterCount without spaces
  const cc = characterCount(text, false);

  if (wc === 0 || sc === 0) return 0;

  const ari = 4.71 * (cc / wc) + 0.5 * (wc / sc) - 21.43;
  return Math.round(ari * 10) / 10;
}

/**
 * Coleman-Liau Index — grade level based on characters per 100 words.
 * Formula: 0.0588 × L − 0.296 × S − 15.8
 * where L = avg letters per 100 words, S = avg sentences per 100 words.
 */
export function colemanLiau(text: string): number {
  const wc = wordCount(text);
  const sc = sentenceCount(text);
  const cc = characterCount(text, false);

  if (wc === 0) return 0;

  const L = (cc / wc) * 100;
  const S = (sc / wc) * 100;

  const cli = 0.0588 * L - 0.296 * S - 15.8;
  return Math.round(cli * 10) / 10;
}

/**
 * Comprehensive text summary combining statistics and readability scores.
 */
export function textSummary(text: string): {
  wordCount: number;
  sentenceCount: number;
  averageWordLength: number;
  averageSentenceLength: number;
  fleschReadingEase: number;
  gradeLevel: number;
} {
  const wc = wordCount(text);
  const sc = sentenceCount(text);

  // Average word length (characters)
  const tokens = tokenize(text);
  const avgWordLen =
    tokens.length > 0
      ? Math.round((tokens.reduce((s, w) => s + w.length, 0) / tokens.length) * 10) / 10
      : 0;

  const avgSentLen = sc > 0 ? Math.round((wc / sc) * 10) / 10 : 0;

  const { readingEase, gradeLevel } = fleschKincaid(text);

  return {
    wordCount: wc,
    sentenceCount: sc,
    averageWordLength: avgWordLen,
    averageSentenceLength: avgSentLen,
    fleschReadingEase: readingEase,
    gradeLevel,
  };
}
