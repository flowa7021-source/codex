/**
 * @module table-editor
 * @description Phase 8 — Inline Table Editor (Tier 4 unique tool).
 *
 * Provides Excel-like inline editing for tables detected in a PDF page.
 * When a user clicks on a table region, TableEditor builds an interactive
 * HTML grid overlay exactly aligned with the table's bounding box on the
 * canvas.  Edits are committed back to the PDF via pdf-lib.
 *
 * Capabilities:
 *   • Click-to-activate on a detected table
 *   • Tab / Shift+Tab / Arrow key navigation between cells
 *   • Enter to commit a cell, Escape to cancel
 *   • Add / remove rows and columns
 *   • Cell text and basic formatting (bold, alignment)
 *   • Export modified table back to the PDF
 *
 * Usage:
 *   const editor = new TableEditor(containerEl, pdfLibDoc, pageModel, zoom);
 *   editor.open(tableBlock);     // opens the editor
 *   editor.on('commit', async (updatedRows) => { ... });
 *   editor.close();
 *
 * A tableBlock matches the `table` block type from layout-analyzer.js /
 * semantic-enricher.js:
 *   {
 *     rows: [{ cells: [{ text, runs }] }],
 *     bbox: { x, y, width, height },  // page pt
 *     pageNumber: number,
 *   }
 */

// ---------------------------------------------------------------------------
// TableEditor
// ---------------------------------------------------------------------------

export class TableEditor {
  /**
   * @param {HTMLElement} pageContainer   – the element that holds the PDF canvas
   * @param {Object} pdfLibDoc            – pdf-lib PDFDocument (may be null)
   * @param {number} pageWidthPt
   * @param {number} pageHeightPt
   * @param {number} [zoom=1]
   */
  constructor(pageContainer, pdfLibDoc, pageWidthPt, pageHeightPt, zoom = 1) {
    this.container   = pageContainer;
    this.pdfDoc      = pdfLibDoc;
    this.pageW       = pageWidthPt;
    this.pageH       = pageHeightPt;
    this.zoom        = zoom;

    this._tableBlock = null;
    this._rows       = [];          // deep copy of rows for editing
    this._overlay    = null;        // the outer overlay div
    this._grid       = null;        // the table HTML element
    this._activeCell = null;        // {row, col}
    this._listeners  = {};

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Open the table editor for the given table block.
   * @param {Object} tableBlock
   */
  open(tableBlock) {
    if (this._overlay) this.close();

    this._tableBlock = tableBlock;
    this._rows = _deepCopyRows(tableBlock.rows || []);

    this._buildOverlay();
    this._buildGrid();
    this._positionOverlay(tableBlock.bbox);

    document.addEventListener('keydown', this._onKeyDown);
    this._emit('open', { tableBlock });
  }

  /** Close and destroy the editor without committing. */
  close() {
    if (!this._overlay) return;
    document.removeEventListener('keydown', this._onKeyDown);
    this._overlay.remove();
    this._overlay    = null;
    this._grid       = null;
    this._tableBlock = null;
    this._activeCell = null;
    this._emit('close', {});
  }

  /**
   * Commit the current edits.
   * Fires the 'commit' event with the updated row data, then closes.
   */
  async commit() {
    const updatedRows = this._collectRows();
    this._emit('commit', { rows: updatedRows, tableBlock: this._tableBlock });
    this.close();
  }

  /** Register an event listener. */
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return this;
  }

  /** Update zoom factor and reposition overlay. */
  setZoom(zoom) {
    this.zoom = zoom;
    if (this._overlay && this._tableBlock) {
      this._positionOverlay(this._tableBlock.bbox);
    }
  }

  /** Add a new empty row at the bottom. */
  addRow() {
    const colCount = this._colCount();
    this._rows.push({ cells: Array.from({ length: colCount }, () => ({ text: '', runs: [] })) });
    this._buildGrid();
  }

  /** Remove the last row (only if more than 1 row remains). */
  removeLastRow() {
    if (this._rows.length <= 1) return;
    this._rows.pop();
    this._buildGrid();
  }

  /** Add a new empty column at the right. */
  addColumn() {
    for (const row of this._rows) {
      row.cells.push({ text: '', runs: [] });
    }
    this._buildGrid();
  }

  /** Remove the last column (only if more than 1 column remains). */
  removeLastColumn() {
    const minCols = 1;
    for (const row of this._rows) {
      if (row.cells.length > minCols) row.cells.pop();
    }
    this._buildGrid();
  }

  // ── Overlay construction ───────────────────────────────────────────────────

  _buildOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'table-editor-overlay';
    this._overlay.style.cssText = [
      'position:absolute',
      'z-index:100',
      'background:rgba(255,255,255,0.96)',
      'border:2px solid #0078D4',
      'border-radius:4px',
      'box-shadow:0 4px 20px rgba(0,0,0,0.25)',
      'overflow:auto',
      'max-width:90vw',
      'max-height:80vh',
    ].join(';');

    // Toolbar
    const toolbar = this._buildToolbar();
    this._overlay.appendChild(toolbar);

    this.container.style.position = 'relative';
    this.container.appendChild(this._overlay);
  }

  _buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'table-editor-toolbar';
    bar.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:6px',
      'padding:4px 8px',
      'background:#F3F9FF',
      'border-bottom:1px solid #D0E4F7',
      'font-size:12px',
      'font-family:Arial,sans-serif',
    ].join(';');

    const btn = (label, title, handler) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.style.cssText = 'padding:2px 8px;cursor:pointer;border:1px solid #ccc;border-radius:3px;background:#fff;font-size:12px;';
      b.addEventListener('click', handler);
      return b;
    };

    bar.appendChild(btn('+Строка', 'Добавить строку', () => this.addRow()));
    bar.appendChild(btn('-Строка', 'Удалить последнюю строку', () => this.removeLastRow()));
    bar.appendChild(btn('+Столбец', 'Добавить столбец', () => this.addColumn()));
    bar.appendChild(btn('-Столбец', 'Удалить последний столбец', () => this.removeLastColumn()));

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    bar.appendChild(spacer);

    bar.appendChild(btn('✓ Применить', 'Сохранить изменения', () => this.commit()));
    bar.appendChild(btn('✕ Отмена',   'Закрыть без сохранения', () => this.close()));

    return bar;
  }

  _buildGrid() {
    // Remove existing grid
    if (this._grid) this._grid.remove();

    const table = document.createElement('table');
    table.className = 'table-editor-grid';
    table.style.cssText = [
      'border-collapse:collapse',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'width:100%',
      'min-width:300px',
    ].join(';');

    this._rows.forEach((row, ri) => {
      const tr = document.createElement('tr');
      (row.cells || []).forEach((cell, ci) => {
        const td = document.createElement('td');
        td.style.cssText = [
          'border:1px solid #BDD7EE',
          'padding:0',
          'min-width:60px',
          'max-width:300px',
          ri === 0 ? 'background:#DEEAF1;font-weight:bold;' : '',
        ].join(';');

        const input = document.createElement('input');
        input.type  = 'text';
        input.value = cell.text || '';
        input.setAttribute('data-row', ri);
        input.setAttribute('data-col', ci);
        input.style.cssText = [
          'width:100%',
          'border:none',
          'outline:none',
          'padding:4px 6px',
          'background:transparent',
          'font-family:inherit',
          'font-size:inherit',
          ri === 0 ? 'font-weight:bold;' : '',
          'box-sizing:border-box',
        ].join(';');

        input.addEventListener('focus', () => {
          this._activeCell = { row: ri, col: ci };
          td.style.outline = '2px solid #0078D4';
        });
        input.addEventListener('blur', () => {
          td.style.outline = '';
          // Sync value back to rows model
          this._rows[ri].cells[ci].text = input.value;
        });

        td.appendChild(input);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    this._grid = table;
    this._overlay.appendChild(table);

    // Focus first cell
    const firstInput = table.querySelector('input');
    if (firstInput) { firstInput.focus(); this._activeCell = { row: 0, col: 0 }; }
  }

  _positionOverlay(bbox) {
    if (!this._overlay || !bbox) return;
    const z = this.zoom;

    // Convert PDF pt (Y up, origin bottom-left) → container px (Y down, origin top-left)
    const left   = bbox.x * z;
    const top    = (this.pageH - bbox.y - bbox.height) * z;

    this._overlay.style.left = `${left}px`;
    this._overlay.style.top  = `${top}px`;
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (!this._overlay) return;

    const inputs = Array.from(this._overlay.querySelectorAll('input'));
    const current = document.activeElement;
    const idx = inputs.indexOf(current);
    if (idx < 0) return;

    const colCount = this._colCount();
    const rowCount = this._rows.length;

    switch (e.key) {
      case 'Tab': {
        e.preventDefault();
        const next = e.shiftKey ? idx - 1 : idx + 1;
        if (next >= 0 && next < inputs.length) inputs[next].focus();
        break;
      }
      case 'Enter': {
        e.preventDefault();
        // Move to the input below (same column, next row)
        const row = Math.floor(idx / colCount);
        const col = idx % colCount;
        const nextRow = row + 1;
        if (nextRow < rowCount) {
          const nextIdx = nextRow * colCount + col;
          if (inputs[nextIdx]) inputs[nextIdx].focus();
        } else {
          this.commit();
        }
        break;
      }
      case 'Escape':
        this.close();
        break;
      case 'ArrowRight':
        if (current.selectionEnd === current.value.length) {
          e.preventDefault();
          if (inputs[idx + 1]) inputs[idx + 1].focus();
        }
        break;
      case 'ArrowLeft':
        if (current.selectionStart === 0) {
          e.preventDefault();
          if (inputs[idx - 1]) inputs[idx - 1].focus();
        }
        break;
      case 'ArrowDown': {
        e.preventDefault();
        const downIdx = idx + colCount;
        if (inputs[downIdx]) inputs[downIdx].focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const upIdx = idx - colCount;
        if (upIdx >= 0 && inputs[upIdx]) inputs[upIdx].focus();
        break;
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _colCount() {
    return this._rows.reduce((max, row) => Math.max(max, (row.cells || []).length), 1);
  }

  _collectRows() {
    // Sync all input values to this._rows before returning
    if (this._grid) {
      const inputs = Array.from(this._grid.querySelectorAll('input'));
      const _colCount = this._colCount();
      for (const input of inputs) {
        const ri = parseInt(input.getAttribute('data-row'), 10);
        const ci = parseInt(input.getAttribute('data-col'), 10);
        if (this._rows[ri] && this._rows[ri].cells[ci]) {
          this._rows[ri].cells[ci].text = input.value;
        }
      }
    }
    return _deepCopyRows(this._rows);
  }

  _emit(event, data) {
    for (const fn of (this._listeners[event] || [])) {
      try { fn(data); } catch (e) { console.error('[table-editor] event error:', e); }
    }
  }
}

// ---------------------------------------------------------------------------
// TableDetector — find table blocks on a rendered canvas (heuristic)
// ---------------------------------------------------------------------------

/**
 * Detect table-like regions on a rendered page canvas by looking for
 * horizontal and vertical line intersections.
 *
 * This is a lightweight client-side detector intended for pages where
 * layout-analyzer.js did not detect a table (e.g. image-based tables in scans).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [opts]
 * @param {number} [opts.minLineLength=40]   px — minimum line length to consider
 * @param {number} [opts.threshold=200]       Luminance threshold for line detection
 * @returns {Array<{x,y,width,height}>}  Bounding boxes in canvas px
 */
export function detectTableRegions(canvas, opts = {}) {
  const minLen   = opts.minLineLength ?? 40;
  const thresh   = opts.threshold ?? 200;

  const ctx  = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  // ── Horizontal line scan ──────────────────────────────────────────────────
  // A horizontal line = a row where many consecutive pixels are dark (lum < thresh)
  const hLines = [];   // { y, x1, x2 }

  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const isDark = x < width && _pixelLum(data, x, y, width) < thresh;
      if (isDark && runStart < 0) {
        runStart = x;
      } else if (!isDark && runStart >= 0) {
        if (x - runStart >= minLen) hLines.push({ y, x1: runStart, x2: x - 1 });
        runStart = -1;
      }
    }
  }

  // ── Vertical line scan ────────────────────────────────────────────────────
  const vLines = [];   // { x, y1, y2 }

  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y <= height; y++) {
      const isDark = y < height && _pixelLum(data, x, y, width) < thresh;
      if (isDark && runStart < 0) {
        runStart = y;
      } else if (!isDark && runStart >= 0) {
        if (y - runStart >= minLen) vLines.push({ x, y1: runStart, y2: y - 1 });
        runStart = -1;
      }
    }
  }

  if (!hLines.length || !vLines.length) return [];

  // ── Group intersecting lines into table bboxes ────────────────────────────
  // Simple approach: cluster horizontal lines by X overlap and vertical lines
  // by Y overlap, then find the bounding box of each cluster.
  const clusters = _clusterLines(hLines, vLines);

  return clusters.map(c => ({
    x: c.left,
    y: c.top,
    width:  c.right  - c.left,
    height: c.bottom - c.top,
  })).filter(r => r.width > minLen && r.height > minLen);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _deepCopyRows(rows) {
  return (rows || []).map(row => ({
    ...row,
    cells: (row.cells || []).map(cell => ({ ...cell, runs: cell.runs ? [...cell.runs] : [] })),
  }));
}

function _pixelLum(data, x, y, width) {
  const i = (y * width + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function _clusterLines(hLines, vLines) {
  // Group h-lines that have similar Y range and overlapping X range
  const TOL = 4; // pixel tolerance for grouping nearby lines
  const clusters = [];

  for (const hl of hLines) {
    let placed = false;
    for (const cl of clusters) {
      if (Math.abs(hl.y - cl.lastHY) <= TOL * 3 &&
          hl.x1 <= cl.right + TOL &&
          hl.x2 >= cl.left  - TOL) {
        cl.top     = Math.min(cl.top,    hl.y);
        cl.bottom  = Math.max(cl.bottom, hl.y);
        cl.left    = Math.min(cl.left,   hl.x1);
        cl.right   = Math.max(cl.right,  hl.x2);
        cl.lastHY  = hl.y;
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ top: hl.y, bottom: hl.y, left: hl.x1, right: hl.x2, lastHY: hl.y });
    }
  }

  // Expand clusters using v-lines that fall within the horizontal span
  for (const vl of vLines) {
    for (const cl of clusters) {
      if (vl.x >= cl.left - TOL && vl.x <= cl.right + TOL) {
        cl.top    = Math.min(cl.top,    vl.y1);
        cl.bottom = Math.max(cl.bottom, vl.y2);
      }
    }
  }

  // Merge overlapping clusters
  const merged = [];
  for (const cl of clusters) {
    let found = false;
    for (const mc of merged) {
      if (cl.left   <= mc.right  + TOL && cl.right  >= mc.left   - TOL &&
          cl.top    <= mc.bottom + TOL && cl.bottom >= mc.top    - TOL) {
        mc.top    = Math.min(mc.top,    cl.top);
        mc.bottom = Math.max(mc.bottom, cl.bottom);
        mc.left   = Math.min(mc.left,   cl.left);
        mc.right  = Math.max(mc.right,  cl.right);
        found = true;
        break;
      }
    }
    if (!found) merged.push({ ...cl });
  }

  return merged;
}
