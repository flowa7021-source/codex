// ─── Unit Tests: markdown-parser ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parse,
  toHtml,
  toPlainText,
  extractLinks,
  extractHeadings,
} from '../../app/modules/markdown-parser.js';

// ─── parse – headings ─────────────────────────────────────────────────────────

describe('parse – headings', () => {
  it('parses an h1 heading', () => {
    const tokens = parse('# Hello');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'heading');
    assert.equal(tokens[0].level, 1);
    assert.equal(tokens[0].content, 'Hello');
  });

  it('parses h2 through h6', () => {
    for (let n = 2; n <= 6; n++) {
      const tokens = parse(`${'#'.repeat(n)} Title`);
      assert.equal(tokens[0].type, 'heading');
      assert.equal(tokens[0].level, n);
    }
  });

  it('heading content trims surrounding whitespace', () => {
    const tokens = parse('#   Spaces  ');
    assert.equal(tokens[0].content, 'Spaces');
  });

  it('heading requires a space after #', () => {
    // No space → should NOT be a heading (treated as paragraph)
    const tokens = parse('#NoSpace');
    assert.notEqual(tokens[0].type, 'heading');
  });

  it('multiple headings are all captured in order', () => {
    const tokens = parse('# One\n## Two\n### Three');
    const headings = tokens.filter((t) => t.type === 'heading');
    assert.equal(headings.length, 3);
    assert.equal(headings[0].level, 1);
    assert.equal(headings[1].level, 2);
    assert.equal(headings[2].level, 3);
  });

  it('heading mixed with paragraph produces two tokens', () => {
    const tokens = parse('# Title\n\nSome text.');
    assert.ok(tokens.some((t) => t.type === 'heading'));
    assert.ok(tokens.some((t) => t.type === 'paragraph'));
  });

  it('heading token has no url field', () => {
    const tokens = parse('# Hi');
    assert.equal(tokens[0].url, undefined);
  });

  it('empty heading (# with trailing space) is parsed', () => {
    const tokens = parse('# ');
    // "# " → heading regex requires at least one char after the space — should not match
    // or produce empty heading; either way it should not throw
    assert.ok(Array.isArray(tokens));
  });
});

// ─── parse – paragraphs & inline markup ──────────────────────────────────────

describe('parse – paragraphs & inline markup', () => {
  it('plain text becomes a paragraph token', () => {
    const tokens = parse('Just some text.');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'paragraph');
    assert.equal(tokens[0].content, 'Just some text.');
  });

  it('bold **text** produces a bold item inside paragraph items', () => {
    const tokens = parse('Hello **world** end');
    const para = tokens.find((t) => t.type === 'paragraph');
    assert.ok(para);
    const boldItem = para.items && para.items.find((t) => t.type === 'bold');
    assert.ok(boldItem);
    assert.equal(boldItem.content, 'world');
  });

  it('italic *text* produces an italic item inside paragraph items', () => {
    const tokens = parse('Hello *world*');
    const para = tokens.find((t) => t.type === 'paragraph');
    assert.ok(para);
    assert.ok(para.items && para.items.some((t) => t.type === 'italic'));
  });

  it('inline `code` produces a code item', () => {
    const tokens = parse('Use `console.log` here');
    const para = tokens.find((t) => t.type === 'paragraph');
    assert.ok(para);
    assert.ok(para.items && para.items.some((t) => t.type === 'code'));
  });

  it('link [text](url) produces a link item', () => {
    const tokens = parse('Click [here](https://example.com) now');
    const para = tokens.find((t) => t.type === 'paragraph');
    assert.ok(para);
    const link = para.items && para.items.find((t) => t.type === 'link');
    assert.ok(link);
    assert.equal(link.content, 'here');
    assert.equal(link.url, 'https://example.com');
  });

  it('image ![alt](url) produces an image item', () => {
    const tokens = parse('See ![logo](img/logo.png) above');
    const para = tokens.find((t) => t.type === 'paragraph');
    assert.ok(para);
    const img = para.items && para.items.find((t) => t.type === 'image');
    assert.ok(img);
    assert.equal(img.content, 'logo');
    assert.equal(img.url, 'img/logo.png');
  });

  it('empty string returns an empty array', () => {
    assert.deepEqual(parse(''), []);
  });

  it('blank lines between paragraphs produce separate paragraph tokens', () => {
    const tokens = parse('First\n\nSecond');
    const paras = tokens.filter((t) => t.type === 'paragraph');
    assert.equal(paras.length, 2);
  });
});

// ─── parse – block elements ───────────────────────────────────────────────────

describe('parse – block elements', () => {
  it('fenced code block produces a codeblock token', () => {
    const tokens = parse('```\nconsole.log("hi")\n```');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'codeblock');
    assert.ok(tokens[0].content.includes('console.log'));
  });

  it('horizontal rule --- produces an hr token', () => {
    const tokens = parse('---');
    assert.ok(tokens.some((t) => t.type === 'hr'));
  });

  it('blockquote > text produces a blockquote token', () => {
    const tokens = parse('> This is a quote');
    assert.ok(tokens.some((t) => t.type === 'blockquote'));
    const bq = tokens.find((t) => t.type === 'blockquote');
    assert.ok(bq.content.includes('This is a quote'));
  });

  it('unordered list produces a list token with listitem children', () => {
    const tokens = parse('- Alpha\n- Beta\n- Gamma');
    const list = tokens.find((t) => t.type === 'list');
    assert.ok(list);
    assert.equal(list.items.length, 3);
    assert.ok(list.items.every((i) => i.type === 'listitem'));
  });

  it('list items capture their text content', () => {
    const tokens = parse('- Foo\n- Bar');
    const list = tokens.find((t) => t.type === 'list');
    const texts = list.items.map((i) => i.content);
    assert.ok(texts.includes('Foo'));
    assert.ok(texts.includes('Bar'));
  });

  it('codeblock preserves multiline content', () => {
    const md = '```\nline one\nline two\nline three\n```';
    const tokens = parse(md);
    const cb = tokens.find((t) => t.type === 'codeblock');
    assert.ok(cb.content.includes('line one'));
    assert.ok(cb.content.includes('line three'));
  });

  it('multi-line blockquote merges lines', () => {
    const tokens = parse('> line 1\n> line 2');
    const bq = tokens.find((t) => t.type === 'blockquote');
    assert.ok(bq);
    assert.ok(bq.content.includes('line 1'));
    assert.ok(bq.content.includes('line 2'));
  });

  it('*** also produces an hr token', () => {
    const tokens = parse('***');
    assert.ok(tokens.some((t) => t.type === 'hr'));
  });
});

// ─── toHtml ───────────────────────────────────────────────────────────────────

describe('toHtml', () => {
  it('heading converts to <h1>…</h1>', () => {
    const html = toHtml(parse('# Title'));
    assert.ok(html.startsWith('<h1>'));
    assert.ok(html.endsWith('</h1>'));
    assert.ok(html.includes('Title'));
  });

  it('paragraph wraps content in <p>', () => {
    const html = toHtml(parse('Simple text.'));
    assert.ok(html.includes('<p>'));
    assert.ok(html.includes('</p>'));
  });

  it('bold becomes <strong>', () => {
    const html = toHtml(parse('**bold**'));
    assert.ok(html.includes('<strong>bold</strong>'));
  });

  it('italic becomes <em>', () => {
    const html = toHtml(parse('*italic*'));
    assert.ok(html.includes('<em>italic</em>'));
  });

  it('inline code becomes <code>', () => {
    const html = toHtml(parse('`snippet`'));
    assert.ok(html.includes('<code>snippet</code>'));
  });

  it('codeblock becomes <pre><code>', () => {
    const html = toHtml(parse('```\nconst x = 1;\n```'));
    assert.ok(html.includes('<pre><code>'));
    assert.ok(html.includes('</code></pre>'));
  });

  it('link becomes <a href="…">', () => {
    const html = toHtml(parse('[Visit](https://example.com)'));
    assert.ok(html.includes('<a href="https://example.com">Visit</a>'));
  });

  it('image becomes <img src="…" alt="…">', () => {
    const html = toHtml(parse('![cat](cat.png)'));
    assert.ok(html.includes('<img src="cat.png" alt="cat">'));
  });

  it('list becomes <ul> with <li> items', () => {
    const html = toHtml(parse('- A\n- B'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>A</li>'));
    assert.ok(html.includes('<li>B</li>'));
    assert.ok(html.includes('</ul>'));
  });

  it('hr becomes <hr>', () => {
    const html = toHtml(parse('---'));
    assert.ok(html.includes('<hr>'));
  });

  it('blockquote becomes <blockquote>', () => {
    const html = toHtml(parse('> A quote'));
    assert.ok(html.includes('<blockquote>'));
  });

  it('HTML special characters in content are escaped', () => {
    const html = toHtml(parse('a < b & c > d'));
    assert.ok(html.includes('&lt;'));
    assert.ok(html.includes('&amp;'));
    assert.ok(html.includes('&gt;'));
  });
});

// ─── toPlainText ──────────────────────────────────────────────────────────────

describe('toPlainText', () => {
  it('strips heading markers', () => {
    const text = toPlainText(parse('# Title'));
    assert.ok(text.includes('Title'));
    assert.ok(!text.includes('#'));
  });

  it('strips bold markers', () => {
    const text = toPlainText(parse('**bold**'));
    assert.ok(text.includes('bold'));
    assert.ok(!text.includes('*'));
  });

  it('strips italic markers', () => {
    const text = toPlainText(parse('*italic*'));
    assert.ok(text.includes('italic'));
    assert.ok(!text.includes('*'));
  });

  it('strips link markup, keeping link text', () => {
    const text = toPlainText(parse('[Click here](https://example.com)'));
    assert.ok(text.includes('Click here'));
    assert.ok(!text.includes('https://'));
  });

  it('strips image markup, keeping alt text', () => {
    const text = toPlainText(parse('![alt text](img.png)'));
    assert.ok(text.includes('alt text'));
    assert.ok(!text.includes('img.png'));
  });

  it('code content is preserved without backticks', () => {
    const text = toPlainText(parse('`myFunc()`'));
    assert.ok(text.includes('myFunc()'));
    assert.ok(!text.includes('`'));
  });

  it('codeblock content is preserved', () => {
    const text = toPlainText(parse('```\nconst x = 1;\n```'));
    assert.ok(text.includes('const x = 1;'));
  });

  it('list items appear in plain text', () => {
    const text = toPlainText(parse('- Apple\n- Banana'));
    assert.ok(text.includes('Apple'));
    assert.ok(text.includes('Banana'));
  });

  it('hr produces empty content (no visible chars)', () => {
    const text = toPlainText(parse('---'));
    assert.ok(!text.includes('-'));
  });
});

// ─── extractLinks ─────────────────────────────────────────────────────────────

describe('extractLinks', () => {
  it('extracts a single link', () => {
    const links = extractLinks(parse('[OpenAI](https://openai.com)'));
    assert.equal(links.length, 1);
    assert.equal(links[0].text, 'OpenAI');
    assert.equal(links[0].url, 'https://openai.com');
  });

  it('extracts multiple links from the same paragraph', () => {
    const links = extractLinks(parse('[A](url-a) and [B](url-b)'));
    assert.equal(links.length, 2);
  });

  it('returns empty array when no links are present', () => {
    const links = extractLinks(parse('No links here.'));
    assert.deepEqual(links, []);
  });

  it('does NOT include images in extractLinks output', () => {
    const links = extractLinks(parse('![alt](img.png)'));
    assert.equal(links.length, 0);
  });

  it('extracts links from list item inline content', () => {
    const tokens = parse('- Visit [Example](https://example.com) today');
    const links = extractLinks(tokens);
    assert.equal(links.length, 1);
    assert.equal(links[0].url, 'https://example.com');
  });

  it('each link entry has both text and url properties', () => {
    const links = extractLinks(parse('[Foo](bar)'));
    assert.ok('text' in links[0]);
    assert.ok('url' in links[0]);
  });

  it('preserves link text exactly', () => {
    const links = extractLinks(parse('[My Cool Link](url)'));
    assert.equal(links[0].text, 'My Cool Link');
  });

  it('handles multiple paragraphs with links', () => {
    const md = '[A](a)\n\n[B](b)\n\n[C](c)';
    const links = extractLinks(parse(md));
    assert.equal(links.length, 3);
  });
});

// ─── extractHeadings ─────────────────────────────────────────────────────────

describe('extractHeadings', () => {
  it('extracts a single heading', () => {
    const headings = extractHeadings(parse('# Hello'));
    assert.equal(headings.length, 1);
    assert.equal(headings[0].level, 1);
    assert.equal(headings[0].text, 'Hello');
  });

  it('extracts headings at all six levels', () => {
    const md = ['# H1', '## H2', '### H3', '#### H4', '##### H5', '###### H6'].join('\n');
    const headings = extractHeadings(parse(md));
    assert.equal(headings.length, 6);
    headings.forEach((h, i) => assert.equal(h.level, i + 1));
  });

  it('returns empty array when no headings present', () => {
    const headings = extractHeadings(parse('Just a paragraph.'));
    assert.deepEqual(headings, []);
  });

  it('preserves document order', () => {
    const md = '## Second\n# First placed second in doc\n### Third';
    const headings = extractHeadings(parse(md));
    assert.equal(headings[0].level, 2);
    assert.equal(headings[1].level, 1);
    assert.equal(headings[2].level, 3);
  });

  it('heading text does not include # characters', () => {
    const headings = extractHeadings(parse('## Clean Title'));
    assert.ok(!headings[0].text.includes('#'));
  });

  it('paragraphs and code blocks are not included', () => {
    const headings = extractHeadings(parse('Some text\n\n```\ncode\n```'));
    assert.equal(headings.length, 0);
  });

  it('each heading entry has level and text properties', () => {
    const headings = extractHeadings(parse('# Hi'));
    assert.ok('level' in headings[0]);
    assert.ok('text' in headings[0]);
  });

  it('headings mixed with other block types are still found', () => {
    const md = '> quote\n\n# Heading\n\n- list item';
    const headings = extractHeadings(parse(md));
    assert.equal(headings.length, 1);
    assert.equal(headings[0].text, 'Heading');
  });
});
