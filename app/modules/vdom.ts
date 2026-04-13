// @ts-check
// ─── Virtual DOM ─────────────────────────────────────────────────────────────
// Lightweight virtual DOM representation with a simple h() factory,
// children normalisation, and a renderToString() helper for testing.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Any value that may appear as a child in a virtual node tree. */
export type VNodeChild = VNode | string | number | null | undefined | boolean;

/** A virtual DOM node. */
export interface VNode {
  type: string;
  props: Record<string, unknown>;
  children: VNodeChild[];
  key?: string | number | null;
}

// ─── Self-closing (void) HTML elements ───────────────────────────────────────

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// ─── h() ─────────────────────────────────────────────────────────────────────

/**
 * Create a virtual node.
 *
 * @param type     - HTML tag name (e.g. `'div'`).
 * @param props    - Attributes / properties, or `null`.
 * @param children - Zero or more child nodes.
 */
export function h(
  type: string,
  props?: Record<string, unknown> | null,
  ...children: VNodeChild[]
): VNode {
  const key =
    props != null && 'key' in props
      ? (props['key'] as string | number | null)
      : undefined;

  const cleanProps: Record<string, unknown> = {};
  if (props != null) {
    for (const [k, v] of Object.entries(props)) {
      if (k !== 'key') cleanProps[k] = v;
    }
  }

  return {
    type,
    props: cleanProps,
    children,
    key,
  };
}

// ─── normalizeChildren() ─────────────────────────────────────────────────────

/**
 * Normalise a raw children array:
 * - Flatten nested arrays one level deep.
 * - Remove `null`, `undefined`, `true`, and `false`.
 * - Convert numbers to strings.
 */
export function normalizeChildren(children: VNodeChild[]): (VNode | string)[] {
  const result: (VNode | string)[] = [];

  function process(child: VNodeChild): void {
    if (child === null || child === undefined || child === true || child === false) {
      return;
    }
    if (Array.isArray(child)) {
      for (const c of child as VNodeChild[]) {
        process(c);
      }
      return;
    }
    if (typeof child === 'number') {
      result.push(String(child));
      return;
    }
    result.push(child as VNode | string);
  }

  for (const child of children) {
    process(child);
  }

  return result;
}

// ─── renderToString() ────────────────────────────────────────────────────────

/**
 * Serialize a VNode (or plain string) to an HTML string.
 * Suitable for tests and server-side rendering snapshots.
 */
export function renderToString(node: VNode | string): string {
  if (typeof node === 'string') return escapeHtml(node);

  const { type, props, children } = node;

  // Build attribute string
  let attrs = '';
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (value === true) {
      attrs += ` ${key}`;
    } else {
      attrs += ` ${key}="${escapeAttr(String(value))}"`;
    }
  }

  if (VOID_ELEMENTS.has(type)) {
    return `<${type}${attrs}>`;
  }

  const normalised = normalizeChildren(children);
  const inner = normalised.map((c) => renderToString(c)).join('');
  return `<${type}${attrs}>${inner}</${type}>`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
