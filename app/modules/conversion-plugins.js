// ─── Conversion Plugins Module ───────────────────────────────────────────────
// Plugin system for complex tabular templates: invoices, reports, custom tables

const plugins = new Map();

class ConversionPlugin {
  constructor(id, name, description) {
    this.id = id;
    this.name = name;
    this.description = description;
  }

  detect(_text) { return false; }
  transform(_text, _pageNum) { return _text; }
  toDocxXml(_text, _pageNum) { return null; }
}

// ─── Invoice Plugin ─────────────────────────────────────────────────────────
class InvoicePlugin extends ConversionPlugin {
  constructor() {
    super('invoice', 'Invoice / Счёт-фактура', 'Detects and formats invoice-like tabular data');
  }

  detect(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const markers = ['invoice', 'счёт', 'счет', 'фактура', 'итого', 'total', 'amount', 'сумма', 'qty', 'кол-во', 'цена', 'price'];
    const hits = markers.filter((m) => lower.includes(m));
    return hits.length >= 2;
  }

  transform(text) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inTable) { result.push(''); inTable = false; }
        result.push('');
        continue;
      }

      // Detect tabular rows (numbers, amounts, quantities)
      const hasNumbers = /\d+[.,]\d{2}/.test(trimmed);
      const hasMultiCols = (trimmed.match(/\t|  {2,}/g) || []).length >= 1;

      if (hasNumbers && hasMultiCols) {
        if (!inTable) {
          result.push('--- TABLE START ---');
          inTable = true;
        }
        const cells = trimmed.split(/\t|  {2,}/).map((c) => c.trim()).filter(Boolean);
        result.push('| ' + cells.join(' | ') + ' |');
      } else {
        if (inTable) { result.push('--- TABLE END ---'); inTable = false; }
        result.push(trimmed);
      }
    }
    if (inTable) result.push('--- TABLE END ---');
    return result.join('\n');
  }

  toDocxXml(text) {
    const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = text.split('\n');
    const xml = [];
    let tableRows = [];

    for (const line of lines) {
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.slice(1, -1).split('|').map((c) => c.trim());
        tableRows.push(cells);
      } else {
        if (tableRows.length) {
          xml.push(this._buildTable(tableRows, escXml));
          tableRows = [];
        }
        if (line.trim()) {
          xml.push(`<w:p><w:r><w:t xml:space="preserve">${escXml(line.trim())}</w:t></w:r></w:p>`);
        }
      }
    }
    if (tableRows.length) xml.push(this._buildTable(tableRows, escXml));
    return xml.join('\n');
  }

  _buildTable(rows, escXml) {
    const maxCols = Math.max(...rows.map((r) => r.length));
    const colW = Math.floor(9000 / maxCols);
    let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>';
    xml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    xml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    xml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    xml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    xml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    xml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
    xml += '</w:tblBorders></w:tblPr><w:tblGrid>';
    for (let c = 0; c < maxCols; c++) xml += `<w:gridCol w:w="${colW}"/>`;
    xml += '</w:tblGrid>';

    for (let i = 0; i < rows.length; i++) {
      xml += '<w:tr>';
      const isHeader = i === 0;
      for (let c = 0; c < maxCols; c++) {
        const val = escXml(rows[i][c] || '');
        const boldTag = isHeader ? '<w:rPr><w:b/></w:rPr>' : '';
        xml += `<w:tc><w:p><w:r>${boldTag}<w:t xml:space="preserve">${val}</w:t></w:r></w:p></w:tc>`;
      }
      xml += '</w:tr>';
    }
    xml += '</w:tbl>';
    return xml;
  }
}

// ─── Report Plugin ──────────────────────────────────────────────────────────
class ReportPlugin extends ConversionPlugin {
  constructor() {
    super('report', 'Report / Отчёт', 'Detects and formats report-like structured data');
  }

  detect(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const markers = ['report', 'отчёт', 'отчет', 'summary', 'итоги', 'section', 'раздел', 'conclusion', 'выводы', 'results', 'результаты'];
    const hits = markers.filter((m) => lower.includes(m));
    return hits.length >= 2;
  }

  transform(text) {
    const lines = text.split('\n');
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { result.push(''); continue; }

      // Detect section headers (ALL CAPS, numbered, or short standalone lines)
      if (/^[A-ZА-ЯЁ\d\s.():]+$/.test(trimmed) && trimmed.length < 80 && trimmed.length > 3) {
        result.push(`## ${trimmed}`);
      } else if (/^\d+[.)]\s/.test(trimmed) && trimmed.length < 100) {
        result.push(`### ${trimmed}`);
      } else {
        result.push(trimmed);
      }
    }
    return result.join('\n');
  }

  toDocxXml(text) {
    const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = text.split('\n');
    const xml = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('## ')) {
        const heading = escXml(trimmed.slice(3));
        xml.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${heading}</w:t></w:r></w:p>`);
      } else if (trimmed.startsWith('### ')) {
        const heading = escXml(trimmed.slice(4));
        xml.push(`<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>${heading}</w:t></w:r></w:p>`);
      } else {
        xml.push(`<w:p><w:r><w:t xml:space="preserve">${escXml(trimmed)}</w:t></w:r></w:p>`);
      }
    }
    return xml.join('\n');
  }
}

// ─── Custom Table Plugin ────────────────────────────────────────────────────
class CustomTablePlugin extends ConversionPlugin {
  constructor() {
    super('custom-table', 'Custom Table / Таблица', 'Converts delimited data to proper table format');
  }

  detect(text) {
    if (!text) return false;
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return false;
    const tabCount = lines.filter((l) => l.includes('\t') || /  {2,}/.test(l)).length;
    return tabCount / lines.length > 0.5;
  }

  transform(text) {
    const lines = text.split('\n');
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { result.push(''); continue; }
      const cells = trimmed.split(/\t|  {2,}/).map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        result.push('| ' + cells.join(' | ') + ' |');
      } else {
        result.push(trimmed);
      }
    }
    return result.join('\n');
  }

  toDocxXml(text) {
    return new InvoicePlugin().toDocxXml(text);
  }
}

// Register built-in plugins
plugins.set('invoice', new InvoicePlugin());
plugins.set('report', new ReportPlugin());
plugins.set('custom-table', new CustomTablePlugin());

export function getPlugin(id) {
  return plugins.get(id) || null;
}

export function getAllPlugins() {
  return [...plugins.values()];
}

export function registerPlugin(plugin) {
  plugins.set(plugin.id, plugin);
}

export function detectApplicablePlugins(text) {
  return [...plugins.values()].filter((p) => p.detect(text));
}

export function applyPlugin(pluginId, text, pageNum) {
  const plugin = plugins.get(pluginId);
  if (!plugin) return text;
  return plugin.transform(text, pageNum);
}

export function pluginToDocxXml(pluginId, text, pageNum) {
  const plugin = plugins.get(pluginId);
  if (!plugin) return null;
  return plugin.toDocxXml(text, pageNum);
}
