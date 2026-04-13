// @ts-check
// ─── Keyboard Shortcut Manager ───────────────────────────────────────────────
// Manages registration and dispatching of keyboard shortcuts across the app.

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Keyboard shortcut definition.
 */
export interface ShortcutDefinition {
  key: string;           // e.g. 'k', 'ArrowUp', 'Escape'
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description?: string;
}

// ─── Internal state ──────────────────────────────────────────────────────────

/** Map from canonical shortcut string to list of registered handlers */
const _shortcuts = new Map<string, Array<{ handler: (event: KeyboardEvent) => void; shortcut: ShortcutDefinition }>>();

/** Whether the global keydown listener has been installed */
let _listenerInstalled = false;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Build a canonical string key from a ShortcutDefinition for use as a Map key.
 */
function _canonicalize(shortcut: ShortcutDefinition): string {
  const ctrl  = shortcut.ctrl  ? 'ctrl+'  : '';
  const shift = shortcut.shift ? 'shift+' : '';
  const alt   = shortcut.alt   ? 'alt+'   : '';
  const meta  = shortcut.meta  ? 'meta+'  : '';
  return `${ctrl}${shift}${alt}${meta}${shortcut.key.toLowerCase()}`;
}

/**
 * Global keydown handler — delegates to all registered handlers.
 */
function _globalKeydownHandler(event: KeyboardEvent): void {
  for (const entries of _shortcuts.values()) {
    for (const entry of entries) {
      if (matchesShortcut(event, entry.shortcut)) {
        entry.handler(event);
      }
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if a keyboard event matches a shortcut definition.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (!!(shortcut.ctrl)  !== !!(event.ctrlKey))  return false;
  if (!!(shortcut.shift) !== !!(event.shiftKey)) return false;
  if (!!(shortcut.alt)   !== !!(event.altKey))   return false;
  if (!!(shortcut.meta)  !== !!(event.metaKey))  return false;
  return true;
}

/**
 * Format a shortcut definition as a human-readable string.
 * e.g. { ctrl: true, key: 'k' } → 'Ctrl+K'
 */
export function formatShortcut(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];
  if (shortcut.ctrl)  parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt)   parts.push('Alt');
  if (shortcut.meta)  parts.push('Meta');
  const key = shortcut.key.length === 1
    ? shortcut.key.toUpperCase()
    : shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1);
  parts.push(key);
  return parts.join('+');
}

/**
 * Register a keyboard shortcut. Returns an unregister function.
 * Installs a single global `keydown` listener on first call.
 */
export function registerShortcut(
  shortcut: ShortcutDefinition,
  handler: (event: KeyboardEvent) => void,
): () => void {
  if (!_listenerInstalled) {
    window.addEventListener('keydown', _globalKeydownHandler);
    _listenerInstalled = true;
  }

  const key = _canonicalize(shortcut);
  if (!_shortcuts.has(key)) {
    _shortcuts.set(key, []);
  }
  const entry = { handler, shortcut };
  _shortcuts.get(key)!.push(entry);

  return () => {
    const list = _shortcuts.get(key);
    if (!list) return;
    const idx = list.indexOf(entry);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) _shortcuts.delete(key);
  };
}

/**
 * Unregister all shortcuts for a given key combination.
 */
export function unregisterShortcut(shortcut: ShortcutDefinition): void {
  const key = _canonicalize(shortcut);
  _shortcuts.delete(key);
}

/**
 * Get all registered shortcuts (deduplicated by shortcut identity).
 */
export function getRegisteredShortcuts(): Array<{ shortcut: ShortcutDefinition; description?: string }> {
  const result: Array<{ shortcut: ShortcutDefinition; description?: string }> = [];
  for (const entries of _shortcuts.values()) {
    for (const entry of entries) {
      result.push({ shortcut: entry.shortcut, description: entry.shortcut.description });
    }
  }
  return result;
}

/**
 * Remove all registered shortcuts and uninstall the global listener.
 */
export function clearShortcuts(): void {
  _shortcuts.clear();
  if (_listenerInstalled) {
    window.removeEventListener('keydown', _globalKeydownHandler);
    _listenerInstalled = false;
  }
}
