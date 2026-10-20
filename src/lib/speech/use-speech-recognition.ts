"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getCaddieLanguageSnapshot } from "@/lib/speech/caddie-language";

function subscribeToNothing() {
  return () => {};
}

function getSupportedSnapshot() {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function getServerSupportedSnapshot() {
  return false;
}

type ActiveSession = { abort: () => void };

// App-wide: only one microphone session at a time. Starting any mic aborts
// whichever one was active (check-in, reflection, Caddie, Hands-Free).
let activeSession: ActiveSession | null = null;

export type SpeechEndInfo = {
  /** True if at least one final transcript was delivered this session. */
  heardSomething: boolean;
  /** Raw error code ("not-allowed", "no-speech", "start-failed", …) or null. */
  errorCode: string | null;
};

type SpeechOptions = {
  /** Defaults to the saved Caddie language. */
  lang?: string;
  /** true (default): keep listening until stopped. false: end after one utterance. */
  continuous?: boolean;
  /** Called when a session ends on its own or via stop() — never after abort(). */
  onEnd?: (info: SpeechEndInfo) => void;
};

export function describeSpeechError(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the microphone for this site in your browser settings, or type instead.";
    case "audio-capture":
      return "No microphone was found. You can type instead.";
    case "network":
      return "Voice input needs an internet connection. You can type instead.";
    case "no-speech":
      return "I didn't hear anything. Tap the mic and try again.";
    case "language-not-supported":
      return "Voice input isn't available for this language in this browser. You can type instead.";
    case "start-failed":
      return "Couldn't start the microphone. Tap the mic to try again, or type instead.";
    default:
      return "Voice input stopped unexpectedly. You can type instead.";
  }
}

export function useSpeechRecognition(
  onFinalTranscript: (transcript: string) => void,
  options: SpeechOptions = {},
) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Every start() gets a new session number; events from older sessions
  // (e.g. a late result after the panel closed) are ignored.
  const sessionRef = useRef(0);
  const ownerRef = useRef<ActiveSession | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const optionsRef = useRef(options);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
    optionsRef.current = options;
  });

  const supported = useSyncExternalStore(
    subscribeToNothing,
    getSupportedSnapshot,
    getServerSupportedSnapshot,
  );
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releaseActiveSession = useCallback(() => {
    if (activeSession && activeSession === ownerRef.current) activeSession = null;
    ownerRef.current = null;
  }, []);

  /** Stops immediately and discards any results still in flight. */
  const abort = useCallback(() => {
    sessionRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Already stopped — nothing to do.
      }
    }
    releaseActiveSession();
    setIsListening(false);
  }, [releaseActiveSession]);

  useEffect(() => abort, [abort]);

  /** Stops listening but still delivers the last phrase (used by the mic toggle). */
  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped — nothing to do.
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback((): boolean => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Voice input isn't supported in this browser — you can type instead.");
      return false;
    }

    // One mic at a time: stop any other active session, then our own.
    if (activeSession && activeSession !== ownerRef.current) activeSession.abort();
    abort();

    const session = ++sessionRef.current;
    const isCurrent = () => sessionRef.current === session;
    let heardSomething = false;
    let errorCode: string | null = null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = optionsRef.current.lang ?? getCaddieLanguageSnapshot();
    recognition.interimResults = false;
    recognition.continuous = optionsRef.current.continuous ?? true;

    // Only show "listening" once the browser has actually started.
    recognition.onstart = () => {
      if (isCurrent()) setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (!isCurrent()) return;
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          transcript += result[0]?.transcript ?? "";
        }
      }
      if (transcript.trim()) {
        heardSomething = true;
        onFinalTranscriptRef.current(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      if (!isCurrent()) return;
      errorCode = event.error;
      const message = describeSpeechError(event.error);
      if (message) setError(message);
    };

    recognition.onend = () => {
      if (!isCurrent()) return;
      recognitionRef.current = null;
      releaseActiveSession();
      setIsListening(false);
      optionsRef.current.onEnd?.({ heardSomething, errorCode });
    };

    const owner: ActiveSession = { abort };
    ownerRef.current = owner;
    activeSession = owner;
    recognitionRef.current = recognition;
    setError(null);

    try {
      recognition.start();
      return true;
    } catch (startError) {
      // e.g. InvalidStateError (already started) or a browser refusing to
      // start without a fresh tap — fail softly and let the golfer type.
      sessionRef.current += 1;
      recognitionRef.current = null;
      releaseActiveSession();
      setIsListening(false);
      const code =
        startError instanceof DOMException && startError.name === "NotAllowedError"
          ? "not-allowed"
          : "start-failed";
      setError(describeSpeechError(code));
      optionsRef.current.onEnd?.({ heardSomething: false, errorCode: code });
      return false;
    }
  }, [abort, releaseActiveSession]);

  return { supported, isListening, error, start, stop, abort, clearError };
}
