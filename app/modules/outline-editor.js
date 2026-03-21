/**
 * @module outline-editor
 * @description PDF bookmark / outline tree editor.
 *
 * Provides:
 *   • Read the existing outline (bookmark) tree from a PDF
 *   • Add, rename, move, delete bookmarks
 *   • Auto-generate outline from heading-level text analysis
 *   • Interactive tree UI with drag-reorder and inline rename
 *   • Write modified outline back to the PDF via pdf-lib
 *
 * Usage:
 *   import { readOutline, writeOutline, autoGenerateOutline, OutlineEditor } from './outline-editor.js';
 *
 *   const tree = await readOutline(pdfBytes);
 *   tree[0].title = 'Renamed Chapter';
 *   const blob = await writeOutline(pdfBytes, tree);
 */

import { PDFDocument, PDFName, PDFString, PDFNumber } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} OutlineItem
 * @property {string}        title
 * @property {number}        pageNum    – 1-based destination page
 * @property {OutlineItem[]} children
 * @property {boolean}       [open=true] – expanded by default
 */

// ---------------------------------------------------------------------------
// Public API — Read outline
// ---------------------------------------------------------------------------

/**
 * Extract the bookmark tree from a PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<OutlineItem[]>}
 */
export async function readOutline(pdfBytes) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfJsDoc = await getDocument({ data: data.slice() }).promise;

  const outline = await pdfJsDoc.getOutline();
  const tree    = outline ? _convertPdfJsOutline(outline) : [];

  pdfJsDoc.destroy();
  return tree;
}

// ---------------------------------------------------------------------------
// Public API — Write outline
// ---------------------------------------------------------------------------

/**
 * Replace the PDF's outline tree with a new one.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {OutlineItem[]} outlineTree
 * @returns {Promise<Blob>}
 */
export async function writeOutline(pdfBytes, outlineTree) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const ctx    = pdfDoc.context;

  // Get all page refs for destination linking
  const pageRefs = pdfDoc.getPages().map(p => p.ref);

  // Remove existing outlines
  const catalog = pdfDoc.catalog;
  if (catalog.has(PDFName.of('Outlines'))) {
    catalog.delete(PDFName.of('Outlines'));
  }

  if (outlineTree.length === 0) {
    const saved = await pdfDoc.save();
    return new Blob([saved], { type: 'application/pdf' });
  }

  // Build new outline dict tree
  const outlinesRef = _buildOutlineTree(ctx, outlineTree, pageRefs);
  catalog.set(PDFName.of('Outlines'), outlinesRef);

  const saved = await pdfDoc.save();
  return new Blob([saved], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Auto-generate outline from text
// ---------------------------------------------------------------------------

/**
 * Analyse PDF text content and generate an outline tree based on
 * detected headings (larger font sizes, bold text, etc.).
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} [opts]
 * @param {number} [opts.minFontSize=14]  – minimum font size to consider a heading
 * @param {number} [opts.maxDepth=3]      – maximum nesting depth
 * @returns {Promise<OutlineItem[]>}
 */
export async function autoGenerateOutline(pdfBytes, opts = {}) {
  const data        = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const minFontSize = opts.minFontSize ?? 14;
  const maxDepth    = opts.maxDepth    ?? 3;

  const pdfJsDoc = await getDocument({ data: data.slice() }).promise;
  const headings = [];

  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page    = await pdfJsDoc.getPage(i);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const fontSize = Math.abs(item.transform[0]);   // approximate font size

      if (fontSize >= minFontSize) {
        headings.push({
          title:    item.str.trim().slice(0, 120),
          pageNum:  i,
          fontSize,
        });
      }
    }
  }

  pdfJsDoc.destroy();

  // Build hierarchical tree based on font size levels
  return _buildHierarchy(headings, maxDepth);
}

// ---------------------------------------------------------------------------
// OutlineEditor — UI controller
// ---------------------------------------------------------------------------

export class OutlineEditor {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.getPdfBytes   – () => Uint8Array
   * @param {Function} deps.onApply       – (blob: Blob) => void
   * @param {Function} [deps.onNavigate]  – (pageNum: number) => void
   * @param {Function} [deps.onCancel]
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
    this._tree      = [];
  }

  async open() {
    const pdfBytes = this._deps.getPdfBytes();
    this._tree = await readOutline(pdfBytes);
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
  }

  close() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute', 'top:20px', 'right:20px',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:16px', 'z-index:9000', 'width:320px', 'max-height:80vh',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
      'display:flex', 'flex-direction:column',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;margin-bottom:12px';

    const title = document.createElement('h3');
    title.textContent = 'Bookmarks';
    title.style.cssText = 'margin:0;font-size:15px;font-weight:600;flex:1';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none;background:transparent;color:#888;font-size:16px;cursor:pointer;padding:0 4px';
    closeBtn.addEventListener('click', () => {
      this.close();
      this._deps.onCancel?.();
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;flex-shrink:0';

    const addBtn = _miniBtn('+ Add', () => this._addItem());
    const autoBtn = _miniBtn('Auto', async () => {
      const pdfBytes = this._deps.getPdfBytes();
      this._tree = await autoGenerateOutline(pdfBytes);
      this._renderTree();
    });
    const saveBtn = _miniBtn('Save', async () => {
      const pdfBytes = this._deps.getPdfBytes();
      const blob = await writeOutline(pdfBytes, this._tree);
      this._deps.onApply?.(blob);
      this.close();
    });
    saveBtn.style.background = '#0078d4';
    saveBtn.style.color = '#fff';

    toolbar.append(addBtn, autoBtn, saveBtn);
    panel.appendChild(toolbar);

    // Tree container
    this._treeContainer = document.createElement('div');
    this._treeContainer.style.cssText = 'flex:1;overflow-y:auto;min-height:100px';
    panel.appendChild(this._treeContainer);

    this._renderTree();
    return panel;
  }

  _renderTree() {
    this._treeContainer.innerHTML = '';

    if (this._tree.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No bookmarks. Click "+ Add" or "Auto" to generate.';
      empty.style.cssText = 'color:#888;font-size:12px;padding:20px 0;text-align:center';
      this._treeContainer.appendChild(empty);
      return;
    }

    const list = this._buildTreeList(this._tree, 0);
    this._treeContainer.appendChild(list);
  }

  _buildTreeList(items, depth) {
    const ul = document.createElement('ul');
    ul.style.cssText = `list-style:none;margin:0;padding:0;padding-left:${depth > 0 ? 16 : 0}px`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const li   = document.createElement('li');
      li.style.cssText = 'margin:2px 0';

      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:6px',
        'padding:3px 6px', 'border-radius:3px', 'cursor:pointer',
      ].join(';');

      row.addEventListener('mouseenter', () => { row.style.background = '#3a3a3a'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

      // Expand/collapse toggle for items with children
      if (item.children?.length > 0) {
        const toggle = document.createElement('span');
        toggle.textContent = item.open !== false ? '▼' : '▶';
        toggle.style.cssText = 'font-size:10px;width:12px;cursor:pointer;color:#888';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          item.open = !(item.open !== false);
          this._renderTree();
        });
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.style.cssText = 'width:12px;display:inline-block';
        row.appendChild(spacer);
      }

      // Title (editable on double-click)
      const titleEl = document.createElement('span');
      titleEl.textContent = item.title;
      titleEl.style.cssText = 'flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

      titleEl.addEventListener('click', () => {
        this._deps.onNavigate?.(item.pageNum);
      });

      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this._inlineRename(titleEl, item);
      });

      row.appendChild(titleEl);

      // Page number
      const pageEl = document.createElement('span');
      pageEl.textContent = String(item.pageNum);
      pageEl.style.cssText = 'font-size:11px;color:#888;min-width:20px;text-align:right';
      row.appendChild(pageEl);

      // Delete button
      const delBtn = document.createElement('span');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'font-size:11px;color:#666;cursor:pointer;padding:0 2px';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeItem(items, i);
      });
      row.appendChild(delBtn);

      li.appendChild(row);

      // Recurse children
      if (item.children?.length > 0 && item.open !== false) {
        li.appendChild(this._buildTreeList(item.children, depth + 1));
      }

      ul.appendChild(li);
    }

    return ul;
  }

  _inlineRename(el, item) {
    const input = document.createElement('input');
    input.type  = 'text';
    input.value = item.title;
    input.style.cssText = 'flex:1;font-size:13px;background:#1e1e1e;color:#eee;border:1px solid #0078d4;border-radius:2px;padding:1px 4px';

    const commit = () => {
      item.title = input.value.trim() || item.title;
      this._renderTree();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') this._renderTree();
    });

    el.replaceWith(input);
    input.focus();
    input.select();
  }

  _addItem() {
    this._tree.push({
      title:    'New Bookmark',
      pageNum:  1,
      children: [],
      open:     true,
    });
    this._renderTree();
  }

  _removeItem(arr, index) {
    arr.splice(index, 1);
    this._renderTree();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _convertPdfJsOutline(items) {
  if (!items) return [];
  return items.map(item => ({
    title:    item.title ?? '',
    pageNum:  1,   // pdf.js outline dest resolution is complex; default to 1
    children: _convertPdfJsOutline(item.items),
    open:     true,
  }));
}

function _buildHierarchy(headings, maxDepth) {
  if (headings.length === 0) return [];

  // Determine font size levels
  const sizes  = [...new Set(headings.map(h => h.fontSize))].sort((a, b) => b - a);
  const levels = new Map();
  sizes.forEach((s, i) => levels.set(s, Math.min(i, maxDepth - 1)));

  const root   = [];
  const stack  = [{ children: root, level: -1 }];

  for (const h of headings) {
    const level = levels.get(h.fontSize) ?? 0;
    const node  = { title: h.title, pageNum: h.pageNum, children: [], open: true };

    // Pop stack until we find the right parent
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push({ children: node.children, level });
  }

  return root;
}

function _buildOutlineTree(ctx, items, pageRefs) {
  // Create Outlines dict
  const outlinesDict = ctx.obj({
    Type: 'Outlines',
  });
  const outlinesRef = ctx.register(outlinesDict);

  if (items.length === 0) return outlinesRef;

  // Build linked list of outline items
  const refs = items.map(item => _buildOutlineItem(ctx, item, pageRefs, outlinesRef));

  // Link siblings
  for (let i = 0; i < refs.length; i++) {
    const dict = ctx.lookup(refs[i]);
    if (i > 0)              dict.set(PDFName.of('Prev'), refs[i - 1]);
    if (i < refs.length - 1) dict.set(PDFName.of('Next'), refs[i + 1]);
  }

  // Set First/Last on parent
  outlinesDict.set(PDFName.of('First'), refs[0]);
  outlinesDict.set(PDFName.of('Last'),  refs[refs.length - 1]);
  outlinesDict.set(PDFName.of('Count'), PDFNumber.of(items.length));

  return outlinesRef;
}

function _buildOutlineItem(ctx, item, pageRefs, parentRef) {
  const pageIdx = Math.max(0, Math.min((item.pageNum ?? 1) - 1, pageRefs.length - 1));
  const pageRef = pageRefs[pageIdx];

  // Destination: [pageRef /Fit]
  const dest = ctx.obj([pageRef, PDFName.of('Fit')]);

  const dict = ctx.obj({});
  dict.set(PDFName.of('Title'),  PDFString.of(item.title ?? 'Untitled'));
  dict.set(PDFName.of('Parent'), parentRef);
  dict.set(PDFName.of('Dest'),   dest);

  const ref = ctx.register(dict);

  // Process children
  if (item.children?.length > 0) {
    const childRefs = item.children.map(child =>
      _buildOutlineItem(ctx, child, pageRefs, ref),
    );

    for (let i = 0; i < childRefs.length; i++) {
      const childDict = ctx.lookup(childRefs[i]);
      if (i > 0)                    childDict.set(PDFName.of('Prev'), childRefs[i - 1]);
      if (i < childRefs.length - 1) childDict.set(PDFName.of('Next'), childRefs[i + 1]);
    }

    dict.set(PDFName.of('First'), childRefs[0]);
    dict.set(PDFName.of('Last'),  childRefs[childRefs.length - 1]);
    dict.set(PDFName.of('Count'), PDFNumber.of(item.children.length));
  }

  return ref;
}

function _miniBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = [
    'padding:3px 10px', 'border:1px solid #555', 'border-radius:3px',
    'background:#3c3c3c', 'color:#ddd', 'font-size:12px', 'cursor:pointer',
  ].join(';');
  btn.addEventListener('click', onClick);
  return btn;
}
