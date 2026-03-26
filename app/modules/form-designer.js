// @ts-check
// ─── Form Designer Module ───────────────────────────────────────────────────
// Programmatically add/remove/align form fields on a PDF using pdf-lib
import { PDFDocument, PDFName } from 'pdf-lib';

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} WidgetRect
 */

/**
 * Convert a [x1, y1, x2, y2] rect array into pdf-lib widget dimensions.
 * @param {number[]} rect
 * @returns {WidgetRect}
 */
function toWidget(rect) {
  return {
    x: rect[0],
    y: rect[1],
    width: rect[2] - rect[0],
    height: rect[3] - rect[1],
  };
}

/**
 * Return the canonical name for any field descriptor.
 * @param {object} f
 * @returns {string|undefined}
 */
function fieldName(f) {
  return f.type === 'radio' ? f.name : f.props?.name;
}

export class FormDesigner {
  /**
   * @param {Uint8Array|ArrayBuffer} pdfBytes
   */
  constructor(pdfBytes) {
    /** @type {Uint8Array|ArrayBuffer} */
    this._pdfBytes = pdfBytes;
    /** @type {Array<object>} */
    this._fields = [];
    /** @type {Map<number, string[]>} pageNum -> [fieldNames] */
    this._tabOrders = new Map();
    /** @type {Map<string, object>} fieldName -> rule */
    this._validations = new Map();
    /** @type {Map<string, string>} fieldName -> expression */
    this._calculations = new Map();
  }

  /**
   * Add a text field.
   * @param {number} pageNum 1-based page number
   * @param {number[]} rect [x1, y1, x2, y2]
   * @param {object} props
   * @returns {this}
   */
  addTextField(pageNum, rect, props) {
    this._fields.push({ type: 'text', pageNum, rect, props: { ...props } });
    return this;
  }

  /**
   * Add a checkbox.
   * @param {number} pageNum
   * @param {number[]} rect
   * @param {object} props
   * @returns {this}
   */
  addCheckbox(pageNum, rect, props) {
    this._fields.push({ type: 'checkbox', pageNum, rect, props: { ...props } });
    return this;
  }

  /**
   * Add a radio button group.
   * @param {string} name
   * @param {Array<{pageNum: number, rect: number[], value: string}>} buttons
   * @returns {this}
   */
  addRadioGroup(name, buttons) {
    this._fields.push({ type: 'radio', name, buttons: buttons.map(b => ({ ...b })) });
    return this;
  }

  /**
   * Add a dropdown (combo box).
   * @param {number} pageNum
   * @param {number[]} rect
   * @param {object} props
   * @returns {this}
   */
  addDropdown(pageNum, rect, props) {
    this._fields.push({ type: 'dropdown', pageNum, rect, props: { ...props } });
    return this;
  }

  /**
   * Add a list box.
   * @param {number} pageNum
   * @param {number[]} rect
   * @param {object} props
   * @returns {this}
   */
  addListBox(pageNum, rect, props) {
    this._fields.push({ type: 'listbox', pageNum, rect, props: { ...props } });
    return this;
  }

  /**
   * Add a push button.
   * @param {number} pageNum
   * @param {number[]} rect
   * @param {object} props
   * @returns {this}
   */
  addPushButton(pageNum, rect, props) {
    this._fields.push({ type: 'button', pageNum, rect, props: { ...props } });
    return this;
  }

  /**
   * Add a signature field placeholder.
   * @param {number} pageNum
   * @param {number[]} rect
   * @param {object} props
   * @returns {this}
   */
  addSignatureField(pageNum, rect, props) {
    this._fields.push({ type: 'signature', pageNum, rect, props: { ...props } });
    return this;
  }

  /**
   * Set tab order for a page.
   * @param {number} pageNum
   * @param {string[]} fieldNames
   * @returns {this}
   */
  setTabOrder(pageNum, fieldNames) {
    this._tabOrders.set(pageNum, [...fieldNames]);
    return this;
  }

  /**
   * Set a validation rule for a field.
   * @param {string} name
   * @param {object} rule  {type: 'regex'|'range'|'email'|'required', pattern?, min?, max?}
   * @returns {this}
   */
  setValidation(name, rule) {
    this._validations.set(name, { ...rule });
    return this;
  }

  /**
   * Set a calculation expression for a field.
   * @param {string} name
   * @param {string} expression  e.g. "field1 + field2"
   * @returns {this}
   */
  setCalculation(name, expression) {
    this._calculations.set(name, expression);
    return this;
  }

  /**
   * Remove a field by name.
   * @param {string} name
   * @returns {this}
   */
  removeField(name) {
    this._fields = this._fields.filter(f => fieldName(f) !== name);
    this._validations.delete(name);
    this._calculations.delete(name);
    // Also remove from tab orders
    for (const [pg, names] of this._tabOrders) {
      this._tabOrders.set(pg, names.filter(n => n !== name));
    }
    return this;
  }

  /**
   * Return a summary list of all fields.
   * @returns {Array<{name: string|undefined, type: string, page: number|undefined, rect: number[]|undefined, props: object}>}
   */
  getFields() {
    return this._fields.map(f => ({
      name: fieldName(f),
      type: f.type,
      page: f.type === 'radio' ? f.buttons?.[0]?.pageNum : f.pageNum,
      rect: f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect,
      props: f.props || {},
    }));
  }

  /**
   * Align a set of fields along one edge.
   * @param {string[]} fieldNames
   * @param {'left'|'right'|'top'|'bottom'|'center-h'|'center-v'} alignment
   * @returns {this}
   */
  alignFields(fieldNames, alignment) {
    const matching = this._fields.filter(f => fieldNames.includes(fieldName(f)));
    if (matching.length < 2) return this;

    // Collect rects (skip radios for simplicity; use first button rect)
    const rects = matching.map(f => f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect).filter(Boolean);
    if (rects.length < 2) return this;

    switch (alignment) {
      case 'left': {
        const minX = Math.min(...rects.map(r => r[0]));
        for (const f of matching) {
          const r = f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect;
          if (!r) continue;
          const w = r[2] - r[0];
          r[0] = minX;
          r[2] = minX + w;
        }
        break;
      }
      case 'right': {
        const maxX2 = Math.max(...rects.map(r => r[2]));
        for (const f of matching) {
          const r = f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect;
          if (!r) continue;
          const w = r[2] - r[0];
          r[2] = maxX2;
          r[0] = maxX2 - w;
        }
        break;
      }
      case 'top': {
        const maxY2 = Math.max(...rects.map(r => r[3]));
        for (const f of matching) {
          const r = f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect;
          if (!r) continue;
          const h = r[3] - r[1];
          r[3] = maxY2;
          r[1] = maxY2 - h;
        }
        break;
      }
      case 'bottom': {
        const minY = Math.min(...rects.map(r => r[1]));
        for (const f of matching) {
          const r = f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect;
          if (!r) continue;
          const h = r[3] - r[1];
          r[1] = minY;
          r[3] = minY + h;
        }
        break;
      }
      case 'center-h': {
        const centers = rects.map(r => (r[0] + r[2]) / 2);
        const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
        for (const f of matching) {
          const r = f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect;
          if (!r) continue;
          const w = r[2] - r[0];
          r[0] = avg - w / 2;
          r[2] = avg + w / 2;
        }
        break;
      }
      case 'center-v': {
        const centers = rects.map(r => (r[1] + r[3]) / 2);
        const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
        for (const f of matching) {
          const r = f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect;
          if (!r) continue;
          const h = r[3] - r[1];
          r[1] = avg - h / 2;
          r[3] = avg + h / 2;
        }
        break;
      }
    }
    return this;
  }

  /**
   * Evenly distribute fields along an axis.
   * @param {string[]} fieldNames
   * @param {'horizontal'|'vertical'} direction
   * @returns {this}
   */
  distributeFields(fieldNames, direction) {
    const matching = this._fields.filter(f => fieldNames.includes(fieldName(f)));
    if (matching.length < 3) return this;

    const getRects = () => matching.map(f => f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect).filter(Boolean);
    const rects = getRects();
    if (rects.length < 3) return this;

    if (direction === 'horizontal') {
      // Sort by x position
      const sorted = matching
        .map(f => ({ field: f, rect: f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect }))
        .filter(e => e.rect)
        .sort((a, b) => a.rect[0] - b.rect[0]);

      const first = sorted[0].rect[0];
      const last = sorted[sorted.length - 1].rect[0];
      const step = (last - first) / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const r = sorted[i].rect;
        const w = r[2] - r[0];
        r[0] = first + step * i;
        r[2] = r[0] + w;
      }
    } else {
      const sorted = matching
        .map(f => ({ field: f, rect: f.type === 'radio' ? f.buttons?.[0]?.rect : f.rect }))
        .filter(e => e.rect)
        .sort((a, b) => a.rect[1] - b.rect[1]);

      const first = sorted[0].rect[1];
      const last = sorted[sorted.length - 1].rect[1];
      const step = (last - first) / (sorted.length - 1);

      for (let i = 1; i < sorted.length - 1; i++) {
        const r = sorted[i].rect;
        const h = r[3] - r[1];
        r[1] = first + step * i;
        r[3] = r[1] + h;
      }
    }
    return this;
  }

  /**
   * Build the PDF with all designed form fields.
   * @returns {Promise<Uint8Array>}
   */
  async build() {
    const pdfDoc = await PDFDocument.load(this._pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();

    for (const field of this._fields) {
      const pageIdx = (field.pageNum || field.buttons?.[0]?.pageNum || 1) - 1;
      const page = pages[pageIdx];
      if (!page) continue;

      switch (field.type) {
        case 'text': {
          const tf = form.createTextField(field.props.name);
          tf.addToPage(page, toWidget(field.rect));
          if (field.props.defaultValue) tf.setText(field.props.defaultValue);
          if (field.props.maxLen) tf.setMaxLength(field.props.maxLen);
          if (field.props.multiLine) tf.enableMultiline();
          if (field.props.readOnly) tf.enableReadOnly();
          if (field.props.required) {
            tf.acroField.dict.set(PDFName.of('Ff'), pdfDoc.context.obj(
              (/** @type {any} */ (tf.acroField.dict.get(PDFName.of('Ff')))?.asNumber?.() || 0) | (1 << 1)
            ));
          }
          if (field.props.fontSize) {
            tf.setFontSize(field.props.fontSize);
          }
          break;
        }
        case 'checkbox': {
          const cb = form.createCheckBox(field.props.name);
          cb.addToPage(page, toWidget(field.rect));
          if (field.props.checked) cb.check();
          if (field.props.readOnly) cb.enableReadOnly();
          break;
        }
        case 'radio': {
          const rg = form.createRadioGroup(field.name);
          for (const btn of (field.buttons || [])) {
            const btnPage = pages[(btn.pageNum || 1) - 1];
            if (!btnPage) continue;
            rg.addOptionToPage(btn.value || 'option', btnPage, toWidget(btn.rect));
          }
          break;
        }
        case 'dropdown': {
          const dd = form.createDropdown(field.props.name);
          const options = (field.props.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value));
          if (options.length) dd.setOptions(options);
          dd.addToPage(page, toWidget(field.rect));
          if (field.props.defaultValue) dd.select(field.props.defaultValue);
          if (field.props.readOnly) dd.enableReadOnly();
          break;
        }
        case 'listbox': {
          // pdf-lib does not have a dedicated createListBox, use createOptionList
          const lb = form.createOptionList(field.props.name);
          const options = (field.props.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value));
          if (options.length) lb.setOptions(options);
          lb.addToPage(page, toWidget(field.rect));
          if (field.props.multiSelect) lb.enableMultiselect();
          if (field.props.readOnly) lb.enableReadOnly();
          break;
        }
        case 'button': {
          const btn = form.createButton(field.props.name);
          btn.addToPage(field.props.label || field.props.name, page, toWidget(field.rect));
          if (field.props.readOnly) btn.enableReadOnly();
          break;
        }
        case 'signature': {
          // pdf-lib does not have native signature field creation,
          // so we create an empty text field with the /FT /Sig marker.
          // For a placeholder we create a TextField and flag it.
          const sig = form.createTextField(field.props.name);
          sig.addToPage(page, toWidget(field.rect));
          sig.enableReadOnly();
          // Mark as signature type
          sig.acroField.dict.set(PDFName.of('FT'), PDFName.of('Sig'));
          break;
        }
      }
    }

    // Apply validation rules as JavaScript actions (AA dictionary)
    for (const [name, rule] of this._validations) {
      try {
        const pdfField = form.getField(name);
        if (!pdfField) continue;
        let js = '';
        switch (rule.type) {
          case 'regex':
            js = `var v = event.value; if (v && !new RegExp("${(rule.pattern || '').replace(/"/g, '\\"')}").test(v)) { app.alert("Invalid format"); event.rc = false; }`;
            break;
          case 'range':
            js = `var n = Number(event.value); if (isNaN(n) || ${rule.min !== undefined ? `n < ${rule.min}` : 'false'} || ${rule.max !== undefined ? `n > ${rule.max}` : 'false'}) { app.alert("Out of range"); event.rc = false; }`;
            break;
          case 'email':
            js = 'var v = event.value; if (v && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) { app.alert("Invalid email"); event.rc = false; }';
            break;
          case 'required':
            js = 'if (!event.value || !event.value.trim()) { app.alert("Field is required"); event.rc = false; }';
            break;
        }
        if (js) {
          const jsAction = pdfDoc.context.obj({
            S: 'JavaScript',
            JS: js,
          });
          const aaDict = pdfDoc.context.obj({ V: jsAction });
          pdfField.acroField.dict.set(PDFName.of('AA'), aaDict);
        }
      } catch (_err) {
        // Skip fields that cannot be found
      }
    }

    // Apply calculation expressions
    for (const [name, expression] of this._calculations) {
      try {
        const pdfField = form.getField(name);
        if (!pdfField) continue;
        const calcJs = `var result = ${expression}; event.value = result;`;
        const calcAction = pdfDoc.context.obj({
          S: 'JavaScript',
          JS: calcJs,
        });
        const existingAA = pdfField.acroField.dict.get(PDFName.of('AA'));
        if (existingAA) {
          /** @type {any} */ (existingAA).set(PDFName.of('C'), calcAction);
        } else {
          const aaDict = pdfDoc.context.obj({ C: calcAction });
          pdfField.acroField.dict.set(PDFName.of('AA'), aaDict);
        }
      } catch (_err) {
        // Skip
      }
    }

    // Apply tab orders
    for (const [pageNum, _names] of this._tabOrders) {
      const page = pages[pageNum - 1];
      if (!page) continue;
      // Set /Tabs to /S (structure order) — the actual field order
      // is determined by the annotation array order on the page
      page.node.set(PDFName.of('Tabs'), PDFName.of('S'));
    }

    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }
}
