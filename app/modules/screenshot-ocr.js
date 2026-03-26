// @ts-check

/**
 * Screenshot OCR - capture screen region and recognize text.
 * Works in Tauri (native screenshot) and PWA (getDisplayMedia) environments.
 */
export class ScreenshotOcr {
  constructor() {
    /** @type {ImageData|null} */
    this._lastCapture = null;
  }

  /**
   * Capture a screen region.
   * In PWA: uses navigator.mediaDevices.getDisplayMedia → canvas → crop
   * In Tauri: uses native screenshot command
   * @returns {Promise<ImageData>}
   */
  async captureRegion() {
    // Check for Tauri environment
    if (typeof globalThis.__TAURI__ !== 'undefined') {
      return this._captureTauri();
    }
    return this._capturePwa();
  }

  /**
   * Recognize text from captured image data.
   * @param {ImageData} imageData
   * @param {string} [lang='eng']
   * @returns {Promise<{text: string, confidence: number, bounds: Array<{x: number, y: number, w: number, h: number}>}>}
   */
  async recognizeFromCapture(imageData, lang = 'eng') {
    if (!imageData || !imageData.width || !imageData.height) {
      throw new Error('Invalid image data');
    }

    // Lazy import tesseract adapter
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(lang);

      // Convert ImageData to canvas for tesseract
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });

      const { data } = await worker.recognize(blob);
      await worker.terminate();

      return {
        text: data.text,
        confidence: data.confidence / 100,
        bounds: (data.words || []).map(w => ({
          x: w.bbox.x0,
          y: w.bbox.y0,
          w: w.bbox.x1 - w.bbox.x0,
          h: w.bbox.y1 - w.bbox.y0,
        })),
      };
    } catch (e) {
      throw new Error(`OCR failed: ${e.message}`);
    }
  }

  /**
   * Capture region and recognize in one step.
   * @param {string} [lang='eng']
   */
  async captureAndRecognize(lang = 'eng') {
    const imageData = await this.captureRegion();
    this._lastCapture = imageData;
    const result = await this.recognizeFromCapture(imageData, lang);

    // Copy to clipboard if available
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(result.text);
      } catch (_e) { /* clipboard may not be available */ }
    }

    return result;
  }

  /**
   * Capture region as image blob (no OCR).
   * @param {'png'|'jpeg'} [format='png']
   * @returns {Promise<Blob>}
   */
  async captureToImage(format = 'png') {
    const imageData = await this.captureRegion();
    this._lastCapture = imageData;

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: `image/${format}` });
  }

  /** @private */
  async _capturePwa() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('Screen capture not available in this environment');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const width = settings.width || 1920;
    const height = settings.height || 1080;

    // Capture frame
    const videoEl = document.createElement('video');
    videoEl.srcObject = stream;
    await videoEl.play();

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);

    track.stop();
    stream.getTracks().forEach(t => t.stop());

    return ctx.getImageData(0, 0, width, height);
  }

  /** @private */
  async _captureTauri() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const rgbaBytes = await invoke('capture_screen_region', { x: 0, y: 0, w: 1920, h: 1080 });
      const data = new Uint8ClampedArray(rgbaBytes);
      return new ImageData(data, 1920, 1080);
    } catch (e) {
      throw new Error(`Tauri capture failed: ${e.message}`);
    }
  }
}
