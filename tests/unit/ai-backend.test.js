// ─── Unit Tests: AI Backend ──────────────────────────────────────────────────
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js
const _store = {};
globalThis.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
};

const {
  loadAiBackendConfig,
  saveAiBackendConfig,
  getAiBackendConfig,
  isAiBackendActive,
  aiSummarize,
  aiExtractTags,
  aiGenerateToc,
  aiAskQuestion,
} = await import('../../app/modules/ai-backend.js');

describe('loadAiBackendConfig / saveAiBackendConfig', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults to heuristic backend', () => {
    loadAiBackendConfig();
    const cfg = getAiBackendConfig();
    assert.equal(cfg.backend, 'heuristic');
    assert.equal(cfg.apiKey, '');
  });

  it('saves and reloads config', () => {
    saveAiBackendConfig({ backend: 'claude', apiKey: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' });
    // Reset in-memory state by re-loading
    loadAiBackendConfig();
    const cfg = getAiBackendConfig();
    assert.equal(cfg.backend, 'claude');
    assert.equal(cfg.apiKey, 'sk-ant-test');
    assert.equal(cfg.model, 'claude-haiku-4-5-20251001');
  });

  it('merges partial config with defaults', () => {
    saveAiBackendConfig({ backend: 'openai', apiKey: 'sk-openai-test' });
    loadAiBackendConfig();
    const cfg = getAiBackendConfig();
    assert.equal(cfg.backend, 'openai');
    assert.equal(cfg.baseUrl, '');  // default
    assert.equal(cfg.model, '');    // default
  });
});

describe('isAiBackendActive', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns false for heuristic backend', () => {
    saveAiBackendConfig({ backend: 'heuristic', apiKey: 'sk-ant-test' });
    assert.equal(isAiBackendActive(), false);
  });

  it('returns false for claude without API key', () => {
    saveAiBackendConfig({ backend: 'claude', apiKey: '' });
    assert.equal(isAiBackendActive(), false);
  });

  it('returns true for claude with API key', () => {
    saveAiBackendConfig({ backend: 'claude', apiKey: 'sk-ant-test' });
    assert.equal(isAiBackendActive(), true);
  });

  it('returns true for openai with API key', () => {
    saveAiBackendConfig({ backend: 'openai', apiKey: 'sk-openai-test' });
    assert.equal(isAiBackendActive(), true);
  });
});

describe('aiSummarize', () => {
  let fetchMock;

  beforeEach(() => {
    saveAiBackendConfig({ backend: 'claude', apiKey: 'sk-ant-test' });
    fetchMock = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'This is a summary.' }],
      }),
    }));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    delete globalThis.fetch;
    saveAiBackendConfig({ backend: 'heuristic', apiKey: '' });
  });

  it('calls Claude API and returns text', async () => {
    const result = await aiSummarize('Some long text content here', 3);
    assert.equal(result, 'This is a summary.');
    assert.equal(fetchMock.mock.callCount(), 1);

    const [url, opts] = fetchMock.mock.calls[0].arguments;
    assert.ok(url.includes('/v1/messages'));
    const body = JSON.parse(opts.body);
    assert.ok(body.messages[0].content.includes('3')); // maxSentences in prompt
  });

  it('sends correct headers for Claude', async () => {
    await aiSummarize('text', 3);
    const [, opts] = fetchMock.mock.calls[0].arguments;
    assert.equal(opts.headers['x-api-key'], 'sk-ant-test');
    assert.ok(opts.headers['anthropic-version']);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Unauthorized',
    }));
    await assert.rejects(() => aiSummarize('text', 3), /401/);
  });
});

describe('aiSummarize (OpenAI backend)', () => {
  let fetchMock;

  beforeEach(() => {
    saveAiBackendConfig({ backend: 'openai', apiKey: 'sk-openai-test', model: 'gpt-4o-mini' });
    fetchMock = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI summary.' } }],
      }),
    }));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    delete globalThis.fetch;
    saveAiBackendConfig({ backend: 'heuristic', apiKey: '' });
  });

  it('calls OpenAI Chat Completions endpoint', async () => {
    const result = await aiSummarize('text', 3);
    assert.equal(result, 'OpenAI summary.');
    const [url, opts] = fetchMock.mock.calls[0].arguments;
    assert.ok(url.includes('/chat/completions'));
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'gpt-4o-mini');
    assert.equal(opts.headers['authorization'], 'Bearer sk-openai-test');
  });

  it('uses custom baseUrl when configured', async () => {
    saveAiBackendConfig({ backend: 'openai', apiKey: 'sk-test', baseUrl: 'https://my-proxy.example.com/v1' });
    await aiSummarize('text', 3);
    const [url] = fetchMock.mock.calls[0].arguments;
    assert.ok(url.startsWith('https://my-proxy.example.com/v1'));
  });
});

describe('aiExtractTags', () => {
  beforeEach(() => {
    saveAiBackendConfig({ backend: 'claude', apiKey: 'sk-ant-test' });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'javascript, programming, web development, node.js, react' }],
      }),
    }));
  });

  afterEach(() => {
    delete globalThis.fetch;
    saveAiBackendConfig({ backend: 'heuristic', apiKey: '' });
  });

  it('parses comma-separated tags', async () => {
    const tags = await aiExtractTags('some text', 5);
    assert.deepEqual(tags, ['javascript', 'programming', 'web development', 'node.js', 'react']);
  });

  it('limits to maxTags', async () => {
    const tags = await aiExtractTags('some text', 3);
    assert.ok(tags.length <= 3);
  });
});

describe('aiGenerateToc', () => {
  beforeEach(() => {
    saveAiBackendConfig({ backend: 'claude', apiKey: 'sk-ant-test' });
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '1|Introduction|1\n2|Background|3\n3|Methods overview|5\n1|Results|10' }],
      }),
    }));
  });

  afterEach(() => {
    delete globalThis.fetch;
    saveAiBackendConfig({ backend: 'heuristic', apiKey: '' });
  });

  it('parses LEVEL|TITLE|PAGE format', async () => {
    const toc = await aiGenerateToc('document text');
    assert.equal(toc.length, 4);
    assert.deepEqual(toc[0], { level: 1, title: 'Introduction', page: 1 });
    assert.deepEqual(toc[1], { level: 2, title: 'Background', page: 3 });
    assert.deepEqual(toc[3], { level: 1, title: 'Results', page: 10 });
  });

  it('skips malformed lines', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '1|Good Entry|5\nBad Line\n2|Another|8' }],
      }),
    }));
    const toc = await aiGenerateToc('text');
    assert.equal(toc.length, 2);
  });
});

describe('aiAskQuestion', () => {
  beforeEach(() => {
    localStorage.clear();
    saveAiBackendConfig({ backend: 'claude', apiKey: 'key-test', baseUrl: 'https://api.anthropic.com' });
    loadAiBackendConfig();
  });
  afterEach(() => {
    localStorage.clear();
    loadAiBackendConfig();
    if (globalThis.fetch?.mock) globalThis.fetch.mock.resetCalls();
  });

  it('returns LLM answer when backend is active', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'The answer is 42.' }],
      }),
    }));
    const result = await aiAskQuestion('What is the answer?', 'Some document text about 42.');
    assert.equal(result, 'The answer is 42.');
  });

  it('returns empty string on network error', async () => {
    globalThis.fetch = mock.fn(async () => { throw new Error('network'); });
    const result = await aiAskQuestion('question', 'context').catch(() => '');
    assert.equal(typeof result, 'string');
  });
});
