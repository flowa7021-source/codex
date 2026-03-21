// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — PDF Document Comparison Module
// Text-based and visual comparison of two PDF documents
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute a diff between two text arrays using a simple LCS-based approach.
 * Returns an array of {type: 'equal'|'add'|'remove', text: string, line: number}
 */
function computeLineDiff(linesA, linesB) {
  const _result = [];
  const m = linesA.length;
  const n = linesB.length;

  // Build LCS table (O(mn) — acceptable for documents up to ~5000 lines)
  const maxSize = 5000;
  if (m > maxSize || n > maxSize) {
    // Fallback: simple sequential comparison for very large docs
    return simpleDiff(linesA, linesB);
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  let i = m, j = n;
  const backtrack = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      backtrack.push({ type: 'equal', text: linesA[i - 1], lineA: i, lineB: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      backtrack.push({ type: 'add', text: linesB[j - 1], lineB: j });
      j--;
    } else {
      backtrack.push({ type: 'remove', text: linesA[i - 1], lineA: i });
      i--;
    }
  }

  return backtrack.reverse();
}

function simpleDiff(linesA, linesB) {
  const result = [];
  const maxLen = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < maxLen; i++) {
    const a = linesA[i];
    const b = linesB[i];

    if (a === b) {
      result.push({ type: 'equal', text: a, lineA: i + 1, lineB: i + 1 });
    } else {
      if (a !== undefined) result.push({ type: 'remove', text: a, lineA: i + 1 });
      if (b !== undefined) result.push({ type: 'add', text: b, lineB: i + 1 });
    }
  }
  return result;
}

/**
 * Compute word-level diff for changed lines
 */
function computeWordDiff(textA, textB) {
  const wordsA = textA.split(/\s+/);
  const wordsB = textB.split(/\s+/);

  const _result = [];
  const m = wordsA.length;
  const n = wordsB.length;

  if (m > 500 || n > 500) {
    return [{ type: 'remove', text: textA }, { type: 'add', text: textB }];
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  let i = m, j = n;
  const backtrack = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      backtrack.push({ type: 'equal', text: wordsA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      backtrack.push({ type: 'add', text: wordsB[j - 1] });
      j--;
    } else {
      backtrack.push({ type: 'remove', text: wordsA[i - 1] });
      i--;
    }
  }

  return backtrack.reverse();
}

export class PdfCompare {
  /**
   * Extract all text from a PDF via PDF.js
   * @param {Object} pdfDocument - PDF.js document
   * @returns {Promise<string[]>} Array of text per page
   */
  async extractAllText(pdfDocument) {
    const pages = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      pages.push(text);
    }
    return pages;
  }

  /**
   * Compare text content of two PDFs
   */
  async compareText(pdfDocA, pdfDocB) {
    const textA = await this.extractAllText(pdfDocA);
    const textB = await this.extractAllText(pdfDocB);

    const allTextA = textA.join('\n').split('\n');
    const allTextB = textB.join('\n').split('\n');

    const diff = computeLineDiff(allTextA, allTextB);

    const added = diff.filter(d => d.type === 'add');
    const removed = diff.filter(d => d.type === 'remove');
    const equal = diff.filter(d => d.type === 'equal');

    return {
      diff,
      summary: {
        totalLines: diff.length,
        addedLines: added.length,
        removedLines: removed.length,
        unchangedLines: equal.length,
        changePercent: diff.length > 0
          ? ((added.length + removed.length) / diff.length * 100).toFixed(1)
          : '0.0',
      },
      pagesA: textA.length,
      pagesB: textB.length,
    };
  }

  /**
   * Visual pixel-diff of a specific page
   */
  async compareVisual(pdfDocA, pdfDocB, pageNum, scale = 1.5) {
    const renderPage = async (pdfDoc, num) => {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { canvas, ctx: null, width: viewport.width, height: viewport.height };
      await page.render({ canvasContext: ctx, viewport }).promise;
      return { canvas, ctx, width: viewport.width, height: viewport.height };
    };

    const pageNumA = Math.min(pageNum, pdfDocA.numPages);
    const pageNumB = Math.min(pageNum, pdfDocB.numPages);

    const [a, b] = await Promise.all([
      renderPage(pdfDocA, pageNumA),
      renderPage(pdfDocB, pageNumB),
    ]);

    // Create diff canvas
    const width = Math.max(a.width, b.width);
    const height = Math.max(a.height, b.height);
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext('2d');
    if (!diffCtx) return null;

    const imgDataA = a.ctx.getImageData(0, 0, a.width, a.height);
    const imgDataB = b.ctx.getImageData(0, 0, b.width, b.height);
    const diffImgData = diffCtx.createImageData(width, height);

    let diffPixels = 0;
    const totalPixels = width * height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const idxA = x < a.width && y < a.height ? (y * a.width + x) * 4 : -1;
        const idxB = x < b.width && y < b.height ? (y * b.width + x) * 4 : -1;

        const rA = idxA >= 0 ? imgDataA.data[idxA] : 255;
        const gA = idxA >= 0 ? imgDataA.data[idxA + 1] : 255;
        const bA = idxA >= 0 ? imgDataA.data[idxA + 2] : 255;

        const rB = idxB >= 0 ? imgDataB.data[idxB] : 255;
        const gB = idxB >= 0 ? imgDataB.data[idxB + 1] : 255;
        const bB = idxB >= 0 ? imgDataB.data[idxB + 2] : 255;

        const diff = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);

        if (diff > 30) { // Threshold for "different"
          diffPixels++;
          // Highlight differences: red for A-only, green for B-only, yellow for changed
          if (idxA < 0) {
            diffImgData.data[idx] = 0; diffImgData.data[idx + 1] = 200; diffImgData.data[idx + 2] = 0; // Green (added)
          } else if (idxB < 0) {
            diffImgData.data[idx] = 200; diffImgData.data[idx + 1] = 0; diffImgData.data[idx + 2] = 0; // Red (removed)
          } else {
            diffImgData.data[idx] = 255; diffImgData.data[idx + 1] = 200; diffImgData.data[idx + 2] = 0; // Yellow (changed)
          }
          diffImgData.data[idx + 3] = 180;
        } else {
          // Desaturated original
          const gray = Math.round((rB + gB + bB) / 3);
          diffImgData.data[idx] = gray;
          diffImgData.data[idx + 1] = gray;
          diffImgData.data[idx + 2] = gray;
          diffImgData.data[idx + 3] = 255;
        }
      }
    }

    diffCtx.putImageData(diffImgData, 0, 0);

    return {
      diffCanvas,
      canvasA: a.canvas,
      canvasB: b.canvas,
      diffPercent: ((diffPixels / totalPixels) * 100).toFixed(2),
      diffPixels,
      totalPixels,
    };
  }

  /**
   * Generate an HTML report of the comparison
   */
  generateDiffHtml(diff) {
    const lines = [];
    lines.push('<div class="diff-report">');

    for (const entry of diff) {
      const cls = entry.type === 'add' ? 'diff-add' : entry.type === 'remove' ? 'diff-remove' : 'diff-equal';
      const prefix = entry.type === 'add' ? '+' : entry.type === 'remove' ? '−' : ' ';
      const escaped = (entry.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      lines.push(`<div class="${cls}"><span class="diff-prefix">${prefix}</span> ${escaped}</div>`);
    }

    lines.push('</div>');
    return lines.join('\n');
  }
}

export const pdfCompare = new PdfCompare();
export { computeLineDiff, computeWordDiff };
