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

  onEvent(fn) {
    this.listeners.push(fn);
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
