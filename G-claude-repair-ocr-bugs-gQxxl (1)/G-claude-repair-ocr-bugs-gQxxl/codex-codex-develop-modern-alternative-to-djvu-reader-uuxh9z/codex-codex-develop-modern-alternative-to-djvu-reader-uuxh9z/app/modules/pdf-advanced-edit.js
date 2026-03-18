// ─── Advanced PDF Editing Module ─────────────────────────────────────────────
// Block repositioning, text block management, layout editing capabilities

export class PdfBlockEditor {
  constructor() {
    this.blocks = new Map(); // pageNum -> [{id, type, x, y, width, height, content, style}]
    this.selectedBlock = null;
    this.dragState = null;
    this.resizeState = null;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.listeners = [];
    this.snapEnabled = true;
    this.snapThreshold = 8; // px
    this.showGuides = true;
    this._guides = []; // active snap guides [{axis:'x'|'y', pos: number}]
  }

  getPageBlocks(pageNum) {
    if (!this.blocks.has(pageNum)) {
      this.blocks.set(pageNum, []);
    }
    return this.blocks.get(pageNum);
  }

  addTextBlock(pageNum, x, y, content, style = {}) {
    const block = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      x, y,
      width: style.width || 200,
      height: style.height || 40,
      content,
      style: {
        fontSize: style.fontSize || 14,
        fontFamily: style.fontFamily || 'sans-serif',
        color: style.color || '#000000',
        backgroundColor: style.backgroundColor || 'transparent',
        bold: style.bold || false,
        italic: style.italic || false,
        align: style.align || 'left',
      },
    };
    this._pushUndo(pageNum);
    this.getPageBlocks(pageNum).push(block);
    this._notify('add', pageNum, block);
    return block;
  }

  addImageBlock(pageNum, x, y, imageDataUrl, width, height) {
    const block = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'image',
      x, y, width, height,
      content: imageDataUrl,
      style: {},
    };
    this._pushUndo(pageNum);
    this.getPageBlocks(pageNum).push(block);
    this._notify('add', pageNum, block);
    return block;
  }

  moveBlock(pageNum, blockId, newX, newY) {
    const blocks = this.getPageBlocks(pageNum);
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    this._pushUndo(pageNum);
    block.x = newX;
    block.y = newY;
    this._notify('move', pageNum, block);
  }

  resizeBlock(pageNum, blockId, newWidth, newHeight) {
    const blocks = this.getPageBlocks(pageNum);
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    this._pushUndo(pageNum);
    block.width = Math.max(20, newWidth);
    block.height = Math.max(10, newHeight);
    this._notify('resize', pageNum, block);
  }

  updateBlockContent(pageNum, blockId, content) {
    const blocks = this.getPageBlocks(pageNum);
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    this._pushUndo(pageNum);
    block.content = content;
    this._notify('update', pageNum, block);
  }

  updateBlockStyle(pageNum, blockId, styleUpdates) {
    const blocks = this.getPageBlocks(pageNum);
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    this._pushUndo(pageNum);
    Object.assign(block.style, styleUpdates);
    this._notify('style', pageNum, block);
  }

  deleteBlock(pageNum, blockId) {
    const blocks = this.getPageBlocks(pageNum);
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    this._pushUndo(pageNum);
    const [removed] = blocks.splice(idx, 1);
    if (this.selectedBlock?.id === blockId) this.selectedBlock = null;
    this._notify('delete', pageNum, removed);
  }

  selectBlock(block) {
    this.selectedBlock = block;
    this._notify('select', null, block);
  }

  deselectAll() {
    this.selectedBlock = null;
    this._notify('deselect', null, null);
  }

  hitTest(pageNum, x, y) {
    const blocks = this.getPageBlocks(pageNum);
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return b;
      }
    }
    return null;
  }

  hitTestResizeHandle(pageNum, x, y, handleSize = 8) {
    const blocks = this.getPageBlocks(pageNum);
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      const rx = b.x + b.width;
      const ry = b.y + b.height;
      if (x >= rx - handleSize && x <= rx + handleSize && y >= ry - handleSize && y <= ry + handleSize) {
        return b;
      }
    }
    return null;
  }

  renderBlocks(ctx, pageNum, zoom = 1) {
    const blocks = this.getPageBlocks(pageNum);
    for (const block of blocks) {
      const x = block.x * zoom;
      const y = block.y * zoom;
      const w = block.width * zoom;
      const h = block.height * zoom;

      if (block.type === 'text') {
        if (block.style.backgroundColor && block.style.backgroundColor !== 'transparent') {
          ctx.fillStyle = block.style.backgroundColor;
          ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = block.style.color || '#000';
        const fontSize = (block.style.fontSize || 14) * zoom;
        const fontStyle = `${block.style.italic ? 'italic ' : ''}${block.style.bold ? 'bold ' : ''}${fontSize}px ${block.style.fontFamily || 'sans-serif'}`;
        ctx.font = fontStyle;
        ctx.textAlign = block.style.align || 'left';
        ctx.textBaseline = 'top';

        const lines = (block.content || '').split('\n');
        const lineHeight = fontSize * 1.3;
        const textX = block.style.align === 'center' ? x + w / 2 : block.style.align === 'right' ? x + w : x + 4 * zoom;
        for (let i = 0; i < lines.length; i++) {
          const ly = y + 4 * zoom + i * lineHeight;
          if (ly > y + h) break;
          ctx.fillText(lines[i], textX, ly, w - 8 * zoom);
        }
        ctx.textAlign = 'left';
      } else if (block.type === 'image' && block.content) {
        const img = new Image();
        img.src = block.content;
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x, y, w, h);
        }
      }

      // Selection highlight
      if (this.selectedBlock?.id === block.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 * zoom;
        ctx.setLineDash([4 * zoom, 4 * zoom]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Resize handle
        const hs = 6 * zoom;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x + w - hs, y + h - hs, hs * 2, hs * 2);
      }
    }

    // Render snap guides if active
    const cW = ctx.canvas.width / zoom;
    const cH = ctx.canvas.height / zoom;
    this.renderGuides(ctx, zoom, cW, cH);
  }

  undo(pageNum) {
    if (!this.undoStack.length) return false;
    const last = this.undoStack.pop();
    if (last.pageNum !== pageNum) {
      this.undoStack.push(last);
      return false;
    }
    this.redoStack.push({ pageNum, blocks: JSON.parse(JSON.stringify(this.getPageBlocks(pageNum))) });
    this.blocks.set(pageNum, last.blocks);
    this._notify('undo', pageNum, null);
    return true;
  }

  redo(pageNum) {
    if (!this.redoStack.length) return false;
    const last = this.redoStack.pop();
    if (last.pageNum !== pageNum) {
      this.redoStack.push(last);
      return false;
    }
    this.undoStack.push({ pageNum, blocks: JSON.parse(JSON.stringify(this.getPageBlocks(pageNum))) });
    this.blocks.set(pageNum, last.blocks);
    this._notify('redo', pageNum, null);
    return true;
  }

  exportPageBlocks(pageNum) {
    return JSON.parse(JSON.stringify(this.getPageBlocks(pageNum)));
  }

  importPageBlocks(pageNum, blocksData) {
    this._pushUndo(pageNum);
    this.blocks.set(pageNum, JSON.parse(JSON.stringify(blocksData)));
    this._notify('import', pageNum, null);
  }

  exportAllBlocks() {
    const result = {};
    for (const [pageNum, blocks] of this.blocks) {
      if (blocks.length) result[pageNum] = JSON.parse(JSON.stringify(blocks));
    }
    return result;
  }

  importAllBlocks(data) {
    for (const [pageNum, blocks] of Object.entries(data)) {
      this.blocks.set(Number(pageNum), JSON.parse(JSON.stringify(blocks)));
    }
    this._notify('import-all', null, null);
  }

  enable(container, sourceCanvas) {
    this.active = true;
    this.sourceCanvas = sourceCanvas;
    this.refreshOverlay(container, sourceCanvas);
    this._notify('enable', null, null);
  }

  disable() {
    this.active = false;
    this.sourceCanvas = null;
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._notify('disable', null, null);
  }

  refreshOverlay(container, sourceCanvas) {
    if (!this.active || !container || !sourceCanvas) return;
    if (!this._overlay) {
      this._overlay = document.createElement('canvas');
      this._overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
      container.style.position = 'relative';
      container.appendChild(this._overlay);
    }
    this._overlay.width = sourceCanvas.width;
    this._overlay.height = sourceCanvas.height;
    this._overlay.style.width = sourceCanvas.style.width;
    this._overlay.style.height = sourceCanvas.style.height;
    // Current page from data attribute or default 1
    const pageNum = Number(container.dataset?.page || 1);
    const ctx = this._overlay.getContext('2d');
    ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);
    this.renderBlocks(ctx, pageNum, 1);
  }

  onEvent(fn) {
    this.listeners.push(fn);
  }

  // ─── Snap & Guides ──────────────────────────────────────────────────────────
  snapPosition(pageNum, blockId, x, y, width, height, canvasW, canvasH) {
    if (!this.snapEnabled) {
      this._guides = [];
      return { x, y };
    }
    const guides = [];
    const threshold = this.snapThreshold;
    let snappedX = x;
    let snappedY = y;

    // Snap points for the moving block: left, center, right / top, middle, bottom
    const edges = {
      left: x, centerX: x + width / 2, right: x + width,
      top: y, centerY: y + height / 2, bottom: y + height,
    };

    // Collect target edges from other blocks + canvas boundaries
    const targetXEdges = [0, canvasW / 2, canvasW]; // canvas left, center, right
    const targetYEdges = [0, canvasH / 2, canvasH]; // canvas top, center, bottom

    const blocks = this.getPageBlocks(pageNum);
    for (const b of blocks) {
      if (b.id === blockId) continue;
      targetXEdges.push(b.x, b.x + b.width / 2, b.x + b.width);
      targetYEdges.push(b.y, b.y + b.height / 2, b.y + b.height);
    }

    // Find closest X snap
    let bestXDist = Infinity;
    for (const target of targetXEdges) {
      for (const edgeKey of ['left', 'centerX', 'right']) {
        const dist = Math.abs(edges[edgeKey] - target);
        if (dist < threshold && dist < bestXDist) {
          bestXDist = dist;
          snappedX = x + (target - edges[edgeKey]);
          guides.push({ axis: 'x', pos: target });
        }
      }
    }

    // Find closest Y snap
    let bestYDist = Infinity;
    for (const target of targetYEdges) {
      for (const edgeKey of ['top', 'centerY', 'bottom']) {
        const dist = Math.abs(edges[edgeKey] - target);
        if (dist < threshold && dist < bestYDist) {
          bestYDist = dist;
          snappedY = y + (target - edges[edgeKey]);
          guides.push({ axis: 'y', pos: target });
        }
      }
    }

    this._guides = guides;
    return { x: snappedX, y: snappedY };
  }

  renderGuides(ctx, zoom = 1, canvasW, canvasH) {
    if (!this.showGuides || !this._guides.length) return;
    ctx.save();
    ctx.strokeStyle = '#f97316'; // orange
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const guide of this._guides) {
      ctx.beginPath();
      if (guide.axis === 'x') {
        const px = guide.pos * zoom;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvasH * zoom);
      } else {
        const py = guide.pos * zoom;
        ctx.moveTo(0, py);
        ctx.lineTo(canvasW * zoom, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  clearGuides() {
    this._guides = [];
  }

  moveBlockWithSnap(pageNum, blockId, newX, newY, canvasW, canvasH) {
    const blocks = this.getPageBlocks(pageNum);
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const snapped = this.snapPosition(pageNum, blockId, newX, newY, block.width, block.height, canvasW, canvasH);
    this._pushUndo(pageNum);
    block.x = snapped.x;
    block.y = snapped.y;
    this._notify('move', pageNum, block);
  }

  // ─── Export blocks to pdf-lib PDF ─────────────────────────────────────────
  async exportBlocksToPdf(pdfArrayBuffer, canvasSize) {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    const pages = pdfDoc.getPages();

    for (const [pageNum, blocks] of this.blocks) {
      const pageIdx = pageNum - 1;
      if (pageIdx < 0 || pageIdx >= pages.length || !blocks.length) continue;
      const page = pages[pageIdx];
      const { width: pW, height: pH } = page.getSize();

      // Scale from canvas coords to PDF coords
      const scaleX = pW / (canvasSize?.width || pW);
      const scaleY = pH / (canvasSize?.height || pH);

      for (const block of blocks) {
        const bx = block.x * scaleX;
        const by = pH - (block.y + block.height) * scaleY; // flip Y
        const bw = block.width * scaleX;
        const bh = block.height * scaleY;

        if (block.type === 'text') {
          let font = helvetica;
          if (block.style.bold && block.style.italic) font = helveticaBoldOblique;
          else if (block.style.bold) font = helveticaBold;
          else if (block.style.italic) font = helveticaOblique;

          const fontSize = (block.style.fontSize || 14) * scaleY;
          const color = this._parseColor(block.style.color || '#000000');

          // Draw background if not transparent
          if (block.style.backgroundColor && block.style.backgroundColor !== 'transparent') {
            const bgColor = this._parseColor(block.style.backgroundColor);
            page.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: rgb(bgColor.r, bgColor.g, bgColor.b) });
          }

          const lines = (block.content || '').split('\n');
          const lineHeight = fontSize * 1.3;
          for (let i = 0; i < lines.length; i++) {
            const lineY = by + bh - fontSize - i * lineHeight;
            if (lineY < by) break;
            page.drawText(lines[i], { x: bx + 2, y: lineY, size: fontSize, font, color: rgb(color.r, color.g, color.b), maxWidth: bw - 4 });
          }
        } else if (block.type === 'image' && block.content) {
          try {
            const dataUrl = block.content;
            const base64 = dataUrl.split(',')[1];
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            let img;
            if (dataUrl.includes('image/png')) {
              img = await pdfDoc.embedPng(bytes);
            } else {
              img = await pdfDoc.embedJpg(bytes);
            }
            page.drawImage(img, { x: bx, y: by, width: bw, height: bh });
          } catch { /* skip unembeddable images */ }
        }
      }
    }

    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  _parseColor(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16) / 255,
      g: parseInt(h.substring(2, 4), 16) / 255,
      b: parseInt(h.substring(4, 6), 16) / 255,
    };
  }

  _pushUndo(pageNum) {
    this.undoStack.push({ pageNum, blocks: JSON.parse(JSON.stringify(this.getPageBlocks(pageNum))) });
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
  }

  _notify(event, pageNum, block) {
    for (const fn of this.listeners) fn(event, pageNum, block);
  }
}

export const blockEditor = new PdfBlockEditor();
