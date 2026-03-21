/**
 * @module presentation-mode
 * @description Full-screen slideshow mode for PDF documents.
 *
 * Features:
 *   • Renders each PDF page as a full-screen slide
 *   • Smooth page transitions (fade, slide, none)
 *   • Keyboard navigation (arrows, space, Escape)
 *   • Auto-advance timer (configurable interval)
 *   • Slide counter overlay
 *   • Presenter notes panel (optional second window)
 *   • Laser pointer simulation (red dot following cursor)
 *   • Black/white screen toggle (B/W keys)
 *
 * Usage:
 *   import { PresentationMode } from './presentation-mode.js';
 *
 *   const pres = new PresentationMode({
 *     renderPage: async (pageNum) => canvas,
 *     getTotalPages: () => totalPages,
 *     getCurrentPage: () => currentPage,
 *   });
 *   pres.start();
 */

import { safeTimeout, clearSafeTimeout, safeInterval, clearSafeInterval } from './safe-timers.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSITIONS = {
  none: { duration: 0 },
  fade: { duration: 400 },
  slide: { duration: 350 },
};

// ---------------------------------------------------------------------------
// PresentationMode
// ---------------------------------------------------------------------------

export class PresentationMode {
  /**
   * @param {Object} deps
   * @param {Function} deps.renderPage     – (pageNum) => Promise<HTMLCanvasElement>
   * @param {Function} deps.getTotalPages  – () => number
   * @param {Function} deps.getCurrentPage – () => number (1-based)
   * @param {Function} [deps.onExit]
   * @param {Function} [deps.onPageChange] – (pageNum) => void
   */
  constructor(deps) {
    this._deps       = deps;
    this._overlay     = null;
    this._currentPage = deps.getCurrentPage?.() ?? 1;
    this._totalPages  = deps.getTotalPages?.()  ?? 1;

    this._transition  = 'fade';
    this._autoAdvance = 0;       // seconds; 0 = off
    this._autoTimer   = null;
    this._laserOn     = false;
    this._blanked     = null;    // null | 'black' | 'white'

    this._onKeyDown   = this._onKeyDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick     = this._onClick.bind(this);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(pageNum) {
    this._totalPages  = this._deps.getTotalPages?.() ?? 1;
    this._currentPage = pageNum ?? this._deps.getCurrentPage?.() ?? 1;

    this._buildOverlay();

    document.addEventListener('keydown', this._onKeyDown);
    this._overlay.addEventListener('mousemove', this._onMouseMove);
    this._overlay.addEventListener('click', this._onClick);

    // Request fullscreen (only if not already in fullscreen)
    if (!document.fullscreenElement && this._overlay.requestFullscreen) {
      try {
        await this._overlay.requestFullscreen();
      } catch (_e) {
        // Fullscreen not available — continue windowed
      }
    }

    await this._showPage(this._currentPage, 'none');
    this._startAutoAdvance();
  }

  stop() {
    this._stopAutoAdvance();
    clearSafeTimeout(this._cursorTimer);
    document.removeEventListener('keydown', this._onKeyDown);

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }

    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }

    this._deps.onExit?.();
  }

  async goToPage(n) {
    if (n < 1 || n > this._totalPages) return;
    this._currentPage = n;
    this._deps.onPageChange?.(n);
    await this._showPage(n, this._transition);
    this._resetAutoAdvance();
  }

  setTransition(name) {
    if (TRANSITIONS[name]) this._transition = name;
  }

  setAutoAdvance(seconds) {
    this._autoAdvance = Math.max(0, seconds);
    this._resetAutoAdvance();
  }

  toggleLaser() {
    this._laserOn = !this._laserOn;
    this._laserDot.style.display = this._laserOn ? 'block' : 'none';
  }

  // ── Overlay construction ───────────────────────────────────────────────────

  _buildOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:#000', 'display:flex', 'align-items:center', 'justify-content:center',
      'cursor:none', 'overflow:hidden',
    ].join(';');

    // Slide container
    this._slideContainer = document.createElement('div');
    this._slideContainer.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center';
    this._overlay.appendChild(this._slideContainer);

    // Counter
    this._counter = document.createElement('div');
    this._counter.style.cssText = [
      'position:absolute', 'bottom:16px', 'right:24px',
      'color:rgba(255,255,255,0.5)', 'font-size:14px', 'font-family:sans-serif',
      'pointer-events:none', 'z-index:2',
    ].join(';');
    this._overlay.appendChild(this._counter);

    // Laser pointer dot
    this._laserDot = document.createElement('div');
    this._laserDot.style.cssText = [
      'position:absolute', 'width:12px', 'height:12px', 'border-radius:50%',
      'background:red', 'box-shadow:0 0 8px 2px rgba(255,0,0,0.6)',
      'pointer-events:none', 'z-index:3', 'display:none',
      'transform:translate(-50%,-50%)',
    ].join(';');
    this._overlay.appendChild(this._laserDot);

    // Blank screen overlay
    this._blankOverlay = document.createElement('div');
    this._blankOverlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:4',
      'display:none', 'pointer-events:none',
    ].join(';');
    this._overlay.appendChild(this._blankOverlay);

    document.body.appendChild(this._overlay);
  }

  // ── Page rendering ─────────────────────────────────────────────────────────

  async _showPage(pageNum, transition) {
    const canvas = await this._deps.renderPage(pageNum);
    if (!canvas) return;

    // Scale to fit screen
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const scale = Math.min(sw / canvas.width, sh / canvas.height);

    const display = document.createElement('canvas');
    display.width  = Math.round(canvas.width  * scale);
    display.height = Math.round(canvas.height * scale);
    display.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain';
    const displayCtx = display.getContext('2d');
    if (!displayCtx) return;
    displayCtx.drawImage(canvas, 0, 0, display.width, display.height);

    const transConfig = TRANSITIONS[transition] ?? TRANSITIONS.none;

    if (transConfig.duration > 0 && this._slideContainer.firstChild) {
      // Animate transition
      const old = this._slideContainer.firstChild;

      if (transition === 'fade') {
        display.style.opacity = '0';
        display.style.transition = `opacity ${transConfig.duration}ms ease`;
        this._slideContainer.appendChild(display);
        // Trigger reflow then set opacity
        display.getBoundingClientRect();
        display.style.opacity = '1';
        old.style.transition = `opacity ${transConfig.duration}ms ease`;
        old.style.opacity    = '0';
        safeTimeout(() => { old.width = 0; old.height = 0; old.remove(); }, transConfig.duration);
      } else if (transition === 'slide') {
        display.style.transform  = 'translateX(100%)';
        display.style.transition = `transform ${transConfig.duration}ms ease`;
        this._slideContainer.appendChild(display);
        display.getBoundingClientRect();
        display.style.transform = 'translateX(0)';
        old.style.transition    = `transform ${transConfig.duration}ms ease`;
        old.style.transform     = 'translateX(-100%)';
        safeTimeout(() => { old.width = 0; old.height = 0; old.remove(); }, transConfig.duration);
      }
    } else {
      this._slideContainer.innerHTML = '';
      this._slideContainer.appendChild(display);
    }

    this._counter.textContent = `${pageNum} / ${this._totalPages}`;
  }

  // ── Auto-advance ──────────────────────────────────────────────────────────

  _startAutoAdvance() {
    if (this._autoAdvance <= 0) return;
    this._autoTimer = safeInterval(() => {
      if (this._currentPage < this._totalPages) {
        this.goToPage(this._currentPage + 1);
      } else {
        this._stopAutoAdvance();
      }
    }, this._autoAdvance * 1000);
  }

  _stopAutoAdvance() {
    if (this._autoTimer) {
      clearSafeInterval(this._autoTimer);
      this._autoTimer = null;
    }
  }

  _resetAutoAdvance() {
    this._stopAutoAdvance();
    this._startAutoAdvance();
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  _onKeyDown(e) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.stop();
        break;

      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        this.goToPage(this._currentPage + 1);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        this.goToPage(this._currentPage - 1);
        break;

      case 'Home':
        e.preventDefault();
        this.goToPage(1);
        break;

      case 'End':
        e.preventDefault();
        this.goToPage(this._totalPages);
        break;

      case 'b':
      case 'B':
        this._toggleBlank('black');
        break;

      case 'w':
      case 'W':
        this._toggleBlank('white');
        break;

      case 'l':
      case 'L':
        this.toggleLaser();
        break;

      case 'f':
      case 'F':
        if (!document.fullscreenElement) {
          this._overlay?.requestFullscreen?.().catch(() => {});
        }
        break;
    }
  }

  _onMouseMove(e) {
    if (this._laserOn) {
      this._laserDot.style.left = `${e.clientX}px`;
      this._laserDot.style.top  = `${e.clientY}px`;
    }

    // Show cursor briefly
    this._overlay.style.cursor = 'default';
    clearSafeTimeout(this._cursorTimer);
    this._cursorTimer = safeTimeout(() => {
      if (this._overlay) this._overlay.style.cursor = 'none';
    }, 2000);
  }

  _onClick(e) {
    // Click left half = previous, right half = next
    const half = window.innerWidth / 2;
    if (e.clientX < half) {
      this.goToPage(this._currentPage - 1);
    } else {
      this.goToPage(this._currentPage + 1);
    }
  }

  _toggleBlank(color) {
    if (this._blanked === color) {
      this._blankOverlay.style.display = 'none';
      this._blanked = null;
    } else {
      this._blankOverlay.style.display    = 'block';
      this._blankOverlay.style.background = color;
      this._blankOverlay.style.pointerEvents = 'auto';
      this._blanked = color;
    }
  }
}
