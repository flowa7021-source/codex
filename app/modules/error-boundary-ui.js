// ─── Error Boundary Fallback UI ──────────────────────────────────────────────
// Provides visual fallback when critical errors occur.
// Uses inline styles so it works even if CSS fails to load.

const BANNER_ID = 'nr-error-banner';
const AUTO_DISMISS_MS = 30000;

/**
 * Show a non-intrusive error banner at the top of the app.
 * @param {string} context - Where the error occurred (e.g. 'file-open')
 * @param {Error|string} error - The error object or message
 */
export function showErrorFallback(context, error) {
  // Remove any existing banner first
  const existing = document.getElementById(BANNER_ID);
  if (existing) existing.remove();

  const message = typeof error === 'string' ? error : (error?.message || 'Unknown error');

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'alert');
  banner.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'z-index: 999999',
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'padding: 10px 16px',
    'background: #fee2e2',
    'border-bottom: 2px solid #dc2626',
    'color: #991b1b',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font-size: 14px',
    'line-height: 1.4',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.15)',
  ].join(';');

  const textSpan = document.createElement('span');
  textSpan.style.cssText = 'flex: 1; margin-right: 12px; word-break: break-word;';
  textSpan.textContent = `An error occurred in ${context}. ${message}`;
  banner.appendChild(textSpan);

  const btnContainer = document.createElement('span');
  btnContainer.style.cssText = 'display: flex; gap: 8px; flex-shrink: 0;';

  const btnStyle = [
    'padding: 4px 12px',
    'border: 1px solid #dc2626',
    'border-radius: 4px',
    'cursor: pointer',
    'font-size: 13px',
    'font-family: inherit',
  ].join(';');

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'Retry';
  retryBtn.style.cssText = btnStyle + ';background: #dc2626; color: #fff;';
  retryBtn.addEventListener('click', () => {
    window.location.reload();
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.style.cssText = btnStyle + ';background: transparent; color: #991b1b;';
  dismissBtn.addEventListener('click', () => {
    banner.remove();
  });

  btnContainer.appendChild(retryBtn);
  btnContainer.appendChild(dismissBtn);
  banner.appendChild(btnContainer);

  // Insert at the very top of the body
  if (document.body) {
    document.body.prepend(banner);
  } else {
    document.documentElement.appendChild(banner);
  }

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    const el = document.getElementById(BANNER_ID);
    if (el) el.remove();
  }, AUTO_DISMISS_MS);
}

/**
 * Full-screen fallback when the app cannot start at all.
 * Replaces document.body content entirely.
 * @param {Error|string} error - The error object or message
 */
export function showCriticalErrorScreen(error) {
  const message = typeof error === 'string' ? error : (error?.message || 'Unknown error');

  const html = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      background: #1e1e2e;
      color: #cdd6f4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
      box-sizing: border-box;
    ">
      <div style="max-width: 480px; width: 100%;">
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #cdd6f4;
        ">NovaReader</h1>
        <p style="
          font-size: 16px;
          color: #a6adc8;
          margin: 0 0 24px 0;
        ">The application failed to start.</p>
        <div style="
          background: #313244;
          border: 1px solid #45475a;
          border-radius: 8px;
          padding: 16px;
          margin: 0 0 24px 0;
          text-align: left;
          word-break: break-word;
        ">
          <p style="
            margin: 0 0 4px 0;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #f38ba8;
          ">Error Details</p>
          <p style="
            margin: 0;
            font-size: 14px;
            color: #cdd6f4;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            line-height: 1.5;
          ">${escapeHtml(message)}</p>
        </div>
        <button onclick="window.location.reload()" style="
          padding: 10px 28px;
          background: #89b4fa;
          color: #1e1e2e;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        " onmouseover="this.style.background='#74c7ec'"
           onmouseout="this.style.background='#89b4fa'"
        >Reload</button>
      </div>
    </div>
  `;

  if (!document.body) return;
  document.body.innerHTML = html;
  document.body.style.margin = '0';
  document.body.style.padding = '0';
}

/**
 * Escape HTML entities to prevent XSS in error messages.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
