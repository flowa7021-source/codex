import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { convertDocxToXlsx } from '../../app/modules/docx-to-xlsx.js';

function makeDocx(documentXml) {
  const enc = new TextEncoder();
  return zipSync({ 'word/document.xml': enc.encode(documentXml) }, { level: 0 });
}

function docXml(body) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + body + '</w:body></w:document>';
}

function tbl(rows, opts) {
  let xml = '<w:tbl>';
  for (let r = 0; r < rows.length; r++) {
    xml += '<w:tr>';
    for (let c = 0; c < rows[r].length; c++) {
      const gs = opts && opts.gridSpans && opts.gridSpans[r] && opts.gridSpans[r][c];
      const b = opts && opts.bold && opts.bold[r] && opts.bold[r][c];
      xml += '<w:tc><w:tcPr>';
      if (gs && gs > 1) xml += '<w:gridSpan w:val="' + gs + '"/>';
      xml += '</w:tcPr><w:p><w:r>';
      if (b) xml += '<w:rPr><w:b/></w:rPr>';
      xml += '<w:t>' + rows[r][c] + '</w:t></w:r></w:p></w:tc>';
    }
    xml += '</w:tr>';
  }
  xml += '</w:tbl>';
  return xml;
}

function heading(text) {
  return '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>' + text + '</w:t></w:r></w:p>';
}

describe('docx-to-xlsx', () => {
  describe('invalid input', () => {
    it('throws on non-ZIP input', async () => {
      await assert.rejects(
        () => convertDocxToXlsx(new Uint8Array([0, 1, 2, 3])),
        { message: 'Invalid DOCX format' }
      );
    });

    it('throws on ZIP without word/document.xml', async () => {
      const bad = zipSync({ 'other.xml': new TextEncoder().encode('<r/>') });
      await assert.rejects(() => convertDocxToXlsx(bad), { message: 'Invalid DOCX format' });
    });
  });

  describe('DOCX without tables', () => {
    it('throws error with clear message', async () => {
      const docx = makeDocx(docXml('<w:p><w:r><w:t>text</w:t></w:r></w:p>'));
      await assert.rejects(() => convertDocxToXlsx(docx), { message: 'No tables found in document' });
    });

    it('empty body throws no-tables error', async () => {
      const docx = makeDocx(docXml(''));
      await assert.rejects(() => convertDocxToXlsx(docx), { message: 'No tables found in document' });
    });

    it('headings only throws no-tables error', async () => {
      const docx = makeDocx(docXml(heading('Title')));
      await assert.rejects(() => convertDocxToXlsx(docx), { message: 'No tables found in document' });
    });
  });

  describe('DOCX with tables', () => {
    it('DOCX with 2 tables produces 2 sheets', async () => {
      const t1 = tbl([['A', 'B'], ['1', '2']]);
      const t2 = tbl([['X', 'Y'], ['3', '4']]);
      const docx = makeDocx(docXml(t1 + t2));
      const result = await convertDocxToXlsx(docx);
      assert.equal(result.sheetCount, 2);
      assert.ok(result.blob instanceof Blob);
      assert.ok(result.blob.size > 0);
    });

    it('merged cells with gridSpan are handled', async () => {
      const t = tbl(
        [['Merged', '', 'C'], ['A', 'B', 'C']],
        { gridSpans: [[2, undefined, 1], [1, 1, 1]] }
      );
      const docx = makeDocx(docXml(t));
      const result = await convertDocxToXlsx(docx);
      assert.equal(result.sheetCount, 1);
      assert.ok(result.blob.size > 0);
    });

    it('bold text in cell is detected', async () => {
      const t = tbl([['Normal', 'Bold']], { bold: [[false, true]] });
      const docx = makeDocx(docXml(t));
      const result = await convertDocxToXlsx(docx);
      assert.equal(result.sheetCount, 1);
    });

    it('heading before table is used for sheet naming', async () => {
      const h = heading('Sales Report');
      const t = tbl([['Q1', 'Q2'], ['100', '200']]);
      const docx = makeDocx(docXml(h + t));
      const result = await convertDocxToXlsx(docx);
      assert.equal(result.sheetCount, 1);
      assert.ok(result.blob.size > 0);
    });

    it('output blob is valid XLSX ZIP', async () => {
      const t = tbl([['Hello', 'World']]);
      const docx = makeDocx(docXml(t));
      const result = await convertDocxToXlsx(docx);
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Check PK header (ZIP signature)
      assert.equal(bytes[0], 0x50);
      assert.equal(bytes[1], 0x4B);
    });
  });
});
