// ─── ePub Adapter ────────────────────────────────────────────────────────────
// Lightweight ePub reader: parses OEBPS/OPF container, extracts XHTML chapters,
// renders them as styled text on canvas.

import { loadImage } from './utils.js';

function extractFileFromZip(bytes, targetName) {
  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4B && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const name = decoder.decode(bytes.slice(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      if (name === targetName || name.endsWith('/' + targetName)) {
        return decoder.decode(bytes.slice(dataStart, dataStart + compSize));
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

function extractBinaryFromZip(bytes, targetName) {
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4B && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const decoder = new TextDecoder('utf-8');
      const name = decoder.decode(bytes.slice(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      if (name === targetName || name.endsWith('/' + targetName)) {
        return bytes.slice(dataStart, dataStart + compSize);
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

function listZipEntries(bytes) {
  const entries = [];
  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4B && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const name = decoder.decode(bytes.slice(pos + 30, pos + 30 + nameLen));
      entries.push(name);
      pos = pos + 30 + nameLen + extraLen + compSize;
    } else {
      pos++;
    }
  }
  return entries;
}

function parseContainer(containerXml) {
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match ? match[1] : null;
}

function parseOpf(opfXml, basePath) {
  const items = {};
  const spine = [];

  const manifestMatches = opfXml.matchAll(/<item\s[^>]*?id="([^"]*)"[^>]*?href="([^"]*)"[^>]*?media-type="([^"]*)"[^>]*/g);
  for (const m of manifestMatches) {
    items[m[1]] = { href: basePath + m[2], mediaType: m[3] };
  }

  const spineMatches = opfXml.matchAll(/<itemref\s[^>]*?idref="([^"]*)"/g);
  for (const m of spineMatches) {
    if (items[m[1]]) {
      spine.push(items[m[1]]);
    }
  }

  const tocMatches = opfXml.matchAll(/<item\s[^>]*?href="([^"]*)"[^>]*?media-type="application\/x-dtbncx\+xml"/g);
  let tocHref = null;
  for (const m of tocMatches) {
    tocHref = basePath + m[1];
    break;
  }

  return { items, spine, tocHref };
}

function stripHtmlTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractChapterTitle(html) {
  const headingMatch = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/is);
  if (headingMatch) {
    return stripHtmlTags(headingMatch[1]).trim().slice(0, 100);
  }
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  if (titleMatch) {
    return stripHtmlTags(titleMatch[1]).trim().slice(0, 100);
  }
  return null;
}

export async function parseEpub(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  const containerXml = extractFileFromZip(bytes, 'META-INF/container.xml');
  if (!containerXml) throw new Error('Invalid ePub: missing container.xml');

  const opfPath = parseContainer(containerXml);
  if (!opfPath) throw new Error('Invalid ePub: missing rootfile path');

  const opfXml = extractFileFromZip(bytes, opfPath);
  if (!opfXml) throw new Error('Invalid ePub: missing OPF file');

  const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const { spine, tocHref } = parseOpf(opfXml, basePath);

  const chapters = [];
  for (const item of spine) {
    const content = extractFileFromZip(bytes, item.href);
    if (content) {
      const title = extractChapterTitle(content);
      const text = stripHtmlTags(content);
      chapters.push({ title: title || `Chapter ${chapters.length + 1}`, text, href: item.href });
    }
  }

  let toc = [];
  if (tocHref) {
    const tocXml = extractFileFromZip(bytes, tocHref);
    if (tocXml) {
      toc = parseToc(tocXml);
    }
  }

  return { chapters, toc, bytes };
}

function parseToc(ncxXml) {
  const items = [];
  const matches = ncxXml.matchAll(/<navPoint[^>]*>[\s\S]*?<text>(.*?)<\/text>[\s\S]*?<content\s+src="([^"]*)"[\s\S]*?<\/navPoint>/g);
  for (const m of matches) {
    items.push({ title: stripHtmlTags(m[1]), src: m[2] });
  }
  return items;
}

export class EpubAdapter {
  constructor(epubData, fileName) {
    this.fileName = fileName;
    this.type = 'epub';
    this.chapters = epubData.chapters;
    this.toc = epubData.toc;
    this.epubBytes = epubData.bytes;
    this.pageCount = this.chapters.length || 1;
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const w = 800 * scale;
    const h = 1100 * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const chapter = this.chapters[pageNumber - 1];
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const baseW = 800;
    const baseH = 1100;
    const w = baseW * zoom;
    const h = baseH * zoom;

    if (rotation % 180 === 0) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = h * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    if (rotation !== 0) {
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
    }

    // Background
    const isDark = document.body.classList.contains('theme-dark') || document.documentElement.dataset.theme === 'dark';
    ctx.fillStyle = isDark ? '#1a1d23' : '#fffef8';
    ctx.fillRect(0, 0, w, h);

    if (!chapter) {
      ctx.fillStyle = isDark ? '#9aa6b8' : '#666';
      ctx.font = `${16 * zoom}px sans-serif`;
      ctx.fillText('Empty chapter', 40 * zoom, 60 * zoom);
      ctx.restore();
      return;
    }

    // Title
    const titleSize = Math.round(22 * zoom);
    const bodySize = Math.round(14 * zoom);
    const lineHeight = Math.round(bodySize * 1.6);
    const margin = Math.round(40 * zoom);
    const maxWidth = w - margin * 2;

    ctx.fillStyle = isDark ? '#e2e8f0' : '#1a1a1a';
    ctx.font = `bold ${titleSize}px serif`;
    ctx.fillText(chapter.title || `Chapter ${pageNumber}`, margin, margin + titleSize);

    // Body text
    ctx.font = `${bodySize}px serif`;
    ctx.fillStyle = isDark ? '#cbd5e1' : '#333';

    const text = chapter.text || '';
    const words = text.split(/\s+/);
    let x = margin;
    let y = margin + titleSize + lineHeight * 1.5;
    const maxY = h - margin;

    for (const word of words) {
      if (y > maxY) break;
      const measured = ctx.measureText(word + ' ');
      if (x + measured.width > margin + maxWidth && x > margin) {
        x = margin;
        y += lineHeight;
        if (y > maxY) break;
      }
      if (word === '' || word === '\n') {
        x = margin;
        y += lineHeight;
        continue;
      }
      ctx.fillText(word, x, y);
      x += measured.width;
    }

    ctx.restore();
  }

  async getText(pageNumber) {
    const chapter = this.chapters[pageNumber - 1];
    return chapter?.text || '';
  }

  async getOutline() {
    if (this.toc.length) {
      return this.toc.map((item, idx) => ({
        title: item.title,
        dest: idx + 1,
        items: [],
      }));
    }
    return this.chapters.map((ch, idx) => ({
      title: ch.title || `Chapter ${idx + 1}`,
      dest: idx + 1,
      items: [],
    }));
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (Number.isInteger(n) && n >= 1 && n <= this.pageCount) return n;
    return null;
  }
}
