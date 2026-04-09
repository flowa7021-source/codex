// @ts-check
// ─── Markdown Utilities ──────────────────────────────────────────────────────
// Lightweight Markdown parsing and rendering helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert basic Markdown to HTML.
 * Supported subset: h1–h6, bold, italic, inline code, links,
 * unordered lists, ordered lists, blockquotes.
 */
export function markdownToHTML(md: string): string {
  if (!md) return '';

  const lines = md.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = processInline(headingMatch[2]);
      output.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const content = processInline(line.slice(2));
      output.push(`<blockquote>${content}</blockquote>`);
      i++;
      continue;
    }

    // Unordered list item
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${processInline(lines[i].replace(/^[-*+]\s/, ''))}</li>`);
        i++;
      }
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list item
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${processInline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    output.push(`<p>${processInline(line)}</p>`);
    i++;
  }

  return output.join('');
}

/** Process inline Markdown: bold, italic, code, links. */
function processInline(text: string): string {
  // Inline code (before bold/italic so backticks aren't disrupted)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

// ─── extractHeadings ─────────────────────────────────────────────────────────

/** Extract all headings from Markdown. Returns {level, text}[]. */
export function extractHeadings(md: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.*)/);
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim() });
    }
  }
  return headings;
}

// ─── extractLinks ────────────────────────────────────────────────────────────

/** Extract all links from Markdown. Returns {text, url}[]. */
export function extractLinks(md: string): { text: string; url: string }[] {
  const links: { text: string; url: string }[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    links.push({ text: m[1], url: m[2] });
  }
  return links;
}

// ─── stripMarkdown ───────────────────────────────────────────────────────────

/** Strip Markdown formatting, returning plain text. */
export function stripMarkdown(md: string): string {
  let text = md;
  // Headings
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Bold / italic (combined syntax like ***text***)
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Links – keep the visible text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Blockquotes
  text = text.replace(/^>\s*/gm, '');
  // List markers
  text = text.replace(/^[-*+]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  return text.trim();
}

// ─── wordCount ───────────────────────────────────────────────────────────────

/** Count words in Markdown text (ignoring formatting). */
export function wordCount(md: string): number {
  const plain = stripMarkdown(md);
  if (!plain) return 0;
  return plain.split(/\s+/).filter((w) => w.length > 0).length;
}

// ─── readingTime ─────────────────────────────────────────────────────────────

/** Estimate reading time in minutes (200 words/min). Minimum 1 minute. */
export function readingTime(md: string): number {
  const words = wordCount(md);
  return Math.max(1, Math.ceil(words / 200));
}

// ─── headingToSlug ───────────────────────────────────────────────────────────

/** Convert a Markdown heading to a URL slug. */
export function headingToSlug(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── hasMarkdown ─────────────────────────────────────────────────────────────

/** Check if a string contains Markdown formatting. */
export function hasMarkdown(text: string): boolean {
  return (
    /^#{1,6}\s/m.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /\*[^*]+\*/.test(text) ||
    /__[^_]+__/.test(text) ||
    /_[^_]+_/.test(text) ||
    /`[^`]+`/.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /^[-*+]\s/m.test(text) ||
    /^\d+\.\s/m.test(text) ||
    /^>\s/m.test(text)
  );
}
