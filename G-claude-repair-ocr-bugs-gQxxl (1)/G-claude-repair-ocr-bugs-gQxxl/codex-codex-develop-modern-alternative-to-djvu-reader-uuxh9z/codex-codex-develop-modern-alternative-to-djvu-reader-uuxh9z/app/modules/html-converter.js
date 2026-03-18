// ─── PDF → HTML Converter ───────────────────────────────────────────────────
// Converts PDF pages to clean, responsive HTML with CSS positioning.

/**
 * Convert extracted page data to an HTML document.
 * @param {object[]} pages - Array of page data objects
 * @param {string} pages[].text - Raw text content
 * @param {object[]} [pages[].items] - Text items with positions [{str, x, y, w, h, fontSize, fontName}]
 * @param {object} [opts]
 * @param {'flow'|'positioned'} [opts.layout='flow'] - Layout mode
 * @param {boolean} [opts.responsive=true] - Add responsive CSS
 * @param {boolean} [opts.includeImages=false] - Include page images as background
 * @param {string} [opts.title=''] - Document title
 * @returns {string} Complete HTML document string
 */
export function convertToHtml(pages, opts = {}) {
  const {
    layout = 'flow',
    responsive = true,
    includeImages = false,
    title = 'Exported Document',
  } = opts;

  const styles = buildCss(layout, responsive);
  const body = pages.map((page, i) => renderPage(page, i + 1, layout, includeImages)).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${styles}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function renderPage(page, pageNum, layout, includeImages) {
  const items = page.items || [];
  const text = page.text || '';

  if (layout === 'positioned' && items.length > 0) {
    return renderPositionedPage(items, pageNum, page);
  }

  return renderFlowPage(text, items, pageNum);
}

function renderFlowPage(text, items, pageNum) {
  // Group items into paragraphs by Y proximity
  const paragraphs = groupIntoParagraphs(items, text);

  const html = paragraphs.map(p => {
    if (p.type === 'heading') {
      const level = p.level || 2;
      return `<h${level}>${escapeHtml(p.text)}</h${level}>`;
    }
    return `<p>${escapeHtml(p.text)}</p>`;
  }).join('\n    ');

  return `  <div class="page" data-page="${pageNum}">
    <div class="page-number">— ${pageNum} —</div>
    ${html || `<p>${escapeHtml(text)}</p>`}
  </div>`;
}

function renderPositionedPage(items, pageNum, page) {
  const pw = page.width || 595;
  const ph = page.height || 842;

  const spans = items.map(item => {
    const left = ((item.x / pw) * 100).toFixed(2);
    const top = ((item.y / ph) * 100).toFixed(2);
    const fontSize = item.fontSize || 12;
    return `<span class="t" style="left:${left}%;top:${top}%;font-size:${fontSize}px">${escapeHtml(item.str)}</span>`;
  }).join('\n      ');

  return `  <div class="page page-positioned" data-page="${pageNum}" style="padding-top:${((ph / pw) * 100).toFixed(1)}%">
    <div class="page-inner">
      ${spans}
    </div>
    <div class="page-number">— ${pageNum} —</div>
  </div>`;
}

function groupIntoParagraphs(items, fallbackText) {
  if (!items || items.length === 0) {
    if (!fallbackText) return [];
    return fallbackText.split(/\n\s*\n/).filter(Boolean).map(t => ({ type: 'paragraph', text: t.trim() }));
  }

  // Sort by Y then X
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const paragraphs = [];
  let currentPara = [];
  let lastY = -Infinity;
  let lastFontSize = 12;

  for (const item of sorted) {
    const yGap = Math.abs(item.y - lastY);
    const lineHeight = (item.fontSize || 12) * 1.5;

    if (yGap > lineHeight && currentPara.length > 0) {
      // New paragraph
      paragraphs.push(finalizeParagraph(currentPara, lastFontSize));
      currentPara = [];
    }

    currentPara.push(item);
    lastY = item.y;
    lastFontSize = item.fontSize || 12;
  }

  if (currentPara.length > 0) {
    paragraphs.push(finalizeParagraph(currentPara, lastFontSize));
  }

  return paragraphs;
}

function finalizeParagraph(items, fontSize) {
  const text = items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
  const isHeading = fontSize > 16 || (items.length <= 3 && text.length < 100 && /^[A-ZА-ЯЁ]/.test(text));
  const level = fontSize >= 24 ? 1 : fontSize >= 18 ? 2 : 3;

  return {
    type: isHeading ? 'heading' : 'paragraph',
    text,
    level: isHeading ? level : undefined,
  };
}

function buildCss(layout, responsive) {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #1a1a2e;
  background: #f4f4f8;
  padding: 1rem;
}
.page {
  background: #fff;
  max-width: 800px;
  margin: 1rem auto;
  padding: 2.5rem 3rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border-radius: 4px;
  page-break-after: always;
}
.page-positioned {
  position: relative;
  width: 100%;
  padding: 0;
  overflow: hidden;
}
.page-inner {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
}
.page-inner .t {
  position: absolute;
  white-space: nowrap;
}
h1 { font-size: 1.8rem; margin: 0.8em 0 0.4em; color: #1a1a3e; }
h2 { font-size: 1.4rem; margin: 0.7em 0 0.3em; color: #2a2a4e; }
h3 { font-size: 1.15rem; margin: 0.6em 0 0.3em; color: #3a3a5e; }
p { margin: 0.5em 0; text-align: justify; }
.page-number {
  text-align: center;
  color: #999;
  font-size: 0.8rem;
  margin-top: 1.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
}
${responsive ? `
@media (max-width: 600px) {
  .page { padding: 1.2rem 1rem; margin: 0.5rem; }
  body { padding: 0; }
}
@media print {
  body { background: #fff; padding: 0; }
  .page { box-shadow: none; margin: 0; border-radius: 0; }
}` : ''}
`.trim();
}

/**
 * Convert a single page's text to a simple HTML fragment.
 */
export function pageToHtmlFragment(text, pageNum) {
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('\n');
}

/**
 * Export HTML as a downloadable file.
 */
export function downloadHtml(htmlString, filename = 'document.html') {
  const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
