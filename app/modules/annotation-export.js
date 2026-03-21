// ─── SVG/PDF Annotation Export Module ────────────────────────────────────────

export function exportAnnotationsAsSvg(strokes, canvasWidth, canvasHeight) {
  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="transparent"/>`);

  for (const stroke of strokes) {
    if (!stroke?.points?.length) continue;

    if (stroke.tool === 'rect') {
      const [p1, p2] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      if (p1 && p2) {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke.color || '#ffd84d'}" stroke-width="${stroke.size || 2}"/>`);
      }
    } else if (stroke.tool === 'circle') {
      const [p1, p2] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      if (p1 && p2) {
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const rx = Math.abs(p2.x - p1.x) / 2;
        const ry = Math.abs(p2.y - p1.y) / 2;
        svgParts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${stroke.color || '#ffd84d'}" stroke-width="${stroke.size || 2}"/>`);
      }
    } else if (stroke.tool === 'arrow' || stroke.tool === 'line') {
      const [p1, p2] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      if (p1 && p2) {
        if (stroke.tool === 'arrow') {
          const markerId = `arrow-${Math.random().toString(36).slice(2, 8)}`;
          svgParts.push(`<defs><marker id="${markerId}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${stroke.color || '#ffd84d'}"/></marker></defs>`);
          svgParts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${stroke.color || '#ffd84d'}" stroke-width="${stroke.size || 2}" marker-end="url(#${markerId})"/>`);
        } else {
          svgParts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${stroke.color || '#ffd84d'}" stroke-width="${stroke.size || 2}"/>`);
        }
      }
    } else if (stroke.tool === 'comment') {
      const p = stroke.points[0];
      if (p) {
        svgParts.push(`<circle cx="${p.x}" cy="${p.y}" r="12" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/>`);
        svgParts.push(`<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" fill="#92400e">💬</text>`);
        if (stroke.text) {
          svgParts.push(`<text x="${p.x + 18}" y="${p.y + 5}" font-size="12" fill="${stroke.color || '#ffd84d'}">${escapeXml(stroke.text)}</text>`);
        }
      }
    } else {
      // pen, highlighter, eraser paths
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        svgParts.push(`<circle cx="${p.x}" cy="${p.y}" r="${(stroke.size || 2) / 2}" fill="${stroke.color || '#ffd84d'}"/>`);
      } else {
        const pathData = stroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const opacity = stroke.tool === 'highlighter' ? 0.4 : 1;
        svgParts.push(`<path d="${pathData}" fill="none" stroke="${stroke.color || '#ffd84d'}" stroke-width="${stroke.size || 2}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`);
      }
    }
  }

  svgParts.push('</svg>');
  return svgParts.join('\n');
}

export function exportAnnotationsAsPdf(strokes, canvasWidth, canvasHeight, _pageImageDataUrl = null) {
  // Minimal PDF 1.4 with annotation overlay
  const objects = [];
  let objNum = 0;

  function addObj(content) {
    objNum++;
    objects.push({ num: objNum, content });
    return objNum;
  }

  // Catalog
  const catalogRef = addObj('');
  // Pages
  const pagesRef = addObj('');
  // Page
  const pageRef = addObj('');
  // Content stream
  const contentRef = addObj('');
  // Resources
  const resourcesRef = addObj('');

  // Build content stream
  const streamLines = [];

  // Set up coordinate transform (PDF has origin at bottom-left)
  const pdfW = canvasWidth;
  const pdfH = canvasHeight;

  for (const stroke of strokes) {
    if (!stroke?.points?.length) continue;

    const color = hexToRgb(stroke.color || '#ffd84d');
    const lineWidth = stroke.size || 2;
    const opacity = stroke.tool === 'highlighter' ? 0.4 : 1;

    if (opacity < 1) {
      streamLines.push(`/GS1 gs`);
    }

    streamLines.push(`${color.r} ${color.g} ${color.b} RG`);
    streamLines.push(`${color.r} ${color.g} ${color.b} rg`);
    streamLines.push(`${lineWidth} w`);
    streamLines.push('1 J 1 j'); // Round caps and joins

    if (stroke.tool === 'rect') {
      const [p1, p2] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      if (p1 && p2) {
        const x = Math.min(p1.x, p2.x);
        const y = pdfH - Math.max(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        streamLines.push(`${x} ${y} ${w} ${h} re S`);
      }
    } else if (stroke.tool === 'circle') {
      const [p1, p2] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      if (p1 && p2) {
        const cx = (p1.x + p2.x) / 2;
        const cy = pdfH - (p1.y + p2.y) / 2;
        const rx = Math.abs(p2.x - p1.x) / 2;
        const ry = Math.abs(p2.y - p1.y) / 2;
        // Approximate ellipse with Bezier curves
        const k = 0.5522847498;
        streamLines.push(`${cx - rx} ${cy} m`);
        streamLines.push(`${cx - rx} ${cy + ry * k} ${cx - rx * k} ${cy + ry} ${cx} ${cy + ry} c`);
        streamLines.push(`${cx + rx * k} ${cy + ry} ${cx + rx} ${cy + ry * k} ${cx + rx} ${cy} c`);
        streamLines.push(`${cx + rx} ${cy - ry * k} ${cx + rx * k} ${cy - ry} ${cx} ${cy - ry} c`);
        streamLines.push(`${cx - rx * k} ${cy - ry} ${cx - rx} ${cy - ry * k} ${cx - rx} ${cy} c`);
        streamLines.push('S');
      }
    } else if (stroke.tool === 'line' || stroke.tool === 'arrow') {
      const [p1, p2] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      if (p1 && p2) {
        streamLines.push(`${p1.x} ${pdfH - p1.y} m ${p2.x} ${pdfH - p2.y} l S`);
        if (stroke.tool === 'arrow') {
          // Arrowhead
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const headLen = lineWidth * 4;
          const ax = p2.x - headLen * Math.cos(angle - 0.4);
          const ay = p2.y - headLen * Math.sin(angle - 0.4);
          const bx = p2.x - headLen * Math.cos(angle + 0.4);
          const by = p2.y - headLen * Math.sin(angle + 0.4);
          streamLines.push(`${p2.x} ${pdfH - p2.y} m ${ax} ${pdfH - ay} l ${bx} ${pdfH - by} l f`);
        }
      }
    } else {
      // Path strokes
      if (stroke.points.length >= 2) {
        const first = stroke.points[0];
        streamLines.push(`${first.x} ${pdfH - first.y} m`);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          streamLines.push(`${p.x} ${pdfH - p.y} l`);
        }
        streamLines.push('S');
      }
    }

    if (opacity < 1) {
      streamLines.push('/GS0 gs'); // Reset to normal
    }
  }

  const streamContent = streamLines.join('\n');
  const streamBytes = new TextEncoder().encode(streamContent);

  // Build PDF objects
  objects[catalogRef - 1].content = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
  objects[pagesRef - 1].content = `<< /Type /Pages /Kids [${pageRef} 0 R] /Count 1 >>`;
  objects[pageRef - 1].content = `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Contents ${contentRef} 0 R /Resources ${resourcesRef} 0 R >>`;
  objects[contentRef - 1].content = `<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream`;
  objects[resourcesRef - 1].content = `<< /ExtGState << /GS0 << /Type /ExtGState /ca 1.0 /CA 1.0 >> /GS1 << /Type /ExtGState /ca 0.4 /CA 0.4 >> >> >>`;

  // Assemble PDF
  const lines = [];
  lines.push('%PDF-1.4');
  const offsets = [];

  for (const obj of objects) {
    offsets.push(lines.join('\n').length + 1);
    lines.push(`${obj.num} 0 obj`);
    lines.push(obj.content);
    lines.push('endobj');
    lines.push('');
  }

  const xrefOffset = lines.join('\n').length;
  lines.push('xref');
  lines.push(`0 ${objects.length + 1}`);
  lines.push('0000000000 65535 f ');
  for (const off of offsets) {
    lines.push(`${String(off).padStart(10, '0')} 00000 n `);
  }

  lines.push('trailer');
  lines.push(`<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>`);
  lines.push('startxref');
  lines.push(String(xrefOffset));
  lines.push('%%EOF');

  return new Blob([lines.join('\n')], { type: 'application/pdf' });
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 1, g: 0.85, b: 0.3 };
  return {
    r: Number((parseInt(result[1], 16) / 255).toFixed(3)),
    g: Number((parseInt(result[2], 16) / 255).toFixed(3)),
    b: Number((parseInt(result[3], 16) / 255).toFixed(3)),
  };
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
