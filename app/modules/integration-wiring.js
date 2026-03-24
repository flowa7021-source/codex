// @ts-check
/**
 * @module integration-wiring
 * @description Phase 7 — Integration layer.
 *
 * Wires all Phase 0–8 + professional modules into the NovaReader app lifecycle:
 *   • Registers toolbar buttons (Erase, Crop, Table, Formula, Diff, Batch OCR,
 *     Watermark, Sign, Bates, Redact, Bookmarks, Measure, A11y, Reading, Diff Text)
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
import { PermissionEnforcer, getSecurityInfo } from './pdf-security.js';
// EraseTool is activated via tool-modes.js deps, not directly imported here
import { novaLog }                     from './diagnostics.js';
import { InlineTextEditor }            from './inline-text-editor.js';
import { ClipboardController }         from './cross-format-paste.js';
import { smartCropPage }                from './smart-crop.js';
import { TableEditor, detectTableRegions } from './table-editor.js';
import { FormulaEditor, insertFormulaIntoPdf } from './formula-editor.js';
import { VisualDiff }                  from './visual-diff.js';
import { BatchOcrEditor, generateBatchReport } from './batch-ocr-editor.js';
import { WatermarkEditor, addTextWatermark, addImageWatermark } from './pdf-watermark.js';
import { SignaturePad, insertSignatureIntoPdf } from './signature-pad.js';
import { BatesEditor, applyBatesNumbering, applyPageStamp, applyConfidentialityLabel } from './bates-numbering.js';
import { RedactionEditor }                     from './text-redact.js';
import { OutlineEditor }                       from './outline-editor.js';
import { MeasurementOverlay }                  from './measurement-tools.js';
import { AccessibilityPanel }                  from './pdf-accessibility-checker.js';
import { ReadingMode }                         from './reading-mode.js';
import { DiffViewer, diffPdfPages }            from './word-level-diff.js';
import { BatchConverter }                     from './batch-convert.js';

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
  // Async — resolves in background; non-blocking
  _initPermissions(ctx).then(enforcer => { handles.permEnforcer = enforcer; }).catch(err => console.warn('[integration] error:', err?.message));

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

async function _initPermissions(ctx) {
  try {
    if (!ctx.pdfBytes) return null;
    const secInfo  = await getSecurityInfo(ctx.pdfBytes);
    const enforcer = new PermissionEnforcer(secInfo);
    if (ctx.toolbar) {
      // Wrap HTMLElement toolbar with the interface enforceUI expects
      enforcer.enforceUI({
        disable(id) {
          const el = ctx.toolbar.querySelector(`#${id}, [data-tool="${id}"]`);
          if (el) { el.disabled = true; el.style.opacity = '0.4'; el.style.pointerEvents = 'none'; }
        },
        showNotice(msg) {
          const notice = document.createElement('span');
          notice.textContent = msg;
          notice.style.cssText = 'font-size:11px;color:#f44;margin-left:8px';
          ctx.toolbar.appendChild(notice);
        },
      });
    }
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

    const page = ctx.pdfLibDoc.getPages()[ctx.getPageNum() - 1];
    if (!page) return;
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
    const page = ctx.pdfLibDoc.getPages()[ctx.getPageNum() - 1];
    if (!page) return;
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
    novaLog('info', 'integration-wiring', report);
  });
  toolbar.appendChild(batchBtn);

  // ── Professional tools separator ──
  toolbar.appendChild(_makeSeparator());

  // Watermark
  toolbar.appendChild(_makeButton('watermarkTool', 'Watermark', () => {
    const editor = new WatermarkEditor(ctx.container, {
      onApply: async (opts) => {
        let blob;
        if (opts.mode === 'text') {
          blob = await addTextWatermark(ctx.pdfBytes, opts.text, opts);
        } else {
          blob = await addImageWatermark(ctx.pdfBytes, opts.imageBytes, opts);
        }
        ctx.onPdfModified(new Uint8Array(await blob.arrayBuffer()));
      },
      onCancel: () => {},
    });
    editor.open();
    handles._watermarkEditor = editor;
  }));

  // Signature
  toolbar.appendChild(_makeButton('signatureTool', 'Sign', () => {
    const pad = new SignaturePad(ctx.container, {
      onInsert: async (sigData) => {
        const blob = await insertSignatureIntoPdf(ctx.pdfBytes, ctx.getPageNum(), sigData);
        ctx.onPdfModified(new Uint8Array(await blob.arrayBuffer()));
      },
      onCancel: () => {},
    });
    pad.open();
    handles._signaturePad = pad;
  }));

  // Bates Numbering
  toolbar.appendChild(_makeButton('batesTool', 'Bates', () => {
    const editor = new BatesEditor(ctx.container, {
      onApply: async (opts) => {
        let blob;
        if (opts.mode === 'bates') {
          blob = await applyBatesNumbering(ctx.pdfBytes, opts);
        } else if (opts.mode === 'stamp') {
          blob = await applyPageStamp(ctx.pdfBytes, opts.text, opts);
        } else {
          blob = await applyConfidentialityLabel(ctx.pdfBytes, opts.level, opts);
        }
        ctx.onPdfModified(new Uint8Array(await blob.arrayBuffer()));
      },
      onCancel: () => {},
    });
    editor.open();
    handles._batesEditor = editor;
  }));

  // Redaction
  toolbar.appendChild(_makeButton('redactTool', 'Redact', () => {
    const editor = new RedactionEditor(ctx.container, {
      getPdfBytes: () => ctx.pdfBytes,
      onApply: (result) => {
        if (result.blob) {
          result.blob.arrayBuffer().then(buf => ctx.onPdfModified(new Uint8Array(buf))).catch(err => console.warn('[integration] error:', err?.message));
        }
      },
      onCancel: () => {},
    });
    editor.open();
    handles._redactionEditor = editor;
  }));

  // Outline / Bookmarks
  toolbar.appendChild(_makeButton('outlineTool', 'Bookmarks', async () => {
    const editor = new OutlineEditor(ctx.container, {
      getPdfBytes: () => ctx.pdfBytes,
      onApply: (blob) => {
        blob.arrayBuffer().then(buf => ctx.onPdfModified(new Uint8Array(buf))).catch(err => console.warn('[integration] error:', err?.message));
      },
      onNavigate: (pageNum) => {
        ctx.eventBus?.dispatchEvent?.(new CustomEvent('go-to-page', { detail: { pageNum } }));
      },
      onCancel: () => {},
    });
    await editor.open();
    handles._outlineEditor = editor;
  }));

  // Measurement
  toolbar.appendChild(_makeButton('measureTool', 'Measure', () => {
    if (handles._measureOverlay) {
      handles._measureOverlay.destroy();
      handles._measureOverlay = null;
      return;
    }
    const page = ctx.pdfLibDoc.getPages()[ctx.getPageNum() - 1];
    if (!page) return;
    const { width, height } = page.getSize();
    handles._measureOverlay = new MeasurementOverlay(ctx.container, {
      zoom: 1.0,
      unit: 'mm',
      pageWidthPt: width,
      pageHeightPt: height,
    });
    handles._measureOverlay.setTool('distance');
  }));

  // Accessibility Check
  toolbar.appendChild(_makeButton('a11yTool', 'A11y', async () => {
    const panel = new AccessibilityPanel(ctx.container, {
      getPdfBytes: () => ctx.pdfBytes,
      onClose: () => {},
    });
    await panel.open();
    handles._a11yPanel = panel;
  }));

  // Reading Mode
  toolbar.appendChild(_makeButton('readingModeTool', 'Read', () => {
    const reader = new ReadingMode({
      getPageText: async (pageNum) => {
        const { getDocument } = await import('pdfjs-dist/build/pdf.mjs');
        const doc = await getDocument({ data: ctx.pdfBytes.slice() }).promise;
        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();
        doc.destroy();
        return content.items.map(i => i.str).join(' ');
      },
      getTotalPages: () => ctx.pdfLibDoc.getPageCount(),
      getCurrentPage: () => ctx.getPageNum(),
      onExit: () => {},
    });
    reader.enter();
    handles._readingMode = reader;
  }));

  // Word-level Text Diff
  toolbar.appendChild(_makeButton('textDiffTool', 'Text Diff', () => {
    // Open file picker for comparison PDF
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.pdf';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const otherBytes = new Uint8Array(await file.arrayBuffer());
      const result = await diffPdfPages(ctx.pdfBytes, otherBytes, {
        pageA: ctx.getPageNum(),
        pageB: 1,
        granularity: 'word',
      });
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);overflow:auto;padding:24px';
      document.body.appendChild(overlay);
      const viewer = new DiffViewer(overlay);
      viewer.show(result);
      const onKey = (e) => {
        if (e.key === 'Escape') {
          viewer.close();
          overlay.remove();
          document.removeEventListener('keydown', onKey);
        }
      };
      document.addEventListener('keydown', onKey);
    });
    input.click();
  }));

  // Batch Convert
  const batchConvertBtn = _makeButton('batchConvertTool', 'Batch Convert', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.addEventListener('change', async () => {
      const files = input.files;
      if (!files || files.length === 0) return;

      const converter = new BatchConverter();
      handles._batchConverter = converter;

      converter.addFiles([...files], 'docx');

      converter.onChange((st) => {
        batchConvertBtn.textContent = st.isRunning
          ? `Batch ${st.done}/${st.total}`
          : 'Batch Convert';
      });

      await converter.start(async (file, _format, onProgress) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { getDocument } = await import('pdfjs-dist/build/pdf.mjs');
        const pdfDoc = await getDocument({ data: bytes }).promise;
        const { convertPdfToDocx } = await import('./docx-converter.js');
        onProgress(10);
        const blob = await convertPdfToDocx(pdfDoc, file.name.replace(/\.pdf$/i, ''), pdfDoc.numPages, {});
        pdfDoc.destroy();
        onProgress(100);
        return blob;
      });

      await converter.downloadAsZip('batch-converted.zip');
    });
    input.click();
  });
  toolbar.appendChild(batchConvertBtn);
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
    const pageModel = handles.docModel.pages.get(pageNum);
    if (!pageModel) return;

    const rect   = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const hit = pageModel.objectAtPoint({ x: clickX, y: clickY });
    if (!hit || hit.type !== 'text') return;

    const page = ctx.pdfLibDoc.getPages()[pageNum - 1];
    if (!page) return;
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

async function _rebuildPageModel(ctx, handles) {
  if (!ctx.pdfBytes || !handles.docModel) return;

  const pageNum = ctx.getPageNum();
  if (!pageNum || pageNum < 1) return;

  try {
    // Extract text content from the current page via pdf.js
    const { getDocument } = await import('pdfjs-dist/build/pdf.mjs');
    const pdfJsDoc = await getDocument({ data: ctx.pdfBytes.slice() }).promise;
    const page     = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content  = await page.getTextContent();

    // Build a lightweight ExtractedPage-compatible object
    const textRuns = content.items
      .filter(item => item.str?.trim())
      .map(item => ({
        text:     item.str,
        x:        item.transform[4],
        y:        item.transform[5],
        width:    item.width  || 0,
        height:   item.height || Math.abs(item.transform[0]),
        fontSize: Math.abs(item.transform[0]),
        font:     item.fontName || 'sans-serif',
        color:    '#000000',
        bold:     false,
        italic:   false,
      }));

    const extracted = {
      pageNumber: pageNum,
      width:      viewport.width,
      height:     viewport.height,
      rotation:   0,
      textRuns,
      images:     [],
      paths:      [],
    };

    const { DocumentModel } = await import('./page-model.js');
    const pageModel = DocumentModel.fromExtractedPage(extracted);
    handles.docModel.pages.set(pageNum, pageModel);

    pdfJsDoc.destroy();
  } catch (_e) {
    // Non-critical: page model rebuild failure doesn't block the app
  }
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
  handles._watermarkEditor?.close();
  handles._signaturePad?.close();
  handles._batesEditor?.close();
  handles._redactionEditor?.close();
  handles._outlineEditor?.close();
  handles._measureOverlay?.destroy();
  handles._a11yPanel?.close();
  handles._readingMode?.exit();
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
