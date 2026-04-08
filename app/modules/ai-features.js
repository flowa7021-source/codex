// @ts-check
// ─── AI-Powered Features ────────────────────────────────────────────────────
// Smart summary, auto-tagging, semantic search, auto-TOC generation.
// Uses pluggable AI backend (local heuristics + optional LLM API).
//
// Priority: LLM backend (Claude / OpenAI) → local heuristic fallback.
// Configure the backend via ai-backend.js saveAiBackendConfig().

import { isAiBackendActive, aiSummarize, aiExtractTags, aiGenerateToc, aiAskQuestion as aiAskQuestionBackend } from './ai-backend.js';

/** @type {'stub'|'partial'|'ready'} Module readiness — 'ready' = LLM backend may be active */
export const MODULE_STATUS = 'ready';
/** What's needed for full LLM functionality (heuristic always works) */
export const MODULE_REQUIRES = [];

/**
 * @typedef {object} AiBackend
 * @property {string} name
 * @property {Function} summarize - (text, options) => Promise<string>
 * @property {Function} extractTags - (text, options) => Promise<string[]>
 * @property {Function} semanticSearch - (query, texts) => Promise<Array<{index: number, score: number}>>
 * @property {Function} generateToc - (pages) => Promise<Array<{title: string, page: number, level: number}>>
 */

// ─── Local Heuristic Backend (no API needed) ────────────────────────────────

/**
 * Generate a summary — uses LLM backend when configured, else local extractive heuristic.
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.maxSentences=5]
 * @returns {Promise<string>}
 */
export async function summarizeText(text, options = {}) {
  const { maxSentences = 5 } = options;
  if (!text || text.length < 50) return text;

  // Try LLM backend first
  if (isAiBackendActive()) {
    try {
      return await aiSummarize(text, maxSentences);
    } catch (_e) { /* fall through to heuristic */ }
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length <= maxSentences) return text;

  // Build word frequency map (excluding stopwords)
  const wordFreq = buildWordFrequency(text);

  // Score each sentence by sum of word frequencies
  const scored = sentences.map((sentence, i) => {
    const words = /** @type {string[]} */ (sentence.toLowerCase().match(/[\p{L}]+/gu) || []);
    const score = words.reduce((sum, w) => sum + (/** @type {any} */ (wordFreq).get(w) || 0), 0);
    // Boost first/last sentences
    const positionBoost = i === 0 ? 1.5 : i === sentences.length - 1 ? 1.2 : 1;
    return { sentence: sentence.trim(), score: score * positionBoost, index: i };
  });

  // Pick top N sentences, maintain original order
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxSentences);
  top.sort((a, b) => a.index - b.index);

  return top.map(s => s.sentence).join(' ');
}

/**
 * Extract topic tags — uses LLM backend when configured, else local TF-IDF heuristic.
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.maxTags=10]
 * @param {number} [options.minWordLength=4]
 * @returns {Promise<string[]>}
 */
export async function extractTags(text, options = {}) {
  const { maxTags = 10, minWordLength = 4 } = options;
  if (!text) return [];

  // Try LLM backend first
  if (isAiBackendActive()) {
    try {
      return await aiExtractTags(text, maxTags);
    } catch (_e) { /* fall through to heuristic */ }
  }

  const wordFreq = buildWordFrequency(text, minWordLength);

  // Filter out very common words and score by frequency
  const entries = [...wordFreq.entries()]
    .filter(([word]) => word.length >= minWordLength && !STOPWORDS.has(word))
    .sort((a, b) => b[1] - a[1]);

  return entries.slice(0, maxTags).map(([word]) => word);
}

/**
 * Perform keyword-based semantic search across page texts.
 * @param {string} query
 * @param {string[]} pageTexts - Text content per page
 * @param {object} [options]
 * @param {number} [options.maxResults=20]
 * @returns {Promise<Array<{pageIndex: number, score: number, snippet: string}>>}
 */
export async function semanticSearch(query, pageTexts, options = {}) {
  const { maxResults = 20 } = options;
  if (!query || pageTexts.length === 0) return [];

  const queryWords = query.toLowerCase().match(/[\p{L}]+/gu) || [];
  if (queryWords.length === 0) return [];

  const results = [];

  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i].toLowerCase();
    if (!text) continue;

    // Score: count of query words found, weighted by position
    let score = 0;
    let snippetStart = -1;

    for (const qw of queryWords) {
      const idx = text.indexOf(qw);
      if (idx !== -1) {
        score += 1;
        // Bonus for exact phrase match
        if (snippetStart === -1) snippetStart = idx;
      }
    }

    // Boost for multiple query words appearing close together
    if (queryWords.length > 1) {
      const positions = queryWords
        .map(qw => text.indexOf(qw))
        .filter(p => p !== -1)
        .sort((a, b) => a - b);
      if (positions.length >= 2) {
        const spread = positions[positions.length - 1] - positions[0];
        if (spread < 200) score *= 1.5;
      }
    }

    if (score > 0) {
      // Extract snippet around first match
      const start = Math.max(0, snippetStart - 40);
      const end = Math.min(text.length, snippetStart + 120);
      const snippet = (start > 0 ? '…' : '') +
        pageTexts[i].slice(start, end).trim() +
        (end < text.length ? '…' : '');

      results.push({ pageIndex: i, score, snippet });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

/**
 * Auto-generate a table of contents — uses LLM when configured, else heading heuristics.
 * @param {Array<{text: string, pageNum: number}>} pages
 * @returns {Promise<Array<{title: string, page: number, level: number}>>}
 */
export async function generateToc(pages) {
  // Try LLM backend first
  if (isAiBackendActive()) {
    try {
      const combined = pages
        .map(({ pageNum, text }) => `[Page ${pageNum}]\n${text}`)
        .join('\n\n');
      const llmToc = await aiGenerateToc(combined);
      if (llmToc.length > 0) return llmToc;
    } catch (_e) { /* fall through to heuristic */ }
  }

  const toc = [];

  for (const { text, pageNum } of pages) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      // Heading heuristics:
      // 1. Short line (< 80 chars)
      // 2. Title case or ALL CAPS
      // 3. No ending punctuation (not a sentence)
      // 4. Not a page number
      if (line.length > 80) continue;
      if (line.length < 3) continue;
      if (/[.,:;]$/.test(line)) continue;
      if (/^\d+$/.test(line)) continue; // just a number

      const isAllCaps = line === line.toUpperCase() && /[A-ZА-ЯЁ]/.test(line);
      const isTitleCase = /^[A-ZА-ЯЁ]/.test(line) && !line.includes('. ');
      const hasChapterPrefix = /^(chapter|глава|часть|раздел|section)\s+/i.test(line);
      const hasNumberPrefix = /^\d+[\.\)]\s/.test(line);

      if (isAllCaps || hasChapterPrefix) {
        toc.push({ title: line, page: pageNum, level: 1 });
      } else if (hasNumberPrefix) {
        const level = line.match(/^(\d+\.)+/)?.[0].split('.').filter(Boolean).length || 2;
        toc.push({ title: line, page: pageNum, level: Math.min(level, 3) });
      } else if (isTitleCase && line.length < 50) {
        toc.push({ title: line, page: pageNum, level: 2 });
      }
    }
  }

  return toc;
}

/**
 * Answer a question about document content.
 * Uses LLM when configured; falls back to a simple keyword-search answer.
 *
 * @param {string} question  - Natural language question
 * @param {string} context   - Relevant document text to search
 * @returns {Promise<string>} - Answer or best-matching excerpt
 */
export async function askQuestion(question, context) {
  if (!question || !context) return '';

  // Try LLM backend first
  if (isAiBackendActive()) {
    try {
      const answer = await aiAskQuestionBackend(question, context);
      if (answer) return answer;
    } catch (_e) { /* fall through to heuristic */ }
  }

  // Heuristic fallback: find the sentence/paragraph most relevant to the question
  const qWords = question.toLowerCase().match(/[\p{L}]+/gu) || [];
  const sentences = context.match(/[^.!?]+[.!?]?/g) || [];
  let best = '';
  let bestScore = 0;
  for (const sent of sentences) {
    const lower = sent.toLowerCase();
    const score = qWords.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = sent.trim(); }
  }
  return best || context.slice(0, 200);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildWordFrequency(text, minLength = 3) {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
  const freq = new Map();
  for (const word of words) {
    if (word.length < minLength) continue;
    if (STOPWORDS.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

const STOPWORDS = new Set([
  // English
  'the', 'and', 'that', 'this', 'with', 'for', 'are', 'was', 'were', 'been',
  'have', 'has', 'had', 'not', 'but', 'what', 'all', 'when', 'can', 'there',
  'use', 'each', 'which', 'she', 'how', 'their', 'will', 'other', 'about',
  'out', 'many', 'then', 'them', 'these', 'some', 'her', 'would', 'make',
  'like', 'him', 'into', 'time', 'very', 'just', 'know', 'take', 'come',
  'could', 'than', 'look', 'only', 'its', 'over', 'such', 'after', 'also',
  'did', 'any', 'our', 'may', 'from', 'more', 'who',
  // Russian
  'это', 'как', 'так', 'все', 'она', 'его', 'что', 'для', 'при', 'они',
  'или', 'уже', 'быть', 'нет', 'есть', 'его', 'было', 'мне', 'они', 'был',
  'ещё', 'бы', 'тоже', 'нас', 'них', 'вас', 'над', 'под', 'без', 'вот',
]);
