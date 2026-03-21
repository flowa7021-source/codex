// ─── Floating Search Panel ──────────────────────────────────────────────────
// Ctrl+F style search panel with find, replace, navigation, and match highlighting.

/**
 * @typedef {object} SearchState
 * @property {string} query
 * @property {boolean} caseSensitive
 * @property {boolean} wholeWord
 * @property {boolean} regex
 * @property {number} currentMatch - 0-based index of current match
 * @property {number} totalMatches
 * @property {boolean} visible
 * @property {string} replaceText
 */

/**
 * Create the floating search panel DOM structure.
 * @param {object} callbacks
 * @param {Function} callbacks.onSearch - (query, options) => {matches, total}
 * @param {Function} callbacks.onNavigate - (direction: 'next'|'prev', matchIndex) => void
 * @param {Function} callbacks.onReplace - (replaceText, matchIndex) => void
 * @param {Function} callbacks.onReplaceAll - (replaceText) => void
 * @param {Function} callbacks.onClose - () => void
 * @returns {{panel: HTMLElement, state: SearchState, show: Function, hide: Function, updateResults: Function}}
 */
export function createFloatingSearch(callbacks = {}) {
  const state = {
    query: '',
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    currentMatch: -1,
    totalMatches: 0,
    visible: false,
    replaceText: '',
  };

  // Build DOM
  const panel = document.createElement('div');
  panel.className = 'floating-search-panel';
  panel.setAttribute('role', 'search');
  panel.setAttribute('aria-label', 'Find in document');
  panel.innerHTML = `
    <div class="search-row">
      <input type="text" class="search-input" placeholder="Find…" aria-label="Search query">
      <span class="search-count" aria-live="polite">0/0</span>
      <button class="search-prev" title="Previous (Shift+Enter)" aria-label="Previous match">&#9650;</button>
      <button class="search-next" title="Next (Enter)" aria-label="Next match">&#9660;</button>
      <button class="search-close" title="Close (Escape)" aria-label="Close search">&times;</button>
    </div>
    <div class="search-options">
      <label><input type="checkbox" class="opt-case"> Aa</label>
      <label><input type="checkbox" class="opt-word"> \\bW\\b</label>
      <label><input type="checkbox" class="opt-regex"> .*</label>
      <button class="search-toggle-replace" title="Show replace">Replace</button>
    </div>
    <div class="search-replace-row" style="display:none">
      <input type="text" class="replace-input" placeholder="Replace with…" aria-label="Replace text">
      <button class="replace-one" title="Replace current">Replace</button>
      <button class="replace-all" title="Replace all">All</button>
    </div>
  `;

  // Cache elements
  const searchInput = panel.querySelector('.search-input');
  const countLabel = panel.querySelector('.search-count');
  const prevBtn = panel.querySelector('.search-prev');
  const nextBtn = panel.querySelector('.search-next');
  const closeBtn = panel.querySelector('.search-close');
  const caseOpt = panel.querySelector('.opt-case');
  const wordOpt = panel.querySelector('.opt-word');
  const regexOpt = panel.querySelector('.opt-regex');
  const toggleReplace = panel.querySelector('.search-toggle-replace');
  const replaceRow = panel.querySelector('.search-replace-row');
  const replaceInput = panel.querySelector('.replace-input');
  const replaceOneBtn = panel.querySelector('.replace-one');
  const replaceAllBtn = panel.querySelector('.replace-all');

  let searchDebounce = null;

  function doSearch() {
    state.query = searchInput.value;
    state.caseSensitive = caseOpt.checked;
    state.wholeWord = wordOpt.checked;
    state.regex = regexOpt.checked;

    if (!state.query) {
      updateResults(0, 0);
      return;
    }

    if (callbacks.onSearch) {
      const result = callbacks.onSearch(state.query, {
        caseSensitive: state.caseSensitive,
        wholeWord: state.wholeWord,
        regex: state.regex,
      });
      if (result) {
        state.totalMatches = result.total || 0;
        state.currentMatch = state.totalMatches > 0 ? 0 : -1;
        updateCountLabel();
      }
    }
  }

  function navigate(direction) {
    if (state.totalMatches === 0) return;

    if (direction === 'next') {
      state.currentMatch = (state.currentMatch + 1) % state.totalMatches;
    } else {
      state.currentMatch = (state.currentMatch - 1 + state.totalMatches) % state.totalMatches;
    }

    updateCountLabel();
    if (callbacks.onNavigate) {
      callbacks.onNavigate(direction, state.currentMatch);
    }
  }

  function updateCountLabel() {
    if (state.totalMatches === 0) {
      countLabel.textContent = '0/0';
      countLabel.classList.toggle('no-results', state.query.length > 0);
    } else {
      countLabel.textContent = `${state.currentMatch + 1}/${state.totalMatches}`;
      countLabel.classList.remove('no-results');
    }
  }

  function updateResults(current, total) {
    state.currentMatch = current;
    state.totalMatches = total;
    updateCountLabel();
  }

  function show() {
    panel.classList.add('visible');
    state.visible = true;
    searchInput.focus();
    searchInput.select();
  }

  function hide() {
    panel.classList.remove('visible');
    state.visible = false;
    if (callbacks.onClose) callbacks.onClose();
  }

  // Event bindings
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(doSearch, 150);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  prevBtn.addEventListener('click', () => navigate('prev'));
  nextBtn.addEventListener('click', () => navigate('next'));
  closeBtn.addEventListener('click', hide);

  caseOpt.addEventListener('change', doSearch);
  wordOpt.addEventListener('change', doSearch);
  regexOpt.addEventListener('change', doSearch);

  toggleReplace.addEventListener('click', () => {
    const isHidden = replaceRow.style.display === 'none';
    replaceRow.style.display = isHidden ? 'flex' : 'none';
    toggleReplace.classList.toggle('active', isHidden);
    if (isHidden) replaceInput.focus();
  });

  replaceOneBtn.addEventListener('click', () => {
    state.replaceText = replaceInput.value;
    if (callbacks.onReplace) callbacks.onReplace(state.replaceText, state.currentMatch);
  });

  replaceAllBtn.addEventListener('click', () => {
    state.replaceText = replaceInput.value;
    if (callbacks.onReplaceAll) callbacks.onReplaceAll(state.replaceText);
  });

  // Global Escape handling
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      hide();
    }
  });

  return { panel, state, show, hide, updateResults };
}

/**
 * Initialize the floating search and attach to the document.
 * @param {HTMLElement} container - Where to append the panel
 * @param {object} callbacks - Search callbacks
 * @returns {object} Controller { show, hide, toggle, panel, state }
 */
export function initFloatingSearch(container, callbacks = {}) {
  const search = createFloatingSearch(callbacks);
  container.appendChild(search.panel);

  function toggle() {
    if (search.state.visible) {
      search.hide();
    } else {
      search.show();
    }
  }

  return {
    show: search.show,
    hide: search.hide,
    toggle,
    panel: search.panel,
    state: search.state,
    updateResults: search.updateResults,
  };
}
