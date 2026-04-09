// ─── Unit Tests: markdown-utils ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  markdownToHTML,
  extractHeadings,
  extractLinks,
  stripMarkdown,
  wordCount,
  readingTime,
  headingToSlug,
  hasMarkdown,
} from '../../app/modules/markdown-utils.js';

// ─── markdownToHTML ───────────────────────────────────────────────────────────

describe('markdownToHTML', () => {
  it('converts # heading to <h1>', () => {
    const html = markdownToHTML('# Hello');
    assert.ok(html.includes('<h1>Hello</h1>'), `got: ${html}`);
  });

  it('converts ## heading to <h2>', () => {
    const html = markdownToHTML('## Subtitle');
    assert.ok(html.includes('<h2>Subtitle</h2>'), `got: ${html}`);
  });

  it('converts ### heading to <h3>', () => {
    const html = markdownToHTML('### Three');
    assert.ok(html.includes('<h3>Three</h3>'), `got: ${html}`);
  });

  it('converts h4, h5, h6', () => {
    assert.ok(markdownToHTML('#### Four').includes('<h4>Four</h4>'));
    assert.ok(markdownToHTML('##### Five').includes('<h5>Five</h5>'));
    assert.ok(markdownToHTML('###### Six').includes('<h6>Six</h6>'));
  });

  it('converts **bold** to <strong>', () => {
    const html = markdownToHTML('**bold text**');
    assert.ok(html.includes('<strong>bold text</strong>'), `got: ${html}`);
  });

  it('converts *italic* to <em>', () => {
    const html = markdownToHTML('*italic text*');
    assert.ok(html.includes('<em>italic text</em>'), `got: ${html}`);
  });

  it('converts `code` to <code>', () => {
    const html = markdownToHTML('`inline code`');
    assert.ok(html.includes('<code>inline code</code>'), `got: ${html}`);
  });

  it('converts [text](url) to <a href>', () => {
    const html = markdownToHTML('[click here](https://example.com)');
    assert.ok(html.includes('<a href="https://example.com">click here</a>'), `got: ${html}`);
  });

  it('converts - unordered list to <ul><li>', () => {
    const html = markdownToHTML('- Item one\n- Item two');
    assert.ok(html.includes('<ul>'), `got: ${html}`);
    assert.ok(html.includes('<li>Item one</li>'), `got: ${html}`);
    assert.ok(html.includes('<li>Item two</li>'), `got: ${html}`);
  });

  it('converts 1. ordered list to <ol><li>', () => {
    const html = markdownToHTML('1. First\n2. Second');
    assert.ok(html.includes('<ol>'), `got: ${html}`);
    assert.ok(html.includes('<li>First</li>'), `got: ${html}`);
    assert.ok(html.includes('<li>Second</li>'), `got: ${html}`);
  });

  it('converts > blockquote to <blockquote>', () => {
    const html = markdownToHTML('> A quote');
    assert.ok(html.includes('<blockquote>A quote</blockquote>'), `got: ${html}`);
  });

  it('returns empty string for empty input', () => {
    assert.equal(markdownToHTML(''), '');
  });

  it('wraps plain paragraph in <p>', () => {
    const html = markdownToHTML('Plain text');
    assert.ok(html.includes('<p>Plain text</p>'), `got: ${html}`);
  });

  it('handles inline formatting within headings', () => {
    const html = markdownToHTML('# Hello **world**');
    assert.ok(html.includes('<h1>Hello <strong>world</strong></h1>'), `got: ${html}`);
  });
});

// ─── extractHeadings ─────────────────────────────────────────────────────────

describe('extractHeadings', () => {
  it('returns empty array for no headings', () => {
    assert.deepEqual(extractHeadings('Just plain text'), []);
  });

  it('extracts a single h1 with correct level and text', () => {
    const result = extractHeadings('# Title');
    assert.deepEqual(result, [{ level: 1, text: 'Title' }]);
  });

  it('extracts multiple headings at different levels', () => {
    const md = '# H1\n## H2\n### H3';
    const result = extractHeadings(md);
    assert.deepEqual(result, [
      { level: 1, text: 'H1' },
      { level: 2, text: 'H2' },
      { level: 3, text: 'H3' },
    ]);
  });

  it('does not extract non-heading lines as headings', () => {
    const result = extractHeadings('Normal line\n**bold** text');
    assert.deepEqual(result, []);
  });

  it('handles headings mixed with body text', () => {
    const md = '# Intro\nSome paragraph.\n## Details\nMore text.';
    const result = extractHeadings(md);
    assert.deepEqual(result, [
      { level: 1, text: 'Intro' },
      { level: 2, text: 'Details' },
    ]);
  });
});

// ─── extractLinks ─────────────────────────────────────────────────────────────

describe('extractLinks', () => {
  it('returns empty array when no links', () => {
    assert.deepEqual(extractLinks('No links here'), []);
  });

  it('extracts a single link', () => {
    const result = extractLinks('[Google](https://google.com)');
    assert.deepEqual(result, [{ text: 'Google', url: 'https://google.com' }]);
  });

  it('extracts multiple links', () => {
    const md = '[A](http://a.com) and [B](http://b.com)';
    const result = extractLinks(md);
    assert.deepEqual(result, [
      { text: 'A', url: 'http://a.com' },
      { text: 'B', url: 'http://b.com' },
    ]);
  });

  it('extracts link text and URL correctly', () => {
    const result = extractLinks('See [the docs](https://docs.example.com/page) for info.');
    assert.equal(result[0].text, 'the docs');
    assert.equal(result[0].url, 'https://docs.example.com/page');
  });
});

// ─── stripMarkdown ────────────────────────────────────────────────────────────

describe('stripMarkdown', () => {
  it('removes heading markers', () => {
    const result = stripMarkdown('# Hello');
    assert.equal(result, 'Hello');
  });

  it('removes bold markers', () => {
    const result = stripMarkdown('**bold text**');
    assert.equal(result, 'bold text');
  });

  it('removes italic markers', () => {
    const result = stripMarkdown('*italic text*');
    assert.equal(result, 'italic text');
  });

  it('removes inline code backticks', () => {
    const result = stripMarkdown('`code`');
    assert.equal(result, 'code');
  });

  it('removes link syntax, keeps text', () => {
    const result = stripMarkdown('[click here](https://example.com)');
    assert.equal(result, 'click here');
  });

  it('removes blockquote marker', () => {
    const result = stripMarkdown('> quote text');
    assert.equal(result, 'quote text');
  });

  it('removes list markers', () => {
    const result = stripMarkdown('- item one');
    assert.equal(result, 'item one');
  });

  it('removes ordered list markers', () => {
    const result = stripMarkdown('1. first item');
    assert.equal(result, 'first item');
  });

  it('handles mixed formatting', () => {
    const md = '# Title\n**bold** and *italic* and `code` and [link](url)';
    const result = stripMarkdown(md);
    assert.ok(!result.includes('#'), 'heading marker should be removed');
    assert.ok(!result.includes('**'), 'bold markers should be removed');
    assert.ok(!result.includes('*'), 'italic markers should be removed');
    assert.ok(!result.includes('`'), 'code markers should be removed');
    assert.ok(!result.includes('['), 'link brackets should be removed');
    assert.ok(!result.includes('(url)'), 'link URL should be removed');
  });
});

// ─── wordCount ────────────────────────────────────────────────────────────────

describe('wordCount', () => {
  it('returns 0 for empty string', () => {
    assert.equal(wordCount(''), 0);
  });

  it('counts words in plain text', () => {
    assert.equal(wordCount('one two three'), 3);
  });

  it('counts words ignoring markdown formatting', () => {
    // "bold text" = 2 words, "word" = 1 word → 3 total
    const result = wordCount('**bold text** word');
    assert.equal(result, 3);
  });

  it('counts words in a heading', () => {
    assert.equal(wordCount('# Hello World'), 2);
  });

  it('handles multiple spaces and newlines', () => {
    assert.equal(wordCount('one  two\nthree'), 3);
  });
});

// ─── readingTime ─────────────────────────────────────────────────────────────

describe('readingTime', () => {
  it('returns at least 1 minute for any non-empty content', () => {
    assert.ok(readingTime('word') >= 1);
  });

  it('returns 1 minute for 200 words', () => {
    const md = Array(200).fill('word').join(' ');
    assert.equal(readingTime(md), 1);
  });

  it('returns 2 minutes for 201 words', () => {
    const md = Array(201).fill('word').join(' ');
    assert.equal(readingTime(md), 2);
  });

  it('returns 1 minute for empty input', () => {
    assert.equal(readingTime(''), 1);
  });

  it('calculates correctly for 400 words', () => {
    const md = Array(400).fill('word').join(' ');
    assert.equal(readingTime(md), 2);
  });
});

// ─── headingToSlug ────────────────────────────────────────────────────────────

describe('headingToSlug', () => {
  it("converts 'Hello World' to 'hello-world'", () => {
    assert.equal(headingToSlug('Hello World'), 'hello-world');
  });

  it('lowercases all characters', () => {
    assert.equal(headingToSlug('ALL CAPS'), 'all-caps');
  });

  it('replaces spaces with hyphens', () => {
    assert.equal(headingToSlug('a b c'), 'a-b-c');
  });

  it('removes special characters', () => {
    assert.equal(headingToSlug('Hello, World!'), 'hello-world');
  });

  it('collapses multiple spaces', () => {
    assert.equal(headingToSlug('Hello   World'), 'hello-world');
  });

  it('handles an already-slugified string', () => {
    assert.equal(headingToSlug('hello-world'), 'hello-world');
  });

  it('handles empty string', () => {
    assert.equal(headingToSlug(''), '');
  });
});

// ─── hasMarkdown ─────────────────────────────────────────────────────────────

describe('hasMarkdown', () => {
  it('returns true for bold text', () => {
    assert.equal(hasMarkdown('**bold**'), true);
  });

  it('returns true for italic text', () => {
    assert.equal(hasMarkdown('*italic*'), true);
  });

  it('returns true for a heading', () => {
    assert.equal(hasMarkdown('# Title'), true);
  });

  it('returns true for inline code', () => {
    assert.equal(hasMarkdown('`code`'), true);
  });

  it('returns true for a link', () => {
    assert.equal(hasMarkdown('[text](url)'), true);
  });

  it('returns true for an unordered list', () => {
    assert.equal(hasMarkdown('- item'), true);
  });

  it('returns true for an ordered list', () => {
    assert.equal(hasMarkdown('1. item'), true);
  });

  it('returns true for a blockquote', () => {
    assert.equal(hasMarkdown('> quote'), true);
  });

  it('returns false for plain text', () => {
    assert.equal(hasMarkdown('just plain text here'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(hasMarkdown(''), false);
  });
});
