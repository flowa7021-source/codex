// ─── Quick Actions Bar ──────────────────────────────────────────────────────
// Floating toolbar that appears on text selection (like Notion/Google Docs).

let actionBar = null;
const hideTimeout = null;

/**
 * @typedef {object} QuickAction
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {Function} action - (selectedText: string, selection: Selection) => void
 */

const DEFAULT_ACTIONS = [
  { id: 'copy', label: 'Копировать', icon: '📋', action: (text) => navigator.clipboard?.writeText(text) },
  { id: 'highlight', label: 'Выделить', icon: '🖍', action: null },
  { id: 'underline', label: 'Подчеркнуть', icon: '̲U', action: null },
  { id: 'comment', label: 'Комментарий', icon: '💬', action: null },
  { id: 'ocr', label: 'OCR', icon: '🔍', action: null },
  { id: 'search', label: 'Искать', icon: '🔎', action: null },
];

/**
 * Initialize the quick actions bar.
 * @param {object} options
 * @param {HTMLElement} options.container - Element to observe for text selection
 * @param {QuickAction[]} [options.actions] - Custom actions
 * @param {Function} [options.onAction] - Global action handler (id, text) => void
 */
export function initQuickActions(options) {
  const { container, actions = DEFAULT_ACTIONS, onAction } = options;
  if (!container) return;

  // Create action bar element
  actionBar = document.createElement('div');
  actionBar.className = 'quick-actions-bar';
  actionBar.setAttribute('role', 'toolbar');
  actionBar.setAttribute('aria-label', 'Быстрые действия');

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = 'quick-action-btn';
    btn.dataset.actionId = action.id;
    btn.title = action.label;
    btn.innerHTML = `<span class="qa-icon">${action.icon}</span><span class="qa-label">${action.label}</span>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selection = window.getSelection();
      const text = selection?.toString() || '';

      if (action.action) {
        action.action(text, selection);
      }
      if (onAction) {
        onAction(action.id, text, selection);
      }

      hideQuickActions();
    });

    actionBar.appendChild(btn);
  }

  document.body.appendChild(actionBar);

  // Listen for selection changes
  let selectionCheckTimer = null;

  container.addEventListener('mouseup', () => {
    // Delay to allow selection to finalize
    clearTimeout(selectionCheckTimer);
    selectionCheckTimer = setTimeout(() => {
      checkSelection(container);
    }, 200);
  });

  container.addEventListener('mousedown', () => {
    hideQuickActions();
  });

  // Hide on scroll
  container.addEventListener('scroll', () => {
    hideQuickActions();
  }, { passive: true });

  // Hide on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideQuickActions();
  });
}

/**
 * Check if there's a text selection and show/hide the bar.
 */
function checkSelection(container) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    hideQuickActions();
    return;
  }

  // Verify selection is within our container
  if (!container.contains(selection.anchorNode)) {
    hideQuickActions();
    return;
  }

  showQuickActions(selection);
}

/**
 * Show the quick actions bar near the selection.
 */
function showQuickActions(selection) {
  if (!actionBar) return;

  clearTimeout(hideTimeout);

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position above the selection
  const barWidth = 300;
  const barHeight = 36;
  let x = rect.left + (rect.width - barWidth) / 2;
  let y = rect.top - barHeight - 8;

  // Keep within viewport
  x = Math.max(8, Math.min(x, window.innerWidth - barWidth - 8));
  if (y < 8) {
    y = rect.bottom + 8; // Show below if no room above
  }

  actionBar.style.left = `${x}px`;
  actionBar.style.top = `${y}px`;
  actionBar.classList.add('visible');
}

/**
 * Hide the quick actions bar.
 */
export function hideQuickActions() {
  if (!actionBar) return;
  actionBar.classList.remove('visible');
}

/**
 * Add a custom action to the bar.
 * @param {QuickAction} action
 */
export function addQuickAction(action) {
  if (!actionBar) return;

  const btn = document.createElement('button');
  btn.className = 'quick-action-btn';
  btn.dataset.actionId = action.id;
  btn.title = action.label;
  btn.innerHTML = `<span class="qa-icon">${action.icon}</span><span class="qa-label">${action.label}</span>`;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString() || '';
    if (action.action) action.action(text);
    hideQuickActions();
  });

  // Insert before last button
  actionBar.appendChild(btn);
}
