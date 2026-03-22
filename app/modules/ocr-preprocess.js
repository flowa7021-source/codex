// @ts-check
// ─── OCR Image Preprocessing ────────────────────────────────────────────────
// Deskew, denoise, binarization, border removal for better OCR quality.

/**
 * Full preprocessing pipeline for an OCR source canvas.
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @param {object} [opts]
 * @param {boolean} [opts.deskew=true]
 * @param {boolean} [opts.denoise=true]
 * @param {boolean} [opts.binarize=true]
 * @param {boolean} [opts.removeBorders=true]
 * @returns {HTMLCanvasElement} Preprocessed canvas
 */
export function preprocessForOcr(canvas, opts = {}) {
  const { deskew = true, denoise = true, binarize = true, removeBorders = true } = opts;
  if (!canvas.width || !canvas.height) return canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Convert to grayscale
  imageData = toGrayscale(imageData);

  // Remove black borders from scans
  if (removeBorders) {
    imageData = cropBlackBorders(imageData);
  }

  // Denoise with median filter
  if (denoise) {
    imageData = medianFilter(imageData, 3);
  }

  // Adaptive binarization (Sauvola)
  if (binarize) {
    imageData = sauvolaBinarize(imageData, 15, 0.2);
  }

  // Create output canvas
  const out = document.createElement('canvas');
  out.width = imageData.width;
  out.height = imageData.height;
  const outCtx = out.getContext('2d');
  if (!outCtx) return out;
  outCtx.putImageData(imageData, 0, 0);

  // Deskew
  if (deskew) {
    const angle = estimateSkewAngle(imageData);
    if (Math.abs(angle) > 0.3) {
      return rotateCanvas(out, -angle);
    }
  }

  return out;
}

/** Convert ImageData to grayscale (in-place, stores gray in R channel) */
export function toGrayscale(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  return imageData;
}

/** Median filter for noise removal */
export function medianFilter(imageData, size) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src);
  const half = Math.floor(size / 2);
  const buf = new Uint8Array(size * size);

  for (let y = half; y < h - half; y++) {
    for (let x = half; x < w - half; x++) {
      let k = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          buf[k++] = src[((y + dy) * w + (x + dx)) * 4];
        }
      }
      // Only sort the filled portion of the buffer to get the correct median
      const filled = buf.slice(0, k).sort((a, b) => a - b);
      const median = filled[Math.floor(k / 2)];
      const idx = (y * w + x) * 4;
      out[idx] = out[idx + 1] = out[idx + 2] = median;
      out[idx + 3] = 255;
    }
  }

  return new ImageData(out, w, h);
}

/**
 * Sauvola adaptive binarization.
 * Better than Otsu for documents with uneven lighting.
 *
 * The default windowSize=15 and k=0.2 are standard Sauvola parameters tuned
 * for 300 DPI document scans. windowSize controls the local neighbourhood
 * (should be odd; ~15px covers roughly one character at 300 DPI). k is the
 * sensitivity factor — lower values preserve more detail but increase noise;
 * 0.2 is the value recommended in Sauvola & Pietikäinen (2000).
 */
export function sauvolaBinarize(imageData, windowSize = 15, k = 0.2) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  const half = Math.floor(windowSize / 2);

  // Build integral image and integral of squares for fast local mean/std
  const integral = new Float64Array((w + 1) * (h + 1));
  const integralSq = new Float64Array((w + 1) * (h + 1));

  for (let y = 0; y < h; y++) {
    let rowSum = 0, rowSqSum = 0;
    for (let x = 0; x < w; x++) {
      const val = src[(y * w + x) * 4];
      rowSum += val;
      rowSqSum += val * val;
      const idx = (y + 1) * (w + 1) + (x + 1);
      integral[idx] = integral[idx - (w + 1)] + rowSum;
      integralSq[idx] = integralSq[idx - (w + 1)] + rowSqSum;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half);
      const y2 = Math.min(h - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const a1 = (y1) * (w + 1) + x1;
      const a2 = (y1) * (w + 1) + (x2 + 1);
      const a3 = (y2 + 1) * (w + 1) + x1;
      const a4 = (y2 + 1) * (w + 1) + (x2 + 1);

      const sum = integral[a4] - integral[a3] - integral[a2] + integral[a1];
      const sqSum = integralSq[a4] - integralSq[a3] - integralSq[a2] + integralSq[a1];

      const mean = sum / count;
      const variance = sqSum / count - mean * mean;
      const std = Math.sqrt(Math.max(0, variance));

      const threshold = mean * (1 + k * (std / 128 - 1));
      const val = src[(y * w + x) * 4];
      const bw = val > threshold ? 255 : 0;

      const idx = (y * w + x) * 4;
      out[idx] = out[idx + 1] = out[idx + 2] = bw;
      out[idx + 3] = 255;
    }
  }

  return new ImageData(out, w, h);
}

/**
 * Estimate skew angle using projection profile method.
 * Tests angles from -5° to +5° in 0.25° steps.
 */
export function estimateSkewAngle(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  // Downsample for speed
  const scale = Math.max(1, Math.floor(Math.max(w, h) / 500));
  const sw = Math.floor(w / scale);
  const sh = Math.floor(h / scale);

  // Build binary row from grayscale
  const binary = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      binary[y * sw + x] = src[((y * scale) * w + (x * scale)) * 4] < 128 ? 1 : 0;
    }
  }

  let bestAngle = 0;
  let bestScore = -Infinity;

  for (let angleDeg = -5; angleDeg <= 5; angleDeg += 0.25) {
    const angleRad = angleDeg * Math.PI / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    // Compute horizontal projection profile after rotation
    const profile = new Int32Array(sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (binary[y * sw + x]) {
          const ry = Math.round(-x * sinA + y * cosA);
          if (ry >= 0 && ry < sh) profile[ry]++;
        }
      }
    }

    // Score: sum of squared row counts (sharper peaks = better alignment)
    let score = 0;
    for (let i = 0; i < sh; i++) score += profile[i] * profile[i];
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angleDeg;
    }
  }

  return bestAngle;
}

/** Rotate a canvas by angle degrees */
export function rotateCanvas(canvas, angleDeg) {
  if (Math.abs(angleDeg) < 0.1) return canvas;

  const angleRad = angleDeg * Math.PI / 180;
  const cos = Math.abs(Math.cos(angleRad));
  const sin = Math.abs(Math.sin(angleRad));

  const newW = Math.ceil(canvas.width * cos + canvas.height * sin);
  const newH = Math.ceil(canvas.width * sin + canvas.height * cos);

  const out = document.createElement('canvas');
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return out;
}

/** Crop uniform black borders from scanned images */
export function cropBlackBorders(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const threshold = 30; // Pixels darker than this are "black"

  let top = 0, bottom = h - 1, left = 0, right = w - 1;

  // Find top
  outer_top:
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4] > threshold) { top = y; break outer_top; }
    }
  }

  // Find bottom
  outer_bottom:
  for (let y = h - 1; y >= top; y--) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4] > threshold) { bottom = y; break outer_bottom; }
    }
  }

  // Find left
  outer_left:
  for (let x = 0; x < w; x++) {
    for (let y = top; y <= bottom; y++) {
      if (d[(y * w + x) * 4] > threshold) { left = x; break outer_left; }
    }
  }

  // Find right
  outer_right:
  for (let x = w - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y++) {
      if (d[(y * w + x) * 4] > threshold) { right = x; break outer_right; }
    }
  }

  // Add small margin
  const margin = 2;
  top = Math.max(0, top - margin);
  bottom = Math.min(h - 1, bottom + margin);
  left = Math.max(0, left - margin);
  right = Math.min(w - 1, right + margin);

  const cw = right - left + 1;
  const ch = bottom - top + 1;

  if (cw < w * 0.5 || ch < h * 0.5) return imageData; // Don't crop too aggressively

  const cropped = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const srcOffset = ((y + top) * w + left) * 4;
    const dstOffset = y * cw * 4;
    cropped.set(d.subarray(srcOffset, srcOffset + cw * 4), dstOffset);
  }

  return new ImageData(cropped, cw, ch);
}
