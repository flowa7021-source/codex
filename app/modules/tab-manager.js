// @ts-check
// ─── Tab Manager ────────────────────────────────────────────────────────────
// Multi-document tab system: open several documents in one window.

/**
 * @typedef {object} DocumentTab
 * @property {string} id
 * @property {string} name
 * @property {string} type - 'pdf' | 'djvu' | 'epub' | 'image'
 * @property {Uint8Array|null} bytes
 * @property {object} state - { currentPage, zoom, scrollY, bookmarks, annotations }
 * @property {boolean} modified
 * @property {number} openedAt
 */

export class TabManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.tabBar - Container for tab buttons
   * @param {Function} options.onActivate - (tab: DocumentTab) => void
   * @param {Function} options.onClose - (tab: DocumentTab) => boolean (return false to cancel)
   * @param {Function} [options.onDeactivate] - (tab: DocumentTab) => void
   * @param {number} [options.maxTabs=10]
   */
  constructor(options) {
    this.tabBar = options.tabBar;
    this.onActivate = options.onActivate;
    this.onClose = options.onClose || (() => true);
    this.onDeactivate = options.onDeactivate || null;
    this.maxTabs = options.maxTabs ?? 10;

    /** @type {Map<string, DocumentTab>} */
    this.tabs = new Map();
    /** @type {string|null} */
    this.activeTabId = null;

    this._render();
  }

  /**
   * Open a new document tab.
   * @param {string} name - File name
   * @param {string} type - Document type
   * @param {Uint8Array} bytes - Document data
   * @param {object} [initialState] - Initial state
   * @returns {string} Tab ID
   */
  open(name, type, bytes, initialState = {}) {
    // Check for duplicate
    for (const [id, tab] of this.tabs) {
      if (tab.name === name) {
        this.activate(id);
        return id;
      }
    }

    if (this.tabs.size >= this.maxTabs) {
      // Close oldest non-modified tab
      const oldest = [...this.tabs.values()]
        .filter(t => !t.modified)
        .sort((a, b) => a.openedAt - b.openedAt)[0];
      if (oldest) this.close(oldest.id);
    }

    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tab = {
      id,
      name,
      type,
      bytes,
      state: {
        currentPage: 1,
        zoom: 1,
        scrollY: 0,
        bookmarks: [],
        annotations: [],
        ...initialState,
      },
      modified: false,
      openedAt: Date.now(),
    };

    this.tabs.set(id, tab);
    this.activate(id);
    this._render();
    return id;
  }

  /**
   * Activate a tab.
   * @param {string} id
   */
  activate(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    // Save current tab state before switching
    if (this.activeTabId && this.activeTabId !== id) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab && this.onDeactivate) {
        this.onDeactivate(currentTab);
      }
    }

    this.activeTabId = id;
    this.onActivate(tab);
    this._render();
  }

  /**
   * Close a tab.
   * @param {string} id
   * @returns {boolean} Whether the tab was closed
   */
  close(id) {
    const tab = this.tabs.get(id);
    if (!tab) return false;

    // Ask for confirmation (onClose can veto for modified or any tab)
    if (!this.onClose(tab)) {
      return false;
    }

    // Save current tab state before closing if it's the active tab
    if (this.activeTabId === id && this.onDeactivate) {
      this.onDeactivate(tab);
    }

    // Clean up resources: release byte data
    tab.bytes = null;
    tab.state = null;
    this.tabs.delete(id);

    // If closing active tab, switch to adjacent
    if (this.activeTabId === id) {
      const remaining = [...this.tabs.keys()];
      if (remaining.length > 0) {
        this.activate(remaining[remaining.length - 1]);
      } else {
        this.activeTabId = null;
      }
    }

    this._render();
    return true;
  }

  /**
   * Mark current tab as modified.
   */
  markModified() {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.modified = true;
      this._render();
    }
  }

  /**
   * Update the state of the active tab.
   * @param {object} stateUpdate
   */
  updateState(stateUpdate) {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      Object.assign(tab.state, stateUpdate);
    }
  }

  /**
   * Get active tab.
   * @returns {DocumentTab|null}
   */
  getActiveTab() {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }

  /**
   * Get all tabs.
   * @returns {DocumentTab[]}
   */
  getAllTabs() {
    return [...this.tabs.values()];
  }

  /** @private */
  _render() {
    if (!this.tabBar) return;
    this.tabBar.innerHTML = '';
    this.tabBar.className = 'tab-bar';
    this.tabBar.setAttribute('role', 'tablist');

    for (const [id, tab] of this.tabs) {
      const tabEl = document.createElement('div');
      const isActive = id === this.activeTabId;
      tabEl.className = `tab-item${isActive ? ' active' : ''}${tab.modified ? ' modified' : ''}`;
      tabEl.dataset.tabId = id;
      tabEl.setAttribute('role', 'tab');
      tabEl.setAttribute('aria-selected', String(isActive));

      const icon = this._getTypeIcon(tab.type);
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = `${icon} ${tab.name}`;
      label.title = tab.name;
      tabEl.appendChild(label);

      if (tab.modified) {
        const dot = document.createElement('span');
        dot.className = 'tab-modified-dot';
        dot.textContent = '●';
        tabEl.appendChild(dot);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = 'Закрыть';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close(id);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => this.activate(id));

      // Middle click to close
      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.close(id);
        }
      });

      this.tabBar.appendChild(tabEl);
    }

    // Add new tab button
    const newBtn = document.createElement('button');
    newBtn.className = 'tab-new';
    newBtn.innerHTML = '+';
    newBtn.title = 'Открыть файл';
    newBtn.addEventListener('click', () => {
      document.getElementById('fileInput')?.click();
    });
    this.tabBar.appendChild(newBtn);
  }

  _getTypeIcon(type) {
    switch (type) {
      case 'pdf': return '📄';
      case 'djvu': return '📘';
      case 'epub': return '📖';
      case 'image': return '🖼';
      default: return '📃';
    }
  }
}
