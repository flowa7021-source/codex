// @ts-check
// ─── Template Engine ──────────────────────────────────────────────────────────
// A lightweight Mustache-inspired template engine with variable substitution,
// triple-brace raw output, #if conditionals, #each iteration (named variable,
// index, @first, @last), partials, and HTML escaping on by default.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateOptions {
  /** Opening and closing delimiters. Default: ['{{', '}}'] */
  delimiters?: [string, string];
  /** HTML-escape interpolated values. Default: true */
  escape?: boolean;
}

// ─── HTML Escaping ────────────────────────────────────────────────────────────

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Escape HTML special characters: & < > " ' → entities */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/** Unescape HTML entities back to their original characters. */
export function unescapeHtml(str: string): string {
  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_UNESCAPE_MAP[entity] ?? entity);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve a dot-notation key against a data context.
 * Returns undefined when any segment along the path is missing.
 */
function resolvePath(data: Record<string, unknown>, key: string): unknown {
  const path = key.trim();
  // Support dot-access for @first, @last, etc. — stored verbatim in data
  if (Object.prototype.hasOwnProperty.call(data, path)) {
    return data[path];
  }
  const parts = path.split('.');
  if (parts.length === 1) {
    return data[path];
  }
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Stringify a resolved value; null/undefined → empty string. */
function toStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Normalise options, filling in defaults. */
function normalizeOptions(options?: TemplateOptions): { open: string; close: string; doEscape: boolean } {
  const [open, close] = options?.delimiters ?? ['{{', '}}'];
  return {
    open,
    close,
    doEscape: options?.escape !== false,
  };
}

// ─── Block-end finder ─────────────────────────────────────────────────────────

/**
 * From `searchFrom`, scan `template` for the matching closing tag
 * (e.g. `{{/if}}`) that balances the already-open block `blockName`.
 *
 * Returns the index at which the closing tag starts, or -1 if not found.
 */
function findBlockEnd(
  template: string,
  searchFrom: number,
  open: string,
  close: string,
  blockName: string,
): number {
  const openTag = `${open}#${blockName}`;   // e.g. {{#if
  const closeTag = `${open}/${blockName}${close}`; // e.g. {{/if}}

  let depth = 1;
  let pos = searchFrom;

  while (pos < template.length) {
    const nextOpen  = template.indexOf(openTag,  pos);
    const nextClose = template.indexOf(closeTag, pos);

    if (nextClose === -1) return -1;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      // Another opening of the same block — deepen nesting
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

// ─── Core Processor ───────────────────────────────────────────────────────────

type ProcOpts = {
  open: string;
  close: string;
  doEscape: boolean;
  partials: Map<string, string>;
};

/**
 * Recursively process a template against a data context.
 * This is the single central function used by all public APIs.
 */
function processTemplate(
  template: string,
  data: Record<string, unknown>,
  opts: ProcOpts,
): string {
  const { open, close, doEscape, partials } = opts;
  const isDefault = open === '{{' && close === '}}';

  const chunks: string[] = [];
  let pos = 0;

  while (pos < template.length) {
    // Locate the next opening delimiter
    const tagStart = template.indexOf(open, pos);

    if (tagStart === -1) {
      // No more tags — append remainder as-is
      chunks.push(template.slice(pos));
      break;
    }

    // Append literal text before the tag
    chunks.push(template.slice(pos, tagStart));

    // ── Triple-brace raw output: {{{name}}} ───────────────────────────────
    if (isDefault && template.startsWith('{{{', tagStart)) {
      const tripleEnd = template.indexOf('}}}', tagStart + 3);
      if (tripleEnd !== -1) {
        const key = template.slice(tagStart + 3, tripleEnd).trim();
        chunks.push(toStr(resolvePath(data, key)));
        pos = tripleEnd + 3;
        continue;
      }
    }

    // Locate closing delimiter
    const tagEnd = template.indexOf(close, tagStart + open.length);
    if (tagEnd === -1) {
      // Unclosed tag — treat rest of string as literal
      chunks.push(template.slice(tagStart));
      break;
    }

    const inner = template.slice(tagStart + open.length, tagEnd).trim();
    pos = tagEnd + close.length;

    // ── Comment: {{! … }} ────────────────────────────────────────────────
    if (inner.startsWith('!')) {
      continue; // swallow the comment
    }

    // ── Partial: {{> name }} ─────────────────────────────────────────────
    if (inner.startsWith('>')) {
      const partialName = inner.slice(1).trim();
      const partialSrc = partials.get(partialName);
      if (partialSrc !== undefined) {
        chunks.push(processTemplate(partialSrc, data, opts));
      }
      continue;
    }

    // ── Block open: {{#if …}} / {{#each …}} ──────────────────────────────
    if (inner.startsWith('#')) {
      const directive = inner.slice(1).trim(); // e.g. "if cond" or "each arr as item"

      // ── #if ────────────────────────────────────────────────────────────
      if (directive.startsWith('if ')) {
        const condKey = directive.slice(3).trim();
        const blockEnd = findBlockEnd(template, pos, open, close, 'if');
        const closeTag = `${open}/if${close}`;

        if (blockEnd === -1) break;

        const blockContent = template.slice(pos, blockEnd);
        pos = blockEnd + closeTag.length;

        if (resolvePath(data, condKey)) {
          chunks.push(processTemplate(blockContent, data, opts));
        }
        continue;
      }

      // ── #each ──────────────────────────────────────────────────────────
      if (directive.startsWith('each ')) {
        const eachExpr = directive.slice(5).trim();
        const blockEnd = findBlockEnd(template, pos, open, close, 'each');
        const closeTag = `${open}/each${close}`;

        if (blockEnd === -1) break;

        const blockContent = template.slice(pos, blockEnd);
        pos = blockEnd + closeTag.length;

        // Parse: "arr" or "arr as item"
        const asSplit = eachExpr.split(/\s+as\s+/);
        const arrayKey  = asSplit[0].trim();
        const itemAlias = asSplit.length >= 2 ? asSplit[1].trim() : 'item';

        const collection = resolvePath(data, arrayKey);
        if (Array.isArray(collection)) {
          const last = collection.length - 1;
          for (let i = 0; i < collection.length; i++) {
            const iterData: Record<string, unknown> = {
              ...data,
              [itemAlias]: collection[i],
              index: i,
              '@first': i === 0,
              '@last': i === last,
            };
            chunks.push(processTemplate(blockContent, iterData, opts));
          }
        }
        continue;
      }

      // Unknown block directive — skip
      continue;
    }

    // ── Closing block tag ─────────────────────────────────────────────────
    if (inner.startsWith('/')) {
      // Orphaned close — ignore
      continue;
    }

    // ── Variable substitution: {{name}} ──────────────────────────────────
    const value = toStr(resolvePath(data, inner));
    chunks.push(doEscape ? escapeHtml(value) : value);
  }

  return chunks.join('');
}

// ─── Public Functional API ────────────────────────────────────────────────────

/**
 * Compile a template string into a reusable render function.
 *
 * @example
 * const fn = compile('Hello, {{name}}!');
 * fn({ name: 'World' }); // 'Hello, World!'
 */
export function compile(
  template: string,
  options?: TemplateOptions,
): (data: Record<string, unknown>) => string {
  const { open, close, doEscape } = normalizeOptions(options);
  const partials = new Map<string, string>();
  return (data: Record<string, unknown>) =>
    processTemplate(template, data, { open, close, doEscape, partials });
}

/**
 * Render a template string once against the supplied data.
 *
 * @example
 * render('Hello, {{name}}!', { name: 'World' }); // 'Hello, World!'
 */
export function render(
  template: string,
  data: Record<string, unknown>,
  options?: TemplateOptions,
): string {
  return compile(template, options)(data);
}

// ─── TemplateEngine Class ─────────────────────────────────────────────────────

/**
 * Stateful template engine that retains registered partials and options across
 * multiple render calls.
 */
export class TemplateEngine {
  #open: string;
  #close: string;
  #doEscape: boolean;
  #partials: Map<string, string>;

  constructor(options?: TemplateOptions) {
    const { open, close, doEscape } = normalizeOptions(options);
    this.#open = open;
    this.#close = close;
    this.#doEscape = doEscape;
    this.#partials = new Map();
  }

  /** Register a named partial template for use with {{> name}}. */
  registerPartial(name: string, template: string): void {
    this.#partials.set(name, template);
  }

  /** Render `template` against `data` using the engine's settings. */
  render(template: string, data: Record<string, unknown>): string {
    return processTemplate(template, data, {
      open: this.#open,
      close: this.#close,
      doEscape: this.#doEscape,
      partials: this.#partials,
    });
  }

  /**
   * Compile `template` into a reusable function bound to this engine.
   * Partials registered after compilation are still visible at render time.
   */
  compile(template: string): (data: Record<string, unknown>) => string {
    return (data: Record<string, unknown>) => this.render(template, data);
  }
}

/**
 * Factory function — creates a new TemplateEngine with the given options.
 *
 * @example
 * const engine = createTemplateEngine({ escape: false });
 * engine.render('{{html}}', { html: '<b>bold</b>' }); // '<b>bold</b>'
 */
export function createTemplateEngine(options?: TemplateOptions): TemplateEngine {
  return new TemplateEngine(options);
}
