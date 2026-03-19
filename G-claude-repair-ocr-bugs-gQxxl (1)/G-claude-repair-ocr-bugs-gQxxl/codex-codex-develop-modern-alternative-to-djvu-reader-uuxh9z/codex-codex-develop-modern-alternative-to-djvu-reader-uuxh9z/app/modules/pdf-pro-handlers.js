// ─── PDF Pro Handlers ─────────────────────────────────────────────────────────
// Pro PDF tool event handler registrations (redact, optimize, flatten, accessibility,
// compare, header/footer, Bates numbering, page organizer buttons).
// Extracted from app.js as part of module decomposition.

import { PdfRedactor, REDACTION_PATTERNS } from './pdf-redact.js';
import { state } from './state.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
let _deps = {
  setOcrStatus: () => {},
  nrPrompt: async () => null,
  nrConfirm: async () => false,
  safeCreateObjectURL: (b) => URL.createObjectURL(b),
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

export function initPdfProHandlers() {

  // ── PDF Redaction ──
  if (document.getElementById('pdfRedact')) {
    document.getElementById('pdfRedact').addEventListener('click', async () => {
      const file = requirePdfFile();
      if (!file) return;

      const patternName = await _deps.nrPrompt(
        'Выберите тип данных для редактирования:\n' +
        Object.keys(REDACTION_PATTERNS).join(', ') +
        '\n\nИли введите произвольный regex:');
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
            pdfRedactor.markPattern(p, text, patternName);
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
  if (document.getElementById('pdfOptimize')) {
    document.getElementById('pdfOptimize').addEventListener('click', async () => {
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
  if (document.getElementById('pdfFlatten')) {
    document.getElementById('pdfFlatten').addEventListener('click', async () => {
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
  if (document.getElementById('pdfAccessibility')) {
    document.getElementById('pdfAccessibility').addEventListener('click', async () => {
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

  // ── PDF Compare ──
  if (document.getElementById('pdfCompare')) {
    document.getElementById('pdfCompare').addEventListener('click', async () => {
      if (!state.adapter || state.adapter.type !== 'pdf') {
        _deps.setOcrStatus('Откройте PDF-файл для сравнения');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = async (e) => {
        const file2 = e.target.files?.[0];
        if (!file2) return;

        try {
          _deps.setOcrStatus('Сравнение документов...');
          const pdf = await _deps.ensurePdfJs();
          const ab2 = await file2.arrayBuffer();
          const pdfDoc2 = await pdf.getDocument({ data: ab2 }).promise;

          const result = await _deps.pdfCompare.compareText(state.adapter.pdfDoc, pdfDoc2);
          const html = _deps.pdfCompare.generateDiffHtml(result.diff);

          // Show results in a new window
          const win = window.open('', '_blank', 'width=800,height=600');
          if (win) {
            win.document.write(`
              <html><head><title>Сравнение документов</title>
              <style>
                body { font-family: monospace; font-size: 13px; padding: 16px; background: #1b1b1f; color: #d4d4d8; }
                .diff-add { background: #1a3a1a; color: #4ade80; }
                .diff-remove { background: #3a1a1a; color: #f87171; }
                .diff-equal { color: #71717a; }
                .diff-prefix { display: inline-block; width: 20px; }
                h2 { color: #e4e4e7; }
              </style></head><body>
              <h2>Сравнение: ${state.docName} vs ${file2.name}</h2>
              <p>Изменено строк: ${result.summary.changePercent}% (${result.summary.addedLines} добавлено, ${result.summary.removedLines} удалено)</p>
              ${html}
              </body></html>`);
            win.document.close();
          }

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
  if (document.getElementById('pdfHeaderFooter')) {
    document.getElementById('pdfHeaderFooter').addEventListener('click', async () => {
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
  if (document.getElementById('pdfBatesNumber')) {
    document.getElementById('pdfBatesNumber').addEventListener('click', async () => {
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
  if (document.getElementById('orgRotateCW')) {
    document.getElementById('orgRotateCW').addEventListener('click', async () => {
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

  if (document.getElementById('orgRotateCCW')) {
    document.getElementById('orgRotateCCW').addEventListener('click', async () => {
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

  if (document.getElementById('orgDelete')) {
    document.getElementById('orgDelete').addEventListener('click', async () => {
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

  if (document.getElementById('orgExtract')) {
    document.getElementById('orgExtract').addEventListener('click', async () => {
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

  if (document.getElementById('orgInsertPages')) {
    document.getElementById('orgInsertPages').addEventListener('change', async (e) => {
      const file = requirePdfFile();
      if (!file) return;
      const insertFile = e.target.files?.[0];
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
      e.target.value = '';
    });
  }
}
