// @ts-check
// ─── DOM Utilities ───────────────────────────────────────────────────────────
// General-purpose DOM manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Create an element with optional attributes and children. */
export function createElement(
  tag: string,
  attrs?: Record<string, string | boolean | number>,
  ...children: (string | Element | null | undefined)[]
): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === 'boolean') {
        if (value) {
          el.setAttribute(key, '');
        } else {
          el.removeAttribute(key);
        }
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

/** Safely query for an element, returning null instead of throwing. */
export function qs<T extends Element = Element>(
  selector: string,
  root?: Element | Document,
): T | null {
  try {
    return (root ?? document).querySelector<T>(selector);
  } catch {
    return null;
  }
}

/** Query for all matching elements as an Array. */
export function qsAll<T extends Element = Element>(
  selector: string,
  root?: Element | Document,
): T[] {
  return Array.from((root ?? document).querySelectorAll<T>(selector));
}

/** Add multiple event listeners in one call. Returns a cleanup function. */
export function addListeners(
  element: Element | Window | Document,
  events: Record<string, EventListener>,
): () => void {
  for (const [type, handler] of Object.entries(events)) {
    element.addEventListener(type, handler);
  }
  return () => {
    for (const [type, handler] of Object.entries(events)) {
      element.removeEventListener(type, handler);
    }
  };
}

/** Wait for an element matching a selector to appear in the DOM. */
export function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = qs(selector);
    if (found) {
      resolve(found);
      return;
    }

    let settled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    function finish(result: Element | null): void {
      if (settled) return;
      settled = true;
      if (timerId !== null) clearTimeout(timerId);
      if (observer !== null) observer.disconnect();
      resolve(result);
    }

    observer = new MutationObserver(() => {
      const el = qs(selector);
      if (el) finish(el);
    });

    observer.observe(document.documentElement ?? document.body, {
      childList: true,
      subtree: true,
    });

    timerId = setTimeout(() => finish(null), timeout);
  });
}

/** Check if an element is visible (not display:none, not hidden). */
export function isVisible(element: Element): boolean {
  return (
    getComputedStyle(element).display !== 'none' &&
    (element as HTMLElement).offsetParent !== null
  );
}

/** Get an element's absolute position (top/left relative to viewport). */
export function getElementRect(
  element: Element,
): { top: number; left: number; width: number; height: number } {
  const { top, left, width, height } = element.getBoundingClientRect();
  return { top, left, width, height };
}

/** Set multiple styles on an element at once. */
export function setStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}

/** Copy all attributes from one element to another. */
export function copyAttributes(source: Element, target: Element): void {
  for (const attr of Array.from(source.attributes)) {
    target.setAttribute(attr.name, attr.value);
  }
}

/** Toggle an attribute (add if absent, remove if present). */
export function toggleAttr(element: Element, attr: string, value = ''): void {
  if (element.hasAttribute(attr)) {
    element.removeAttribute(attr);
  } else {
    element.setAttribute(attr, value);
  }
}
