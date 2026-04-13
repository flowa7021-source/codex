// @ts-check
// ─── Markdown Parser ──────────────────────────────────────────────────────────
// Minimal Markdown → token/AST parser with HTML and plain-text renderers.

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenType =
  | 'heading'
  | 'paragraph'
  | 'bold'
  | 'italic'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'image'
  | 'list'
  | 'listitem'
  | 'hr'
  | 'blockquote';

export interface Token {
  type: TokenType;
  content: string;
  level?: number;
  url?: string;
  items?: Token[];
}

export interface LinkEntry {
  text: string;
  url: string;
}

export interface HeadingEntry {
  level: number;
  text: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS when rendering to HTML.
 */
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse inline Markdown (bold, italic, code, links, images) into tokens.
 * Returns a flat list of tokens representing the inline content.
 */
function parseInline(text: string): Token[] {
  const tokens: Token[] = [];
  // Combined regex for all inline patterns – order matters:
  // image before link so ![...](...) matches before [...](...).
  const inlineRe =
    /!\[([^\]]*)\]\(([^)]*)\)|\[([^\]]*)\]\(([^)]*)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    // Capture any plain text before this match.
    if (match.index > lastIndex) {
      tokens.push({ type: 'paragraph', content: text.slice(lastIndex, match.index) });
    }

    if (match[0].startsWith('![')) {
      // Image: ![alt](url)
      tokens.push({ type: 'image', content: match[1] ?? '', url: match[2] ?? '' });
    } else if (match[0].startsWith('[')) {
      // Link: [text](url)
      tokens.push({ type: 'link', content: match[3] ?? '', url: match[4] ?? '' });
    } else if (match[0].startsWith('`')) {
      // Inline code
      tokens.push({ type: 'code', content: match[5] ?? '' });
    } else if (match[0].startsWith('**')) {
      // Bold
      tokens.push({ type: 'bold', content: match[6] ?? '' });
    } else {
      // Italic
      tokens.push({ type: 'italic', content: match[7] ?? '' });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text.
  if (lastIndex < text.length) {
    tokens.push({ type: 'paragraph', content: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Convert an inline token array to an HTML string.
 */
function inlineToHtml(tokens: Token[]): string {
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'bold':
          return `<strong>${escHtml(t.content)}</strong>`;
        case 'italic':
          return `<em>${escHtml(t.content)}</em>`;
        case 'code':
          return `<code>${escHtml(t.content)}</code>`;
        case 'link':
          return `<a href="${escHtml(t.url ?? '')}">${escHtml(t.content)}</a>`;
        case 'image':
          return `<img src="${escHtml(t.url ?? '')}" alt="${escHtml(t.content)}">`;
        default:
          return escHtml(t.content);
      }
    })
    .join('');
}

/**
 * Convert an inline token array to plain text (strip markup).
 */
function inlineToPlain(tokens: Token[]): string {
  return tokens.map((t) => t.content).join('');
}

// ─── parse ────────────────────────────────────────────────────────────────────

/**
 * Parse a Markdown string into a flat array of block-level tokens.
 * Inline elements (bold, italic, code, links, images) are stored in the
 * `items` array of their containing block token where relevant.
 */
export function parse(markdown: string): Token[] {
  const tokens: Token[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ```…``` ──────────────────────────────────────────
    if (line.trimStart().startsWith('```')) {
      const fence = line.trimStart().slice(3); // optional language hint (ignored)
      void fence;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({ type: 'codeblock', content: codeLines.join('\n') });
      i++; // skip closing ```
      continue;
    }

    // ── Horizontal rule --- / *** / ___ ───────────────────────────────────
    if (/^(\s*[-*_]){3,}\s*$/.test(line) && line.trim().length >= 3) {
      tokens.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // ── ATX Heading # … ######  ────────────────────────────────────────────
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // ── Blockquote > ───────────────────────────────────────────────────────
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      tokens.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // ── Unordered list - item ──────────────────────────────────────────────
    if (/^(\s*[-*+])\s+/.test(line)) {
      const items: Token[] = [];
      while (i < lines.length && /^(\s*[-*+])\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*+]\s+/, '');
        const inlineItems = parseInline(itemText);
        // Flatten: if there is exactly one plain-paragraph token, store as
        // simple content string; otherwise keep items.
        if (
          inlineItems.length === 1 &&
          inlineItems[0].type === 'paragraph'
        ) {
          items.push({ type: 'listitem', content: inlineItems[0].content });
        } else {
          items.push({ type: 'listitem', content: itemText, items: inlineItems });
        }
        i++;
      }
      tokens.push({ type: 'list', content: '', items });
      continue;
    }

    // ── Empty line – skip ──────────────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph (may contain inline markup) ─────────────────────────────
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !lines[i].startsWith('>') &&
           !/^(\s*[-*+])\s+/.test(lines[i]) &&
           !lines[i].trimStart().startsWith('```') &&
           !/^(\s*[-*_]){3,}\s*$/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length === 0) {
      // Unconsumed line that matched no block-level pattern — treat as paragraph.
      paraLines.push(lines[i]);
      i++;
    }
    const paraText = paraLines.join(' ');
    const inlineItems = parseInline(paraText);

    if (inlineItems.length === 1 && inlineItems[0].type === 'paragraph') {
      tokens.push({ type: 'paragraph', content: inlineItems[0].content });
    } else if (inlineItems.length > 0) {
      tokens.push({ type: 'paragraph', content: paraText, items: inlineItems });
    }
  }

  return tokens;
}

// ─── toHtml ───────────────────────────────────────────────────────────────────

/**
 * Convert a token array produced by `parse()` to an HTML string.
 */
export function toHtml(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'heading': {
          const lvl = token.level ?? 1;
          const inner = inlineToHtml(parseInline(token.content));
          return `<h${lvl}>${inner}</h${lvl}>`;
        }
        case 'paragraph': {
          const inner = token.items ? inlineToHtml(token.items) : escHtml(token.content);
          return `<p>${inner}</p>`;
        }
        case 'bold':
          return `<strong>${escHtml(token.content)}</strong>`;
        case 'italic':
          return `<em>${escHtml(token.content)}</em>`;
        case 'code':
          return `<code>${escHtml(token.content)}</code>`;
        case 'codeblock':
          return `<pre><code>${escHtml(token.content)}</code></pre>`;
        case 'link':
          return `<a href="${escHtml(token.url ?? '')}">${escHtml(token.content)}</a>`;
        case 'image':
          return `<img src="${escHtml(token.url ?? '')}" alt="${escHtml(token.content)}">`;
        case 'list': {
          const liHtml = (token.items ?? [])
            .map((item) => {
              const inner = item.items ? inlineToHtml(item.items) : escHtml(item.content);
              return `<li>${inner}</li>`;
            })
            .join('');
          return `<ul>${liHtml}</ul>`;
        }
        case 'listitem': {
          const inner = token.items ? inlineToHtml(token.items) : escHtml(token.content);
          return `<li>${inner}</li>`;
        }
        case 'hr':
          return '<hr>';
        case 'blockquote':
          return `<blockquote>${escHtml(token.content)}</blockquote>`;
        default:
          return '';
      }
    })
    .join('');
}

// ─── toPlainText ──────────────────────────────────────────────────────────────

/**
 * Strip all Markdown markup and return plain text.
 */
export function toPlainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'heading':
        case 'paragraph':
        case 'bold':
        case 'italic':
        case 'code':
        case 'blockquote': {
          if (token.items) {
            return inlineToPlain(token.items);
          }
          return token.content;
        }
        case 'codeblock':
          return token.content;
        case 'link':
          return token.content;
        case 'image':
          return token.content;
        case 'list':
          return (token.items ?? [])
            .map((item) => (item.items ? inlineToPlain(item.items) : item.content))
            .join('\n');
        case 'listitem':
          return token.items ? inlineToPlain(token.items) : token.content;
        case 'hr':
          return '';
        default:
          return '';
      }
    })
    .join('\n');
}

// ─── extractLinks ─────────────────────────────────────────────────────────────

/**
 * Recursively collect all link tokens from a token array.
 */
export function extractLinks(tokens: Token[]): LinkEntry[] {
  const result: LinkEntry[] = [];

  function walk(toks: Token[]): void {
    for (const tok of toks) {
      if (tok.type === 'link') {
        result.push({ text: tok.content, url: tok.url ?? '' });
      }
      if (tok.items) walk(tok.items);
    }
  }

  walk(tokens);
  return result;
}

// ─── extractHeadings ──────────────────────────────────────────────────────────

/**
 * Collect all heading tokens from a token array, in document order.
 */
export function extractHeadings(tokens: Token[]): HeadingEntry[] {
  return tokens
    .filter((t): t is Token & { type: 'heading'; level: number } => t.type === 'heading')
    .map((t) => ({ level: t.level ?? 1, text: t.content }));
}
