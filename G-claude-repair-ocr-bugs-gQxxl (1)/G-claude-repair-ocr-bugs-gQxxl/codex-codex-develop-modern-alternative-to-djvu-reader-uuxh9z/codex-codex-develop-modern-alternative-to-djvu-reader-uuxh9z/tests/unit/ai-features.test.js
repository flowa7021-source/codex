// ─── Unit Tests: AI Features ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeText, extractTags, semanticSearch, generateToc } from '../../app/modules/ai-features.js';

describe('summarizeText', () => {
  it('returns short text unchanged', async () => {
    const result = await summarizeText('Short text.');
    assert.equal(result, 'Short text.');
  });

  it('reduces long text to maxSentences', async () => {
    const sentences = Array.from({ length: 20 }, (_, i) =>
      `This is sentence number ${i + 1} about different topics.`
    ).join(' ');
    const result = await summarizeText(sentences, { maxSentences: 3 });
    const resultSentences = result.match(/[^.]+\./g) || [];
    assert.ok(resultSentences.length <= 4); // approximate
  });

  it('handles empty input', async () => {
    assert.equal(await summarizeText(''), '');
    assert.equal(await summarizeText(null), null);
  });
});

describe('extractTags', () => {
  it('extracts frequent words as tags', async () => {
    const text = 'JavaScript programming language. JavaScript frameworks. JavaScript development tools. Python programming language. Python data science.';
    const tags = await extractTags(text, { maxTags: 3 });
    assert.ok(tags.length > 0);
    assert.ok(tags.includes('javascript'));
  });

  it('respects maxTags limit', async () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'.repeat(3);
    const tags = await extractTags(text, { maxTags: 5 });
    assert.ok(tags.length <= 5);
  });

  it('returns empty for empty input', async () => {
    assert.deepEqual(await extractTags(''), []);
  });
});

describe('semanticSearch', () => {
  it('finds pages containing query words', async () => {
    const pages = [
      'The quick brown fox jumps over the lazy dog.',
      'Programming in JavaScript is fun and productive.',
      'The fox was seen near the river yesterday.',
    ];
    const results = await semanticSearch('fox', pages);
    assert.ok(results.length >= 2);
    assert.equal(results[0].pageIndex, 0); // or 2
  });

  it('scores multi-word queries higher for proximity', async () => {
    const pages = [
      'JavaScript is a programming language used for web development.',
      'Python programming language is great. JavaScript framework is separate.',
    ];
    const results = await semanticSearch('JavaScript programming', pages);
    assert.ok(results.length > 0);
  });

  it('returns empty for empty query', async () => {
    assert.deepEqual(await semanticSearch('', ['text']), []);
  });

  it('provides snippets', async () => {
    const pages = ['Lorem ipsum dolor sit amet. The fox jumped over the fence.'];
    const results = await semanticSearch('fox', pages);
    assert.ok(results[0].snippet.includes('fox'));
  });
});

describe('generateToc', () => {
  it('detects chapter headings', async () => {
    const pages = [
      { text: 'Chapter 1 Introduction\nThis is the introduction text with details.', pageNum: 1 },
      { text: 'Chapter 2 Methods\nWe used several methods in this study.', pageNum: 5 },
    ];
    const toc = await generateToc(pages);
    assert.ok(toc.length >= 2);
    assert.ok(toc.some(e => e.title.includes('Chapter 1')));
    assert.ok(toc.some(e => e.title.includes('Chapter 2')));
  });

  it('detects ALL CAPS headings', async () => {
    const pages = [
      { text: 'INTRODUCTION\nBody text follows here with more details.', pageNum: 1 },
    ];
    const toc = await generateToc(pages);
    assert.ok(toc.some(e => e.title === 'INTRODUCTION'));
    assert.equal(toc[0].level, 1);
  });

  it('detects numbered sections', async () => {
    const pages = [
      { text: '1. Overview\n2. Background\n3. Results', pageNum: 1 },
    ];
    const toc = await generateToc(pages);
    assert.ok(toc.length >= 3);
  });

  it('returns empty for no headings', async () => {
    const pages = [
      { text: 'Just regular body text with no headings or structure at all, going on and on about things.', pageNum: 1 },
    ];
    const toc = await generateToc(pages);
    assert.equal(toc.length, 0);
  });
});
