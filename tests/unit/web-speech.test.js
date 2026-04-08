// ─── Unit Tests: Web Speech API ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isSpeechSynthesisSupported,
  isSpeechRecognitionSupported,
  speak,
  cancelSpeech,
  isSpeaking,
  getVoices,
  startRecognition,
} from '../../app/modules/web-speech.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let mockUtterances;
let mockSynth;

beforeEach(() => {
  mockUtterances = [];
  mockSynth = {
    speaking: false,
    speak(utt) {
      mockSynth.speaking = true;
      mockUtterances.push(utt);
      queueMicrotask(() => {
        mockSynth.speaking = false;
        if (utt.onend) utt.onend({});
      });
    },
    cancel() { mockSynth.speaking = false; },
    getVoices() { return [{ name: 'Google US English', lang: 'en-US' }]; },
  };
  globalThis.window.speechSynthesis = mockSynth;
  globalThis.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
    constructor(text) { this.text = text; this.onend = null; this.onerror = null; }
  };
});

afterEach(() => {
  delete globalThis.window.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.window.SpeechRecognition;
  delete globalThis.window.webkitSpeechRecognition;
});

// ─── isSpeechSynthesisSupported ──────────────────────────────────────────────

describe('isSpeechSynthesisSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isSpeechSynthesisSupported(), 'boolean');
  });

  it('returns true when speechSynthesis is present on window', () => {
    assert.equal(isSpeechSynthesisSupported(), true);
  });

  it('returns false when speechSynthesis is absent', () => {
    delete globalThis.window.speechSynthesis;
    assert.equal(isSpeechSynthesisSupported(), false);
  });
});

// ─── isSpeechRecognitionSupported ────────────────────────────────────────────

describe('isSpeechRecognitionSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isSpeechRecognitionSupported(), 'boolean');
  });

  it('returns false when both SpeechRecognition and webkitSpeechRecognition are absent', () => {
    assert.equal(isSpeechRecognitionSupported(), false);
  });

  it('returns true when SpeechRecognition is present', () => {
    globalThis.window.SpeechRecognition = class SpeechRecognition {};
    assert.equal(isSpeechRecognitionSupported(), true);
  });

  it('returns true when webkitSpeechRecognition is present', () => {
    globalThis.window.webkitSpeechRecognition = class webkitSpeechRecognition {};
    assert.equal(isSpeechRecognitionSupported(), true);
  });
});

// ─── speak ───────────────────────────────────────────────────────────────────

describe('speak', () => {
  it('resolves when the utterance ends', async () => {
    await assert.doesNotReject(() => speak('hello'));
  });

  it('calls speechSynthesis.speak with the utterance', async () => {
    await speak('hello world');
    assert.equal(mockUtterances.length, 1);
    assert.equal(mockUtterances[0].text, 'hello world');
  });

  it('sets rate on utterance when provided', async () => {
    await speak('test', { rate: 1.5 });
    assert.equal(mockUtterances[0].rate, 1.5);
  });

  it('sets pitch on utterance when provided', async () => {
    await speak('test', { pitch: 0.8 });
    assert.equal(mockUtterances[0].pitch, 0.8);
  });

  it('sets volume on utterance when provided', async () => {
    await speak('test', { volume: 0.5 });
    assert.equal(mockUtterances[0].volume, 0.5);
  });

  it('sets lang on utterance when provided', async () => {
    await speak('test', { lang: 'fr-FR' });
    assert.equal(mockUtterances[0].lang, 'fr-FR');
  });

  it('resolves immediately when speech synthesis is unsupported', async () => {
    delete globalThis.window.speechSynthesis;
    await assert.doesNotReject(() => speak('no synth'));
  });

  it('rejects when utterance fires onerror', async () => {
    mockSynth.speak = function(utt) {
      queueMicrotask(() => {
        if (utt.onerror) utt.onerror(new Error('speech error'));
      });
    };
    await assert.rejects(() => speak('bad'));
  });
});

// ─── cancelSpeech ────────────────────────────────────────────────────────────

describe('cancelSpeech', () => {
  it('calls speechSynthesis.cancel', () => {
    let cancelled = false;
    mockSynth.cancel = () => { cancelled = true; };
    cancelSpeech();
    assert.equal(cancelled, true);
  });

  it('does not throw when speech synthesis is unsupported', () => {
    delete globalThis.window.speechSynthesis;
    assert.doesNotThrow(() => cancelSpeech());
  });

  it('sets speaking to false after cancel', () => {
    mockSynth.speaking = true;
    cancelSpeech();
    assert.equal(mockSynth.speaking, false);
  });
});

// ─── isSpeaking ──────────────────────────────────────────────────────────────

describe('isSpeaking', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isSpeaking(), 'boolean');
  });

  it('returns false when not speaking', () => {
    mockSynth.speaking = false;
    assert.equal(isSpeaking(), false);
  });

  it('returns true when speaking', () => {
    mockSynth.speaking = true;
    assert.equal(isSpeaking(), true);
  });

  it('returns false when speech synthesis is unsupported', () => {
    delete globalThis.window.speechSynthesis;
    assert.equal(isSpeaking(), false);
  });
});

// ─── getVoices ───────────────────────────────────────────────────────────────

describe('getVoices', () => {
  it('returns an array', () => {
    assert.ok(Array.isArray(getVoices()));
  });

  it('returns voices from speechSynthesis', () => {
    const voices = getVoices();
    assert.equal(voices.length, 1);
    assert.equal(voices[0].name, 'Google US English');
  });

  it('returns empty array when speech synthesis is unsupported', () => {
    delete globalThis.window.speechSynthesis;
    const voices = getVoices();
    assert.ok(Array.isArray(voices));
    assert.equal(voices.length, 0);
  });
});

// ─── startRecognition ────────────────────────────────────────────────────────

describe('startRecognition', () => {
  it('returns a function when recognition is unsupported', () => {
    const stop = startRecognition(() => {});
    assert.equal(typeof stop, 'function');
  });

  it('does not throw when recognition is unsupported', () => {
    assert.doesNotThrow(() => startRecognition(() => {}));
  });

  it('calling the returned stop function does not throw when unsupported', () => {
    const stop = startRecognition(() => {});
    assert.doesNotThrow(() => stop());
  });

  it('returns a function when recognition is supported', () => {
    globalThis.window.SpeechRecognition = class SpeechRecognition {
      constructor() { this.onresult = null; }
      start() {}
      stop() {}
    };
    const stop = startRecognition(() => {});
    assert.equal(typeof stop, 'function');
  });

  it('calls start on the recognition instance', () => {
    let started = false;
    globalThis.window.SpeechRecognition = class SpeechRecognition {
      constructor() { this.onresult = null; }
      start() { started = true; }
      stop() {}
    };
    startRecognition(() => {});
    assert.equal(started, true);
  });

  it('sets options on the recognition instance', () => {
    let capturedLang;
    let capturedContinuous;
    let capturedInterim;
    globalThis.window.SpeechRecognition = class SpeechRecognition {
      constructor() {
        this.onresult = null;
        this.lang = '';
        this.continuous = false;
        this.interimResults = false;
      }
      start() {
        capturedLang = this.lang;
        capturedContinuous = this.continuous;
        capturedInterim = this.interimResults;
      }
      stop() {}
    };
    startRecognition(() => {}, { lang: 'de-DE', continuous: true, interimResults: true });
    assert.equal(capturedLang, 'de-DE');
    assert.equal(capturedContinuous, true);
    assert.equal(capturedInterim, true);
  });

  it('calls stop on the recognition instance when stop function is invoked', () => {
    let stopped = false;
    globalThis.window.SpeechRecognition = class SpeechRecognition {
      constructor() { this.onresult = null; }
      start() {}
      stop() { stopped = true; }
    };
    const stop = startRecognition(() => {});
    stop();
    assert.equal(stopped, true);
  });

  it('invokes onResult callback with transcript and isFinal when onresult fires', () => {
    const results = [];
    let recognitionInstance;
    globalThis.window.SpeechRecognition = class SpeechRecognition {
      constructor() {
        this.onresult = null;
        recognitionInstance = this;
      }
      start() {}
      stop() {}
    };
    startRecognition((transcript, isFinal) => {
      results.push({ transcript, isFinal });
    });
    // Simulate a recognition result event
    recognitionInstance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'hello there' }], { isFinal: true }),
      ],
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].transcript, 'hello there');
    assert.equal(results[0].isFinal, true);
  });
});
