// @ts-check
// ─── Template Engine ──────────────────────────────────────────────────────────
// A Mustache-inspired template engine supporting variable interpolation,
// raw output, truthy/falsy sections, array iteration, partials, and comments.

// ─── Types ────────────────────────────────────────────────────────────────────

/** @deprecated Use Record<string, unknown> directly. */
export interface TemplateContext {
  [key: string]: unknown;
}

export interface TemplateOptions {
  /** Delimiters, default ['{{', '}}'] */
  delimiters?: [string, string];
  /** Escape HTML in interpolations, default true */
  escapeHtml?: boolean;
}

// ─── HTML Escaping ────────────────────────────────────────────────────────────

const _HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape HTML characters in a string. */
export function escapeTemplateHTML(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => _HTML_ESCAPE_MAP[ch] ?? ch);
}

// ─── Token types ──────────────────────────────────────────────────────────────

const _TOKEN = {
  TEXT: 'text',
  VAR: 'var',
  RAW: 'raw',
  SECTION_OPEN: 'section_open',
  SECTION_CLOSE: 'section_close',
  INVERTED_OPEN: 'inverted_open',
  PARTIAL: 'partial',
  COMMENT: 'comment',
} as const;

type _TokenType = (typeof _TOKEN)[keyof typeof _TOKEN];

interface _Token {
  type: _TokenType;
  value: string;
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

function _tokenize(source: string, open: string, close: string): _Token[] {
  const tokens: _Token[] = [];
  let pos = 0;
  const useTriple = open === '{{' && close === '}}';

  while (pos < source.length) {
    if (useTriple) {
      const tripleIdx = source.indexOf('{{{', pos);
      const normalIdx = source.indexOf(open, pos);

      if (tripleIdx !== -1 && (normalIdx === -1 || tripleIdx <= normalIdx)) {
        if (tripleIdx > pos) {
          tokens.push({ type: _TOKEN.TEXT, value: source.slice(pos, tripleIdx) });
        }
        const end = source.indexOf('}}}', tripleIdx + 3);
        if (end === -1) {
          tokens.push({ type: _TOKEN.TEXT, value: source.slice(tripleIdx) });
          pos = source.length;
          continue;
        }
        const inner = source.slice(tripleIdx + 3, end).trim();
        tokens.push({ type: _TOKEN.RAW, value: inner });
        pos = end + 3;
        continue;
      }
    }

    const tagStart = source.indexOf(open, pos);
    if (tagStart === -1) {
      tokens.push({ type: _TOKEN.TEXT, value: source.slice(pos) });
      break;
    }

    if (tagStart > pos) {
      tokens.push({ type: _TOKEN.TEXT, value: source.slice(pos, tagStart) });
    }

    const tagEnd = source.indexOf(close, tagStart + open.length);
    if (tagEnd === -1) {
      tokens.push({ type: _TOKEN.TEXT, value: source.slice(tagStart) });
      pos = source.length;
      break;
    }

    const inner = source.slice(tagStart + open.length, tagEnd);
    pos = tagEnd + close.length;

    const first = inner[0];

    if (first === '!') {
      tokens.push({ type: _TOKEN.COMMENT, value: inner.slice(1).trim() });
    } else if (first === '#') {
      tokens.push({ type: _TOKEN.SECTION_OPEN, value: inner.slice(1).trim() });
    } else if (first === '/') {
      tokens.push({ type: _TOKEN.SECTION_CLOSE, value: inner.slice(1).trim() });
    } else if (first === '^') {
      tokens.push({ type: _TOKEN.INVERTED_OPEN, value: inner.slice(1).trim() });
    } else if (first === '>') {
      tokens.push({ type: _TOKEN.PARTIAL, value: inner.slice(1).trim() });
    } else if (first === '&') {
      tokens.push({ type: _TOKEN.RAW, value: inner.slice(1).trim() });
    } else {
      tokens.push({ type: _TOKEN.VAR, value: inner.trim() });
    }
  }

  return tokens;
}

// ─── AST ──────────────────────────────────────────────────────────────────────

interface _TextNode { type: 'text'; value: string; }
interface _VarNode  { type: 'var'; key: string; raw: boolean; }
interface _SectionNode { type: 'section'; key: string; inverted: boolean; children: _AstNode[]; }
interface _PartialNode { type: 'partial'; name: string; }
interface _CommentNode { type: 'comment'; }
type _AstNode = _TextNode | _VarNode | _SectionNode | _PartialNode | _CommentNode;

function _parse(tokens: _Token[]): _AstNode[] {
  const root: _AstNode[] = [];
  const stack: { key: string; inverted: boolean; children: _AstNode[] }[] = [];

  function current(): _AstNode[] {
    return stack.length > 0 ? stack[stack.length - 1].children : root;
  }

  for (const token of tokens) {
    switch (token.type) {
      case _TOKEN.TEXT:
        current().push({ type: 'text', value: token.value });
        break;
      case _TOKEN.VAR:
        current().push({ type: 'var', key: token.value, raw: false });
        break;
      case _TOKEN.RAW:
        current().push({ type: 'var', key: token.value, raw: true });
        break;
      case _TOKEN.SECTION_OPEN:
        stack.push({ key: token.value, inverted: false, children: [] });
        break;
      case _TOKEN.INVERTED_OPEN:
        stack.push({ key: token.value, inverted: true, children: [] });
        break;
      case _TOKEN.SECTION_CLOSE: {
        const frame = stack.pop();
        if (!frame) break;
        current().push({ type: 'section', key: frame.key, inverted: frame.inverted, children: frame.children });
        break;
      }
      case _TOKEN.PARTIAL:
        current().push({ type: 'partial', name: token.value });
        break;
      case _TOKEN.COMMENT:
        current().push({ type: 'comment' });
        break;
    }
  }

  while (stack.length > 0) {
    const frame = stack.pop()!;
    current().push({ type: 'section', key: frame.key, inverted: frame.inverted, children: frame.children });
  }

  return root;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

function _lookup(data: Record<string, unknown>, key: string): unknown {
  if (key === '.') return data['.'] !== undefined ? data['.'] : data;
  const parts = key.split('.');
  let val: unknown = data;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return '';
    val = (val as Record<string, unknown>)[part];
  }
  return val;
}

function _isFalsy(val: unknown): boolean {
  if (val === false || val === null || val === undefined || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function _renderNodes(nodes: _AstNode[], data: Record<string, unknown>, escape: boolean): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out += node.value;
        break;
      case 'var': {
        const raw = _lookup(data, node.key);
        const str = raw == null ? '' : String(raw);
        out += node.raw || !escape ? str : escapeTemplateHTML(str);
        break;
      }
      case 'section': {
        const val = _lookup(data, node.key);
        if (node.inverted) {
          if (_isFalsy(val)) out += _renderNodes(node.children, data, escape);
        } else if (!_isFalsy(val)) {
          if (Array.isArray(val)) {
            for (const item of val) {
              const childData: Record<string, unknown> =
                item !== null && typeof item === 'object'
                  ? { ...data, ...(item as Record<string, unknown>), '.': item }
                  : { ...data, '.': item };
              out += _renderNodes(node.children, childData, escape);
            }
          } else {
            const childData: Record<string, unknown> =
              val !== null && typeof val === 'object'
                ? { ...data, ...(val as Record<string, unknown>) }
                : data;
            out += _renderNodes(node.children, childData, escape);
          }
        }
        break;
      }
      case 'partial': {
        const partial = _lookup(data, node.name);
        if (typeof partial === 'function') {
          out += String((partial as () => unknown)());
        } else if (typeof partial === 'string') {
          out += _renderString(partial, data, escape);
        }
        break;
      }
      case 'comment':
        break;
    }
  }
  return out;
}

function _renderString(source: string, data: Record<string, unknown>, escape: boolean): string {
  return _renderNodes(_parse(_tokenize(source, '{{', '}}')), data, escape);
}

// ─── Template Class ───────────────────────────────────────────────────────────

export class Template {
  readonly #ast: _AstNode[];
  readonly #escape: boolean;

  constructor(source: string, options?: TemplateOptions) {
    const [open, close] = options?.delimiters ?? ['{{', '}}'];
    this.#escape = options?.escapeHtml ?? true;
    this.#ast = _parse(_tokenize(source, open, close));
  }

  /** Render the template with given data. */
  render(data: Record<string, unknown>): string {
    return _renderNodes(this.#ast, data, this.#escape);
  }
}

// ─── Functional API ───────────────────────────────────────────────────────────

/**
 * Compile a template string into a reusable render function.
 */
export function compile(
  source: string,
  options?: TemplateOptions,
): (data: Record<string, unknown>) => string {
  const tmpl = new Template(source, options);
  return (data) => tmpl.render(data);
}

/**
 * Render a template string once with the given data.
 */
export function render(
  source: string,
  data: Record<string, unknown>,
  options?: TemplateOptions,
): string {
  return new Template(source, options).render(data);
}

// ─── Legacy API (kept for backwards compatibility) ────────────────────────────

/**
 * Render a template string with context data.
 * @deprecated Use `render()` instead.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  return render(template, context);
}

/**
 * Compile a template to a reusable render function.
 * @deprecated Use `compile()` instead.
 */
export function compileTemplate(template: string): (context: TemplateContext) => string {
  return compile(template);
}

// ─── validateTemplate ────────────────────────────────────────────────────────

/** Check if a template has any syntax errors. */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const openTags: string[] = [];

  const tagRe = /\{\{([#^/])(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(template)) !== null) {
    const type = m[1];
    const name = m[2];
    if (type === '#' || type === '^') {
      openTags.push(name);
    } else if (type === '/') {
      const last = openTags.pop();
      if (last !== name) {
        errors.push(`Unexpected closing tag: {{/${name}}}`);
      }
    }
  }

  for (const unclosed of openTags) {
    errors.push(`Unclosed tag: {{#${unclosed}}}`);
  }

  const stripped = template
    .replace(/\{\{[#^/!]?\w*\}\}/g, '')
    .replace(/\{\{\{[\w.]+\}\}\}/g, '');
  const opens = (stripped.match(/\{\{/g) || []).length;
  const closes = (stripped.match(/\}\}/g) || []).length;
  if (opens !== closes) {
    errors.push('Mismatched {{ }} braces in template');
  }

  return { valid: errors.length === 0, errors };
}

// ─── extractVariables ────────────────────────────────────────────────────────

/** Extract variable names from a template (excludes section/inverted/comment tags). */
export function extractVariables(template: string): string[] {
  const vars = new Set<string>();

  for (const m of template.matchAll(/\{\{\{(\w+)\}\}\}/g)) {
    vars.add(m[1]);
  }

  for (const m of template.matchAll(/\{\{([^#/^!{][\w]*)\}\}/g)) {
    vars.add(m[1]);
  }

  return [...vars];
}
