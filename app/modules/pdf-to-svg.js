// @ts-check
// ─── PDF → SVG Converter ─────────────────────────────────────────────────────
// Converts a single PDF page to an SVG string by extracting text content
// and positioning <text> elements using the original PDF coordinates.
// The SVG coordinate system has origin at top-left; PDF origin is bottom-left,
// so Y coordinates are flipped.

/**
 * Escape XML special characters for safe embedding in SVG.
 * @param {string} text
 * @returns {string}
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert a single PDF page to an SVG string.
 *
 * @param {any} pdfDoc - PDF.js document proxy (from getDocument().promise)
 * @param {number} pageNum - 1-based page number
 * @returns {Promise<string>} SVG markup
 */
export async function convertPdfPageToSvg(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const textContent = await page.getTextContent();

  /** @type {string[]} */
  const svgElements = [];

  // Optional: add a white background rectangle
  svgElements.push(
    `  <rect width="${pageWidth}" height="${pageHeight}" fill="white"/>`,
  );

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue;

    const text = item.str;
    const tx = item.transform;

    // tx = [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const fontSize = Math.abs(tx[3]) || 12;
    const x = tx[4];
    // Flip Y: PDF origin is bottom-left, SVG is top-left
    const y = pageHeight - tx[5];

    // Determine font properties from fontName
    const fontName = item.fontName || '';
    const isBold = /bold|black|heavy/i.test(fontName);
    const isItalic = /italic|oblique/i.test(fontName);

    // Clean font family name (remove subset prefix like "ABCDEF+")
    let fontFamily = fontName.replace(/^[A-Z]{6}\+/, '').replace(/-/g, ' ');
    if (!fontFamily) fontFamily = 'sans-serif';

    // Build style attributes
    const styles = [];
    styles.push(`font-size: ${fontSize.toFixed(1)}px`);
    styles.push(`font-family: ${fontFamily}, sans-serif`);
    if (isBold) styles.push('font-weight: bold');
    if (isItalic) styles.push('font-style: italic');

    svgElements.push(
      `  <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" style="${styles.join('; ')}">${escapeXml(text)}</text>`,
    );
  }

  page.cleanup();

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" width="${pageWidth}" height="${pageHeight}">`,
    ...svgElements,
    '</svg>',
  ].join('\n');

  return svg;
}
