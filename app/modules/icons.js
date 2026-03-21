// @ts-check
// ─── Icon System (Lucide-inspired SVG icons) ────────────────────────────────
// Provides clean, consistent SVG icon strings for use throughout the UI.
// Each icon is a 16x16 SVG with stroke-based design for crisp rendering.

const s = (d, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/** @type {Record<string, string>} */
export const icons = {
  // ── File / Document ──
  folderOpen:    s('<path d="M2 4v9a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3H3a1 1 0 00-1 1z"/>'),
  file:          s('<path d="M4 2h5l4 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v4h4"/>'),
  filePlus:      s('<path d="M4 2h5l4 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v4h4"/><path d="M8 9v4M6 11h4"/>'),
  download:      s('<path d="M3 13h10"/><path d="M8 3v7"/><path d="M5 7l3 3 3-3"/>'),
  upload:        s('<path d="M3 13h10"/><path d="M8 10V3"/><path d="M5 6l3-3 3 3"/>'),

  // ── Edit / Annotation ──
  pencil:        s('<path d="M2.5 11.5l8-8 2 2-8 8-3 1z"/>'),
  undo:          s('<path d="M4 7h5a3 3 0 110 6H7"/><path d="M4 7l3-3M4 7l3 3"/>'),
  redo:          s('<path d="M12 7H7a3 3 0 100 6h2"/><path d="M12 7l-3-3M12 7l-3 3"/>'),
  trash:         s('<path d="M3 4h10"/><path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/><path d="M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4"/>'),
  save:          s('<path d="M3 2h8l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M5 2v4h5V2"/><path d="M5 14v-4h6v4"/>'),
  eraser:        s('<path d="M7 3l6 6-4 4H5l-2-2 4-4"/><path d="M10 6l-4 4"/>'),

  // ── Clipboard ──
  clipboard:     s('<rect x="4" y="3" width="8" height="11" rx="1"/><path d="M6 1h4v3H6z"/><path d="M6 8h4M6 10h3"/>'),
  copy:          s('<rect x="5" y="5" width="8" height="9" rx="1"/><path d="M3 11V3a1 1 0 011-1h7"/>'),

  // ── Search ──
  search:        s('<circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/>'),
  searchSlash:   s('<circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/><path d="M5 9l4-4"/>'),

  // ── Navigation ──
  chevronUp:     s('<path d="M4 10l4-4 4 4"/>'),
  chevronDown:   s('<path d="M4 6l4 4 4-4"/>'),
  chevronLeft:   s('<path d="M10 3L5 8l5 5"/>'),
  chevronRight:  s('<path d="M6 3l5 5-5 5"/>'),
  arrowReturn:   s('<path d="M4 8h8"/><path d="M4 8l3-3M4 8l3 3"/>'),

  // ── View ──
  eye:           s('<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>'),
  eyeOff:        s('<path d="M2 2l12 12"/><path d="M6.5 6.5a2 2 0 002.8 2.8"/><path d="M1 8s3-5 7-5c1 0 1.8.3 2.6.7"/>'),

  // ── Close / X ──
  x:             s('<path d="M4 4l8 8M12 4l-8 8"/>'),

  // ── Zoom ──
  zoomIn:        s('<circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/><path d="M7 5v4M5 7h4"/>'),
  zoomOut:       s('<circle cx="7" cy="7" r="4"/><path d="M11 11l3 3"/><path d="M5 7h4"/>'),

  // ── Layout / Panels ──
  panelLeft:     s('<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M6 2v12"/>'),
  columns:       s('<rect x="2" y="2" width="5" height="12" rx="1"/><rect x="9" y="2" width="5" height="12" rx="1"/>'),

  // ── Rotate ──
  rotateCw:      s('<path d="M13 7a5 5 0 10-1 3"/><path d="M14 4l-2 3h3"/>'),
  rotateCcw:     s('<path d="M3 7a5 5 0 111 3"/><path d="M2 4l2 3H1"/>'),

  // ── Fullscreen ──
  maximize:      s('<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>'),

  // ── Clock / Timer ──
  clock:         s('<circle cx="8" cy="8" r="6"/><path d="M8 4v4l2 2"/>'),

  // ── Alert / Warning ──
  alertTriangle: s('<path d="M8 1L1 14h14L8 1z"/><path d="M8 6v4M8 12h0"/>'),

  // ── Settings / Gear ──
  settings:      s('<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/>'),

  // ── Bookmark ──
  bookmark:      s('<path d="M4 2h8v12l-4-3-4 3z"/>'),

  // ── Text / OCR ──
  type:          s('<path d="M4 4h8M8 4v8M6 12h4"/>'),
  scan:          s('<path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2"/>'),

  // ── Printer ──
  printer:       s('<path d="M4 6V2h8v4"/><rect x="2" y="6" width="12" height="6" rx="1"/><path d="M4 12v2h8v-2"/>'),

  // ── Merge / Split ──
  merge:         s('<path d="M4 4h3l5 4-5 4H4"/><path d="M12 8H8"/>'),
  scissors:      s('<circle cx="5" cy="5" r="2"/><circle cx="5" cy="11" r="2"/><path d="M13 3L6.6 6.4M6.6 9.6L13 13"/>'),

  // ── Stamp / Signature ──
  stamp:         s('<path d="M4 13h8"/><path d="M6 13V9h4v4"/><path d="M5 9h6a3 3 0 00-6 0z"/>'),
  penTool:       s('<path d="M3 13l2-8 6 6-8 2z"/><path d="M11 5l2-2"/>'),

  // ── Image ──
  image:         s('<rect x="2" y="2" width="12" height="12" rx="1.5"/><circle cx="6" cy="6" r="1.5"/><path d="M14 10l-3-3-7 7"/>'),

  // ── Watermark ──
  droplet:       s('<path d="M8 2C5.5 6 3 8.5 3 10.5a5 5 0 0010 0C13 8.5 10.5 6 8 2z"/>'),

  // ── Security / Lock ──
  lock:          s('<rect x="4" y="7" width="8" height="7" rx="1.5"/><path d="M6 7V5a2 2 0 014 0v2"/>'),
  shield:        s('<path d="M8 2l6 2v4c0 4-3 6-6 8-3-2-6-4-6-8V4z"/>'),

  // ── Package / Optimize ──
  package:       s('<path d="M2 5l6-3 6 3v6l-6 3-6-3z"/><path d="M2 5l6 3 6-3"/><path d="M8 14V8"/>'),

  // ── Accessibility ──
  accessibility: s('<circle cx="8" cy="3" r="1.5"/><path d="M4 7l4 1 4-1"/><path d="M6 14l2-6 2 6"/>'),

  // ── Compare / Diff ──
  diffIcon:      s('<rect x="2" y="2" width="5" height="12" rx="1"/><rect x="9" y="2" width="5" height="12" rx="1"/><path d="M4 6h1M11 6h1M4 10h1M11 10h1"/>'),

  // ── Header / Footer ──
  layoutList:    s('<rect x="2" y="2" width="12" height="3" rx="1"/><rect x="2" y="7" width="12" height="2" rx="0.5"/><rect x="2" y="11" width="12" height="3" rx="1"/>'),

  // ── Numbering ──
  hash:          s('<path d="M4 1v14M10 1v14M1 5h14M1 11h14"/>'),

  // ── Stop ──
  squareStop:    s('<rect x="3" y="3" width="10" height="10" rx="1.5"/>'),

  // ── Globe ──
  globe:         s('<circle cx="8" cy="8" r="6"/><path d="M2 8h12"/><path d="M8 2c2 2 3 4 3 6s-1 4-3 6c-2-2-3-4-3-6s1-4 3-6"/>'),

  // ── Word doc ──
  fileText:      s('<path d="M4 2h5l4 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v4h4"/><path d="M6 8h4M6 10h3"/>'),

  // ── Filter / Advanced search ──
  filter:        s('<path d="M2 3h12l-4 5v4l-4 2V8z"/>'),

  // ── Flatten ──
  layers:        s('<path d="M2 8l6-4 6 4-6 4z"/><path d="M2 11l6 4 6-4"/>'),

  // ── Health ──
  heartPulse:    s('<path d="M8 14S2 10 2 6a3 3 0 016-1 3 3 0 016 1c0 4-6 8-6 8z"/><path d="M4 8h2l1-2 2 4 1-2h2"/>'),

  // ── Collapse / Expand ──
  chevronsUp:    s('<path d="M4 10l4-3 4 3"/><path d="M4 7l4-3 4 3"/>'),
  chevronsDown:  s('<path d="M4 6l4 3 4-3"/><path d="M4 9l4 3 4-3"/>'),
};

/**
 * Get an SVG icon string by name.
 * @param {string} name - Icon name from the icons map
 * @param {number} [size=16] - Override icon size
 * @returns {string} SVG string or empty string if not found
 */
export function icon(name, size) {
  if (!size || size === 16) return icons[name] || '';
  // Rebuild with custom size
  const svg = icons[name];
  if (!svg) return '';
  return svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
}
