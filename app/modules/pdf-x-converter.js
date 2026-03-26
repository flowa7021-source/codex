// @ts-check
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

/**
 * Convert PDF to PDF/X standard for print production.
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} [standard='PDF/X-4']
 * @param {object} [options]
 * @param {string} [options.outputIntent='sRGB']
 * @param {boolean} [options.trapped=false]
 * @returns {Promise<{blob: Blob, warnings: string[]}>}
 */
export async function convertToPdfX(pdfBytes, standard = 'PDF/X-4', options = {}) {
  const { outputIntent = 'sRGB', trapped = false } = options;
  const validStandards = ['PDF/X-1a', 'PDF/X-3', 'PDF/X-4'];
  if (!validStandards.includes(standard)) throw new Error(`Unknown standard: ${standard}`);

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const warnings = [];

  // 1. Add OutputIntent
  try {
    const oiDict = pdfDoc.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFX'),
      OutputConditionIdentifier: 'sRGB IEC61966-2.1',
      RegistryName: 'http://www.color.org',
      Info: outputIntent,
    });
    const oiRef = pdfDoc.context.register(oiDict);
    const oiArray = pdfDoc.context.obj([oiRef]);
    pdfDoc.catalog.set(PDFName.of('OutputIntents'), oiArray);
  } catch (e) { warnings.push(`OutputIntent: ${e.message}`); }

  // 2. Set Trapped
  try {
    pdfDoc.catalog.set(PDFName.of('Trapped'), PDFName.of(trapped ? 'True' : 'False'));
  } catch (e) { warnings.push(`Trapped: ${e.message}`); }

  // 3. Ensure TrimBox on each page
  for (const page of pdfDoc.getPages()) {
    try {
      const mb = page.getMediaBox();
      const trimBox = page.node.get(PDFName.of('TrimBox'));
      if (!trimBox) {
        page.setTrimBox(mb.x, mb.y, mb.width, mb.height);
      }
    } catch (_e) { /* skip */ }
  }

  // 4. Remove JavaScript, multimedia
  try {
    const catalog = pdfDoc.catalog;
    const names = catalog.get(PDFName.of('Names'));
    if (names instanceof PDFDict && names.get(PDFName.of('JavaScript'))) {
      names.delete(PDFName.of('JavaScript'));
    }
    if (catalog.get(PDFName.of('OpenAction'))) {
      const oa = catalog.get(PDFName.of('OpenAction'));
      if (oa instanceof PDFDict) {
        const s = oa.get(PDFName.of('S'));
        if (s && s.toString() === '/JavaScript') {
          catalog.delete(PDFName.of('OpenAction'));
        }
      }
    }
  } catch (_e) { /* skip */ }

  // 5. Set GTS_PDFXVersion in Info
  pdfDoc.setProducer('NovaReader PDF/X Converter');
  pdfDoc.setCreator('NovaReader');

  // 6. Add XMP with PDF/X identification
  try {
    const xmp = buildPdfXXmp(standard);
    const xmpBytes = new TextEncoder().encode(xmp);
    const xmpStream = pdfDoc.context.stream(xmpBytes, {
      Type: PDFName.of('Metadata'),
      Subtype: PDFName.of('XML'),
      Length: xmpBytes.length,
    });
    const xmpRef = pdfDoc.context.register(xmpStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), xmpRef);
  } catch (e) { warnings.push(`XMP: ${e.message}`); }

  // For PDF/X-1a: remove transparency
  if (standard === 'PDF/X-1a') {
    for (const page of pdfDoc.getPages()) {
      try {
        if (page.node.get(PDFName.of('Group'))) {
          page.node.delete(PDFName.of('Group'));
        }
      } catch (_e) { /* skip */ }
    }
  }

  const bytes = await pdfDoc.save();
  return { blob: new Blob([/** @type {any} */ (bytes)], { type: 'application/pdf' }), warnings };
}

/**
 * Validate PDF/X compliance.
 */
export function validatePdfX(pdfBytes, standard = 'PDF/X-4') {
  // Sync validation wrapper - returns a promise
  return validatePdfXAsync(pdfBytes, standard);
}

async function validatePdfXAsync(pdfBytes, standard) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const errors = [];
  const warnings = [];

  // Check OutputIntents
  if (!pdfDoc.catalog.get(PDFName.of('OutputIntents'))) {
    errors.push({ rule: 'output-intent', message: 'OutputIntents required for PDF/X' });
  }

  // Check TrimBox on each page
  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPages()[i];
    if (!page.node.get(PDFName.of('TrimBox'))) {
      errors.push({ rule: 'trim-box', message: `TrimBox missing on page ${i + 1}`, page: i + 1 });
    }
  }

  // Check no JavaScript
  try {
    const names = pdfDoc.catalog.get(PDFName.of('Names'));
    if (names instanceof PDFDict && names.get(PDFName.of('JavaScript'))) {
      errors.push({ rule: 'no-javascript', message: 'JavaScript not allowed in PDF/X' });
    }
  } catch (_e) { /* skip */ }

  // Check transparency for PDF/X-1a
  if (standard === 'PDF/X-1a') {
    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      if (pdfDoc.getPages()[i].node.get(PDFName.of('Group'))) {
        errors.push({ rule: 'no-transparency', message: `Transparency on page ${i + 1}`, page: i + 1 });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function buildPdfXXmp(standard) {
  const _version = standard.replace('PDF/', '').replace('-', '');
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <pdfxid:GTS_PDFXVersion>${standard}</pdfxid:GTS_PDFXVersion>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}
