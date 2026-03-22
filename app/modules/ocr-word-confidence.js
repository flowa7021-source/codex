// @ts-check
// ─── OCR Word-Level Confidence Module ────────────────────────────────────────
// Scores individual words from OCR output for quality/confidence.
// Highlights suspicious words that likely contain OCR errors.
// Fully offline — uses heuristic analysis, no external APIs.

import { getLanguageProfile } from './ocr-languages.js';

// Characters that commonly appear as OCR garbage
const GARBAGE_PATTERN = /[|~`^\\{}[\]@#$%&*_+=<>]/;
const REPEATED_CHAR = /(.)\1{3,}/;
const VOWELS_RU = /[АЕИОУЫЭЮЯаеиоуыэюяЁё]/;
const VOWELS_EN = /[AEIOUaeiou]/;
const CONSONANT_CLUSTER_RU = /[БВГДЖЗКЛМНПРСТФХЦЧШЩбвгджзклмнпрстфхцчшщ]{5,}/;
const CONSONANT_CLUSTER_EN = /[BCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz]{5,}/;
const MIXED_SCRIPT = /[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё]/;

/**
 * Score a single word for OCR confidence.
 * @param {string} word
 * @param {string} lang - language code (rus, eng, deu, etc.)
 * @returns {{ word: string, score: number, level: 'high'|'medium'|'low', issues: string[] }}
 */
export function scoreWord(word, lang = 'auto') {
  const issues = [];
  let score = 100;
  const w = String(word || '').trim();
  if (!w) return { word: w, score: 0, level: 'low', issues: ['empty'] };

  // 1. Garbage characters
  if (GARBAGE_PATTERN.test(w)) {
    score -= 40;
    issues.push('garbage-chars');
  }

  // 2. Repeated characters (e.g., "ааааа")
  if (REPEATED_CHAR.test(w)) {
    score -= 30;
    issues.push('repeated-chars');
  }

  // 3. Mixed script in single word
  if (MIXED_SCRIPT.test(w)) {
    score -= 35;
    issues.push('mixed-script');
  }

  // 4. No vowels (for words > 3 chars)
  if (w.length > 3) {
    const isRus = /[А-Яа-яЁё]/.test(w);
    const hasVowel = isRus ? VOWELS_RU.test(w) : VOWELS_EN.test(w);
    if (!hasVowel) {
      score -= 25;
      issues.push('no-vowels');
    }
  }

  // 5. Excessive consonant clusters
  if (CONSONANT_CLUSTER_RU.test(w) || CONSONANT_CLUSTER_EN.test(w)) {
    score -= 20;
    issues.push('consonant-cluster');
  }

  // 6. Very short single-character words (except common ones)
  if (w.length === 1 && !/^[а-яА-ЯёЁa-zA-Z0-9]$/.test(w)) {
    score -= 15;
    issues.push('single-unknown-char');
  }

  // 7. Digit-letter confusion patterns
  if (/[0О]/.test(w) && /[А-Яа-яЁё]/.test(w) && /[0-9]/.test(w)) {
    score -= 15;
    issues.push('digit-letter-confusion');
  }

  // 8. Very long words (>25 chars) are suspicious
  if (w.length > 25) {
    score -= 20;
    issues.push('too-long');
  }

  // 9. Check against common words list (bonus)
  const profile = getLanguageProfile(lang);
  if (profile?.commonWords?.includes(w.toLowerCase())) {
    score += 15;
    issues.length = 0; // common word = probably correct
  }

  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { word: w, score: Math.max(0, Math.min(100, score)), level, issues };
}

/**
 * Score all words in a text block.
 * @param {string} text
 * @param {string} lang
 * @returns {{ words: Array<{word, score, level, issues}>, avgScore: number, lowConfidenceCount: number }}
 */
export function scoreAllWords(text, lang = 'auto') {
  if (!text) return { words: [], avgScore: 0, lowConfidenceCount: 0 };

  const tokens = text.split(/\s+/).filter(Boolean);
  const words = tokens.map((t) => scoreWord(t, lang));
  const totalScore = words.reduce((s, w) => s + w.score, 0);
  const avgScore = words.length ? Math.round(totalScore / words.length) : 0;
  const lowConfidenceCount = words.filter((w) => w.level === 'low').length;

  return { words, avgScore, lowConfidenceCount };
}

/**
 * Format text with confidence markers for display.
 * Wraps low-confidence words with markers for highlighting.
 * @param {string} text
 * @param {string} lang
 * @returns {string} text with [?word?] markers around suspicious words
 */
export function markLowConfidenceWords(text, lang = 'auto') {
  if (!text) return '';
  const tokens = text.split(/(\s+)/);
  const result = [];
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      result.push(token);
      continue;
    }
    const { level } = scoreWord(token, lang);
    if (level === 'low') {
      result.push(`[?${token}?]`);
    } else {
      result.push(token);
    }
  }
  return result.join('');
}

/**
 * Get a summary of OCR quality for a page of text.
 * @param {string} text
 * @param {string} lang
 * @returns {{ quality: 'good'|'fair'|'poor', avgScore: number, totalWords: number, lowCount: number, mediumCount: number }}
 */
export function getPageQualitySummary(text, lang = 'auto') {
  const { words, avgScore, lowConfidenceCount } = scoreAllWords(text, lang);
  const mediumCount = words.filter((w) => w.level === 'medium').length;
  const quality = avgScore >= 75 ? 'good' : avgScore >= 50 ? 'fair' : 'poor';
  return {
    quality,
    avgScore,
    totalWords: words.length,
    lowCount: lowConfidenceCount,
    mediumCount,
  };
}
