// @ts-check
// ─── Accessibility Module ───────────────────────────────────────────────────
// ARIA attributes, focus management, reduced-motion, screen reader announcements

let liveRegion = null;

/** Create a screen reader live region for dynamic announcements */
function ensureLiveRegion() {
  if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
  liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.id = 'a11y-live-region';
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/** Announce a message to screen readers */
export function announce(message, priority = 'polite') {
  const region = ensureLiveRegion();
  region.setAttribute('aria-live', priority);
  // Clear then set to trigger announcement
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}

/** Check if user prefers reduced motion */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Check if user prefers high contrast */
export function prefersHighContrast() {
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/** Apply ARIA attributes to the entire UI */
export function applyAriaAttributes() {
  // ─── Command bar ──────────────────────────────────────
  const commandBar = document.getElementById('commandBar');
  if (commandBar) {
    commandBar.setAttribute('role', 'toolbar');
    commandBar.setAttribute('aria-label', 'Панель инструментов');
  }

  // ─── CB groups → role group ───────────────────────────
  document.querySelectorAll('.cb-group').forEach((g, _i) => {
    g.setAttribute('role', 'group');
  });

  // ─── Icon-only buttons → aria-label ───────────────────
  document.querySelectorAll('.cb-btn, .cb-tool-btn, .btn-xs, .btn-ghost').forEach(btn => {
    if (btn.getAttribute('aria-label')) return;
    const tooltip = btn.getAttribute('data-tooltip') || btn.getAttribute('title');
    if (tooltip) {
      btn.setAttribute('aria-label', tooltip);
    }
  });

  // ─── Sidebar panels → tablist/tab/tabpanel ────────────
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.setAttribute('role', 'tablist');
    sidebarNav.setAttribute('aria-label', 'Боковая панель');
    sidebarNav.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
      btn.setAttribute('role', 'tab');
      const panelId = btn.getAttribute('data-panel');
      if (panelId) {
        btn.setAttribute('aria-controls', panelId);
        btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
      }
    });
  }

  document.querySelectorAll('.sidebar-panel').forEach(panel => {
    panel.setAttribute('role', 'tabpanel');
    if (!panel.getAttribute('aria-label')) {
      const header = panel.querySelector('h3, .section-head');
      if (header) panel.setAttribute('aria-label', header.textContent.trim());
    }
  });

  // ─── Right panel tabs ─────────────────────────────────
  const rpNav = document.querySelector('.rp-nav');
  if (rpNav) {
    rpNav.setAttribute('role', 'tablist');
    rpNav.setAttribute('aria-label', 'Правая панель');
    rpNav.querySelectorAll('.rp-nav-btn').forEach(btn => {
      btn.setAttribute('role', 'tab');
      const panelId = btn.getAttribute('data-panel');
      if (panelId) {
        btn.setAttribute('aria-controls', panelId);
        btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
      }
    });
  }

  document.querySelectorAll('.rp-panel').forEach(panel => {
    panel.setAttribute('role', 'tabpanel');
  });

  // ─── Collapsible sections → aria-expanded ─────────────
  document.querySelectorAll('.section-head, .section-toggle').forEach(head => {
    const section = head.closest('section');
    if (!section) return;
    const isCollapsed = section.classList.contains('collapsed');
    head.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    head.setAttribute('role', 'button');
    /** @type {any} */ (head).tabIndex = /** @type {any} */ (head).tabIndex >= 0 ? /** @type {any} */ (head).tabIndex : 0;
  });

  // ─── Modals → role dialog ─────────────────────────────
  document.querySelectorAll('.modal').forEach(m => {
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    const title = m.querySelector('.modal-head h3, .modal-head');
    if (title) m.setAttribute('aria-label', title.textContent.trim());
  });

  // ─── Search input ─────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.setAttribute('aria-label', 'Поиск в документе');
    searchInput.setAttribute('role', 'searchbox');
  }

  // ─── Page input ───────────────────────────────────────
  const pageInput = document.getElementById('pageInput');
  if (pageInput) {
    pageInput.setAttribute('aria-label', 'Номер страницы');
  }

  // ─── Main viewport ────────────────────────────────────
  const viewport = document.querySelector('.document-viewport');
  if (viewport) {
    viewport.setAttribute('role', 'document');
    viewport.setAttribute('aria-label', 'Просмотр документа');
  }

  // ─── Status bar ───────────────────────────────────────
  const statusBar = document.getElementById('statusBar');
  if (statusBar) {
    statusBar.setAttribute('role', 'status');
    statusBar.setAttribute('aria-label', 'Строка состояния');
  }

  // ─── Dropdown menus ───────────────────────────────────
  document.querySelectorAll('.dropdown').forEach(dd => {
    const trigger = dd.querySelector('.dropdown-trigger, .cb-tool-btn');
    const menu = dd.querySelector('.dropdown-menu');
    if (trigger && menu) {
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('role', 'menu');
    }
  });
}

/** Watch for sidebar tab changes and update aria-selected */
export function observeTabChanges() {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = /** @type {HTMLElement} */ (m.target);
        if (el.getAttribute('role') === 'tab') {
          el.setAttribute('aria-selected', el.classList.contains('active') ? 'true' : 'false');
        }
      }
    }
  });

  document.querySelectorAll('[role="tab"]').forEach(tab => {
    observer.observe(tab, { attributes: true, attributeFilter: ['class'] });
  });
}

/** Set up keyboard-only focus visibility */
function setupFocusVisibility() {
  let _usingKeyboard = false;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      _usingKeyboard = true;
      document.body.classList.add('keyboard-nav');
    }
  });

  document.addEventListener('mousedown', () => {
    _usingKeyboard = false;
    document.body.classList.remove('keyboard-nav');
  });
}

/** Initialize all accessibility features */
export function initA11y() {
  ensureLiveRegion();
  applyAriaAttributes();
  observeTabChanges();
  setupFocusVisibility();
  setupTablistKeyboard();
  setupModalEscape();

  // Listen for section collapse changes (both .section-head and .section-toggle)
  document.addEventListener('click', (e) => {
    const head = /** @type {HTMLElement} */ (e.target).closest('.section-head, .section-toggle');
    if (head) {
      requestAnimationFrame(() => {
        const section = head.closest('section');
        if (section) {
          head.setAttribute('aria-expanded', section.classList.contains('collapsed') ? 'false' : 'true');
        }
      });
    }
  });

  // Listen for dropdown toggle
  document.addEventListener('click', (e) => {
    const trigger = /** @type {HTMLElement} */ (e.target).closest('.dropdown-trigger, [aria-haspopup]');
    if (trigger) {
      requestAnimationFrame(() => {
        const dd = trigger.closest('.dropdown');
        const isOpen = dd?.classList.contains('open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }
  });

  // Sidebar toggle: sync aria-expanded
  const sidebarBtn = document.getElementById('toggleSidebar');
  if (sidebarBtn) {
    sidebarBtn.addEventListener('click', () => {
      const expanded = sidebarBtn.getAttribute('aria-expanded') === 'true';
      sidebarBtn.setAttribute('aria-expanded', String(!expanded));
    });
  }
}

/** Arrow key navigation within tablists */
function setupTablistKeyboard() {
  document.querySelectorAll('[role="tablist"]').forEach(tablist => {
    tablist.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
      const tabs = /** @type {HTMLElement[]} */ ([...tablist.querySelectorAll('[role="tab"]')]);
      if (tabs.length === 0) return;
      const current = tabs.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      if (current === -1) return;

      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (current + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (current - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = tabs.length - 1;
      }

      if (next !== -1) {
        e.preventDefault();
        tabs[next].focus();
        tabs[next].click();
      }
    });
  });
}

/** Escape key closes open modals and returns focus (event delegation) */
function setupModalEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = /** @type {HTMLElement} */ (e.target).closest('.modal[role="dialog"]');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    if (/** @type {any} */ (modal).style) /** @type {any} */ (modal).style.display = 'none';
    modal.classList.remove('open');
  });
}
