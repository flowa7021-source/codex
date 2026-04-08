// ─── Toast Notification System ──────────────────────────────────────────────
// Types: success, error, warning, info, progress
// Auto-dismiss, stacking, click-to-dismiss, progress bar

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'progress';

interface ToastOpts {
  type?: ToastType;
  duration?: number;
  progress?: number;
  id?: string | number;
}

interface ToastHandle {
  id: string | number;
  update: (msg: string, newOpts?: ToastOpts) => ToastHandle;
  dismiss: () => void;
}

let container: HTMLElement | null = null;
let toastIdCounter = 0;
const activeToasts = new Map<string | number, { el: HTMLElement; timer: number | null; type: string }>();

const ICONS: Record<string, string> = {
  success: '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 9.5l2 2 5-5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error: '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  warning: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 2L1 16h16L9 2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 7v4M9 13v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 5v1M9 8v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  progress: '<svg width="18" height="18" viewBox="0 0 18 18" class="toast-spinner"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="30 14" stroke-linecap="round"/></svg>',
};

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-relevant', 'additions');
  container.setAttribute('role', 'status');
  document.body.appendChild(container);
  return container;
}

function removeToast(id: string | number): void {
  const entry = activeToasts.get(id);
  if (!entry) return;
  activeToasts.delete(id);
  if (entry.timer !== null) clearSafeTimeout(entry.timer);
  entry.el.classList.add('toast-exit');
  entry.el.addEventListener('animationend', () => {
    if (entry.el.parentNode) entry.el.remove();
  }, { once: true });
  safeTimeout(() => {
    if (entry.el.parentNode) entry.el.remove();
  }, 350);
}

function evictOldest(): void {
  if (activeToasts.size < MAX_TOASTS) return;
  const oldest = activeToasts.keys().next().value;
  if (oldest !== undefined) removeToast(oldest);
}

export function toast(message: string, opts: ToastOpts = {}): ToastHandle {
  const {
    type = 'info',
    duration = type === 'progress' ? 0 : DEFAULT_DURATION,
    progress,
    id: customId,
  } = opts;

  if (customId !== undefined && activeToasts.has(customId)) {
    return updateToast(customId, message, opts);
  }

  evictOldest();
  ensureContainer();

  const id = customId ?? ++toastIdCounter;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');

  const icon = ICONS[type] ?? ICONS['info'];
  const progressBar = progress != null
    ? `<div class="toast-progress"><div class="toast-progress-bar" style="width:${progress}%"></div></div>`
    : '';

  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Закрыть">&times;</button>
    ${progressBar}
  `;

  el.querySelector('.toast-close')!.addEventListener('click', () => removeToast(id));
  el.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.toast-close')) removeToast(id);
  });

  container!.appendChild(el);

  const timer = duration > 0 ? safeTimeout(() => removeToast(id), duration) : null;
  activeToasts.set(id, { el, timer, type });

  return {
    id,
    update: (msg, newOpts) => updateToast(id, msg, { type, ...newOpts }),
    dismiss: () => removeToast(id),
  };
}

function updateToast(id: string | number, message: string, opts: ToastOpts = {}): ToastHandle {
  const entry = activeToasts.get(id);
  if (!entry) return toast(message, { ...opts, id });

  const msgEl = entry.el.querySelector('.toast-message');
  if (msgEl) msgEl.textContent = message;

  if (opts.progress != null) {
    let bar = entry.el.querySelector<HTMLElement>('.toast-progress-bar');
    if (!bar) {
      const wrap = document.createElement('div');
      wrap.className = 'toast-progress';
      wrap.innerHTML = '<div class="toast-progress-bar"></div>';
      entry.el.appendChild(wrap);
      bar = wrap.firstChild as HTMLElement;
    }
    bar.style.width = `${opts.progress}%`;
  }

  if (opts.type && opts.type !== entry.type) {
    entry.el.className = `toast toast-${opts.type}`;
    const iconEl = entry.el.querySelector('.toast-icon');
    if (iconEl) iconEl.innerHTML = ICONS[opts.type] ?? ICONS['info'];
    entry.type = opts.type;
  }

  if (opts.duration != null && opts.duration > 0) {
    if (entry.timer !== null) clearSafeTimeout(entry.timer);
    entry.timer = safeTimeout(() => removeToast(id), opts.duration);
  }

  return {
    id,
    update: (msg, newOpts) => updateToast(id, msg, { ...opts, ...newOpts }),
    dismiss: () => removeToast(id),
  };
}

export function dismissAllToasts(): void {
  for (const id of [...activeToasts.keys()]) {
    removeToast(id);
  }
}

export function toastSuccess(message: string, duration?: number): ToastHandle { return toast(message, { type: 'success', duration }); }
export function toastError(message: string, duration?: number): ToastHandle { return toast(message, { type: 'error', duration: duration ?? 6000 }); }
export function toastWarning(message: string, duration?: number): ToastHandle { return toast(message, { type: 'warning', duration }); }
export function toastInfo(message: string, duration?: number): ToastHandle { return toast(message, { type: 'info', duration }); }
export function toastProgress(message: string, opts: ToastOpts = {}): ToastHandle { return toast(message, { type: 'progress', ...opts }); }

function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
