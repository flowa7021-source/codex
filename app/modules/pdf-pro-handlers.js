// @ts-check
// ─── PDF Pro Handlers ─────────────────────────────────────────────────────────
// Pro PDF tool event handler registrations (redact, optimize, flatten, accessibility,
// compare, header/footer, Bates numbering, page organizer buttons).
// Extracted from app.js as part of module decomposition.

import { PdfRedactor, REDACTION_PATTERNS } from './pdf-redact.js';
import { state } from './state.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
/** @type {Record<string, any>} */
const _deps = {
  setOcrStatus: () => {},
  nrPrompt: async () => null,
  nrConfirm: async () => false,
  safeCreateObjectURL: (/** @type {Blob} */ b) => URL.createObjectURL(b),
  pushDiagnosticEvent: () => {},
  ensurePdfJs: async () => {},
  toastSuccess: () => {},
  toastInfo: () => {},
  pdfOptimizer: null,
  flattenPdf: async () => {},
  checkAccessibility: async () => {},
  autoFixAccessibility: async () => {},
  pdfCompare: null,
  addHeaderFooter: async () => {},
  addBatesNumbering: async () => {},
  rotatePdfPages: async () => {},
  splitPdfDocument: async () => {},
  mergePdfDocuments: async () => {},
  parsePageRangeLib: () => [],
  reloadPdfFromBytes: async () => {},
};

/** @param {Record<string, any>} deps @returns {void} */
export function initPdfProHandlersDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const pdfRedactor = new PdfRedactor();

function requirePdfFile() {
  if (!state.file || state.adapter?.type !== 'pdf') {
    _deps.setOcrStatus('Откройте PDF-файл для использования этого инструмента');
    return null;
  }
  return state.file;
}

/** Extract Uint8Array from a Blob */
async function blobToBytes(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Apply PDF operation result in-place: reload from blob bytes */
async function applyInPlace(blob, statusMsg) {
  const bytes = await blobToBytes(blob);
  await _deps.reloadPdfFromBytes(bytes);
  _deps.setOcrStatus(statusMsg);
}

// ─── Init: register all Pro PDF event handlers ──────────────────────────────

/** @returns {void} */
export function initPdfProHandlers() {

  // ── PDF Redaction ──
  { const _el = document.getElementById('pdfRedact'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      // Show pattern selection modal instead of text prompt
      const patternName = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.style.zIndex = '2000';
        const patterns = Object.keys(REDACTION_PATTERNS);
        const btns = patterns.map(p =>
          `<button class="btn-xs" data-pat="${p}" style="margin:4px;padding:6px 12px;">${p}</button>`
        ).join('');
        modal.innerHTML = `<div class="modal-card" style="max-width:420px;">
          <div class="modal-head"><h3 style="margin:0;">Тип редакции</h3><button id="_redCloseModal" class="btn-xs">✕</button></div>
          <div class="modal-body" style="padding:12px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${btns}</div>
            <div style="margin-top:12px;"><input id="_redCustom" type="text" placeholder="Или regex..." class="input-sm" style="width:100%;padding:6px;"/></div>
            <div style="margin-top:8px;text-align:right;"><button id="_redApplyCustom" class="btn-xs" style="background:var(--accent);color:white;padding:6px 16px;">Применить</button></div>
          </div>
        </div>`;
        document.body.appendChild(modal);
        modal.querySelectorAll('[data-pat]').forEach(btn => {
          btn.addEventListener('click', () => { modal.remove(); resolve(/** @type {HTMLElement} */ (btn).dataset.pat); });
        });
        modal.querySelector('#_redCloseModal').addEventListener('click', () => { modal.remove(); resolve(null); });
        modal.querySelector('#_redApplyCustom').addEventListener('click', () => {
          const v = /** @type {HTMLInputElement} */ (modal.querySelector('#_redCustom')).value.trim();
          modal.remove();
          resolve(v || null);
        });
        modal.addEventListener('click', (ev) => { if (ev.target === modal) { modal.remove(); resolve(null); } });
      });
      if (!patternName) return;

      try {
        _deps.setOcrStatus('Поиск конфиденциальных данных...');
        const arrayBuffer = await file.arrayBuffer();

        // Use predefined pattern or custom regex
        if (REDACTION_PATTERNS[patternName]) {
          // Get text from all pages and mark patterns
          for (let p = 1; p <= state.pageCount; p++) {
            const page = await state.adapter.pdfDoc.getPage(p);
            const content = await page.getTextContent();
            const text = content.items.map(item => item.str).join(' ');
// @ts-ignore
            pdfRedactor.markPattern(p, text, /** @type {any} */ (patternName));
          }
        } else {
          // Custom regex
          for (let p = 1; p <= state.pageCount; p++) {
            const page = await state.adapter.pdfDoc.getPage(p);
            const content = await page.getTextContent();
            const text = content.items.map(item => item.str).join(' ');
            pdfRedactor.markRegex(p, text, new RegExp(patternName, 'gi'));
          }
        }

        const marks = pdfRedactor.getMarks();
        const totalMarks = marks.reduce((sum, m) => sum + m.areas.length, 0);

        if (totalMarks === 0) {
          _deps.setOcrStatus('Совпадений не найдено');
          return;
        }

        const apply = await _deps.nrConfirm(`Найдено ${totalMarks} совпадений. Применить редактирование? Это действие необратимо.`);
        if (!apply) {
          pdfRedactor.clearAll();
          return;
        }

        _deps.setOcrStatus('Применение редактирования...');
        const result = await pdfRedactor.applyRedactions(arrayBuffer);
        await applyInPlace(result.blob, `Редактирование завершено: ${result.redactedCount} областей в ${result.pagesProcessed} стр.`);
        _deps.pushDiagnosticEvent('pdf.redact', { areas: result.redactedCount, pages: result.pagesProcessed });
      } catch (err) {
        _deps.setOcrStatus(`Ошибка редактирования: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // ── PDF Optimize ──
  { const _el = document.getElementById('pdfOptimize'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      try {
        _deps.setOcrStatus('Оптимизация PDF...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await _deps.pdfOptimizer.optimize(arrayBuffer);
        await applyInPlace(result.blob, `Оптимизация: ${result.summary}`);
        _deps.pushDiagnosticEvent('pdf.optimize', { original: result.original, optimized: result.optimized, savingsPercent: result.savingsPercent });
      } catch (err) {
        _deps.setOcrStatus(`Ошибка оптимизации: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // ── PDF Flatten ──
  { const _el = document.getElementById('pdfFlatten'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      try {
        _deps.setOcrStatus('Выравнивание PDF...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await _deps.flattenPdf(arrayBuffer, { flattenForms: true, flattenAnnotations: true });
        await applyInPlace(result.blob, `Выровнено: ${result.formsFlattened} форм, ${result.annotationsFlattened} аннотаций`);
        _deps.pushDiagnosticEvent('pdf.flatten', { forms: result.formsFlattened, annotations: result.annotationsFlattened });
      } catch (err) {
        _deps.setOcrStatus(`Ошибка выравнивания: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // ── Accessibility Check ──
  { const _el = document.getElementById('pdfAccessibility'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      try {
        _deps.setOcrStatus('Проверка доступности...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await _deps.checkAccessibility(arrayBuffer);

        let msg = `Доступность: ${result.score}/100 (${result.level})\n`;
        msg += `Ошибок: ${result.summary.errors}, Предупреждений: ${result.summary.warnings}\n\n`;
        for (const issue of result.issues) {
          msg += `[${issue.severity.toUpperCase()}] ${issue.rule}: ${issue.message}\n`;
          msg += `  Рекомендация: ${issue.fix}\n\n`;
        }

        if (result.issues.some(i => i.autoFixable)) {
          const fix = await _deps.nrConfirm(msg + '\nИсправить автоматически исправляемые проблемы?');
          if (fix) {
            const fixed = await _deps.autoFixAccessibility(arrayBuffer, {
              title: state.docName || 'Document',
              language: 'ru',
            });
            await applyInPlace(fixed.blob, `Исправлено ${fixed.fixCount} проблем доступности`);
            return;
          }
        }

        _deps.setOcrStatus(`Доступность: ${result.score}/100 — ${result.summary.errors} ошибок, ${result.summary.warnings} предупреждений`);
        _deps.toastInfo(msg);
        _deps.pushDiagnosticEvent('pdf.accessibility', { score: result.score, level: result.level, errors: result.summary.errors });
      } catch (err) {
        _deps.setOcrStatus(`Ошибка проверки доступности: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // ── PDF Compare (side-by-side like MS Word) ──
  { const _el = document.getElementById('pdfCompare'); if (_el) _el.addEventListener('click', async () => {
      if (!state.adapter || state.adapter.type !== 'pdf') {
        _deps.setOcrStatus('Откройте PDF-файл для сравнения');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = async (e) => {
        const file2 = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (!file2) return;

        try {
          _deps.setOcrStatus('Сравнение документов...');
          const pdf = await _deps.ensurePdfJs();
          const ab2 = await file2.arrayBuffer();
          const pdfDoc2 = await pdf.getDocument({ data: ab2 }).promise;

          const result = await _deps.pdfCompare.compareText(state.adapter.pdfDoc, pdfDoc2);
          const maxPages = Math.max(state.adapter.pdfDoc.numPages, pdfDoc2.numPages);

          // Build side-by-side comparison modal
          const overlay = document.createElement('div');
          overlay.className = 'modal open';
          overlay.style.cssText = 'z-index:2000;';
          overlay.innerHTML = `
            <div class="modal-card" style="width:96vw;max-width:1600px;height:90vh;display:flex;flex-direction:column;">
              <div class="modal-head" style="flex-shrink:0;">
                <h3 style="margin:0;">Сравнение документов</h3>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span style="font-size:0.8rem;color:var(--text-muted);">
                    Изменено: ${result.summary.changePercent}% (${result.summary.addedLines} добавлено, ${result.summary.removedLines} удалено)
                  </span>
                  <select id="cmpViewMode" class="select-xs" style="font-size:0.75rem;">
                    <option value="text">Текст</option>
                    <option value="visual">Визуально</option>
                  </select>
                  <button id="cmpPrev" class="btn-xs">&larr;</button>
                  <span id="cmpPageLabel" style="font-size:0.8rem;">1 / ${maxPages}</span>
                  <button id="cmpNext" class="btn-xs">&rarr;</button>
                  <button id="closeCompare" class="btn-xs">✕</button>
                </div>
              </div>
              <div style="display:flex;flex:1;overflow:hidden;gap:2px;min-height:0;">
                <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                  <div style="padding:4px 8px;background:var(--bg-secondary);font-size:0.75rem;font-weight:600;flex-shrink:0;">
                    ${state.docName} (${state.adapter.pdfDoc.numPages} стр.)
                  </div>
                  <div id="cmpPanelA" style="flex:1;overflow:auto;padding:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6;background:var(--bg);"></div>
                </div>
                <div style="width:2px;background:var(--border);flex-shrink:0;"></div>
                <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                  <div style="padding:4px 8px;background:var(--bg-secondary);font-size:0.75rem;font-weight:600;flex-shrink:0;">
                    ${file2.name} (${pdfDoc2.numPages} стр.)
                  </div>
                  <div id="cmpPanelB" style="flex:1;overflow:auto;padding:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6;background:var(--bg);"></div>
                </div>
              </div>
            </div>`;

          document.body.appendChild(overlay);

          const panelA = overlay.querySelector('#cmpPanelA');
          const panelB = overlay.querySelector('#cmpPanelB');
          const pageLabel = overlay.querySelector('#cmpPageLabel');
          const viewMode = /** @type {HTMLSelectElement} */ (overlay.querySelector('#cmpViewMode'));
          let currentPage = 1;

          // Synchronized scroll
          let scrolling = false;
          panelA.addEventListener('scroll', () => {
            if (scrolling) return;
            scrolling = true;
            panelB.scrollTop = panelA.scrollTop;
            requestAnimationFrame(() => { scrolling = false; });
          });
          panelB.addEventListener('scroll', () => {
            if (scrolling) return;
            scrolling = true;
            panelA.scrollTop = panelB.scrollTop;
            requestAnimationFrame(() => { scrolling = false; });
          });

          const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          async function renderTextComparison(pageNum) {
            const getPageText = async (doc, p) => {
              if (p > doc.numPages) return '';
              const page = await doc.getPage(p);
              const content = await page.getTextContent();
              return content.items.map(item => item.str).join(' ');
            };

            const [textA, textB] = await Promise.all([
              getPageText(state.adapter.pdfDoc, pageNum),
              getPageText(pdfDoc2, pageNum),
            ]);

            const linesA = textA.split(/\n|(?<=\.)\s+/);
            const linesB = textB.split(/\n|(?<=\.)\s+/);

            // Side-by-side with diff highlighting
            let htmlA = '', htmlB = '';
            const maxLines = Math.max(linesA.length, linesB.length);
            for (let i = 0; i < maxLines; i++) {
              const a = linesA[i] || '';
              const b = linesB[i] || '';
              if (a === b) {
                htmlA += `<div style="padding:1px 4px;">${escXml(a)}</div>`;
                htmlB += `<div style="padding:1px 4px;">${escXml(b)}</div>`;
              } else {
                htmlA += `<div style="padding:1px 4px;background:rgba(248,113,113,0.15);border-left:3px solid #f87171;">${escXml(a) || '&nbsp;'}</div>`;
                htmlB += `<div style="padding:1px 4px;background:rgba(74,222,128,0.15);border-left:3px solid #4ade80;">${escXml(b) || '&nbsp;'}</div>`;
              }
            }
            panelA.innerHTML = htmlA;
            panelB.innerHTML = htmlB;
          }

          async function renderVisualComparison(pageNum) {
            panelA.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Рендер...</div>';
            panelB.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Рендер...</div>';

            const renderPage = async (doc, p) => {
              if (p > doc.numPages) return null;
              const page = await doc.getPage(p);
              const vp = page.getViewport({ scale: 1.2 });
              const canvas = document.createElement('canvas');
              canvas.width = vp.width;
              canvas.height = vp.height;
              canvas.style.cssText = 'max-width:100%;height:auto;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.15);';
              const ctx = canvas.getContext('2d');
              if (!ctx) return canvas;
              ctx.fillStyle = '#fff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: ctx, viewport: vp }).promise;
              return canvas;
            };

            const [canvasA, canvasB] = await Promise.all([
              renderPage(state.adapter.pdfDoc, pageNum),
              renderPage(pdfDoc2, pageNum),
            ]);

            panelA.innerHTML = '';
            panelB.innerHTML = '';
            if (canvasA) panelA.appendChild(canvasA);
            else panelA.innerHTML = '<div style="padding:20px;color:var(--text-muted);">Нет страницы</div>';
            if (canvasB) panelB.appendChild(canvasB);
            else panelB.innerHTML = '<div style="padding:20px;color:var(--text-muted);">Нет страницы</div>';
          }

          async function renderPage() {
            pageLabel.textContent = `${currentPage} / ${maxPages}`;
            if (viewMode.value === 'visual') {
              await renderVisualComparison(currentPage);
            } else {
              await renderTextComparison(currentPage);
            }
          }

          overlay.querySelector('#cmpPrev').addEventListener('click', async () => {
            if (currentPage > 1) { currentPage--; await renderPage(); }
          });
          overlay.querySelector('#cmpNext').addEventListener('click', async () => {
            if (currentPage < maxPages) { currentPage++; await renderPage(); }
          });
          viewMode.addEventListener('change', () => renderPage());
          overlay.querySelector('#closeCompare').addEventListener('click', () => overlay.remove());
          overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });

          // Keyboard navigation
          const keyHandler = (ev) => {
            if (!document.body.contains(overlay)) { document.removeEventListener('keydown', keyHandler); return; }
            if (ev.key === 'Escape') overlay.remove();
            if (ev.key === 'ArrowLeft' && currentPage > 1) { currentPage--; renderPage(); }
            if (ev.key === 'ArrowRight' && currentPage < maxPages) { currentPage++; renderPage(); }
          };
          document.addEventListener('keydown', keyHandler);

          await renderPage();
          _deps.setOcrStatus(`Сравнение: ${result.summary.changePercent}% различий (${result.summary.addedLines}+, ${result.summary.removedLines}-)`);
          _deps.pushDiagnosticEvent('pdf.compare', { changePercent: result.summary.changePercent });
        } catch (err) {
          _deps.setOcrStatus(`Ошибка сравнения: ${err?.message || 'неизвестная'}`);
        }
      };
      input.click();
    });
  }

  // ── Header/Footer ──
  { const _el = document.getElementById('pdfHeaderFooter'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      const format = await _deps.nrPrompt(
        'Шаблон колонтитула (переменные: {{page}}, {{total}}, {{date}}, {{title}}):\n' +
        'Пример: "{{page}} / {{total}}"',
        '{{page}} / {{total}}');
      if (!format) return;

      const position = await _deps.nrPrompt('Позиция: top (верх) или bottom (низ)?', 'bottom');
      if (!position) return;

      try {
        _deps.setOcrStatus('Добавление колонтитулов...');
        const arrayBuffer = await file.arrayBuffer();
        const blob = await _deps.addHeaderFooter(arrayBuffer, {
          [position === 'top' ? 'headerCenter' : 'footerCenter']: format,
        });
        await applyInPlace(blob, 'Колонтитулы добавлены');
        _deps.pushDiagnosticEvent('pdf.headerFooter');
      } catch (err) {
        _deps.setOcrStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // ── Bates Numbering ──
  { const _el = document.getElementById('pdfBatesNumber'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      const prefix = await _deps.nrPrompt('Префикс Бейтса (напр. "DOC-"):', 'DOC-');
      if (prefix === null) return;
      const startStr = await _deps.nrPrompt('Начальный номер:', '1');
      if (!startStr) return;

      try {
        _deps.setOcrStatus('Добавление нумерации Бейтса...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await _deps.addBatesNumbering(arrayBuffer, {
          prefix,
          startNum: parseInt(startStr, 10) || 1,
          digits: 6,
          position: 'bottom-right',
        });
        await applyInPlace(result.blob, `Нумерация Бейтса: ${result.startNum}–${result.endNum} (${result.totalPages} стр.)`);
        _deps.pushDiagnosticEvent('pdf.bates', { startNum: result.startNum, endNum: result.endNum });
      } catch (err) {
        _deps.setOcrStatus(`Ошибка нумерации: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // ── Page Organizer Buttons ──
  { const _el = document.getElementById('orgRotateCW'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;
      try {
        _deps.setOcrStatus('Поворот страницы по часовой стрелке...');
        const arrayBuffer = await file.arrayBuffer();
        const blob = await _deps.rotatePdfPages(arrayBuffer, [state.currentPage], 90);
        if (blob) {
          await applyInPlace(blob, 'Страница повёрнута на 90°');
        }
      } catch (err) {
        _deps.setOcrStatus(`Ошибка поворота: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  { const _el = document.getElementById('orgRotateCCW'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;
      try {
        _deps.setOcrStatus('Поворот страницы против часовой стрелки...');
        const arrayBuffer = await file.arrayBuffer();
        const blob = await _deps.rotatePdfPages(arrayBuffer, [state.currentPage], -90);
        if (blob) {
          await applyInPlace(blob, 'Страница повёрнута на -90°');
        }
      } catch (err) {
        _deps.setOcrStatus(`Ошибка поворота: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  { const _el = document.getElementById('orgDelete'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;
      if (state.pageCount <= 1) {
        _deps.setOcrStatus('Невозможно удалить единственную страницу');
        return;
      }
      const confirmed = await _deps.nrConfirm(`Удалить страницу ${state.currentPage} из документа?`);
      if (!confirmed) return;

      try {
        _deps.setOcrStatus('Удаление страницы...');
        const arrayBuffer = await file.arrayBuffer();
        const deletedPage = state.currentPage;
        // Extract all pages except current
        const pages = [];
        for (let i = 1; i <= state.pageCount; i++) {
          if (i !== deletedPage) pages.push(i);
        }
        const blob = await _deps.splitPdfDocument(arrayBuffer, pages);
        if (blob) {
          await applyInPlace(blob, `Страница ${deletedPage} удалена, осталось ${pages.length} стр.`);
        }
      } catch (err) {
        _deps.setOcrStatus(`Ошибка удаления: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  { const _el = document.getElementById('orgExtract'); if (_el) _el.addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;
      const rangeStr = await _deps.nrPrompt(`Извлечь страницы (напр. "1-3" или "2,5,7").\nТекущая: ${state.currentPage}, Всего: ${state.pageCount}`, String(state.currentPage));
      if (!rangeStr) return;

      const pageNums = _deps.parsePageRangeLib(rangeStr, state.pageCount);
      if (!pageNums.length) {
        _deps.setOcrStatus('Неверный диапазон страниц');
        return;
      }

      try {
        _deps.setOcrStatus(`Извлечение ${pageNums.length} страниц...`);
        const arrayBuffer = await file.arrayBuffer();
        const blob = await _deps.splitPdfDocument(arrayBuffer, pageNums);
        if (blob) {
          const url = _deps.safeCreateObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${state.docName || 'document'}-extracted.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          _deps.setOcrStatus(`Извлечено ${pageNums.length} страниц`);
        }
      } catch (err) {
        _deps.setOcrStatus(`Ошибка извлечения: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  { const _el = document.getElementById('orgInsertPages'); if (_el) _el.addEventListener('change', async (e) => {
      const file = requirePdfFile();
      if (!file) return;
      const insertFile = /** @type {HTMLInputElement} */ (e.target).files?.[0];
      if (!insertFile) return;

      try {
        _deps.setOcrStatus('Объединение PDF...');
        const blob = await _deps.mergePdfDocuments([file, insertFile]);
        if (blob) {
          await applyInPlace(blob, 'PDF-файлы объединены');
        }
      } catch (err) {
        _deps.setOcrStatus(`Ошибка объединения: ${err?.message || 'неизвестная'}`);
      }
      /** @type {HTMLInputElement} */ (e.target).value = '';
    });
  }
}
