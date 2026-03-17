// ─── OCR Worker Manager ──────────────────────────────────────────────────────
// Offloads OCRAD recognition to a dedicated Web Worker.
// OCRAD.js is loaded inside the worker via importScripts (fully offline).
// Falls back to main-thread OCRAD if worker creation fails.

let _worker = null;
let _taskId = 0;
const _pending = new Map();
let _workerReady = false;
let _fallbackMode = false;
let _ocradUrl = '';

function getOcradAbsoluteUrl() {
  if (_ocradUrl) return _ocradUrl;
  try {
    _ocradUrl = new URL('../vendor/ocrad.js', import.meta.url).href;
  } catch {
    _ocradUrl = './vendor/ocrad.js';
  }
  return _ocradUrl;
}

function buildWorkerCode() {
  return `
    let ocradReady = false;

    self.onmessage = function(e) {
      const { type, taskId, payload } = e.data;

      if (type === 'init') {
        try {
          // Configure Emscripten Module before loading
          self.Module = {
            TOTAL_MEMORY: 192 * 1024 * 1024,
            ALLOW_MEMORY_GROWTH: 1,
            printErr: function() {},
          };
          importScripts(payload.ocradUrl);

          // Wait for OCRAD to initialize
          let attempts = 0;
          const check = setInterval(function() {
            attempts++;
            if (typeof self.OCRAD === 'function') {
              clearInterval(check);
              ocradReady = true;
              self.postMessage({ type: 'init-done', taskId: taskId, ok: true });
            } else if (attempts > 80) {
              clearInterval(check);
              self.postMessage({ type: 'init-done', taskId: taskId, ok: false, error: 'OCRAD init timeout' });
            }
          }, 50);
        } catch (err) {
          self.postMessage({ type: 'init-done', taskId: taskId, ok: false, error: err.message || String(err) });
        }
        return;
      }

      if (type === 'recognize') {
        if (!ocradReady) {
          self.postMessage({ type: 'recognize-done', taskId: taskId, text: '', error: 'OCRAD not ready' });
          return;
        }
        try {
          var imageData = payload.imageData;
          var width = payload.width;
          var height = payload.height;

          // Create OffscreenCanvas if available, otherwise use ImageData trick
          var canvas;
          if (typeof OffscreenCanvas !== 'undefined') {
            canvas = new OffscreenCanvas(width, height);
            var ctx = canvas.getContext('2d');
            ctx.putImageData(new ImageData(imageData, width, height), 0, 0);
          } else {
            // Fallback: create a minimal canvas-like object that OCRAD can consume
            canvas = {
              width: width,
              height: height,
              getContext: function() {
                return {
                  getImageData: function() {
                    return { data: imageData, width: width, height: height };
                  }
                };
              }
            };
          }

          var text = self.OCRAD(canvas);
          self.postMessage({ type: 'recognize-done', taskId: taskId, text: text || '' });
        } catch (err) {
          self.postMessage({ type: 'recognize-done', taskId: taskId, text: '', error: err.message || String(err) });
        }
        return;
      }

      if (type === 'preprocess') {
        // Image preprocessing inside worker (offload from main thread)
        var d = payload.imageData;
        var w = payload.width;
        var h = payload.height;
        var thresholdBias = payload.thresholdBias || 0;
        var mode = payload.mode || 'otsu';
        var invert = !!payload.invert;

        var totalPx = w * h;
        var hist = new Uint32Array(256);
        var mean = 0;

        // Grayscale + histogram
        for (var i = 0; i < d.length; i += 4) {
          var gray = Math.round(d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
          gray = Math.max(0, Math.min(255, gray));
          d[i] = d[i+1] = d[i+2] = gray;
          hist[gray]++;
          mean += gray;
        }
        mean /= Math.max(1, totalPx);

        // p5/p95
        var p5 = 0, p95 = 255, acc = 0;
        for (var j = 0; j < 256; j++) { acc += hist[j]; if (acc >= totalPx * 0.05) { p5 = j; break; } }
        acc = 0;
        for (var j2 = 0; j2 < 256; j2++) { acc += hist[j2]; if (acc >= totalPx * 0.95) { p95 = j2; break; } }
        var spread = Math.max(1, p95 - p5);

        // stdDev
        var sqSum = 0;
        for (var k = 0; k < d.length; k += 4) sqSum += d[k] * d[k];
        var stdDev = Math.sqrt(Math.max(0, sqSum / totalPx - mean * mean));

        // Contrast stretch + boost
        var boost = stdDev < 36 ? 1.18 : 1.0;
        for (var m = 0; m < d.length; m += 4) {
          var stretched = ((d[m] - p5) * 255) / spread;
          var centered = (stretched - 127) * boost + 127;
          d[m] = d[m+1] = d[m+2] = Math.max(0, Math.min(255, Math.round(centered)));
        }

        // Otsu threshold
        var otsu = 128;
        var total = 0, sumTotal = 0;
        for (var t1 = 0; t1 < 256; t1++) { total += hist[t1]; sumTotal += t1 * hist[t1]; }
        var sumBack = 0, wBack = 0, maxVar = 0;
        for (var t2 = 0; t2 < 256; t2++) {
          wBack += hist[t2]; if (wBack === 0) continue;
          var wFore = total - wBack; if (wFore === 0) break;
          sumBack += t2 * hist[t2];
          var mBack = sumBack / wBack;
          var mFore = (sumTotal - sumBack) / wFore;
          var between = wBack * wFore * (mBack - mFore) * (mBack - mFore);
          if (between > maxVar) { maxVar = between; otsu = t2; }
        }

        var thresholdBase = mode === 'otsu' ? otsu : mean;
        var threshold = Math.max(50, Math.min(220, thresholdBase + thresholdBias));
        for (var n = 0; n < d.length; n += 4) {
          var v = d[n] > threshold ? 255 : 0;
          if (invert) v = 255 - v;
          d[n] = d[n+1] = d[n+2] = v;
          d[n+3] = 255;
        }

        self.postMessage(
          { type: 'preprocess-done', taskId: taskId, imageData: d, width: w, height: h, otsu: otsu, mean: mean, stdDev: stdDev },
          [d.buffer]
        );
        return;
      }
    };
  `;
}

function ensureWorker() {
  if (_fallbackMode) return Promise.resolve(false);
  if (_worker && _workerReady) return Promise.resolve(true);
  if (_worker) {
    // Worker exists but not yet ready — wait for init
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (_workerReady) { clearInterval(check); resolve(true); }
        if (_fallbackMode) { clearInterval(check); resolve(false); }
      }, 50);
      setTimeout(() => { clearInterval(check); resolve(_workerReady); }, 6000);
    });
  }

  return new Promise((resolve) => {
    try {
      const blob = new Blob([buildWorkerCode()], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      _worker = new Worker(url);
      URL.revokeObjectURL(url);

      const initId = ++_taskId;
      const timeout = setTimeout(() => {
        _fallbackMode = true;
        resolve(false);
      }, 8000);

      _worker.onmessage = (e) => {
        const { type, taskId, ok, error } = e.data;

        if (type === 'init-done') {
          clearTimeout(timeout);
          if (ok) {
            _workerReady = true;
            // Re-attach general message handler
            _worker.onmessage = handleWorkerMessage;
            resolve(true);
          } else {
            console.warn('OCR Worker init failed:', error);
            _fallbackMode = true;
            resolve(false);
          }
          return;
        }

        handleWorkerMessage(e);
      };

      _worker.onerror = () => {
        clearTimeout(timeout);
        _fallbackMode = true;
        resolve(false);
      };

      _worker.postMessage({ type: 'init', taskId: initId, payload: { ocradUrl: getOcradAbsoluteUrl() } });
    } catch {
      _fallbackMode = true;
      resolve(false);
    }
  });
}

function handleWorkerMessage(e) {
  const { type, taskId } = e.data;
  const key = `${type}:${taskId}`;
  const handler = _pending.get(key);
  if (handler) {
    _pending.delete(key);
    handler(e.data);
  }
}

function sendToWorker(type, payload) {
  const id = ++_taskId;
  const transferables = [];

  // Transfer ArrayBuffer for image data to avoid copying
  if (payload.imageData && payload.imageData.buffer) {
    transferables.push(payload.imageData.buffer);
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      _pending.delete(`${type}-done:${id}`);
      reject(new Error(`OCR worker timeout for ${type}`));
    }, 30000);

    _pending.set(`${type}-done:${id}`, (data) => {
      clearTimeout(timeoutId);
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
    });

    _worker.postMessage({ type, taskId: id, payload }, transferables);
  });
}

/**
 * Recognize text from an ImageData-like object using OCRAD in a Web Worker.
 * @param {Uint8ClampedArray} imageData - pixel data (RGBA)
 * @param {number} width
 * @param {number} height
 * @returns {Promise<string>} recognized text
 */
export async function recognizeInWorker(imageData, width, height) {
  const workerOk = await ensureWorker();
  if (!workerOk) {
    // Fallback: use main-thread OCRAD
    return null; // caller handles fallback
  }

  // Copy imageData since it will be transferred
  const copy = new Uint8ClampedArray(imageData);
  const result = await sendToWorker('recognize', { imageData: copy, width, height });
  return result.text || '';
}

/**
 * Preprocess image in worker (grayscale, threshold, binarize).
 * Returns preprocessed pixel data.
 */
export async function preprocessInWorker(imageData, width, height, thresholdBias, mode, invert) {
  const workerOk = await ensureWorker();
  if (!workerOk) return null;

  const copy = new Uint8ClampedArray(imageData);
  const result = await sendToWorker('preprocess', {
    imageData: copy, width, height, thresholdBias, mode, invert,
  });
  return {
    imageData: new Uint8ClampedArray(result.imageData),
    width: result.width,
    height: result.height,
    otsu: result.otsu,
    mean: result.mean,
    stdDev: result.stdDev,
  };
}

/**
 * Check if OCR worker is available (not in fallback mode).
 */
export function isWorkerAvailable() {
  return !_fallbackMode && _workerReady;
}

/**
 * Pre-initialize the worker (call early to avoid first-OCR delay).
 */
export async function warmUpOcrWorker() {
  return ensureWorker();
}

/**
 * Terminate the OCR worker and release resources.
 */
export function terminateOcrWorker() {
  if (_worker) {
    _worker.terminate();
    _worker = null;
  }
  _workerReady = false;
  _fallbackMode = false;
  _pending.clear();
}
