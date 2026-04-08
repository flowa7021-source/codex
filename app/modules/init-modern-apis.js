// @ts-check
// ─── Modern APIs Initialization ─────────────────────────────────────────────
// Wires up next-gen Web APIs into the application: File System Access,
// OPFS, WebCodecs, Compression Streams, Task Scheduler, Wake Lock,
// Web Share, View Transitions, and Disposable resources.
//
// Called from app-init-phase2 to register capabilities and event handlers.

import { isFsAccessSupported, openFilePicker, saveFile, getLastHandle } from './fs-access.js';
import { isOpfsSupported, writeFile as opfsWrite, readFile as opfsRead } from './opfs-storage.js';
import { isWebCodecsSupported } from './web-codecs.js';
import { isCompressionStreamsSupported } from './compression-streams.js';
import { isSchedulerSupported, postBackgroundTask } from './task-scheduler.js';
import { isWakeLockSupported, withWakeLock } from './wake-lock.js';
import { isShareSupported, isFileShareSupported, shareDocument, downloadFallback } from './web-share.js';
import { isViewTransitionsSupported, navigateToPage } from './view-transitions.js';
import { DisposableStack } from './disposable.js';

/**
 * @typedef {object} ModernApiCapabilities
 * @property {boolean} fsAccess   — File System Access API
 * @property {boolean} opfs       — Origin Private File System
 * @property {boolean} webCodecs  — WebCodecs ImageDecoder
 * @property {boolean} compression — Compression Streams API
 * @property {boolean} scheduler  — scheduler.postTask
 * @property {boolean} wakeLock   — Screen Wake Lock
 * @property {boolean} share      — Web Share API
 * @property {boolean} fileShare  — Web Share with files
 * @property {boolean} viewTransitions — View Transitions API
 */

/** @type {ModernApiCapabilities} */
let _capabilities = {
  fsAccess: false,
  opfs: false,
  webCodecs: false,
  compression: false,
  scheduler: false,
  wakeLock: false,
  share: false,
  fileShare: false,
  viewTransitions: false,
};

/**
 * Detect and log available modern API capabilities.
 * @returns {Promise<ModernApiCapabilities>}
 */
export async function detectCapabilities() {
  _capabilities = {
    fsAccess: isFsAccessSupported(),
    opfs: await isOpfsSupported(),
    webCodecs: isWebCodecsSupported(),
    compression: isCompressionStreamsSupported(),
    scheduler: isSchedulerSupported(),
    wakeLock: isWakeLockSupported(),
    share: isShareSupported(),
    fileShare: isFileShareSupported(),
    viewTransitions: isViewTransitionsSupported(),
  };
  return _capabilities;
}

/**
 * Get previously detected capabilities.
 * @returns {ModernApiCapabilities}
 */
export function getCapabilities() {
  return { ..._capabilities };
}

/**
 * Initialize modern API integrations.
 * Call once during app startup (after DOM ready).
 */
export async function initModernApis() {
  const caps = await detectCapabilities();

  // Log available APIs (development aid)
  const available = Object.entries(caps)
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (available.length > 0) {
    console.info('[modern-apis] Available:', available.join(', '));
  }

  return caps;
}

// ─── Re-exports for convenience ─────────────────────────────────────────────
// So other modules can import from a single entry point.
export {
  // File System Access
  openFilePicker, saveFile, getLastHandle,
  // OPFS
  opfsWrite, opfsRead,
  // Wake Lock
  withWakeLock,
  // Share
  shareDocument, downloadFallback,
  // View Transitions
  navigateToPage,
  // Task Scheduler
  postBackgroundTask,
  // Disposable
  DisposableStack,
};
