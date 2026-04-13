// ─── Unit Tests: md-parser ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdown, parseInline } from '../../app/modules/md-parser.js';

// ─── parseInline ──────────────────────────────────────────────────────────────

describe('parseInline – bold', () => {
  it('renders **bold** as <strong>', () => {
    assert.equal(parseInline('**hello**'), '<strong>hello</strong>');
  });

  it('renders __bold__ as <strong>', () => {
    assert.equal(parseInline('__world__'), '<strong>world</strong>');
  });

  it('leaves non-bold text unchanged', () => {
    assert.equal(parseInline('plain text'), 'plain text');
  });
});

describe('parseInline – italic', () => {
  it('renders *italic* as <em>', () => {
    assert.equal(parseInline('*hello*'), '<em>hello</em>');
  });

  it('renders _italic_ as <em>', () => {
    assert.equal(parseInline('_world_'), '<em>world</em>');
  });
});

describe('parseInline – inline code', () => {
  it('renders `code` as <code>', () => {
    assert.equal(parseInline('`foo`'), '<code>foo</code>');
  });

  it('escapes HTML inside inline code', () => {
    assert.equal(parseInline('`<b>`'), '<code>&lt;b&gt;</code>');
  });
});

describe('parseInline – links', () => {
  it('renders [text](url) as <a>', () => {
    assert.equal(
      parseInline('[Click me](https://example.com)'),
      '<a href="https://example.com">Click me</a>',
    );
  });

  it('handles links with special chars in text', () => {
    const result = parseInline('[**bold link**](http://x.com)');
    assert.ok(result.includes('<a href="http://x.com">'), `got: ${result}`);
  });
});

describe('parseInline – images', () => {
  it('renders ![alt](url) as <img>', () => {
    assert.equal(
      parseInline('![cat](cat.png)'),
      '<img src="cat.png" alt="cat">',
    );
  });

  it('handles empty alt text', () => {
    assert.equal(parseInline('![](img.jpg)'), '<img src="img.jpg" alt="">');
  });
});

describe('parseInline – combined', () => {
  it('parses bold inside sentence', () => {
    const result = parseInline('Hello **world** today');
    assert.equal(result, 'Hello <strong>world</strong> today');
  });

  it('parses italic and code together', () => {
    const result = parseInline('Use `npm` or *yarn*');
    assert.equal(result, 'Use <code>npm</code> or <em>yarn</em>');
  });
});

// ─── parseMarkdown – headings ─────────────────────────────────────────────────

describe('parseMarkdown – headings', () => {
  it('renders # as <h1>', () => {
    assert.equal(parseMarkdown('# Hello'), '<h1>Hello</h1>');
  });

  it('renders ## as <h2>', () => {
    assert.equal(parseMarkdown('## World'), '<h2>World</h2>');
  });

  it('renders ### through ###### correctly', () => {
    for (let n = 3; n <= 6; n++) {
      const md = '#'.repeat(n) + ' Test';
      const result = parseMarkdown(md);
      assert.ok(result.includes(`<h${n}>Test</h${n}>`), `h${n}: got ${result}`);
    }
  });

  it('renders inline markup inside headings', () => {
    const result = parseMarkdown('# **Bold** heading');
    assert.equal(result, '<h1><strong>Bold</strong> heading</h1>');
  });

  it('does not render headings when feature disabled', () => {
    const result = parseMarkdown('# Title', { features: { headings: false } });
    assert.ok(!result.includes('<h1>'), `got: ${result}`);
  });
});

// ─── parseMarkdown – horizontal rule ─────────────────────────────────────────

describe('parseMarkdown – horizontal rule', () => {
  it('renders --- as <hr>', () => {
    assert.equal(parseMarkdown('---'), '<hr>');
  });

  it('renders *** as <hr>', () => {
    assert.equal(parseMarkdown('***'), '<hr>');
  });

  it('renders ___ as <hr>', () => {
    assert.equal(parseMarkdown('___'), '<hr>');
  });

  it('does not render hr when feature disabled', () => {
    const result = parseMarkdown('---', { features: { horizontalRule: false } });
    assert.ok(!result.includes('<hr>'), `got: ${result}`);
  });
});

// ─── parseMarkdown – code blocks ──────────────────────────────────────────────

describe('parseMarkdown – fenced code blocks', () => {
  it('renders ``` block as <pre><code>', () => {
    const md = '```\nhello world\n```';
    const result = parseMarkdown(md);
    assert.ok(result.includes('<pre><code>'), `got: ${result}`);
    assert.ok(result.includes('hello world'), `got: ${result}`);
    assert.ok(result.includes('</code></pre>'), `got: ${result}`);
  });

  it('escapes HTML inside code block', () => {
    const md = '```\n<script>alert(1)</script>\n```';
    const result = parseMarkdown(md);
    assert.ok(result.includes('&lt;script&gt;'), `got: ${result}`);
  });

  it('includes language class when language specified', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const result = parseMarkdown(md);
    assert.ok(result.includes('class="language-javascript"'), `got: ${result}`);
  });

  it('does not render code when feature disabled', () => {
    const md = '```\ncode\n```';
    const result = parseMarkdown(md, { features: { code: false } });
    assert.ok(!result.includes('<pre>'), `got: ${result}`);
  });
});

// ─── parseMarkdown – blockquote ───────────────────────────────────────────────

describe('parseMarkdown – blockquote', () => {
  it('renders > text as <blockquote>', () => {
    const result = parseMarkdown('> Hello');
    assert.ok(result.includes('<blockquote>'), `got: ${result}`);
    assert.ok(result.includes('Hello'), `got: ${result}`);
    assert.ok(result.includes('</blockquote>'), `got: ${result}`);
  });

  it('renders paragraph inside blockquote', () => {
    const result = parseMarkdown('> Quoted paragraph');
    assert.ok(result.includes('<p>Quoted paragraph</p>'), `got: ${result}`);
  });

  it('renders multi-line blockquote', () => {
    const result = parseMarkdown('> Line one\n> Line two');
    assert.ok(result.includes('<blockquote>'), `got: ${result}`);
  });

  it('does not render blockquote when feature disabled', () => {
    const result = parseMarkdown('> text', { features: { blockquote: false } });
    assert.ok(!result.includes('<blockquote>'), `got: ${result}`);
  });
});

// ─── parseMarkdown – lists ────────────────────────────────────────────────────

describe('parseMarkdown – unordered lists', () => {
  it('renders - items as <ul><li>', () => {
    const result = parseMarkdown('- Item A\n- Item B');
    assert.ok(result.includes('<ul>'), `got: ${result}`);
    assert.ok(result.includes('<li>Item A</li>'), `got: ${result}`);
    assert.ok(result.includes('<li>Item B</li>'), `got: ${result}`);
    assert.ok(result.includes('</ul>'), `got: ${result}`);
  });

  it('renders * items as <ul>', () => {
    const result = parseMarkdown('* One\n* Two');
    assert.ok(result.includes('<ul>'), `got: ${result}`);
    assert.ok(result.includes('<li>One</li>'), `got: ${result}`);
  });

  it('renders nested list', () => {
    const md = '- Parent\n  - Child';
    const result = parseMarkdown(md);
    assert.ok(result.includes('<ul>'), `got: ${result}`);
    assert.ok(result.includes('Parent'), `got: ${result}`);
    assert.ok(result.includes('Child'), `got: ${result}`);
  });

  it('does not render lists when feature disabled', () => {
    const result = parseMarkdown('- item', { features: { lists: false } });
    assert.ok(!result.includes('<ul>'), `got: ${result}`);
  });
});

describe('parseMarkdown – ordered lists', () => {
  it('renders 1. items as <ol><li>', () => {
    const result = parseMarkdown('1. First\n2. Second');
    assert.ok(result.includes('<ol>'), `got: ${result}`);
    assert.ok(result.includes('<li>First</li>'), `got: ${result}`);
    assert.ok(result.includes('<li>Second</li>'), `got: ${result}`);
    assert.ok(result.includes('</ol>'), `got: ${result}`);
  });

  it('renders single ordered item', () => {
    const result = parseMarkdown('1. Only item');
    assert.ok(result.includes('<ol>'), `got: ${result}`);
    assert.ok(result.includes('<li>Only item</li>'), `got: ${result}`);
  });
});

// ─── parseMarkdown – paragraphs ───────────────────────────────────────────────

describe('parseMarkdown – paragraphs', () => {
  it('wraps plain text in <p>', () => {
    assert.equal(parseMarkdown('Hello world'), '<p>Hello world</p>');
  });

  it('separates paragraphs with blank lines', () => {
    const result = parseMarkdown('First\n\nSecond');
    assert.ok(result.includes('<p>First</p>'), `got: ${result}`);
    assert.ok(result.includes('<p>Second</p>'), `got: ${result}`);
  });

  it('renders inline markup inside paragraphs', () => {
    const result = parseMarkdown('Use **bold** and *italic*');
    assert.equal(result, '<p>Use <strong>bold</strong> and <em>italic</em></p>');
  });

  it('renders link inside paragraph', () => {
    const result = parseMarkdown('Visit [site](http://example.com)');
    assert.ok(result.includes('<a href="http://example.com">site</a>'), `got: ${result}`);
    assert.ok(result.includes('<p>'), `got: ${result}`);
  });

  it('converts \\n to <br> when breaks option is enabled', () => {
    const result = parseMarkdown('Line one\nLine two', { breaks: true });
    assert.ok(result.includes('<br>'), `got: ${result}`);
  });

  it('does not convert \\n to <br> by default', () => {
    const result = parseMarkdown('Line one\nLine two');
    assert.ok(!result.includes('<br>'), `got: ${result}`);
  });
});

// ─── parseMarkdown – full document ────────────────────────────────────────────

describe('parseMarkdown – mixed content', () => {
  it('parses a document with multiple block types', () => {
    const md = [
      '# Title',
      '',
      'Intro paragraph.',
      '',
      '- Item one',
      '- Item two',
      '',
      '---',
      '',
      '> A quote',
    ].join('\n');

    const result = parseMarkdown(md);
    assert.ok(result.includes('<h1>Title</h1>'), `h1 missing: ${result}`);
    assert.ok(result.includes('<p>Intro paragraph.</p>'), `p missing: ${result}`);
    assert.ok(result.includes('<ul>'), `ul missing: ${result}`);
    assert.ok(result.includes('<hr>'), `hr missing: ${result}`);
    assert.ok(result.includes('<blockquote>'), `blockquote missing: ${result}`);
  });

  it('parses a document with code and links', () => {
    const md = '## Install\n\nRun `npm install` or visit [npm](https://npmjs.com).';
    const result = parseMarkdown(md);
    assert.ok(result.includes('<h2>Install</h2>'), `h2 missing: ${result}`);
    assert.ok(result.includes('<code>npm install</code>'), `code missing: ${result}`);
    assert.ok(result.includes('<a href="https://npmjs.com">npm</a>'), `link missing: ${result}`);
  });
});
