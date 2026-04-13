// ─── Channel Messaging ───────────────────────────────────────────────────────
// Wrappers for the MessageChannel and BroadcastChannel APIs.
// MessageChannel provides a private two-port communication channel between
// scripts. BroadcastChannel enables publish/subscribe across browsing contexts
// that share the same origin.

// @ts-check

// ─── MessageChannel ──────────────────────────────────────────────────────────

/**
 * Whether MessageChannel is supported.
 */
export function isMessageChannelSupported(): boolean {
  return typeof MessageChannel !== 'undefined';
}

/**
 * Create a connected MessageChannel pair and return both ports.
 */
export function createMessageChannel(): { port1: MessagePort; port2: MessagePort } | null {
  try {
    const channel = new MessageChannel();
    return { port1: channel.port1, port2: channel.port2 };
  } catch {
    return null;
  }
}

/**
 * Send a message through port1 and receive via port2 (one-shot round-trip test).
 * Resolves with the received message data, or null on failure.
 */
export async function pingMessageChannel(data: unknown): Promise<unknown> {
  if (!isMessageChannelSupported()) return null;

  const channel = createMessageChannel();
  if (!channel) return null;

  return new Promise<unknown>((resolve) => {
    const timer = setTimeout(() => {
      channel.port1.onmessage = null;
      channel.port2.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      resolve(null);
    }, 1000);

    channel.port2.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      channel.port1.onmessage = null;
      channel.port2.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      resolve(event.data);
    };

    channel.port2.start();
    channel.port1.postMessage(data);
  });
}

// ─── BroadcastChannel ────────────────────────────────────────────────────────

/**
 * Whether BroadcastChannel is supported.
 */
export function isBroadcastChannelSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

/**
 * Open a named BroadcastChannel.
 * Returns the channel (caller should close it when done).
 */
export function openBroadcastChannel(name: string): BroadcastChannel | null {
  try {
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}

/**
 * Post a message to a named broadcast channel and immediately close it.
 * Returns true on success.
 */
export function broadcastMessage(name: string, data: unknown): boolean {
  try {
    const channel = openBroadcastChannel(name);
    if (!channel) return false;
    channel.postMessage(data);
    channel.close();
    return true;
  } catch {
    return false;
  }
}
