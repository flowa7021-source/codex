// @ts-check
// ─── Modal Prompt ────────────────────────────────────────────────────────────
// Async replacement for window.prompt() that works in sandboxed WebView environments.
// Returns a Promise<string|null>.

let _overlayEl = null;
let _dialogEl = null;

function _ensureDOM() {
  if (_overlayEl && document.body.contains(_overlayEl)) return;

  _overlayEl = document.createElement('div');
  _overlayEl.className = 'nr-modal-overlay';
  _overlayEl.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.45); display: none;
    align-items: center; justify-content: center;
    backdrop-filter: blur(2px);
  `;

  _dialogEl = document.createElement('div');
  _dialogEl.className = 'nr-modal-dialog';
  _dialogEl.style.cssText = `
    background: var(--surface, #1e293b); color: var(--text, #e2e8f0);
    border-radius: 12px; padding: 24px; min-width: 340px; max-width: 480px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    font-family: var(--font, system-ui, sans-serif);
  `;

  _overlayEl.appendChild(_dialogEl);
  document.body.appendChild(_overlayEl);
}

/**
 * Show a modal prompt dialog (async replacement for window.prompt).
 * @param {string} message - The prompt message
 * @param {string} [defaultValue=''] - Default input value
 * @param {object} [options]
 * @param {string} [options.okLabel='OK']
 * @param {string} [options.cancelLabel='Отмена']
 * @param {boolean} [options.multiline=false]
 * @param {string} [options.placeholder='']
 * @returns {Promise<string|null>} Entered value or null if cancelled
 */
export function nrPrompt(message, defaultValue = '', options = {}) {
  const {
    okLabel = 'OK',
    cancelLabel = 'Отмена',
    multiline = false,
    placeholder = '',
  } = options;

  _ensureDOM();

  return new Promise(resolve => {
    const inputId = `nr-prompt-${Date.now()}`;
    const inputTag = multiline
      ? `<textarea id="${inputId}" class="nr-modal-input" rows="3" placeholder="${_esc(placeholder)}">${_esc(defaultValue)}</textarea>`
      : `<input id="${inputId}" class="nr-modal-input" type="text" value="${_esc(defaultValue)}" placeholder="${_esc(placeholder)}" />`;

    _dialogEl.innerHTML = `
      <div style="font-size:14px;margin-bottom:12px;white-space:pre-wrap;line-height:1.5">${_esc(message)}</div>
      ${inputTag}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button class="nr-modal-btn nr-modal-cancel">${_esc(cancelLabel)}</button>
        <button class="nr-modal-btn nr-modal-ok">${_esc(okLabel)}</button>
      </div>
    `;

    // Style the input
    const inputEl = _dialogEl.querySelector(`#${inputId}`);
    inputEl.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 8px 10px;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
      background: rgba(0,0,0,0.3); color: inherit; font-size: 14px;
      font-family: inherit; outline: none; resize: vertical;
    `;

    // Style the buttons
    _dialogEl.querySelectorAll('.nr-modal-btn').forEach(btn => {
      btn.style.cssText = `
        padding: 8px 20px; border-radius: 6px; border: none;
        font-size: 13px; cursor: pointer; font-family: inherit;
      `;
    });
    const okBtn = _dialogEl.querySelector('.nr-modal-ok');
    okBtn.style.background = '#3b82f6';
    okBtn.style.color = '#fff';
    const cancelBtn = _dialogEl.querySelector('.nr-modal-cancel');
    cancelBtn.style.background = 'rgba(255,255,255,0.1)';
    cancelBtn.style.color = 'inherit';

    _overlayEl.style.display = 'flex';

    function close(value) {
      _overlayEl.style.display = 'none';
      _dialogEl.innerHTML = '';
      resolve(value);
    }

    okBtn.addEventListener('click', () => close(inputEl.value));
    cancelBtn.addEventListener('click', () => close(null));
    _overlayEl.addEventListener('click', e => {
      if (e.target === _overlayEl) close(null);
    }, { once: true });

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        close(inputEl.value);
      }
      if (e.key === 'Escape') close(null);
    });

    // Focus after display
    requestAnimationFrame(() => {
      inputEl.focus();
      inputEl.select();
    });
  });
}

/**
 * Show a modal confirm dialog.
 * @param {string} message
 * @param {object} [options]
 * @returns {Promise<boolean>}
 */
export function nrConfirm(message, options = {}) {
  const { okLabel = 'OK', cancelLabel = 'Отмена' } = options;

  _ensureDOM();

  return new Promise(resolve => {
    _dialogEl.innerHTML = `
      <div style="font-size:14px;margin-bottom:16px;white-space:pre-wrap;line-height:1.5">${_esc(message)}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="nr-modal-btn nr-modal-cancel">${_esc(cancelLabel)}</button>
        <button class="nr-modal-btn nr-modal-ok">${_esc(okLabel)}</button>
      </div>
    `;

    _dialogEl.querySelectorAll('.nr-modal-btn').forEach(btn => {
      btn.style.cssText = `
        padding: 8px 20px; border-radius: 6px; border: none;
        font-size: 13px; cursor: pointer; font-family: inherit;
      `;
    });
    const okBtn = _dialogEl.querySelector('.nr-modal-ok');
    okBtn.style.background = '#3b82f6';
    okBtn.style.color = '#fff';
    const cancelBtn = _dialogEl.querySelector('.nr-modal-cancel');
    cancelBtn.style.background = 'rgba(255,255,255,0.1)';
    cancelBtn.style.color = 'inherit';

    _overlayEl.style.display = 'flex';

    function close(val) {
      _overlayEl.style.display = 'none';
      _dialogEl.innerHTML = '';
      resolve(val);
    }

    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    _overlayEl.addEventListener('click', e => {
      if (e.target === _overlayEl) close(false);
    }, { once: true });

    requestAnimationFrame(() => okBtn.focus());
  });
}

function _esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
