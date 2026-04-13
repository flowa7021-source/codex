// @ts-check
// ─── Text Statistics ─────────────────────────────────────────────────────────
// Pure-text analysis helpers: word counts, sentence counts, frequency maps, etc.
// No DOM dependencies — safe for Node.js and browser environments.

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Strip leading/trailing punctuation from a token and lower-case it. */
function cleanToken(token: string): string {
  return token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Split text into individual word tokens, stripping punctuation.
 * Returns only non-empty tokens.
 */
export function tokenize(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/\s+/)
    .map(cleanToken)
    .filter((t) => t.length > 0);
}

/**
 * Split text into sentences.
 * Sentences are delimited by `.`, `!`, or `?` followed by whitespace or end-of-string.
 */
export function sentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  // Split on sentence-ending punctuation; keep delimiter attached to the sentence.
  const raw = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return raw;
}

/** Count words in text (non-empty tokens after stripping punctuation). */
export function wordCount(text: string): number {
  return tokenize(text).length;
}

/**
 * Count sentences in text.
 * A sentence ends with `.`, `!`, or `?`.
 * Falls back to treating the entire text as one sentence when no
 * terminal punctuation is present but there is content.
 */
export function sentenceCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const count = (text.match(/[.!?]+/g) || []).length;
  return count > 0 ? count : 1;
}

/**
 * Count paragraphs — blocks of text separated by one or more blank lines.
 */
export function paragraphCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}

/**
 * Count characters in text.
 * @param includeSpaces - when false, whitespace characters are excluded (default true).
 */
export function characterCount(text: string, includeSpaces = true): number {
  if (!text) return 0;
  return includeSpaces ? text.length : text.replace(/\s/g, '').length;
}

/**
 * Compute the average length (in characters) of all word tokens.
 * Returns 0 for empty text.
 */
export function averageWordLength(text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + w.length, 0);
  return total / words.length;
}

/**
 * Compute the average number of words per sentence.
 * Returns 0 for empty text.
 */
export function averageSentenceLength(text: string): number {
  const sc = sentenceCount(text);
  if (sc === 0) return 0;
  return wordCount(text) / sc;
}

/** Count distinct (lower-cased, punctuation-stripped) word tokens. */
export function uniqueWordCount(text: string): number {
  return new Set(tokenize(text)).size;
}

/**
 * Build a frequency map of lower-cased word tokens.
 * The returned Map is sorted descending by frequency.
 */
export function wordFrequency(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  // Sort descending by count
  return new Map([...freq.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * Return the top-`n` most frequent words with their counts.
 * Ties are broken alphabetically.
 */
export function topWords(text: string, n: number): { word: string; count: number }[] {
  const freq = wordFrequency(text);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}
