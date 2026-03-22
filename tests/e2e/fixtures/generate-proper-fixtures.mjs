import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === 3-page PDF ===
const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 3; i++) {
  const page = pdfDoc.addPage([612, 792]);
  page.drawText(`Page ${i} of 3`, { x: 50, y: 700, size: 24, font, color: rgb(0, 0, 0) });
  page.drawText(`This is test content on page ${i}. NovaReader test document.`, { x: 50, y: 650, size: 14, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, { x: 50, y: 620, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
}
const pdfBytes = await pdfDoc.save();
fs.writeFileSync(path.join(__dirname, 'test-3page.pdf'), pdfBytes);
console.log('Created test-3page.pdf (' + pdfBytes.length + ' bytes)');

// === 1-page PDF ===
const pdfDoc1 = await PDFDocument.create();
const font1 = await pdfDoc1.embedFont(StandardFonts.Helvetica);
const page1 = pdfDoc1.addPage([612, 792]);
page1.drawText('Single Page Document', { x: 50, y: 700, size: 24, font: font1 });
page1.drawText('This is a single-page test PDF for NovaReader.', { x: 50, y: 650, size: 14, font: font1 });
const pdf1Bytes = await pdfDoc1.save();
fs.writeFileSync(path.join(__dirname, 'test-1page.pdf'), pdf1Bytes);
console.log('Created test-1page.pdf (' + pdf1Bytes.length + ' bytes)');

// === 100x100 PNG ===
function makePng(w, h, r, g, b) {
  function crc32(buf) {
    let c = 0xffffffff;
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let v = n; for (let k = 0; k < 8; k++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1); t[n] = v; }
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
    return Buffer.concat([len, typeB, data, crcB]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 3);
    raw[off] = 0;
    for (let x = 0; x < w; x++) { raw[off + 1 + x*3] = r; raw[off + 2 + x*3] = g; raw[off + 3 + x*3] = b; }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(__dirname, 'test-100x100.png'), makePng(100, 100, 0x33, 0x66, 0xcc));
console.log('Created test-100x100.png');

console.log('All fixtures generated!');
