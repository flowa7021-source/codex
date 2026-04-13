// @ts-check
// ─── Overlay Manager ─────────────────────────────────────────────────────────
// DOM overlay management for tooltips, popovers, and dialogs.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Overlay configuration.
 */
export interface OverlayConfig {
  id: string;
  content: string | HTMLElement;
  position?: { x: number; y: number };
  className?: string;
  zIndex?: number;
  onClose?: () => void;
  closeOnOutsideClick?: boolean;
}

// ─── Module-level state ──────────────────────────────────────────────────────

/** Map from overlay ID to its container element. */
const _overlays = new Map<string, HTMLElement>();

/** Map from overlay ID to its outside-click listener (for cleanup). */
const _outsideClickListeners = new Map<string, (event: MouseEvent) => void>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Show an overlay. Returns a hide function.
 */
export function showOverlay(config: OverlayConfig): () => void {
  // If already open, hide the existing one first
  if (_overlays.has(config.id)) {
    hideOverlay(config.id);
  }

  const el = document.createElement('div');

  if (config.className) {
    el.className = config.className;
  }

  if (config.zIndex !== undefined) {
    el.style.zIndex = String(config.zIndex);
  }

  if (config.position !== undefined) {
    el.style.position = 'fixed';
    el.style.left = `${config.position.x}px`;
    el.style.top = `${config.position.y}px`;
  }

  if (typeof config.content === 'string') {
    el.innerHTML = config.content;
  } else {
    el.appendChild(config.content);
  }

  document.body.appendChild(el);
  _overlays.set(config.id, el);

  if (config.closeOnOutsideClick) {
    const outsideClickHandler = (event: MouseEvent) => {
      if (!el.contains(event.target as Node)) {
        hideOverlay(config.id);
        if (config.onClose) config.onClose();
      }
    };
    document.addEventListener('click', outsideClickHandler);
    _outsideClickListeners.set(config.id, outsideClickHandler);
  }

  return () => {
    hideOverlay(config.id);
    if (config.onClose) config.onClose();
  };
}

/**
 * Hide a specific overlay by ID.
 */
export function hideOverlay(id: string): void {
  const el = _overlays.get(id);
  if (!el) return;

  el.remove();
  _overlays.delete(id);

  const outsideClickHandler = _outsideClickListeners.get(id);
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    _outsideClickListeners.delete(id);
  }
}

/**
 * Hide all open overlays.
 */
export function hideAllOverlays(): void {
  for (const id of [..._overlays.keys()]) {
    hideOverlay(id);
  }
}

/**
 * Whether an overlay with the given ID is open.
 */
export function isOverlayOpen(id: string): boolean {
  return _overlays.has(id);
}

/**
 * Get IDs of all currently open overlays.
 */
export function getOpenOverlays(): string[] {
  return [..._overlays.keys()];
}
