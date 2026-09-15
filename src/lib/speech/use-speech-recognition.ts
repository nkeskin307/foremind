"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeToNothing() {
  return () => {};
}

function getSupportedSnapshot() {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function getServerSupportedSnapshot() {
  return false;
}

export function useSpeechRecognition(onFinalTranscript: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  });

  const supported = useSyncExternalStore(
    subscribeToNothing,
    getSupportedSnapshot,
    getServerSupportedSnapshot,
  );
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          transcript += result[0]?.transcript ?? "";
        }
      }
      if (transcript.trim()) {
        onFinalTranscriptRef.current(transcript.trim());
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  return { supported, isListening, start, stop };
}
