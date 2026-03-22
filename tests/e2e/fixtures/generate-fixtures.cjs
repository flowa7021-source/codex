const fs = require('fs');
const path = require('path');

// Minimal valid PDF (2-page PDF for navigation testing)
// This is a hand-crafted minimal PDF with 2 pages
const pdf2Pages = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << >> >>
endobj

4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Page 1) Tj
ET
endstream
endobj

5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 6 0 R /Resources << >> >>
endobj

6 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Page 2) Tj
ET
endstream
endobj

xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000230 00000 n 
0000000324 00000 n 
0000000439 00000 n 

trailer
<< /Size 7 /Root 1 0 R >>
startxref
533
%%EOF`;

fs.writeFileSync(path.join(__dirname, 'test-2page.pdf'), pdf2Pages);

// Minimal 1x1 PNG (red pixel)
const pngData = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
  '2e00000000c49444154789c6260f80f0000010100009a6082700000000049454e44ae426082',
  'hex'
);
fs.writeFileSync(path.join(__dirname, 'test-1x1.png'), pngData);

console.log('Fixtures created successfully');
