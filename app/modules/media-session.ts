// ─── Media Session API ────────────────────────────────────────────────────────
// Media Session API wrapper for showing media controls in OS/browser UI.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Media Session API is supported.
 */
export function isMediaSessionSupported(): boolean {
  return 'mediaSession' in navigator;
}

/**
 * Set the media metadata (title, artist, album, artwork).
 */
export function setMediaMetadata(metadata: {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: Array<{ src: string; sizes?: string; type?: string }>;
}): void {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata(metadata);
  } catch {
    (navigator.mediaSession as any).metadata = metadata;
  }
}

/**
 * Set the playback state: 'none' | 'paused' | 'playing'
 */
export function setPlaybackState(state: 'none' | 'paused' | 'playing'): void {
  if (!isMediaSessionSupported()) return;
  navigator.mediaSession.playbackState = state;
}

/**
 * Register an action handler (e.g. 'play', 'pause', 'nexttrack', 'previoustrack').
 * Returns a cleanup function that removes the handler.
 */
export function setActionHandler(
  action: MediaSessionAction,
  handler: (() => void) | null,
): () => void {
  if (!isMediaSessionSupported()) return () => {};
  navigator.mediaSession.setActionHandler(action, handler);
  return () => {
    navigator.mediaSession.setActionHandler(action, null);
  };
}

/**
 * Clear all registered action handlers and reset metadata/state.
 */
export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return;

  const commonActions: MediaSessionAction[] = [
    'play',
    'pause',
    'stop',
    'seekbackward',
    'seekforward',
    'seekto',
    'previoustrack',
    'nexttrack',
    'skipad',
  ];

  for (const action of commonActions) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      // some actions may not be supported in all browsers — ignore
    }
  }

  try {
    navigator.mediaSession.metadata = null;
  } catch {
    (navigator.mediaSession as any).metadata = null;
  }

  navigator.mediaSession.playbackState = 'none';
}
