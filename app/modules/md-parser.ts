// @ts-check
// ─── Markdown Parser ──────────────────────────────────────────────────────────
// A lightweight Markdown-to-HTML parser supporting headings, bold, italic,
// code, links, images, lists, blockquotes, horizontal rules, and paragraphs.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarkdownOptions {
  /** Convert \n to <br> in paragraphs, default false */
  breaks?: boolean;
  /** Enable/disable specific features */
  features?: {
    headings?: boolean;
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    links?: boolean;
    images?: boolean;
    lists?: boolean;
    blockquote?: boolean;
    horizontalRule?: boolean;
  };
}

// ─── Feature flags helper ─────────────────────────────────────────────────────

function _feat(options: MarkdownOptions | undefined, key: keyof NonNullable<MarkdownOptions['features']>): boolean {
  return options?.features?.[key] !== false;
}

// ─── Inline parser ────────────────────────────────────────────────────────────

/**
 * Parse inline Markdown elements (no block elements).
 * Processes: bold, italic, inline code, links, images.
 */
export function parseInline(text: string, options?: MarkdownOptions): string {
  let out = text;

  // Inline code: `code` — process first so other patterns don't match inside code
  if (_feat(options, 'code')) {
    out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${_escapeHtml(code)}</code>`);
  }

  // Images: ![alt](url) — must come before links
  if (_feat(options, 'images')) {
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) =>
      `<img src="${_escapeAttr(url)}" alt="${_escapeAttr(alt)}">`
    );
  }

  // Links: [text](url)
  if (_feat(options, 'links')) {
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, linkText: string, url: string) =>
      `<a href="${_escapeAttr(url)}">${linkText}</a>`
    );
  }

  // Bold: **text** or __text__
  if (_feat(options, 'bold')) {
    out = out.replace(/\*\*([^*]+)\*\*/g, (_m, t: string) => `<strong>${t}</strong>`);
    out = out.replace(/__([^_]+)__/g, (_m, t: string) => `<strong>${t}</strong>`);
  }

  // Italic: *text* or _text_
  if (_feat(options, 'italic')) {
    out = out.replace(/\*([^*]+)\*/g, (_m, t: string) => `<em>${t}</em>`);
    out = out.replace(/_([^_]+)_/g, (_m, t: string) => `<em>${t}</em>`);
  }

  return out;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function _escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── List parser ──────────────────────────────────────────────────────────────

interface _ListItem {
  indent: number;
  ordered: boolean;
  content: string;
  index: number; // 1-based number for ordered items
}

function _parseListItem(line: string): _ListItem | null {
  const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
  if (unorderedMatch) {
    return {
      indent: unorderedMatch[1].length,
      ordered: false,
      content: unorderedMatch[2],
      index: 1,
    };
  }
  const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
  if (orderedMatch) {
    return {
      indent: orderedMatch[1].length,
      ordered: true,
      content: orderedMatch[3],
      index: parseInt(orderedMatch[2], 10),
    };
  }
  return null;
}

function _renderList(items: _ListItem[], options: MarkdownOptions | undefined, baseIndent: number): string {
  if (items.length === 0) return '';

  const tag = items[0].ordered ? 'ol' : 'ul';
  let html = `<${tag}>\n`;
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    if (item.indent !== baseIndent) {
      i++;
      continue;
    }

    // Collect nested children
    const children: _ListItem[] = [];
    let j = i + 1;
    while (j < items.length && items[j].indent > baseIndent) {
      children.push(items[j]);
      j++;
    }

    const content = parseInline(item.content, options);
    if (children.length > 0) {
      html += `<li>${content}\n${_renderList(children, options, children[0].indent)}</li>\n`;
    } else {
      html += `<li>${content}</li>\n`;
    }

    i = j;
  }

  html += `</${tag}>\n`;
  return html;
}

// ─── Block parser ─────────────────────────────────────────────────────────────

/**
 * Parse a Markdown string and return HTML.
 */
export function parseMarkdown(markdown: string, options?: MarkdownOptions): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line ────────────────────────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Heading: # H1 through ###### H6 ──────────────────────────────────────
    if (_feat(options, 'headings')) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = parseInline(headingMatch[2].trim(), options);
        blocks.push(`<h${level}>${content}</h${level}>`);
        i++;
        continue;
      }
    }

    // ── Horizontal rule: --- or *** or ___ (3+ chars, optional spaces) ────────
    if (_feat(options, 'horizontalRule')) {
      if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
        blocks.push('<hr>');
        i++;
        continue;
      }
    }

    // ── Fenced code block: ```...``` ──────────────────────────────────────────
    if (_feat(options, 'code')) {
      const fenceMatch = line.match(/^(`{3,})(.*)/);
      if (fenceMatch) {
        const fence = fenceMatch[1];
        const lang = fenceMatch[2].trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith(fence)) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        const codeContent = _escapeHtml(codeLines.join('\n'));
        const langAttr = lang ? ` class="language-${_escapeAttr(lang)}"` : '';
        blocks.push(`<pre><code${langAttr}>${codeContent}</code></pre>`);
        continue;
      }
    }

    // ── Blockquote: > text ────────────────────────────────────────────────────
    if (_feat(options, 'blockquote') && line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
        const l = lines[i];
        if (l.startsWith('> ')) {
          quoteLines.push(l.slice(2));
        } else if (l.startsWith('>')) {
          quoteLines.push(l.slice(1));
        } else {
          // blank line inside blockquote
          quoteLines.push('');
        }
        i++;
      }
      // Remove trailing blank lines
      while (quoteLines.length > 0 && quoteLines[quoteLines.length - 1].trim() === '') {
        quoteLines.pop();
      }
      const inner = parseMarkdown(quoteLines.join('\n'), options);
      blocks.push(`<blockquote>\n${inner}\n</blockquote>`);
      continue;
    }

    // ── List ──────────────────────────────────────────────────────────────────
    if (_feat(options, 'lists')) {
      const listItem = _parseListItem(line);
      if (listItem) {
        const items: _ListItem[] = [];
        while (i < lines.length) {
          const item = _parseListItem(lines[i]);
          if (item) {
            items.push(item);
            i++;
          } else if (lines[i].trim() === '') {
            // Blank line ends the list
            i++;
            break;
          } else {
            // Continuation line (indented content) — attach to previous item
            if (items.length > 0) {
              items[items.length - 1].content += ' ' + lines[i].trim();
            }
            i++;
          }
        }
        blocks.push(_renderList(items, options, items[0].indent));
        continue;
      }
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        // Stop at block-level elements
        if (_feat(options, 'headings') && /^#{1,6}\s/.test(lines[i])) break;
        if (_feat(options, 'horizontalRule') && /^(\s*[-*_]){3,}\s*$/.test(lines[i])) break;
        if (_feat(options, 'blockquote') && lines[i].startsWith('>')) break;
        if (_feat(options, 'lists') && _parseListItem(lines[i])) break;
        if (_feat(options, 'code') && /^`{3,}/.test(lines[i])) break;
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        const sep = options?.breaks ? '<br>\n' : '\n';
        const content = parseInline(paraLines.join(sep), options);
        blocks.push(`<p>${content}</p>`);
      }
    }
  }

  return blocks.join('\n');
}
