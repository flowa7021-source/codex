// ─── Annotation Controller ──────────────────────────────────────────────────
// Drawing, annotation storage, comment management, and annotation import/export.
// Extracted from app.js as part of module decomposition.

import { state, hotkeys, els } from './state.js';
import { annotationManager, ANNOTATION_TYPES } from './pdf-annotations-pro.js';
import { ToolMode, toolStateMachine } from './tool-modes.js';

// ─── Module-local caches ────────────────────────────────────────────────────
const _strokesCache = new Map();
const _commentsCache = new Map();

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  renderDocStats: () => {},
  renderReadingGoalStatus: () => {},
  renderEtaStatus: () => {},
  setOcrStatus: () => {},
  runOcrOnRect: async () => {},
  drawOcrSelectionPreview: () => {},
  nrPrompt: async () => null,
  toastError: () => {},
};

/**
 * Inject runtime dependencies that live in app.js.
 * Must be called once during startup before any annotation functions are used.
 */
export function initAnnotationControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Annotation Key Helpers ─────────────────────────────────────────────────

export function annotationKey(page) {
  return `novareader-annotations:${state.docName || 'global'}:${page}`;
}

export function commentKey(page) {
  return `novareader-comments:${state.docName || 'global'}:${page}`;
}

export function invalidateAnnotationCaches() {
  _strokesCache.clear();
  _commentsCache.clear();
}

export function getCurrentAnnotationCtx() {
  const ctx = els.annotationCanvas.getContext('2d');
  if (!ctx) return null;
  return ctx;
}

/**
 * Returns the DPR scale factor used for the annotation canvas.
 * Annotation canvas is sized at displayWidth*dpr x displayHeight*dpr
 * while CSS size is displayWidth x displayHeight.
 */
export function getAnnotationDpr() {
  return Math.max(1, window.devicePixelRatio || 1);
}

export function loadStrokes(page = state.currentPage) {
  if (_strokesCache.has(page)) return _strokesCache.get(page);
  const data = JSON.parse(localStorage.getItem(annotationKey(page)) || '[]');
  _strokesCache.set(page, data);
  return data;
}

export function saveStrokes(strokes, page = state.currentPage) {
  _strokesCache.set(page, strokes);
  localStorage.setItem(annotationKey(page), JSON.stringify(strokes));
  _deps.renderDocStats();
  _deps.renderReadingGoalStatus();
  _deps.renderEtaStatus();
}

export function loadComments(page = state.currentPage) {
  if (_commentsCache.has(page)) return _commentsCache.get(page);
  const data = JSON.parse(localStorage.getItem(commentKey(page)) || '[]');
  _commentsCache.set(page, data);
  return data;
}

export function saveComments(comments, page = state.currentPage) {
  _commentsCache.set(page, comments);
  localStorage.setItem(commentKey(page), JSON.stringify(comments));
  _deps.renderDocStats();
  _deps.renderEtaStatus();
}

export function clearDocumentCommentStorage() {
  if (!state.pageCount) return;
  for (let page = 1; page <= state.pageCount; page += 1) {
    localStorage.removeItem(commentKey(page));
  }
}

export function renderCommentList() {
  const comments = loadComments();
  els.commentList.innerHTML = '';

  if (!comments.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Нет комментариев';
    els.commentList.appendChild(li);
    return;
  }

  comments.forEach((comment, idx) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const text = document.createElement('div');
    text.textContent = `${idx + 1}. ${comment.text}`;
    li.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.addEventListener('click', () => {
      const next = loadComments().filter((_, i) => i !== idx);
      saveComments(next);
      renderAnnotations();
      renderCommentList();
    });

    actions.appendChild(del);
    li.appendChild(actions);
    els.commentList.appendChild(li);
  });
}

export function clearDocumentAnnotationStorage() {
  if (!state.pageCount) return;
  for (let page = 1; page <= state.pageCount; page += 1) {
    localStorage.removeItem(annotationKey(page));
  }
}

export function updateOverlayInteractionState() {
  const enabled = !!(state.drawEnabled || state.ocrRegionMode);
  if (els.annotationCanvas) els.annotationCanvas.classList.toggle('drawing-enabled', enabled);
}

export function setDrawMode(enabled) {
  if (enabled) {
    toolStateMachine.transition(ToolMode.ANNOTATE);
  } else if (toolStateMachine.current === ToolMode.ANNOTATE) {
    toolStateMachine.transition(ToolMode.IDLE);
  }
  state.drawEnabled = enabled;
  updateOverlayInteractionState();
  if (els.annotateToggle) {
    els.annotateToggle.textContent = `✎ ${enabled ? 'on' : 'off'}`;
    els.annotateToggle.classList.toggle('active', enabled);
  }
}

// ─── Drawing Functions ──────────────────────────────────────────────────────

export function normalizePoint(x, y) {
  return {
    x: x / Math.max(1, els.annotationCanvas.width),
    y: y / Math.max(1, els.annotationCanvas.height),
  };
}

export function denormalizePoint(point) {
  return {
    x: point.x * els.annotationCanvas.width,
    y: point.y * els.annotationCanvas.height,
  };
}

export function applyStrokeStyle(ctx, stroke) {
  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * 2;
  } else if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.size * 2;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function drawStroke(ctx, stroke) {
  if (!stroke.points?.length) return;
  ctx.save();
  applyStrokeStyle(ctx, stroke);

  const start = denormalizePoint(stroke.points[0]);

  if (stroke.tool === 'rect') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'arrow') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const headLen = Math.max(10, stroke.size * 2);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(end.x, end.y);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'line') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'circle') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      const r = Math.max(rx, ry);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Text highlight preview (semi-transparent rect)
  if (stroke.tool === 'text-highlight') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = stroke.color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    return;
  }

  // Underline preview
  if (stroke.tool === 'text-underline') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.max(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Strikethrough preview
  if (stroke.tool === 'text-strikethrough') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const midY = (start.y + end.y) / 2;
    const w = Math.abs(end.x - start.x);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, midY);
    ctx.lineTo(x + w, midY);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Squiggly underline preview
  if (stroke.tool === 'text-squiggly') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.max(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const waveH = 3;
    const waveW = 6;
    for (let wx = 0; wx < w; wx += waveW) {
      const py = (Math.floor(wx / waveW) % 2 === 0) ? y - waveH : y + waveH;
      if (wx === 0) ctx.moveTo(x + wx, y);
      ctx.lineTo(x + wx + waveW / 2, py);
      ctx.lineTo(x + Math.min(wx + waveW, w), y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Text box preview (bordered rect with optional text)
  if (stroke.tool === 'text-box') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const p = denormalizePoint(stroke.points[i]);
    ctx.lineTo(p.x, p.y);
  }

  if (stroke.points.length === 1) {
    ctx.lineTo(start.x + 0.1, start.y + 0.1);
  }

  ctx.stroke();
  ctx.restore();
}

export function renderAnnotations() {
  const ctx = getCurrentAnnotationCtx();
  const adpr = getAnnotationDpr();
  ctx.clearRect(0, 0, els.annotationCanvas.width, els.annotationCanvas.height);

  // Scale context to match HiDPI annotation canvas
  ctx.save();
  ctx.scale(adpr, adpr);

  const strokes = loadStrokes();
  const comments = loadComments();

  strokes.forEach((stroke) => drawStroke(ctx, stroke));

  comments.forEach((comment, idx) => {
    const p = denormalizePoint(comment.point);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d6fe9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), p.x, p.y);
    ctx.restore();
  });

  // Render pro annotations (highlight, underline, sticky notes, etc.)
  annotationManager.drawOnCanvas(ctx, state.currentPage);

  if (state.ocrSelection) _deps.drawOcrSelectionPreview();

  ctx.restore(); // undo DPR scale

  const proCount = annotationManager.getForPage(state.currentPage).length;
  els.annStats.textContent = `Штрихов: ${strokes.length} • Комментариев: ${comments.length}${proCount ? ` • Аннотаций: ${proCount}` : ''}`;
}

/**
 * Apply text markup (highlight/underline/strikethrough) from text selection.
 * Gets bounding rects of the selection within the text layer and creates annotations.
 */
export function _applyTextMarkupFromSelection(selection, toolValue) {
  const typeMap = {
    'text-highlight': ANNOTATION_TYPES.HIGHLIGHT,
    'text-underline': ANNOTATION_TYPES.UNDERLINE,
    'text-strikethrough': ANNOTATION_TYPES.STRIKETHROUGH,
    'text-squiggly': ANNOTATION_TYPES.UNDERLINE,
  };
  const type = typeMap[toolValue];
  if (!type) return;

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  if (!rects.length) return;

  const containerRect = els.textLayerDiv.getBoundingClientRect();
  const color = els.drawColor?.value || '#ffd84d';

  for (const rect of rects) {
    if (rect.width < 2 || rect.height < 2) continue;
    const bounds = {
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      w: rect.width,
      h: rect.height,
    };
    annotationManager.add(state.currentPage, {
      type,
      bounds,
      color,
      squiggly: toolValue === 'text-squiggly',
    });
  }
  renderAnnotations();
}

export function getCanvasPointFromEvent(e) {
  const rect = els.annotationCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * els.annotationCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * els.annotationCanvas.height;
  return { x, y };
}

export async function beginStroke(e) {
  if (!state.adapter) return;

  if (state.ocrRegionMode) {
    const p = getCanvasPointFromEvent(e);
    const point = normalizePoint(p.x, p.y);
    state.isSelectingOcr = true;
    state.ocrSelection = { start: point, end: point };
    renderAnnotations();
    return;
  }

  if (!state.drawEnabled) return;
  const p = getCanvasPointFromEvent(e);
  const point = normalizePoint(p.x, p.y);

  if (els.drawTool.value === 'comment') {
    const text = await _deps.nrPrompt('Текст комментария:');
    if (!text) return;
    const comments = loadComments();
    comments.push({ point, text: text.trim() });
    saveComments(comments);
    renderAnnotations();
    renderCommentList();
    return;
  }

  // Sticky note: click to place, prompt for text
  if (els.drawTool.value === 'sticky-note') {
    const text = await _deps.nrPrompt('Текст заметки:');
    if (!text) return;
    annotationManager.add(state.currentPage, {
      type: ANNOTATION_TYPES.STICKY_NOTE,
      bounds: { x: p.x, y: p.y, w: 20, h: 20 },
      color: els.drawColor.value,
      text: text.trim(),
    });
    renderAnnotations();
    return;
  }

  // Text-based markup tools: apply to text selection if any, else use region drag
  const textMarkupTools = ['text-highlight', 'text-underline', 'text-strikethrough', 'text-squiggly'];
  if (textMarkupTools.includes(els.drawTool.value)) {
    // Check if there's a text selection in the text layer
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && els.textLayerDiv?.contains(sel.anchorNode)) {
      _applyTextMarkupFromSelection(sel, els.drawTool.value);
      sel.removeAllRanges();
      return;
    }
    // No text selected — fall through to rect-drag mode for manual region markup
  }

  if (!els.drawTool || !els.drawColor || !els.drawSize) return;
  state.isDrawing = true;
  const toolValue = els.drawTool.value;
  const shapeTool = ['rect', 'arrow', 'line', 'circle', 'text-box',
    'text-highlight', 'text-underline', 'text-strikethrough', 'text-squiggly'].includes(toolValue);
  state.currentStroke = {
    tool: toolValue,
    color: els.drawColor.value,
    size: Number(els.drawSize.value),
    points: shapeTool ? [point, point] : [point],
  };
  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

export function moveStroke(e) {
  if (state.ocrRegionMode && state.isSelectingOcr && state.ocrSelection) {
    const p = getCanvasPointFromEvent(e);
    state.ocrSelection.end = normalizePoint(p.x, p.y);
    renderAnnotations();
    return;
  }

  if (!state.isDrawing || !state.currentStroke) return;
  const p = getCanvasPointFromEvent(e);
  const point = normalizePoint(p.x, p.y);

  if (['rect', 'arrow', 'line', 'circle', 'text-box',
    'text-highlight', 'text-underline', 'text-strikethrough', 'text-squiggly'].includes(state.currentStroke.tool)) {
    state.currentStroke.points[1] = point;
  } else {
    state.currentStroke.points.push(point);
  }

  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

export async function endStroke() {
  if (state.ocrRegionMode && state.isSelectingOcr && state.ocrSelection) {
    state.isSelectingOcr = false;
    const s = state.ocrSelection.start;
    const e2 = state.ocrSelection.end;
    const rect = {
      x: Math.min(s.x, e2.x) * els.canvas.width,
      y: Math.min(s.y, e2.y) * els.canvas.height,
      w: Math.abs(e2.x - s.x) * els.canvas.width,
      h: Math.abs(e2.y - s.y) * els.canvas.height,
    };
    const minW = Math.max(8, Number(state.settings?.ocrMinW) || 24);
    const minH = Math.max(8, Number(state.settings?.ocrMinH) || 24);
    if (rect.w > minW && rect.h > minH) {
      await _deps.runOcrOnRect(rect, 'region');
    } else {
      _deps.setOcrStatus(`OCR: область меньше порога ${minW}x${minH}`);
    }
    state.ocrSelection = null;
    renderAnnotations();
    return;
  }

  if (!state.isDrawing || !state.currentStroke) return;

  const tool = state.currentStroke.tool;

  // Pro annotation tools — save to annotationManager instead of strokes
  const proToolMap = {
    'text-highlight': ANNOTATION_TYPES.HIGHLIGHT,
    'text-underline': ANNOTATION_TYPES.UNDERLINE,
    'text-strikethrough': ANNOTATION_TYPES.STRIKETHROUGH,
    'text-squiggly': ANNOTATION_TYPES.UNDERLINE, // rendered with squiggly style
    'text-box': ANNOTATION_TYPES.TEXT_BOX,
  };

  if (proToolMap[tool]) {
    const pts = state.currentStroke.points;
    if (pts.length >= 2) {
      const p0 = pts[0];
      const p1 = pts[1];
      const bounds = {
        x: Math.min(p0.x, p1.x) * els.annotationCanvas.width / getAnnotationDpr(),
        y: Math.min(p0.y, p1.y) * els.annotationCanvas.height / getAnnotationDpr(),
        w: Math.abs(p1.x - p0.x) * els.annotationCanvas.width / getAnnotationDpr(),
        h: Math.abs(p1.y - p0.y) * els.annotationCanvas.height / getAnnotationDpr(),
      };
      if (bounds.w > 4 && bounds.h > 2) {
        const annData = {
          type: proToolMap[tool],
          bounds,
          color: state.currentStroke.color,
          squiggly: tool === 'text-squiggly',
        };
        if (tool === 'text-box') {
          // Prompt for text asynchronously
          state.isDrawing = false;
          state.currentStroke = null;
          const text = await _deps.nrPrompt('Текст:');
          if (text) {
            annData.text = text.trim();
            annotationManager.add(state.currentPage, annData);
          }
          renderAnnotations();
          return;
        }
        annotationManager.add(state.currentPage, annData);
      }
    }
    state.isDrawing = false;
    state.currentStroke = null;
    renderAnnotations();
    return;
  }

  const strokes = loadStrokes();
  strokes.push(state.currentStroke);
  saveStrokes(strokes);
  state.isDrawing = false;
  state.currentStroke = null;
  renderAnnotations();
}

export function undoStroke() {
  // Try undoing pro annotations first (most recent)
  const proAnns = annotationManager.getForPage(state.currentPage);
  if (proAnns.length) {
    const last = proAnns[proAnns.length - 1];
    annotationManager.remove(last.id);
    renderAnnotations();
    return;
  }
  const strokes = loadStrokes();
  if (!strokes.length) return;
  strokes.pop();
  saveStrokes(strokes);
  renderAnnotations();
}

export function clearStrokes() {
  saveStrokes([]);
  // Also clear pro annotations for current page
  const proAnns = annotationManager.getForPage(state.currentPage);
  for (const ann of [...proAnns]) annotationManager.remove(ann.id);
  renderAnnotations();
}

export function clearComments() {
  saveComments([]);
  renderAnnotations();
  renderCommentList();
}

export function exportAnnotatedPng() {
  if (!state.adapter) return;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = els.canvas.width;
  exportCanvas.height = els.canvas.height;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(els.canvas, 0, 0);
  ctx.drawImage(els.annotationCanvas, 0, 0, els.annotationCanvas.width, els.annotationCanvas.height, 0, 0, els.canvas.width, els.canvas.height);
  const url = exportCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotated.png`;
  a.click();
}

export function exportAnnotationsJson() {
  if (!state.adapter) return;
  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    page: state.currentPage,
    strokes: loadStrokes(),
    comments: loadComments(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAnnotationsJson(file) {
  if (!state.adapter || !file) return;

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.strokes)) {
      throw new Error('bad payload');
    }

    const normalized = payload.strokes.filter((stroke) => (
      stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
      && typeof stroke.size === 'number'
      && Array.isArray(stroke.points)
    ));

    const comments = Array.isArray(payload.comments) ? payload.comments.filter((x) => x && x.point && typeof x.text === 'string') : [];
    saveStrokes(normalized);
    saveComments(comments);
    renderAnnotations();
    renderCommentList();
  } catch (err) {
    console.warn('[annotation-controller] error:', err?.message);
    _deps.toastError('Не удалось импортировать JSON аннотаций. Проверьте формат файла.');
  }
}

export function showShortcutsHelp() {
  // Use the new shortcuts modal if available, else fallback
  if (window._novaShortcuts?.openShortcuts) {
    window._novaShortcuts.openShortcuts();
    return;
  }
  // Fallback: create inline modal
  const lines = [
    `След. страница — ${hotkeys.next}`,
    `Пред. страница — ${hotkeys.prev}`,
    `Zoom + — ${hotkeys.zoomIn}`,
    `Zoom − — ${hotkeys.zoomOut}`,
    `По ширине — ${hotkeys.fitWidth}`,
    `По странице — ${hotkeys.fitPage}`,
    `Фокус поиска — ${hotkeys.searchFocus}`,
    `OCR страницы — ${hotkeys.ocrPage}`,
    'Ctrl+P — печать',
    'Ctrl+Shift+O — оптимизация PDF',
    'Ctrl+Shift+A — доступность',
    'Ctrl+Shift+R — редактирование ПД',
    'Ctrl+Shift+C — сравнение документов',
    'Ctrl+Shift+B — пакетное OCR',
    '? — это окно',
  ];
  const overlay = document.createElement('div');
  overlay.className = 'modal open';
  overlay.innerHTML = `<div class="modal-card">
    <div class="modal-head"><h3>Горячие клавиши</h3><button id="closeShortcutsHelp">✕</button></div>
    <div class="modal-body"><pre style="margin:0;font-size:0.82rem;white-space:pre-wrap;color:var(--text)">${lines.join('\n')}</pre></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); };
  overlay.querySelector('#closeShortcutsHelp').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

export function exportAnnotationBundleJson() {
  if (!state.adapter) return;
  const pages = {};
  for (let page = 1; page <= state.pageCount; page += 1) {
    const strokes = loadStrokes(page);
    const comments = loadComments(page);
    if (strokes.length || comments.length) {
      pages[String(page)] = { strokes, comments };
    }
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    pageCount: state.pageCount,
    pages,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-annotations-bundle.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAnnotationBundleJson(file) {
  if (!state.adapter || !file) return;
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    if (!payload || typeof payload.pages !== 'object') {
      throw new Error('bad bundle');
    }

    clearDocumentAnnotationStorage();
    clearDocumentCommentStorage();

    Object.entries(payload.pages).forEach(([pageRaw, entry]) => {
      const page = Number.parseInt(pageRaw, 10);
      const strokes = Array.isArray(entry) ? entry : entry?.strokes;
      const comments = Array.isArray(entry?.comments) ? entry.comments : [];
      if (!Number.isInteger(page) || page < 1 || page > state.pageCount || !Array.isArray(strokes)) {
        return;
      }
      const normalized = strokes.filter((stroke) => (
        stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
        && typeof stroke.size === 'number'
        && Array.isArray(stroke.points)
      ));
      const normalizedComments = comments.filter((x) => x && x.point && typeof x.text === 'string');
      saveStrokes(normalized, page);
      saveComments(normalizedComments, page);
    });

    renderAnnotations();
    renderCommentList();
  } catch (err) {
    console.warn('[annotation-controller] error:', err?.message);
    _deps.toastError('Не удалось импортировать bundle JSON аннотаций. Проверьте формат файла.');
  }
}
