// ─── PDF/A Converter ────────────────────────────────────────────────────────
// Convert PDF to PDF/A-2b compliant format via pdf-lib metadata injection.

import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';

const PDFA_NAMESPACE = 'http://www.aiim.org/pdfa/ns/id/';
const PDFA_CONFORMANCE = 'B';
const PDFA_PART = '2';

/**
 * Convert a PDF to PDF/A-2b by adding required metadata, color profile, and structure.
 *
 * Note: Full PDF/A compliance requires ICC color profile embedding and font subsetting,
 * which pdf-lib cannot fully do. This performs the metadata/XMP portion and basic checks.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.author]
 * @param {string} [options.subject]
 * @returns {Promise<{blob: Blob, report: object}>}
 */
export async function convertToPdfA(pdfBytes, options = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const report = {
    metadataAdded: false,
    markInfoAdded: false,
    structTreeAdded: false,
    issues: [],
  };

  // 1. Set document metadata
  pdfDoc.setTitle(options.title || pdfDoc.getTitle() || 'Untitled');
  pdfDoc.setAuthor(options.author || pdfDoc.getAuthor() || '');
  pdfDoc.setSubject(options.subject || pdfDoc.getSubject() || '');
  pdfDoc.setProducer('NovaReader PDF/A Converter');
  pdfDoc.setCreator('NovaReader');
  report.metadataAdded = true;

  // 2. Add XMP metadata with PDF/A identification
  try {
    const xmp = buildPdfAXmp({
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      producer: 'NovaReader PDF/A Converter',
      creator: 'NovaReader',
      part: PDFA_PART,
      conformance: PDFA_CONFORMANCE,
    });

    const xmpBytes = new TextEncoder().encode(xmp);
    const xmpStream = pdfDoc.context.stream(xmpBytes, {
      Type: PDFName.of('Metadata'),
      Subtype: PDFName.of('XML'),
      Length: xmpBytes.length,
    });
    const xmpRef = pdfDoc.context.register(xmpStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), xmpRef);
  } catch (e) {
    report.issues.push(`XMP metadata: ${e.message}`);
  }

  // 3. Add MarkInfo dictionary (required for PDF/A)
  try {
    if (!pdfDoc.catalog.get(PDFName.of('MarkInfo'))) {
      const markInfo = pdfDoc.context.obj({ Marked: true });
      pdfDoc.catalog.set(PDFName.of('MarkInfo'), markInfo);
      report.markInfoAdded = true;
    }
  } catch (e) {
    report.issues.push(`MarkInfo: ${e.message}`);
  }

  // 4. Add basic structure tree root (required for Tagged PDF)
  try {
    if (!pdfDoc.catalog.get(PDFName.of('StructTreeRoot'))) {
      const structTree = pdfDoc.context.obj({
        Type: PDFName.of('StructTreeRoot'),
        K: pdfDoc.context.obj([]),
        ParentTree: pdfDoc.context.obj({ Type: PDFName.of('NumberTree'), Nums: [] }),
      });
      const structRef = pdfDoc.context.register(structTree);
      pdfDoc.catalog.set(PDFName.of('StructTreeRoot'), structRef);
      report.structTreeAdded = true;
    }
  } catch (e) {
    report.issues.push(`StructTree: ${e.message}`);
  }

  // 5. Set display document title preference
  try {
    const viewerPrefs = pdfDoc.context.obj({ DisplayDocTitle: true });
    pdfDoc.catalog.set(PDFName.of('ViewerPreferences'), viewerPrefs);
  } catch {}

  // 6. Remove prohibited features
  try {
    // Remove JavaScript
    pdfDoc.catalog.delete(PDFName.of('JavaScript'));
    pdfDoc.catalog.delete(PDFName.of('JS'));
    // Remove embedded files (not allowed in PDF/A-2b without AF key)
    const names = pdfDoc.catalog.get(PDFName.of('Names'));
    if (names) {
      const namesDict = pdfDoc.context.lookup(names);
      if (namesDict instanceof PDFDict) {
        namesDict.delete(PDFName.of('EmbeddedFiles'));
      }
    }
  } catch {}

  const saved = await pdfDoc.save();
  return {
    blob: new Blob([saved], { type: 'application/pdf' }),
    report,
  };
}

/**
 * Check PDF/A compliance (basic checks).
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{compliant: boolean, issues: string[]}>}
 */
export async function checkPdfACompliance(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const issues = [];

  // Check metadata
  if (!pdfDoc.getTitle()) issues.push('Missing document title');

  // Check MarkInfo
  if (!pdfDoc.catalog.get(PDFName.of('MarkInfo'))) {
    issues.push('Missing MarkInfo dictionary (document not tagged)');
  }

  // Check for JavaScript
  if (pdfDoc.catalog.get(PDFName.of('JavaScript')) || pdfDoc.catalog.get(PDFName.of('JS'))) {
    issues.push('Contains JavaScript (prohibited in PDF/A)');
  }

  // Check XMP metadata
  if (!pdfDoc.catalog.get(PDFName.of('Metadata'))) {
    issues.push('Missing XMP metadata stream');
  }

  // Check ViewerPreferences
  if (!pdfDoc.catalog.get(PDFName.of('ViewerPreferences'))) {
    issues.push('Missing ViewerPreferences with DisplayDocTitle');
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Build XMP metadata string for PDF/A.
 */
function buildPdfAXmp(meta) {
  const now = new Date().toISOString();
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="${PDFA_NAMESPACE}">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escXml(meta.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escXml(meta.author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escXml(meta.subject)}</rdf:li></rdf:Alt></dc:description>
      <xmp:CreatorTool>${escXml(meta.creator)}</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <pdf:Producer>${escXml(meta.producer)}</pdf:Producer>
      <pdfaid:part>${meta.part}</pdfaid:part>
      <pdfaid:conformance>${meta.conformance}</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function escXml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
