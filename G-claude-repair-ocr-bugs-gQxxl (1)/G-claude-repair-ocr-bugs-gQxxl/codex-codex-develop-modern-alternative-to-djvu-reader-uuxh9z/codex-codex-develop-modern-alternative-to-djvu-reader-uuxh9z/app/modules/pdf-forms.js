// ─── PDF Form Filling Module ─────────────────────────────────────────────────
// Extract, fill, and export PDF form fields using PDF.js annotation API

export class PdfFormManager {
  constructor() {
    this.fields = new Map(); // pageNum -> [{name, type, value, rect, options, ...}]
    this.values = new Map(); // fieldName -> value
    this.listeners = [];
    this.pdfAdapter = null;
  }

  async loadFromAdapter(adapter) {
    if (!adapter || adapter.type !== 'pdf') return 0;
    this.pdfAdapter = adapter;
    this.fields.clear();
    let totalFields = 0;

    for (let p = 1; p <= adapter.getPageCount(); p++) {
      try {
        const page = await adapter.pdfDoc.getPage(p);
        const annotations = await page.getAnnotations({ intent: 'display' });
        const pageFields = [];

        for (const annot of annotations) {
          if (!annot.fieldType) continue;

          const field = {
            name: annot.fieldName || `field_${p}_${pageFields.length}`,
            type: this._mapFieldType(annot.fieldType, annot.checkBox, annot.radioButton),
            value: this.values.get(annot.fieldName) ?? annot.fieldValue ?? annot.buttonValue ?? '',
            defaultValue: annot.defaultFieldValue || '',
            rect: annot.rect || [0, 0, 100, 20],
            options: (annot.options || []).map((o) => ({
              value: o.exportValue || o.displayValue || '',
              label: o.displayValue || o.exportValue || '',
            })),
            maxLen: annot.maxLen || 0,
            readOnly: annot.readOnly || false,
            required: annot.required || false,
            multiLine: annot.multiLine || false,
            page: p,
            id: annot.id || `ann_${p}_${pageFields.length}`,
          };

          pageFields.push(field);
          totalFields++;
        }

        if (pageFields.length) {
          this.fields.set(p, pageFields);
        }
      } catch {
        // Skip pages that fail to load annotations
      }
    }

    this._notify('loaded', totalFields);
    return totalFields;
  }

  getPageFields(pageNum) {
    return this.fields.get(pageNum) || [];
  }

  getAllFields() {
    const all = [];
    for (const fields of this.fields.values()) {
      all.push(...fields);
    }
    return all;
  }

  setFieldValue(fieldName, value) {
    this.values.set(fieldName, value);
    for (const [, pageFields] of this.fields) {
      for (const field of pageFields) {
        if (field.name === fieldName) {
          field.value = value;
        }
      }
    }
    this._notify('change', { fieldName, value });
  }

  getFieldValue(fieldName) {
    return this.values.get(fieldName) ?? '';
  }

  clearAll() {
    this.values.clear();
    for (const [, pageFields] of this.fields) {
      for (const field of pageFields) {
        field.value = field.defaultValue || '';
      }
    }
    this._notify('clear');
  }

  exportFormData() {
    const data = {
      app: 'NovaReader',
      type: 'form-data',
      exportedAt: new Date().toISOString(),
      fields: {},
    };

    for (const [, pageFields] of this.fields) {
      for (const field of pageFields) {
        if (field.value !== '' && field.value !== field.defaultValue) {
          data.fields[field.name] = {
            value: field.value,
            type: field.type,
            page: field.page,
          };
        }
      }
    }
    return data;
  }

  importFormData(data) {
    if (!data?.fields) return 0;
    let count = 0;
    for (const [name, info] of Object.entries(data.fields)) {
      this.setFieldValue(name, info.value);
      count++;
    }
    this._notify('import', count);
    return count;
  }

  persistToLocalStorage(docName) {
    if (!docName) return;
    const key = `nr-forms-${docName}`;
    const data = this.exportFormData();
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* storage quota */ }
  }

  loadFromLocalStorage(docName) {
    if (!docName) return 0;
    const key = `nr-forms-${docName}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      return this.importFormData(JSON.parse(raw));
    } catch {
      return 0;
    }
  }

  renderFormOverlay(ctx, pageNum, zoom = 1, viewport = null) {
    const fields = this.getPageFields(pageNum);
    if (!fields.length) return;

    for (const field of fields) {
      if (field.readOnly) continue;
      const [x1, y1, x2, y2] = field.rect;

      let rx, ry, rw, rh;
      if (viewport) {
        rx = x1 * zoom;
        ry = (viewport.height / zoom - y2) * zoom;
        rw = (x2 - x1) * zoom;
        rh = (y2 - y1) * zoom;
      } else {
        rx = x1 * zoom;
        ry = y1 * zoom;
        rw = (x2 - x1) * zoom;
        rh = (y2 - y1) * zoom;
      }

      // Draw field background
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(rx, ry, rw, rh);

      // Draw field border
      ctx.strokeStyle = field.required ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);

      // Draw value
      if (field.value) {
        ctx.fillStyle = '#1a1a1a';
        const fontSize = Math.max(10, Math.min(rh * 0.7, 16)) * zoom;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';

        if (field.type === 'checkbox' || field.type === 'radio') {
          if (field.value === true || field.value === 'true' || field.value === 'Yes') {
            ctx.fillText('✓', rx + 2 * zoom, ry + rh / 2);
          }
        } else {
          ctx.fillText(String(field.value), rx + 3 * zoom, ry + rh / 2, rw - 6 * zoom);
        }
      }
    }
  }

  hitTestField(pageNum, x, y, zoom = 1) {
    const fields = this.getPageFields(pageNum);
    for (const field of fields) {
      if (field.readOnly) continue;
      const [x1, y1, x2, y2] = field.rect;
      const rx = x1 * zoom;
      const ry = y1 * zoom;
      const rw = (x2 - x1) * zoom;
      const rh = (y2 - y1) * zoom;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        return field;
      }
    }
    return null;
  }

  onEvent(fn) {
    this.listeners.push(fn);
  }

  _mapFieldType(fieldType, isCheckbox, isRadio) {
    if (isCheckbox) return 'checkbox';
    if (isRadio) return 'radio';
    switch (fieldType) {
      case 'Tx': return 'text';
      case 'Btn': return 'button';
      case 'Ch': return 'choice';
      case 'Sig': return 'signature';
      default: return 'text';
    }
  }

  _notify(event, data) {
    for (const fn of this.listeners) fn(event, data);
  }
}

export const formManager = new PdfFormManager();
