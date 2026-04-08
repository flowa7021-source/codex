// @ts-check
// ─── AI Backend ─────────────────────────────────────────────────────────────
// Pluggable AI backend for ai-features.js.  Supports:
//   • heuristic — local TF-IDF / extractive (default, no API needed)
//   • claude    — Anthropic Claude Messages API (user-supplied key)
//   • openai    — OpenAI-compatible Chat Completions API (user-supplied key)
//
// Usage:
//   import { loadAiBackendConfig, saveAiBackendConfig, isAiBackendActive,
//            aiSummarize, aiExtractTags, aiGenerateToc } from './ai-backend.js';
//
//   loadAiBackendConfig();   // call once on app startup
//
//   if (isAiBackendActive()) {
//     const summary = await aiSummarize(text);
//   }

const _STORAGE_KEY = 'novareader-ai-backend';

/**
 * @typedef {'heuristic'|'claude'|'openai'} AiBackendType
 *
 * @typedef {object} AiBackendConfig
 * @property {AiBackendType} backend  - Which backend to use
 * @property {string}        apiKey   - API key (Claude: sk-ant-… / OpenAI: sk-…)
 * @property {string}        baseUrl  - Base URL override (OpenAI-compatible endpoint)
 * @property {string}        model    - Model name override
 */

/** @type {AiBackendConfig} */
const _defaults = {
  backend: 'heuristic',
  apiKey: '',
  baseUrl: '',
  model: '',
};

/** @type {AiBackendConfig} */
let _config = { ..._defaults };

// ─── Config persistence ──────────────────────────────────────────────────────

/**
 * Load AI backend config from localStorage.
 * Call once during app startup.
 */
export function loadAiBackendConfig() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(_STORAGE_KEY);
    if (raw) _config = { ..._defaults, ...JSON.parse(raw) };
  } catch (_e) { /* ignore — SSR / test env */ }
}

/**
 * Persist a new AI backend config to localStorage.
 * @param {Partial<AiBackendConfig>} config
 */
export function saveAiBackendConfig(config) {
  _config = { ..._defaults, ...config };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(_STORAGE_KEY, JSON.stringify(_config));
    }
  } catch (_e) { /* ignore */ }
}

/**
 * Return a shallow copy of the current config (safe to read, not to mutate).
 * @returns {AiBackendConfig}
 */
export function getAiBackendConfig() {
  return { ..._config };
}

/**
 * Returns true when a non-heuristic backend is configured with an API key.
 * @returns {boolean}
 */
export function isAiBackendActive() {
  return _config.backend !== 'heuristic' && Boolean(_config.apiKey);
}

// ─── Low-level fetch helpers ─────────────────────────────────────────────────

/**
 * Call Anthropic's Messages API.
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
async function _callClaude(prompt, maxTokens) {
  const key = _config.apiKey;
  if (!key) throw new Error('[ai-backend] No Claude API key configured');

  const model = _config.model || 'claude-haiku-4-5-20251001';
  const base = (_config.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');

  const resp = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`[ai-backend] Claude ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return /** @type {string} */ (data?.content?.[0]?.text || '');
}

/**
 * Call an OpenAI-compatible Chat Completions endpoint.
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
async function _callOpenAI(prompt, maxTokens) {
  const key = _config.apiKey;
  if (!key) throw new Error('[ai-backend] No OpenAI API key configured');

  const model = _config.model || 'gpt-4o-mini';
  const base = (_config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`[ai-backend] OpenAI ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return /** @type {string} */ (data?.choices?.[0]?.message?.content || '');
}

/**
 * Dispatch to the configured LLM backend.
 * Throws for 'heuristic' so callers can fall back to local logic.
 * @param {string} prompt
 * @param {number} [maxTokens=512]
 * @returns {Promise<string>}
 */
async function _callLLM(prompt, maxTokens = 512) {
  switch (_config.backend) {
    case 'claude': return _callClaude(prompt, maxTokens);
    case 'openai': return _callOpenAI(prompt, maxTokens);
    default: throw new Error('heuristic'); // signal caller to use local fallback
  }
}

// ─── Public AI operations ────────────────────────────────────────────────────

/**
 * Generate an abstractive summary using the configured LLM.
 * The caller is responsible for falling back to heuristic on error.
 *
 * @param {string} text
 * @param {number} [maxSentences=5]
 * @returns {Promise<string>}
 */
export async function aiSummarize(text, maxSentences = 5) {
  // Truncate to ~4 000 chars to stay well within context limits
  const truncated = text.slice(0, 4000);
  const prompt =
    `Summarize the following text in ${maxSentences} concise sentences. ` +
    `Return only the summary without any preamble:\n\n${truncated}`;
  return _callLLM(prompt, 300);
}

/**
 * Extract topic tags using the configured LLM.
 * Returns an array of tag strings.
 *
 * @param {string} text
 * @param {number} [maxTags=10]
 * @returns {Promise<string[]>}
 */
export async function aiExtractTags(text, maxTags = 10) {
  const truncated = text.slice(0, 3000);
  const prompt =
    `Extract the ${maxTags} most relevant topic keywords or tags from the text below. ` +
    `Return only a comma-separated list, nothing else:\n\n${truncated}`;
  const raw = await _callLLM(prompt, 128);
  return raw
    .split(/[,\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 2)
    .slice(0, maxTags);
}

/**
 * Auto-generate a table of contents using the configured LLM.
 * Each output item is `{ level: number, title: string, page: number }`.
 *
 * @param {string} combinedText  - All page texts joined with page markers
 * @returns {Promise<Array<{level: number, title: string, page: number}>>}
 */
export async function aiGenerateToc(combinedText) {
  const truncated = combinedText.slice(0, 6000);
  const prompt =
    `Extract a table of contents from the following document text. ` +
    `For each section output exactly one line in the format LEVEL|TITLE|PAGE ` +
    `where LEVEL is 1 (chapter), 2 (section) or 3 (subsection), and PAGE is the ` +
    `approximate page number (integer). Output only these lines:\n\n${truncated}`;
  const raw = await _callLLM(prompt, 512);
  const toc = [];
  for (const line of raw.split('\n')) {
    const m = line.trim().match(/^([123])\|(.+)\|(\d+)$/);
    if (m) {
      toc.push({ level: parseInt(m[1], 10), title: m[2].trim(), page: parseInt(m[3], 10) });
    }
  }
  return toc;
}

/**
 * Answer a question about provided document text using the configured LLM.
 * @param {string} question  - User question
 * @param {string} context   - Relevant document text (will be truncated if too long)
 * @returns {Promise<string>} - Answer text
 */
export async function aiAskQuestion(question, context) {
  const truncated = context.slice(0, 8000);
  const prompt =
    `You are a helpful document assistant. Answer the following question based ` +
    `only on the provided document text. Be concise and accurate.\n\n` +
    `Document:\n${truncated}\n\nQuestion: ${question}\n\nAnswer:`;
  return _callLLM(prompt, 512);
}
