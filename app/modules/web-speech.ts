// ─── Web Speech API ───────────────────────────────────────────────────────────
// Wrapper for the Web Speech Synthesis and Speech Recognition APIs.

// @ts-check

// ─── Speech Synthesis ────────────────────────────────────────────────────────

/**
 * Whether the Web Speech Synthesis API is supported.
 */
export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * Whether the Web Speech Recognition API is supported.
 */
export function isSpeechRecognitionSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Speak a text string using speech synthesis.
 * Returns a promise that resolves when speech ends, or rejects on error.
 * Options: voice name, rate (0.1-10), pitch (0-2), volume (0-1), lang
 */
export async function speak(
  text: string,
  options?: { voice?: string; rate?: number; pitch?: number; volume?: number; lang?: string },
): Promise<void> {
  if (!isSpeechSynthesisSupported()) return;

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);

    if (options) {
      if (options.rate !== undefined) utterance.rate = options.rate;
      if (options.pitch !== undefined) utterance.pitch = options.pitch;
      if (options.volume !== undefined) utterance.volume = options.volume;
      if (options.lang !== undefined) utterance.lang = options.lang;
      if (options.voice !== undefined) {
        const voices = window.speechSynthesis.getVoices();
        const matched = voices.find(v => v.name === options.voice);
        if (matched) utterance.voice = matched;
      }
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(event);

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Cancel any ongoing speech synthesis.
 */
export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Whether speech synthesis is currently speaking.
 */
export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking ?? false;
}

/**
 * Get all available speech synthesis voices.
 */
export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

// ─── Speech Recognition ──────────────────────────────────────────────────────

/**
 * Start speech recognition and return recognized text via callback.
 * Returns a stop function.
 */
export function startRecognition(
  onResult: (transcript: string, isFinal: boolean) => void,
  options?: { lang?: string; continuous?: boolean; interimResults?: boolean },
): () => void {
  if (!isSpeechRecognitionSupported()) return () => {};

  const SpeechRecognitionCtor: new () => any =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

  const recognition = new SpeechRecognitionCtor();

  if (options) {
    if (options.lang !== undefined) recognition.lang = options.lang;
    if (options.continuous !== undefined) recognition.continuous = options.continuous;
    if (options.interimResults !== undefined) recognition.interimResults = options.interimResults;
  }

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      onResult(transcript, result.isFinal);
    }
  };

  recognition.start();

  return () => {
    try {
      recognition.stop();
    } catch {
      // ignore errors on stop
    }
  };
}
