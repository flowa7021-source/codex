// @ts-check
// ─── SVG Utilities ───────────────────────────────────────────────────────────
// SVG creation and manipulation helpers for PDF reader UI components.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * SVG namespace constant.
 */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with optional attributes. */
export function createSVGElement(
  tag: string,
  attrs?: Record<string, string | number>,
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag) as SVGElement;
  if (attrs) {
    setSVGAttrs(el, attrs);
  }
  return el;
}

/** Create a complete SVG root element with viewBox and optional size. */
export function createSVG(
  viewBox: string,
  width?: number | string,
  height?: number | string,
): SVGSVGElement {
  const svg = createSVGElement('svg') as SVGSVGElement;
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('xmlns', SVG_NS);
  if (width !== undefined) svg.setAttribute('width', String(width));
  if (height !== undefined) svg.setAttribute('height', String(height));
  return svg;
}

/** Create an SVG path element from a 'd' attribute string. */
export function createPath(
  d: string,
  attrs?: Record<string, string | number>,
): SVGPathElement {
  const el = createSVGElement('path', { d, ...attrs }) as SVGPathElement;
  return el;
}

/** Create an SVG circle element. */
export function createCircle(
  cx: number,
  cy: number,
  r: number,
  attrs?: Record<string, string | number>,
): SVGCircleElement {
  return createSVGElement('circle', { cx, cy, r, ...attrs }) as SVGCircleElement;
}

/** Create an SVG rect element. */
export function createRect(
  x: number,
  y: number,
  width: number,
  height: number,
  attrs?: Record<string, string | number>,
): SVGRectElement {
  return createSVGElement('rect', { x, y, width, height, ...attrs }) as SVGRectElement;
}

/** Create an SVG line element. */
export function createLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attrs?: Record<string, string | number>,
): SVGLineElement {
  return createSVGElement('line', { x1, y1, x2, y2, ...attrs }) as SVGLineElement;
}

/** Create an SVG text element. */
export function createSVGText(
  content: string,
  x: number,
  y: number,
  attrs?: Record<string, string | number>,
): SVGTextElement {
  const el = createSVGElement('text', { x, y, ...attrs }) as SVGTextElement;
  el.textContent = content;
  return el;
}

/** Set multiple attributes on an SVG element at once. */
export function setSVGAttrs(element: SVGElement, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
}

/** Serialize an SVG element to a string. */
export function svgToString(svg: SVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

/** Create an SVG icon (common icon patterns for PDF readers). */
export function createIcon(
  name: 'chevron-left' | 'chevron-right' | 'zoom-in' | 'zoom-out' | 'close' | 'menu',
  size = 24,
): SVGSVGElement {
  const svg = createSVG(`0 0 24 24`, size, size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  let path: SVGPathElement;

  switch (name) {
    case 'chevron-left':
      path = createPath('M15 18l-6-6 6-6');
      break;
    case 'chevron-right':
      path = createPath('M9 18l6-6-6-6');
      break;
    case 'zoom-in':
      path = createPath('M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6');
      break;
    case 'zoom-out':
      path = createPath('M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM8 11h6');
      break;
    case 'close':
      path = createPath('M18 6L6 18M6 6l12 12');
      break;
    case 'menu':
      path = createPath('M3 12h18M3 6h18M3 18h18');
      break;
  }

  svg.appendChild(path!);
  return svg;
}
