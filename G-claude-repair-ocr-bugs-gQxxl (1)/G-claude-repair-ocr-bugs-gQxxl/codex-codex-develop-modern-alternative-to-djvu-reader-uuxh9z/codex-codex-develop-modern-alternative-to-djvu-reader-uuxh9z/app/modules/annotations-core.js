// ─── Annotations Core ───────────────────────────────────────────────────────
// Centralized annotation management: strokes, comments, rendering, I/O.

/**
 * @typedef {object} Stroke
 * @property {string} tool - 'pen' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'oval' | 'arrow'
 * @property {string} color
 * @property {number} width
 * @property {number} opacity
 * @property {Array<[number, number]>} points
 * @property {number} [timestamp]
 */

/**
 * @typedef {object} Comment
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {string} [author]
 * @property {number} timestamp
 * @property {boolean} resolved
 * @property {Array<{text: string, author: string, timestamp: number}>} replies
 */

export class AnnotationController {
  /**
   * @param {object} options
   * @param {Function} options.loadStrokes - (docName, page) => Stroke[]
   * @param {Function} options.saveStrokes - (docName, page, strokes) => void
   * @param {Function} options.loadComments - (docName, page) => Comment[]
   * @param {Function} options.saveComments - (docName, page, comments) => void
   */
  constructor(options) {
    this.loadStrokesFn = options.loadStrokes;
    this.saveStrokesFn = options.saveStrokes;
    this.loadCommentsFn = options.loadComments;
    this.saveCommentsFn = options.saveComments;

    /** @type {Map<number, Stroke[]>} */
    this.strokes = new Map();
    /** @type {Map<number, Comment[]>} */
    this.comments = new Map();

    this.docName = '';
    this._listeners = new Set();
  }

  /**
   * Set the active document.
   * @param {string} docName
   */
  setDocument(docName) {
    this.docName = docName;
    this.strokes.clear();
    this.comments.clear();
  }

  /**
   * Get strokes for a page (lazy-loaded).
   * @param {number} page
   * @returns {Stroke[]}
   */
  getStrokes(page) {
    if (!this.strokes.has(page)) {
      const loaded = this.loadStrokesFn(this.docName, page);
      this.strokes.set(page, loaded || []);
    }
    return this.strokes.get(page);
  }

  /**
   * Add a stroke to a page.
   * @param {number} page
   * @param {Stroke} stroke
   */
  addStroke(page, stroke) {
    const strokes = this.getStrokes(page);
    stroke.timestamp = stroke.timestamp || Date.now();
    strokes.push(stroke);
    this.saveStrokesFn(this.docName, page, strokes);
    this._notify('stroke-added', { page, stroke });
  }

  /**
   * Remove last stroke from a page (undo).
   * @param {number} page
   * @returns {Stroke|null}
   */
  undoStroke(page) {
    const strokes = this.getStrokes(page);
    const removed = strokes.pop();
    if (removed) {
      this.saveStrokesFn(this.docName, page, strokes);
      this._notify('stroke-removed', { page, stroke: removed });
    }
    return removed || null;
  }

  /**
   * Clear all strokes on a page.
   * @param {number} page
   */
  clearStrokes(page) {
    this.strokes.set(page, []);
    this.saveStrokesFn(this.docName, page, []);
    this._notify('strokes-cleared', { page });
  }

  /**
   * Get comments for a page.
   * @param {number} page
   * @returns {Comment[]}
   */
  getComments(page) {
    if (!this.comments.has(page)) {
      const loaded = this.loadCommentsFn(this.docName, page);
      this.comments.set(page, loaded || []);
    }
    return this.comments.get(page);
  }

  /**
   * Add a comment to a page.
   * @param {number} page
   * @param {Partial<Comment>} comment
   * @returns {Comment}
   */
  addComment(page, comment) {
    const comments = this.getComments(page);
    const full = {
      id: comment.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: comment.x || 0,
      y: comment.y || 0,
      text: comment.text || '',
      author: comment.author || '',
      timestamp: Date.now(),
      resolved: false,
      replies: [],
      ...comment,
    };
    comments.push(full);
    this.saveCommentsFn(this.docName, page, comments);
    this._notify('comment-added', { page, comment: full });
    return full;
  }

  /**
   * Reply to a comment.
   * @param {number} page
   * @param {string} commentId
   * @param {string} text
   * @param {string} [author]
   */
  replyToComment(page, commentId, text, author = '') {
    const comments = this.getComments(page);
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      comment.replies.push({ text, author, timestamp: Date.now() });
      this.saveCommentsFn(this.docName, page, comments);
      this._notify('comment-reply', { page, commentId, text });
    }
  }

  /**
   * Resolve/unresolve a comment.
   * @param {number} page
   * @param {string} commentId
   */
  toggleResolve(page, commentId) {
    const comments = this.getComments(page);
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = !comment.resolved;
      this.saveCommentsFn(this.docName, page, comments);
      this._notify('comment-resolved', { page, commentId, resolved: comment.resolved });
    }
  }

  /**
   * Delete a comment.
   * @param {number} page
   * @param {string} commentId
   */
  deleteComment(page, commentId) {
    const comments = this.getComments(page);
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx !== -1) {
      comments.splice(idx, 1);
      this.saveCommentsFn(this.docName, page, comments);
      this._notify('comment-deleted', { page, commentId });
    }
  }

  /**
   * Render strokes on a canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} page
   * @param {number} [scale=1]
   */
  renderStrokes(ctx, page, scale = 1) {
    const strokes = this.getStrokes(page);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;

      ctx.save();
      ctx.globalAlpha = stroke.opacity ?? 1;
      ctx.strokeStyle = stroke.color || '#000';
      ctx.lineWidth = (stroke.width || 2) * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = (stroke.width || 20) * scale;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0] * scale, stroke.points[0][1] * scale);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0] * scale, stroke.points[i][1] * scale);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Export all annotations for the current document.
   * @param {number} pageCount
   * @returns {object}
   */
  exportAll(pageCount) {
    const data = { strokes: {}, comments: {} };
    for (let p = 1; p <= pageCount; p++) {
      const strokes = this.getStrokes(p);
      if (strokes.length) data.strokes[p] = strokes;
      const comments = this.getComments(p);
      if (comments.length) data.comments[p] = comments;
    }
    return data;
  }

  /**
   * Import annotations.
   * @param {object} data - { strokes: {page: Stroke[]}, comments: {page: Comment[]} }
   */
  importAll(data) {
    if (data.strokes) {
      for (const [page, strokes] of Object.entries(data.strokes)) {
        const p = parseInt(page);
        this.strokes.set(p, strokes);
        this.saveStrokesFn(this.docName, p, strokes);
      }
    }
    if (data.comments) {
      for (const [page, comments] of Object.entries(data.comments)) {
        const p = parseInt(page);
        this.comments.set(p, comments);
        this.saveCommentsFn(this.docName, p, comments);
      }
    }
    this._notify('import-complete', {});
  }

  /**
   * Subscribe to annotation events.
   * @param {Function} listener - (eventType, data) => void
   * @returns {Function} unsubscribe
   */
  on(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** @private */
  _notify(type, data) {
    for (const fn of this._listeners) {
      try { fn(type, data); } catch (err) { console.warn('[annotations-core] error:', err?.message); }
    }
  }
}
