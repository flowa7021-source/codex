// @ts-check
// ─── Focus Manager ───────────────────────────────────────────────────────────
// Utilities for managing focus within the application: querying focusable
// elements, trapping focus in modals/dialogs, and navigating between elements.

const FOCUSABLE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
const FOCUSABLE_QUERY =
  'a[href], button, input, select, textarea, [tabindex]';

/**
 * Whether an element is focusable.
 */
export function isFocusable(element: Element): boolean {
  const el = element as HTMLElement;

  // Disabled elements are never focusable
  if ((el as HTMLInputElement).disabled) return false;

  // Native interactive elements are focusable when not disabled
  if (FOCUSABLE_TAGS.has(el.tagName)) return true;

  // Elements with a non-negative tabIndex are focusable
  if (el.tabIndex !== undefined && el.tabIndex >= 0) return true;

  return false;
}

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: Element): Element[] {
  const candidates = Array.from(container.querySelectorAll(FOCUSABLE_QUERY));
  return candidates.filter(isFocusable);
}

/**
 * Trap focus within a container (for modals/dialogs).
 * Returns a release function.
 */
export function trapFocus(container: Element): () => void {
  const handler = (e: Event) => {
    const event = e as KeyboardEvent;
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handler);

  return () => {
    container.removeEventListener('keydown', handler);
  };
}

/**
 * Set focus to an element safely (catches errors).
 * Returns true if focus was set.
 */
export function focusElement(element: Element): boolean {
  try {
    (element as HTMLElement).focus();
    return true;
  } catch {
    return false;
  }
}

/**
 * Move focus to the next focusable element in the document.
 */
export function focusNext(container?: Element): void {
  const root = container ?? document.body;
  if (!root) return;

  const focusable = getFocusableElements(root);
  if (focusable.length === 0) return;

  const active = document.activeElement;
  const index = focusable.indexOf(active as Element);

  if (index === -1 || index === focusable.length - 1) {
    (focusable[0] as HTMLElement).focus();
  } else {
    (focusable[index + 1] as HTMLElement).focus();
  }
}

/**
 * Move focus to the previous focusable element in the document.
 */
export function focusPrev(container?: Element): void {
  const root = container ?? document.body;
  if (!root) return;

  const focusable = getFocusableElements(root);
  if (focusable.length === 0) return;

  const active = document.activeElement;
  const index = focusable.indexOf(active as Element);

  if (index <= 0) {
    (focusable[focusable.length - 1] as HTMLElement).focus();
  } else {
    (focusable[index - 1] as HTMLElement).focus();
  }
}

/**
 * Get the currently focused element. Returns null if none.
 */
export function getActiveElement(): Element | null {
  return document.activeElement ?? null;
}
