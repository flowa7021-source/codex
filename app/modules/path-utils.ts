// @ts-check
// ─── Path Utilities ───────────────────────────────────────────────────────────
// Cross-platform path manipulation — no Node.js path module, pure logic.

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Split a path string into its non-empty segments. Preserves leading slash. */
function _segments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

/** Resolve dot segments from an array of path parts into a clean parts array. */
function _resolve_dots(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (part === '.') {
      // current dir — skip
    } else if (part === '..') {
      if (out.length > 0) {
        out.pop();
      }
      // at root, ignore '..'
    } else {
      out.push(part);
    }
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Join path segments. */
export function join(...parts: string[]): string {
  if (parts.length === 0) return '.';
  const raw = parts.join('/');
  return normalize(raw);
}

/** Normalize a path (resolve .., ., double slashes). */
export function normalize(path: string): string {
  if (path === '') return '.';
  const abs = path.startsWith('/');
  const parts = _resolve_dots(_segments(path));
  const result = (abs ? '/' : '') + parts.join('/');
  return result === '' ? '/' : result || '.';
}

/** Get directory name from path. */
export function dirname(path: string): string {
  const norm = normalize(path);
  if (norm === '/') return '/';
  const idx = norm.lastIndexOf('/');
  if (idx === -1) return '.';
  if (idx === 0) return '/';
  return norm.slice(0, idx);
}

/** Get filename from path. */
export function basename(path: string, ext?: string): string {
  const norm = normalize(path);
  const parts = norm.split('/');
  let base = parts[parts.length - 1];
  if (base === '') base = parts[parts.length - 2] ?? '';
  if (ext !== undefined && base.endsWith(ext)) {
    base = base.slice(0, base.length - ext.length);
  }
  return base;
}

/** Get file extension (including dot, e.g. '.ts'). */
export function extname(path: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot);
}

/** Check if path is absolute. */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

/** Get relative path from one path to another. */
export function relative(from: string, to: string): string {
  const fromParts = _segments(normalize(from));
  const toParts = _segments(normalize(to));

  // Find common prefix length
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  const up = fromParts.length - common;
  const down = toParts.slice(common);
  const rel = [...Array(up).fill('..'), ...down];
  return rel.length === 0 ? '.' : rel.join('/');
}

/** Resolve path segments to absolute path (like Node's path.resolve). */
export function resolve(...paths: string[]): string {
  let resolved = '/';
  for (const p of paths) {
    if (p.startsWith('/')) {
      resolved = p;
    } else {
      resolved = resolved.endsWith('/') ? resolved + p : resolved + '/' + p;
    }
  }
  return normalize(resolved);
}

/** Split path into parts (no empty strings). */
export function split(path: string): string[] {
  const norm = normalize(path);
  if (norm === '/') return ['/'];
  const parts = norm.split('/').filter((s) => s.length > 0);
  if (norm.startsWith('/')) {
    return ['/', ...parts];
  }
  return parts;
}

/** Check if path is a subpath of another (both should be absolute or both relative). */
export function isSubPath(parent: string, child: string): boolean {
  const p = normalize(parent);
  const c = normalize(child);
  if (p === c) return false;
  const prefix = p.endsWith('/') ? p : p + '/';
  return c.startsWith(prefix);
}

/** Get common ancestor of two paths. */
export function commonAncestor(a: string, b: string): string {
  const aParts = _segments(normalize(a));
  const bParts = _segments(normalize(b));
  const abs = isAbsolute(a) || isAbsolute(b);

  const common: string[] = [];
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (aParts[i] === bParts[i]) {
      common.push(aParts[i]);
    } else {
      break;
    }
  }

  if (common.length === 0) return abs ? '/' : '.';
  return (abs ? '/' : '') + common.join('/');
}

/** Change file extension. */
export function changeExt(path: string, newExt: string): string {
  const dir = dirname(path);
  const base = basename(path);
  const dot = base.lastIndexOf('.');
  const stem = dot <= 0 ? base : base.slice(0, dot);
  const newBase = newExt ? (newExt.startsWith('.') ? stem + newExt : stem + '.' + newExt) : stem;
  if (dir === '.') return newBase;
  return dir + '/' + newBase;
}
