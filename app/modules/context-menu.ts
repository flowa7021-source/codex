// @ts-check
// ─── Custom Context Menu ──────────────────────────────────────────────────────
// Module for displaying and managing custom context menus.

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Context menu item definition.
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
  action?: () => void;
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _activeMenu: HTMLElement | null = null;
let _closeHandler: (() => void) | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Show a context menu at the given position.
 * Closes any previously open menu first.
 * Returns a close function.
 *
 * @param items - Array of menu item definitions
 * @param position - Screen coordinates for the menu
 * @param options - Optional callbacks
 */
export function showContextMenu(
  items: ContextMenuItem[],
  position: { x: number; y: number },
  options?: { onClose?: () => void },
): () => void {
  // Close any existing menu before opening a new one
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${position.x}px`;
  menu.style.top = `${position.y}px`;
  menu.style.zIndex = '9999';

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      continue;
    }

    const btn = document.createElement('button');
    btn.setAttribute('data-id', item.id);
    btn.className = 'context-menu-item';
    btn.textContent = item.label;
    if (item.disabled) {
      btn.setAttribute('disabled', 'true');
    }
    if (item.icon) {
      btn.setAttribute('data-icon', item.icon);
    }
    if (item.shortcut) {
      btn.setAttribute('data-shortcut', item.shortcut);
    }

    btn.addEventListener('click', () => {
      if (item.action) {
        item.action();
      }
      closeContextMenu();
    });

    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  _activeMenu = menu;

  const close = (): void => {
    closeContextMenu();
    options?.onClose?.();
  };

  // Close when clicking outside the menu
  const documentClickHandler = (event: Event): void => {
    if (!menu.contains(event.target as Node)) {
      close();
    }
  };

  document.addEventListener('click', documentClickHandler);

  _closeHandler = () => {
    document.removeEventListener('click', documentClickHandler);
    options?.onClose?.();
  };

  return close;
}

/**
 * Close the currently open context menu (if any).
 */
export function closeContextMenu(): void {
  if (_activeMenu) {
    _activeMenu.remove();
    _activeMenu = null;
    if (_closeHandler) {
      _closeHandler();
      _closeHandler = null;
    }
  }
}

/**
 * Whether a context menu is currently open.
 */
export function isContextMenuOpen(): boolean {
  return _activeMenu !== null;
}

/**
 * Register a context menu for an element.
 * Listens for 'contextmenu' events and shows a menu populated by getItems.
 * Returns a cleanup function that removes the event listener.
 *
 * @param element - The DOM element to attach the context menu to
 * @param getItems - Callback that returns menu items for the given event
 * @param options - Optional callbacks
 */
export function attachContextMenu(
  element: Element,
  getItems: (event: MouseEvent) => ContextMenuItem[],
  options?: { onClose?: () => void },
): () => void {
  const handleContextMenu = (event: Event): void => {
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    const items = getItems(mouseEvent);
    showContextMenu(items, { x: mouseEvent.clientX, y: mouseEvent.clientY }, options);
  };

  element.addEventListener('contextmenu', handleContextMenu);

  return () => {
    element.removeEventListener('contextmenu', handleContextMenu);
  };
}
