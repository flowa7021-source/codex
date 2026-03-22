// @ts-check
// ─── Ribbon-like Toolbar ────────────────────────────────────────────────────
// Contextual tab system: tabs switch based on active tool/content type.

/**
 * @typedef {object} RibbonTab
 * @property {string} id
 * @property {string} label
 * @property {string} [icon]
 * @property {boolean} [contextual] - Only shown when relevant
 * @property {string} [context] - When to show (e.g. 'pdf', 'image', 'annotation')
 * @property {RibbonGroup[]} groups
 */

/**
 * @typedef {object} RibbonGroup
 * @property {string} label
 * @property {string[]} buttonIds - IDs of existing buttons to include
 */

const DEFAULT_TABS = [
  {
    id: 'home',
    label: 'Главная',
    groups: [
      { label: 'Файл', buttonIds: ['fileInput', 'saveBtn'] },
      { label: 'Навигация', buttonIds: ['prevPage', 'pageInput', 'nextPage'] },
      { label: 'Масштаб', buttonIds: ['zoomIn', 'zoomOut', 'zoomStatus'] },
      { label: 'Поиск', buttonIds: ['searchToggle'] },
    ],
  },
  {
    id: 'view',
    label: 'Вид',
    groups: [
      { label: 'Режим просмотра', buttonIds: ['viewModeDropdown'] },
      { label: 'Тема', buttonIds: ['themeSelect'] },
      { label: 'Панели', buttonIds: ['sidebarToggle', 'continuousScroll'] },
    ],
  },
  {
    id: 'edit',
    label: 'Редактирование',
    contextual: true,
    context: 'pdf',
    groups: [
      { label: 'Текст', buttonIds: ['pdfFindReplace', 'pdfBlockEdit'] },
      { label: 'Страницы', buttonIds: ['pdfSplit', 'pdfMerge', 'pdfRotate'] },
      { label: 'Аннотации', buttonIds: ['toggleAnnotate'] },
    ],
  },
  {
    id: 'ocr',
    label: 'OCR',
    groups: [
      { label: 'Распознавание', buttonIds: ['ocrPage', 'ocrAll'] },
      { label: 'Язык', buttonIds: ['ocrLang'] },
      { label: 'Настройки', buttonIds: ['ocrMode'] },
    ],
  },
  {
    id: 'export',
    label: 'Экспорт',
    groups: [
      { label: 'Формат', buttonIds: ['exportText', 'exportWord', 'exportHtml', 'exportPlainText'] },
      { label: 'PDF', buttonIds: ['exportPdfA', 'cleanMetadata', 'sanitizePdf'] },
    ],
  },
  {
    id: 'annotate',
    label: 'Аннотации',
    contextual: true,
    context: 'annotation',
    groups: [
      { label: 'Инструменты', buttonIds: ['annPen', 'annHighlight', 'annEraser'] },
      { label: 'Экспорт', buttonIds: ['exportAnnotated', 'exportAnnSvg', 'exportAnnPdf'] },
    ],
  },
];

/**
 * Initialize the ribbon toolbar system.
 * @param {object} options
 * @param {HTMLElement} options.container - Toolbar container
 * @param {RibbonTab[]} [options.tabs] - Custom tab configuration
 * @param {string} [options.activeTab='home']
 */
export function initRibbonToolbar(options) {
  const { container, tabs = DEFAULT_TABS, activeTab = 'home' } = options;
  if (!container) return;

  // Create tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'ribbon-tab-bar';
  tabBar.setAttribute('role', 'tablist');

  // Create content panels
  const contentArea = document.createElement('div');
  contentArea.className = 'ribbon-content-area';

  for (const tab of tabs) {
    // Tab button
    const tabBtn = document.createElement('button');
    tabBtn.className = 'ribbon-tab-btn';
    tabBtn.dataset.ribbonTab = tab.id;
    tabBtn.textContent = tab.label;
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('aria-selected', tab.id === activeTab ? 'true' : 'false');

    if (tab.contextual) {
      tabBtn.classList.add('ribbon-tab-contextual');
      tabBtn.dataset.context = tab.context;
      tabBtn.hidden = true; // Hidden until context is active
    }

    tabBtn.addEventListener('click', () => switchTab(container, tab.id));
    tabBar.appendChild(tabBtn);

    // Tab panel
    const panel = document.createElement('div');
    panel.className = 'ribbon-panel';
    panel.dataset.ribbonPanel = tab.id;
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = tab.id !== activeTab;

    for (const group of tab.groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'ribbon-group';

      const groupContent = document.createElement('div');
      groupContent.className = 'ribbon-group-content';

      for (const btnId of group.buttonIds) {
        // Try to find existing button and move it into the ribbon
        const existing = document.getElementById(btnId);
        if (existing) {
          const clone = /** @type {HTMLElement} */ (existing.cloneNode(true));
          clone.id = `ribbon-${btnId}`;
          clone.classList.add('ribbon-btn');
          // Forward clicks to original
          clone.addEventListener('click', () => existing.click());
          groupContent.appendChild(clone);
        }
      }

      const groupLabel = document.createElement('div');
      groupLabel.className = 'ribbon-group-label';
      groupLabel.textContent = group.label;

      groupEl.appendChild(groupContent);
      groupEl.appendChild(groupLabel);
      panel.appendChild(groupEl);
    }

    contentArea.appendChild(panel);
  }

  // Collapse/expand toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'ribbon-collapse-btn';
  toggleBtn.innerHTML = '&#x25B2;';
  toggleBtn.title = 'Свернуть/Развернуть ленту';
  toggleBtn.addEventListener('click', () => {
    container.classList.toggle('ribbon-collapsed');
    toggleBtn.innerHTML = container.classList.contains('ribbon-collapsed') ? '&#x25BC;' : '&#x25B2;';
  });
  tabBar.appendChild(toggleBtn);

  container.appendChild(tabBar);
  container.appendChild(contentArea);
  container.classList.add('ribbon-toolbar');
}

/**
 * Switch to a specific ribbon tab.
 */
export function switchTab(container, tabId) {
  if (!container) return;

  container.querySelectorAll('.ribbon-tab-btn').forEach(btn => {
    btn.setAttribute('aria-selected', btn.dataset.ribbonTab === tabId ? 'true' : 'false');
    btn.classList.toggle('active', btn.dataset.ribbonTab === tabId);
  });

  container.querySelectorAll('.ribbon-panel').forEach(panel => {
    panel.hidden = panel.dataset.ribbonPanel !== tabId;
  });
}

/**
 * Show/hide contextual tabs based on current context.
 * @param {HTMLElement} container
 * @param {string} context - e.g. 'pdf', 'annotation', 'image'
 * @param {boolean} show
 */
export function setContextualTab(container, context, show) {
  if (!container) return;
  const tabs = container.querySelectorAll(`.ribbon-tab-contextual[data-context="${context}"]`);
  tabs.forEach(tab => {
    /** @type {any} */ (tab).hidden = !show;
    if (show) switchTab(container, /** @type {HTMLElement} */ (tab).dataset.ribbonTab);
  });
}
