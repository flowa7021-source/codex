// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Extended Annotations Module
// Professional annotation types: highlight, underline, strikethrough,
// sticky notes, callouts, text boxes, measurement, XFDF export/import
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─────────────────────────────────────────────────────────────────────
// Annotation Types
// ─────────────────────────────────────────────────────────────────────

export const ANNOTATION_TYPES = {
  HIGHLIGHT: 'highlight',
  UNDERLINE: 'underline',
  STRIKETHROUGH: 'strikethrough',
  STICKY_NOTE: 'sticky-note',
  TEXT_BOX: 'text-box',
  CALLOUT: 'callout',
  CLOUD: 'cloud',
  STAMP: 'stamp',
  MEASURE: 'measure',
  LINK: 'link',
  PEN: 'pen',
  RECT: 'rect',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  LINE: 'line',
};

const HIGHLIGHT_COLORS = {
  yellow: { r: 1, g: 0.93, b: 0.2 },
  green: { r: 0.4, g: 0.9, b: 0.4 },
  blue: { r: 0.4, g: 0.7, b: 1 },
  pink: { r: 1, g: 0.6, b: 0.7 },
  orange: { r: 1, g: 0.75, b: 0.3 },
};

// ─────────────────────────────────────────────────────────────────────
// Annotation Manager
// ─────────────────────────────────────────────────────────────────────

export class AnnotationManager {
  constructor() {
    this.annotations = new Map(); // pageNum → Annotation[]
    this._listeners = [];
  }

  /** Add a new annotation */
  add(pageNum, annotation) {
    if (!this.annotations.has(pageNum)) this.annotations.set(pageNum, []);
    const ann = {
      id: crypto.randomUUID(),
      pageNum,
      type: annotation.type,
      bounds: annotation.bounds,   // {x, y, w, h}
      color: annotation.color || '#ffd84d',
      opacity: annotation.opacity ?? 0.4,
      text: annotation.text || '',
      author: annotation.author || 'User',
      timestamp: Date.now(),
      replies: [],
      resolved: false,
      ...annotation,
    };
    this.annotations.get(pageNum).push(ann);
    this._notify('add', ann);
    return ann;
  }

  /** Add a reply to an annotation */
  addReply(annotationId, text, author = 'User') {
    for (const [, anns] of this.annotations) {
      const ann = anns.find(a => a.id === annotationId);
      if (ann) {
        const reply = {
          id: crypto.randomUUID(),
          text,
          author,
          timestamp: Date.now(),
        };
        ann.replies.push(reply);
        this._notify('reply', { annotationId, reply });
        return reply;
      }
    }
    return null;
  }

  /** Resolve/unresolve an annotation */
  toggleResolved(annotationId) {
    for (const [, anns] of this.annotations) {
      const ann = anns.find(a => a.id === annotationId);
      if (ann) {
        ann.resolved = !ann.resolved;
        this._notify('resolve', ann);
        return ann.resolved;
      }
    }
    return null;
  }

  /** Remove an annotation */
  remove(annotationId) {
    for (const [pageNum, anns] of this.annotations) {
      const idx = anns.findIndex(a => a.id === annotationId);
      if (idx !== -1) {
        const [removed] = anns.splice(idx, 1);
        if (anns.length === 0) this.annotations.delete(pageNum);
        this._notify('remove', removed);
        return removed;
      }
    }
    return null;
  }

  /** Get annotations for a page */
  getForPage(pageNum) {
    return this.annotations.get(pageNum) || [];
  }

  /** Get all annotations */
  getAll() {
    const result = [];
    for (const [, anns] of this.annotations) result.push(...anns);
    return result;
  }

  /** Get total count */
  get count() {
    let total = 0;
    for (const anns of this.annotations.values()) total += anns.length;
    return total;
  }

  /** Clear all annotations */
  clearAll() {
    this.annotations.clear();
    this._notify('clear');
  }

  /** Subscribe to changes */
  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  }

  _notify(event, data) {
    for (const fn of this._listeners) fn(event, data);
  }

  // ── Rendering ──

  /** Draw annotations on a canvas context */
  drawOnCanvas(ctx, pageNum, scale = 1) {
    const anns = this.getForPage(pageNum);
    if (!anns.length) return;

    ctx.save();

    for (const ann of anns) {
      const b = ann.bounds;
      if (!b) continue;

      switch (ann.type) {
        case ANNOTATION_TYPES.HIGHLIGHT: {
          ctx.fillStyle = ann.color + '66'; // Semi-transparent
          ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
          break;
        }
        case ANNOTATION_TYPES.UNDERLINE: {
          ctx.strokeStyle = ann.color || '#ff0000';
          ctx.lineWidth = 1.5 * scale;
          const uy = (b.y + b.h) * scale;
          if (ann.squiggly) {
            // Squiggly/wavy underline
            ctx.beginPath();
            const waveH = 2.5 * scale;
            const waveW = 5 * scale;
            const startX = b.x * scale;
            const totalW = b.w * scale;
            for (let wx = 0; wx < totalW; wx += waveW) {
              const py = (Math.floor(wx / waveW) % 2 === 0) ? uy - waveH : uy + waveH;
              if (wx === 0) ctx.moveTo(startX + wx, uy);
              ctx.lineTo(startX + wx + waveW / 2, py);
              ctx.lineTo(startX + Math.min(wx + waveW, totalW), uy);
            }
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(b.x * scale, uy);
            ctx.lineTo((b.x + b.w) * scale, uy);
            ctx.stroke();
          }
          break;
        }
        case ANNOTATION_TYPES.STRIKETHROUGH: {
          ctx.strokeStyle = ann.color || '#ff0000';
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          const midY = (b.y + b.h / 2) * scale;
          ctx.moveTo(b.x * scale, midY);
          ctx.lineTo((b.x + b.w) * scale, midY);
          ctx.stroke();
          break;
        }
        case ANNOTATION_TYPES.STICKY_NOTE: {
          // Draw icon
          const iconSize = 20 * scale;
          ctx.fillStyle = ann.color || '#ffd84d';
          ctx.fillRect(b.x * scale, b.y * scale, iconSize, iconSize);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(b.x * scale, b.y * scale, iconSize, iconSize);
          // Text indicator
          ctx.font = `${10 * scale}px sans-serif`;
          ctx.fillStyle = '#000';
          ctx.fillText('💬', b.x * scale + 3, b.y * scale + iconSize - 4);
          break;
        }
        case ANNOTATION_TYPES.TEXT_BOX: {
          ctx.strokeStyle = ann.color || '#3b82f6';
          ctx.lineWidth = 1.5 * scale;
          ctx.setLineDash([]);
          ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
          ctx.fillStyle = (ann.color || '#3b82f6') + '15';
          ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
          if (ann.text) {
            ctx.font = `${(ann.fontSize || 11) * scale}px sans-serif`;
            ctx.fillStyle = '#000';
            ctx.fillText(ann.text, (b.x + 4) * scale, (b.y + 14) * scale);
          }
          break;
        }
        case ANNOTATION_TYPES.CALLOUT: {
          // Draw text box
          ctx.strokeStyle = ann.color || '#ff6600';
          ctx.lineWidth = 1.5 * scale;
          ctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
          ctx.fillStyle = '#fff';
          ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
          // Draw arrow to target
          if (ann.target) {
            ctx.beginPath();
            ctx.moveTo(b.x * scale, (b.y + b.h / 2) * scale);
            ctx.lineTo(ann.target.x * scale, ann.target.y * scale);
            ctx.stroke();
            // Arrowhead
            const angle = Math.atan2(ann.target.y - (b.y + b.h / 2), ann.target.x - b.x);
            const headLen = 8 * scale;
            ctx.beginPath();
            ctx.moveTo(ann.target.x * scale, ann.target.y * scale);
            ctx.lineTo(ann.target.x * scale - headLen * Math.cos(angle - 0.4), ann.target.y * scale - headLen * Math.sin(angle - 0.4));
            ctx.lineTo(ann.target.x * scale - headLen * Math.cos(angle + 0.4), ann.target.y * scale - headLen * Math.sin(angle + 0.4));
            ctx.closePath();
            ctx.fillStyle = ann.color || '#ff6600';
            ctx.fill();
          }
          if (ann.text) {
            ctx.font = `${10 * scale}px sans-serif`;
            ctx.fillStyle = '#000';
            ctx.fillText(ann.text, (b.x + 4) * scale, (b.y + 14) * scale);
          }
          break;
        }
        case ANNOTATION_TYPES.MEASURE: {
          ctx.strokeStyle = '#e11d48';
          ctx.lineWidth = 1.5 * scale;
          ctx.setLineDash([5 * scale, 3 * scale]);
          ctx.beginPath();
          ctx.moveTo(b.x * scale, b.y * scale);
          ctx.lineTo((b.x + b.w) * scale, (b.y + b.h) * scale);
          ctx.stroke();
          ctx.setLineDash([]);
          // Distance label
          const dist = Math.sqrt(b.w * b.w + b.h * b.h);
          const label = `${dist.toFixed(1)} px`;
          const midX = (b.x + b.w / 2) * scale;
          const midY = (b.y + b.h / 2) * scale;
          ctx.font = `bold ${10 * scale}px sans-serif`;
          ctx.fillStyle = '#e11d48';
          ctx.textAlign = 'center';
          ctx.fillText(label, midX, midY - 6 * scale);
          ctx.textAlign = 'start';
          break;
        }
      }
    }

    ctx.restore();
  }

  // ── PDF Embedding ──

  /** Embed annotations into a PDF using pdf-lib */
  async embedIntoPdf(pdfBytes) {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const [pageNum, anns] of this.annotations) {
      const page = pdfDoc.getPage(pageNum - 1);
      if (!page) continue;
      const { height } = page.getSize();

      for (const ann of anns) {
        const b = ann.bounds;
        if (!b) continue;

        const pdfY = height - b.y - b.h;
        const color = this._parseColor(ann.color);

        switch (ann.type) {
          case ANNOTATION_TYPES.HIGHLIGHT:
            page.drawRectangle({
              x: b.x, y: pdfY, width: b.w, height: b.h,
              color, opacity: 0.35,
            });
            break;

          case ANNOTATION_TYPES.UNDERLINE:
            page.drawLine({
              start: { x: b.x, y: pdfY },
              end: { x: b.x + b.w, y: pdfY },
              thickness: 1.5,
              color,
            });
            break;

          case ANNOTATION_TYPES.STRIKETHROUGH:
            page.drawLine({
              start: { x: b.x, y: pdfY + b.h / 2 },
              end: { x: b.x + b.w, y: pdfY + b.h / 2 },
              thickness: 1.5,
              color,
            });
            break;

          case ANNOTATION_TYPES.TEXT_BOX:
            page.drawRectangle({
              x: b.x, y: pdfY, width: b.w, height: b.h,
              borderColor: color, borderWidth: 1,
              color: rgb(1, 1, 1), opacity: 0.9,
            });
            if (ann.text) {
              page.drawText(ann.text, {
                x: b.x + 4, y: pdfY + b.h - 14,
                size: ann.fontSize || 10, font, color: rgb(0, 0, 0),
              });
            }
            break;

          case ANNOTATION_TYPES.STICKY_NOTE:
            // Draw a small note icon
            page.drawRectangle({
              x: b.x, y: pdfY, width: 18, height: 18,
              color, borderColor: rgb(0, 0, 0), borderWidth: 0.5,
            });
            break;
        }
      }
    }

    return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
  }

  // ── XFDF Export/Import ──

  /** Export annotations as XFDF (standard Adobe format) */
  exportAsXFDF(pdfFileName = 'document.pdf') {
    const anns = this.getAll();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n`;
    xml += `  <annots>\n`;

    for (const ann of anns) {
      const b = ann.bounds || {};
      const rect = `${b.x || 0},${b.y || 0},${(b.x || 0) + (b.w || 0)},${(b.y || 0) + (b.h || 0)}`;
      const date = new Date(ann.timestamp).toISOString();

      switch (ann.type) {
        case ANNOTATION_TYPES.HIGHLIGHT:
          xml += `    <highlight page="${ann.pageNum - 1}" rect="${rect}" color="${ann.color}" date="${date}" name="${ann.id}">\n`;
          if (ann.text) xml += `      <contents>${this._escapeXml(ann.text)}</contents>\n`;
          xml += `    </highlight>\n`;
          break;
        case ANNOTATION_TYPES.UNDERLINE:
          xml += `    <underline page="${ann.pageNum - 1}" rect="${rect}" color="${ann.color}" date="${date}" name="${ann.id}" />\n`;
          break;
        case ANNOTATION_TYPES.STRIKETHROUGH:
          xml += `    <strikeout page="${ann.pageNum - 1}" rect="${rect}" color="${ann.color}" date="${date}" name="${ann.id}" />\n`;
          break;
        case ANNOTATION_TYPES.STICKY_NOTE:
          xml += `    <text page="${ann.pageNum - 1}" rect="${rect}" color="${ann.color}" date="${date}" name="${ann.id}" icon="Comment">\n`;
          xml += `      <contents>${this._escapeXml(ann.text)}</contents>\n`;
          xml += `    </text>\n`;
          break;
        case ANNOTATION_TYPES.TEXT_BOX:
          xml += `    <freetext page="${ann.pageNum - 1}" rect="${rect}" color="${ann.color}" date="${date}" name="${ann.id}">\n`;
          xml += `      <contents>${this._escapeXml(ann.text)}</contents>\n`;
          xml += `    </freetext>\n`;
          break;
        default:
          xml += `    <square page="${ann.pageNum - 1}" rect="${rect}" color="${ann.color}" date="${date}" name="${ann.id}" />\n`;
      }
    }

    xml += `  </annots>\n`;
    xml += `  <f href="${this._escapeXml(pdfFileName)}" />\n`;
    xml += `</xfdf>\n`;

    return xml;
  }

  /** Import annotations from XFDF XML string */
  importFromXFDF(xfdfString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xfdfString, 'text/xml');
    const annots = doc.querySelector('annots');
    if (!annots) return 0;

    let imported = 0;
    const typeMap = {
      highlight: ANNOTATION_TYPES.HIGHLIGHT,
      underline: ANNOTATION_TYPES.UNDERLINE,
      strikeout: ANNOTATION_TYPES.STRIKETHROUGH,
      text: ANNOTATION_TYPES.STICKY_NOTE,
      freetext: ANNOTATION_TYPES.TEXT_BOX,
      square: ANNOTATION_TYPES.RECT,
      circle: ANNOTATION_TYPES.CIRCLE,
      line: ANNOTATION_TYPES.LINE,
    };

    for (const child of annots.children) {
      const tag = child.tagName.toLowerCase();
      const type = typeMap[tag];
      if (!type) continue;

      const pageNum = parseInt(child.getAttribute('page') || '0', 10) + 1;
      const rect = (child.getAttribute('rect') || '0,0,0,0').split(',').map(Number);
      const color = child.getAttribute('color') || '#ffd84d';
      const contents = child.querySelector('contents')?.textContent || '';

      this.add(pageNum, {
        type,
        bounds: { x: rect[0], y: rect[1], w: rect[2] - rect[0], h: rect[3] - rect[1] },
        color,
        text: contents,
      });
      imported++;
    }

    return imported;
  }

  // ── Serialization ──

  /** Export all annotations as JSON */
  toJSON() {
    const result = {};
    for (const [pageNum, anns] of this.annotations) {
      result[pageNum] = anns;
    }
    return result;
  }

  /** Import annotations from JSON */
  fromJSON(data) {
    this.clearAll();
    for (const [pageNum, anns] of Object.entries(data)) {
      for (const ann of anns) {
        this.add(Number(pageNum), ann);
      }
    }
  }

  // ── Helpers ──

  _parseColor(colorStr) {
    if (!colorStr) return rgb(1, 0.85, 0.3);
    if (colorStr.startsWith('#')) {
      const r = parseInt(colorStr.slice(1, 3), 16) / 255;
      const g = parseInt(colorStr.slice(3, 5), 16) / 255;
      const b = parseInt(colorStr.slice(5, 7), 16) / 255;
      return rgb(r, g, b);
    }
    const named = HIGHLIGHT_COLORS[colorStr];
    if (named) return rgb(named.r, named.g, named.b);
    return rgb(1, 0.85, 0.3);
  }

  _escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const annotationManager = new AnnotationManager();
export { HIGHLIGHT_COLORS };
