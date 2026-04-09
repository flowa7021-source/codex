// @ts-check
// ─── Template Engine ─────────────────────────────────────────────────────────
// Simple Mustache-like template engine.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TemplateContext {
  [key: string]: unknown;
}

// ─── escapeTemplateHTML ───────────────────────────────────────────────────────

/** Escape HTML characters in a string. */
export function escapeTemplateHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── renderTemplate ───────────────────────────────────────────────────────────

/**
 * Render a template string with context data.
 * Supports:
 *   {{variable}}           – HTML-escaped variable substitution
 *   {{{unescaped}}}        – Raw / unescaped output
 *   {{#section}}...{{/section}} – Truthy / array section
 *   {{^inverted}}...{{/inverted}} – Inverted (falsy) section
 *   {{! comment }}         – Comment (removed from output)
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  return renderSection(template, context);
}

/** Recursively render a template section with a given context. */
function renderSection(template: string, context: TemplateContext): string {
  let result = template;

  // Strip comments: {{! ... }}
  result = result.replace(/\{\{![\s\S]*?\}\}/g, '');

  // Sections: {{#key}}...{{/key}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key: string, inner: string) => {
    const value = resolveKey(context, key);
    if (!value) return '';
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          const itemCtx = typeof item === 'object' && item !== null
            ? (item as TemplateContext)
            : { '.': item, ...context };
          return renderSection(inner, itemCtx);
        })
        .join('');
    }
    // Truthy non-array — render once with same context
    return renderSection(inner, context);
  });

  // Inverted sections: {{^key}}...{{/key}}
  result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key: string, inner: string) => {
    const value = resolveKey(context, key);
    const isFalsy = !value || (Array.isArray(value) && value.length === 0);
    return isFalsy ? renderSection(inner, context) : '';
  });

  // Unescaped: {{{variable}}}
  result = result.replace(/\{\{\{(\w+)\}\}\}/g, (_match, key: string) => {
    const value = resolveKey(context, key);
    return value !== undefined && value !== null ? String(value) : '';
  });

  // Escaped variable: {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = resolveKey(context, key);
    if (value === undefined || value === null) return '';
    return escapeTemplateHTML(String(value));
  });

  return result;
}

/** Resolve a key from the context, supporting dot notation. */
function resolveKey(context: TemplateContext, key: string): unknown {
  if (key === '.') return context['.'];
  const parts = key.split('.');
  let cur: unknown = context;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ─── compileTemplate ─────────────────────────────────────────────────────────

/** Compile a template to a reusable render function. */
export function compileTemplate(template: string): (context: TemplateContext) => string {
  return (context: TemplateContext) => renderTemplate(template, context);
}

// ─── validateTemplate ────────────────────────────────────────────────────────

/** Check if a template has any syntax errors. */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Track open section/inverted tags
  const openTags: string[] = [];

  // Find all section open/close tags
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

  // Check for mismatched braces – lone {{ not closed
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

  // Unescaped {{{var}}}
  for (const m of template.matchAll(/\{\{\{(\w+)\}\}\}/g)) {
    vars.add(m[1]);
  }

  // Escaped {{var}} — but not {{#...}}, {{/...}}, {{^...}}, {{!...}}
  for (const m of template.matchAll(/\{\{([^#/^!{][\w]*)\}\}/g)) {
    vars.add(m[1]);
  }

  return [...vars];
}
