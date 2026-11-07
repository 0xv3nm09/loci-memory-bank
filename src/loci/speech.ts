/**
 * Shared Web Speech API access — desktop browsers only (Quest browsers
 * don't ship SpeechRecognition; callers must hide/disable gracefully).
 */

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<{
          isFinal: boolean;
          length: number;
          [index: number]: { transcript: string };
        }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const holder = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return holder.SpeechRecognition != null || holder.webkitSpeechRecognition != null;
}

export function createRecognizer(): SpeechRecognitionLike | null {
  const holder = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = holder.SpeechRecognition ?? holder.webkitSpeechRecognition;
  if (Ctor == null) {
    return null;
  }
  const rec = new Ctor();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}
