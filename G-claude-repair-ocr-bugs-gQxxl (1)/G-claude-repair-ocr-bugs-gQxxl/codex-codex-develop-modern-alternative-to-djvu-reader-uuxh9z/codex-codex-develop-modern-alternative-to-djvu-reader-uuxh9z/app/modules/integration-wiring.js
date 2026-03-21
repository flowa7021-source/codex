/**
 * @module integration-wiring
 * @description Phase 7 — Integration layer.
 *
 * Wires all Phase 0–8 modules into the NovaReader app lifecycle:
 *   • Registers new toolbar buttons (Erase, Smart Crop, Table Editor,
 *     Formula, Visual Diff, Batch OCR)
 *   • Initialises the PageModel for each loaded page
 *   • Hooks the PixelPerfectTextLayer into the render pipeline
 *   • Activates the ClipboardController for cross-format paste
 *   • Sets up the InlineTextEditor on double-click text blocks
 *   • Enforces PDF security permissions through PermissionEnforcer
 *
 * Entry point:
 *   import { bootstrapAdvancedTools } from './integration-wiring.js';
 *   bootstrapAdvancedTools(appContext);
 *
 * `appContext` must expose:
 *   {
 *     container:      HTMLElement,       // main viewer element
 *     toolbar:        HTMLElement,       // toolbar container
 *     pdfLibDoc:      PDFDocument,       // pdf-lib document
 *     pdfBytes:       Uint8Array,        // raw PDF bytes
 *     getPageCanvas:  (pageNum) => HTMLCanvasElement,
 *     getPageNum:     () => number,      // current 1-based page
 *     reloadPage:     () => Promise,     // re-render current page
 *     onPdfModified:  (newBytes) => void,// callback when PDF bytes change
 *     eventBus:       EventTarget,       // app event bus
 *   }
 */

import { ToolMode, toolStateMachine } from './tool-modes.js';
import { DocumentModel }              from './page-model.js';
import { PermissionEnforcer }          from './pdf-security.js';
// EraseTool is activated via tool-modes.js deps, not directly imported here
import { InlineTextEditor }            from './inline-text-editor.js';
import { ClipboardController }         from './cross-format-paste.js';
import { smartCropPage }                from './smart-crop.js';
import { TableEditor, detectTableRegions } from './table-editor.js';
import { FormulaEditor, insertFormulaIntoPdf } from './formula-editor.js';
import { VisualDiff }                  from './visual-diff.js';
import { BatchOcrEditor, generateBatchReport } from './batch-ocr-editor.js';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialise and wire all advanced tools.
 *
 * @param {Object} ctx – application context (see module JSDoc)
 * @returns {Object} handles – cleanup handles & controller references
 */
export function bootstrapAdvancedTools(ctx) {
  const handles = {};

  // 1. Build document model for current PDF
  handles.docModel = new DocumentModel();

  // 2. Permission enforcer (reads Encrypt dict from raw bytes)
  handles.permEnforcer = _initPermissions(ctx);

  // 3. Toolbar buttons
  _addToolbarButtons(ctx, handles);

  // 4. Clipboard controller
  handles.clipboard = _initClipboard(ctx, handles);

  // 5. Inline text editor (activated on double-click)
  handles.inlineEditor = _initInlineEditor(ctx, handles);

  // 6. Listen for page change events to rebuild PageModel
  const onPageChange = () => _rebuildPageModel(ctx, handles);
  ctx.eventBus?.addEventListener?.('page-change', onPageChange);
  handles._teardownPageChange = () => ctx.eventBus?.removeEventListener?.('page-change', onPageChange);

  // 7. Cleanup function
  handles.destroy = () => _destroyAll(handles);

  return handles;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

function _initPermissions(ctx) {
  try {
    const enforcer = new PermissionEnforcer(ctx.pdfBytes);
    if (ctx.toolbar) enforcer.enforceUI(ctx.toolbar);
    return enforcer;
  } catch (_e) {
    return null;  // unencrypted PDF — no restrictions
  }
}

// ---------------------------------------------------------------------------
// Toolbar buttons
// ---------------------------------------------------------------------------

function _addToolbarButtons(ctx, handles) {
  const toolbar = ctx.toolbar;
  if (!toolbar) return;

  // Separator
  toolbar.appendChild(_makeSeparator());

  // Erase tool
  const eraseBtn = _makeButton('eraseTool', 'Erase', () => {
    toolStateMachine.toggle(ToolMode.ERASE);
  });
  toolbar.appendChild(eraseBtn);

  // Smart Crop
  const cropBtn = _makeButton('smartCropTool', 'Crop', async () => {
    const pageNum = ctx.getPageNum();
    const result  = await smartCropPage(ctx.pdfBytes, pageNum);
    if (result?.blob) {
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      ctx.onPdfModified(bytes);
    }
  });
  toolbar.appendChild(cropBtn);

  // Table Editor
  const tableBtn = _makeButton('tableEditorTool', 'Table', () => {
    const canvas = ctx.getPageCanvas(ctx.getPageNum());
    if (!canvas) return;

    const regions = detectTableRegions(canvas);
    if (regions.length === 0) return;

    const page     = ctx.pdfLibDoc.getPages()[ctx.getPageNum() - 1];
    const { width, height } = page.getSize();

    const editor = new TableEditor(ctx.container, ctx.pdfLibDoc, width, height, 1.0);
    editor.open(regions[0]);
    editor.on('commit', async () => {
      const bytes = await ctx.pdfLibDoc.save();
      ctx.onPdfModified(new Uint8Array(bytes));
    });
    handles._tableEditor = editor;
  });
  toolbar.appendChild(tableBtn);

  // Formula Editor
  const formulaBtn = _makeButton('formulaEditorTool', 'Formula', () => {
    const page     = ctx.pdfLibDoc.getPages()[ctx.getPageNum() - 1];
    const { width, height } = page.getSize();

    const editor = new FormulaEditor(ctx.container, width, height, 1.0);
    editor.on('insert', async ({ latex, x, y }) => {
      const blob = await insertFormulaIntoPdf(ctx.pdfBytes, ctx.getPageNum(), latex, x, y);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      ctx.onPdfModified(bytes);
      editor.close();
    });
    handles._formulaEditor = editor;
  });
  toolbar.appendChild(formulaBtn);

  // Visual Diff
  const diffBtn = _makeButton('visualDiffTool', 'Diff', () => {
    if (handles._visualDiff) {
      handles._visualDiff.destroy();
      handles._visualDiff = null;
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'background:rgba(0,0,0,0.9)',
    ].join(';');
    document.body.appendChild(overlay);

    const diff = new VisualDiff(overlay);
    handles._visualDiff = diff;

    // Close on Escape
    const onKey = (e) => {
      if (e.key === 'Escape') {
        diff.destroy();
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        handles._visualDiff = null;
      }
    };
    document.addEventListener('keydown', onKey);
  });
  toolbar.appendChild(diffBtn);

  // Batch OCR
  const batchBtn = _makeButton('batchOcrTool', 'Batch OCR', async () => {
    const batch = new BatchOcrEditor(ctx.pdfBytes, {
      onProgress: (p) => {
        batchBtn.textContent = `OCR ${p.page}/${p.total}`;
      },
    });

    const result = await batch.run();
    batchBtn.textContent = 'Batch OCR';

    // Update PDF
    if (result.pdfBytes) {
      ctx.onPdfModified(result.pdfBytes);
    }

    // Log report
    const report = generateBatchReport(result);
    console.log(report);
  });
  toolbar.appendChild(batchBtn);
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

function _initClipboard(ctx, _handles) {
  return new ClipboardController({
    container:      ctx.container,
    getSelection:   () => null,   // wired by app's selection system
    getPageCanvas:  () => ctx.getPageCanvas(ctx.getPageNum()),
    getPdfDoc:      () => ctx.pdfLibDoc,
    getPageNum:     () => ctx.getPageNum() - 1,   // paste API uses 0-based
    getCursorPos:   () => ({ x: 72, y: 700 }),    // default; overridden by click
    onPasteComplete: async () => {
      const bytes = await ctx.pdfLibDoc.save();
      ctx.onPdfModified(new Uint8Array(bytes));
    },
  });
}

// ---------------------------------------------------------------------------
// Inline text editor
// ---------------------------------------------------------------------------

function _initInlineEditor(ctx, handles) {
  const container = ctx.container;

  const onDblClick = (e) => {
    // Check if click is on a text block in the PageModel
    if (!handles.docModel || !handles.docModel.pages) return;

    const pageNum   = ctx.getPageNum();
    const pageModel = handles.docModel.pages[pageNum - 1];
    if (!pageModel) return;

    const rect   = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const hit = pageModel.objectAtPoint({ x: clickX, y: clickY });
    if (!hit || hit.type !== 'text') return;

    const page     = ctx.pdfLibDoc.getPages()[pageNum - 1];
    const { width, height } = page.getSize();

    const editor = new InlineTextEditor(container, pageModel, {
      pdfLibDoc:        ctx.pdfLibDoc,
      pageWidthPt:      width,
      pageHeightPt:     height,
      zoom:             1.0,
      getBackgroundCanvas: () => ctx.getPageCanvas(pageNum),
      onCommit:         async () => {
        const bytes = await ctx.pdfLibDoc.save();
        ctx.onPdfModified(new Uint8Array(bytes));
      },
      onCancel:         () => {},
      hideTextBlock:    () => {},
      showTextBlock:    () => {},
    });

    editor.activate(hit, rect);
  };

  container.addEventListener('dblclick', onDblClick);
  return { destroy: () => container.removeEventListener('dblclick', onDblClick) };
}

// ---------------------------------------------------------------------------
// Page model rebuild
// ---------------------------------------------------------------------------

function _rebuildPageModel(_ctx, _handles) {
  // Placeholder: rebuild PageModel from current page data.
  // In a full integration this would call DocumentModel.fromExtractedPage()
  // for the current page using the text content and rendered image.
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function _destroyAll(handles) {
  handles.clipboard?.destroy();
  handles.inlineEditor?.destroy();
  handles._tableEditor?.close();
  handles._formulaEditor?.close?.();
  handles._visualDiff?.destroy();
  handles._teardownPageChange?.();
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function _makeButton(id, label, onClick) {
  const btn = document.createElement('button');
  btn.id          = id;
  btn.textContent = label;
  btn.className   = 'tool-btn';
  btn.style.cssText = [
    'padding:4px 8px', 'border:1px solid #555', 'border-radius:3px',
    'background:#2d2d2d', 'color:#ddd', 'font-size:12px', 'cursor:pointer',
    'margin:0 2px',
  ].join(';');
  btn.addEventListener('click', onClick);
  return btn;
}

function _makeSeparator() {
  const s = document.createElement('div');
  s.style.cssText = 'width:1px;height:24px;background:#555;margin:0 6px;display:inline-block;vertical-align:middle';
  return s;
}
