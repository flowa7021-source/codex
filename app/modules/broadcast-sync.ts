// ─── Broadcast Channel Cross-Tab Sync ───────────────────────────────────────
// Synchronizes state between browser tabs using the BroadcastChannel API.
// When a file is opened, bookmarks are updated, or settings change in one tab,
// other tabs are notified via the 'novareader-sync' channel.

/** Channel name used across all NovaReader tabs. */
const CHANNEL_NAME = 'novareader-sync';

export type BroadcastEventType =
  | 'file:opened'
  | 'file:closed'
  | 'bookmark:added'
  | 'bookmark:removed'
  | 'settings:changed'
  | 'reading-progress:updated'
  | 'annotation:added'
  | 'annotation:removed'
  | 'sync:requested';

export interface BroadcastMessage {
  type: BroadcastEventType;
  payload?: unknown;
  /** Unique ID for this tab — used to filter out own messages. */
  tabId: string;
  timestamp: number;
}

// ─── Module-level state ──────────────────────────────────────────────────────

let _channel: BroadcastChannel | null = null;
let _tabId: string = '';

/** Listeners keyed by event type. Each entry is a set of handler functions. */
const _handlers = new Map<BroadcastEventType | '*', Set<(msg: BroadcastMessage) => void>>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the BroadcastChannel API is available in this environment.
 */
export function isBroadcastSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

/**
 * Returns the unique ID assigned to this tab.
 * An empty string is returned before {@link initBroadcastSync} is called.
 */
export function getTabId(): string {
  return _tabId;
}

/**
 * Initialize the BroadcastChannel for cross-tab synchronization.
 * Safe to call multiple times — subsequent calls are no-ops.
 * Generates a unique `tabId` for this tab on first call.
 */
export function initBroadcastSync(): void {
  if (!isBroadcastSupported()) return;
  if (_channel) return; // already initialized

  _tabId = _generateTabId();
  _channel = new BroadcastChannel(CHANNEL_NAME);
  _channel.onmessage = _onMessage;
}

/**
 * Send a message to all other tabs on the sync channel.
 * No-op when BroadcastChannel is not supported or the channel is not open.
 */
export function broadcastEvent(type: BroadcastEventType, payload?: unknown): void {
  if (!_channel) return;

  const msg: BroadcastMessage = {
    type,
    payload,
    tabId: _tabId,
    timestamp: Date.now(),
  };

  _channel.postMessage(msg);
}

/**
 * Subscribe to a specific event type from OTHER tabs (own messages are filtered).
 * @returns Unsubscribe function — call it to remove this handler.
 */
export function onBroadcastEvent(
  type: BroadcastEventType,
  handler: (payload: unknown) => void,
): () => void {
  const wrapper = (msg: BroadcastMessage) => {
    handler(msg.payload);
  };

  _addHandler(type, wrapper);

  return () => _removeHandler(type, wrapper);
}

/**
 * Subscribe to ALL events from other tabs.
 * @returns Unsubscribe function — call it to remove this handler.
 */
export function onAnyBroadcastEvent(
  handler: (msg: BroadcastMessage) => void,
): () => void {
  _addHandler('*', handler);
  return () => _removeHandler('*', handler);
}

/**
 * Close the BroadcastChannel and remove all listeners.
 * Safe to call multiple times or before {@link initBroadcastSync}.
 */
export function closeBroadcastSync(): void {
  if (_channel) {
    _channel.onmessage = null;
    _channel.close();
    _channel = null;
  }
  _handlers.clear();
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Generate a unique tab identifier using crypto.randomUUID when available,
 * falling back to a timestamp + random suffix.
 */
function _generateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function _addHandler(
  key: BroadcastEventType | '*',
  handler: (msg: BroadcastMessage) => void,
): void {
  let set = _handlers.get(key);
  if (!set) {
    set = new Set();
    _handlers.set(key, set);
  }
  set.add(handler);
}

function _removeHandler(
  key: BroadcastEventType | '*',
  handler: (msg: BroadcastMessage) => void,
): void {
  const set = _handlers.get(key);
  if (set) {
    set.delete(handler);
    if (set.size === 0) {
      _handlers.delete(key);
    }
  }
}

function _onMessage(event: MessageEvent<BroadcastMessage>): void {
  const msg = event.data as BroadcastMessage;

  // Filter out messages originating from this tab
  if (!msg || msg.tabId === _tabId) return;

  // Dispatch to typed handlers
  const typed = _handlers.get(msg.type);
  if (typed) {
    for (const handler of typed) {
      handler(msg);
    }
  }

  // Dispatch to wildcard handlers
  const wildcard = _handlers.get('*');
  if (wildcard) {
    for (const handler of wildcard) {
      handler(msg);
    }
  }
}
