"use client";

import { MicIcon } from "@/components/icons/mic-icon";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";

export function VoiceTextareaField({
  id,
  label,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const { supported, isListening, error, start, stop } = useSpeechRecognition(
    (transcript) => {
      onChange(value ? `${value} ${transcript}` : transcript);
    },
  );

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>

      <div className="relative mt-2">
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted focus:border-forest focus:outline-none"
        />

        {supported && (
          <button
            type="button"
            onClick={isListening ? stop : start}
            aria-pressed={isListening}
            title={isListening ? "Stop listening" : "Speak your answer"}
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              isListening
                ? "border-forest bg-forest text-foreground"
                : "border-border bg-surface text-muted hover:border-forest"
            }`}
          >
            <MicIcon className="h-4 w-4" />
            {isListening && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        )}
      </div>

      {supported && isListening && (
        <p className="mt-1.5 text-xs text-sage">Listening… tap the mic to stop.</p>
      )}
      {supported && error && (
        <p className="mt-1.5 text-xs text-muted">{error}</p>
      )}
      {!supported && (
        <p className="mt-1.5 text-xs text-muted">
          Voice input isn&apos;t supported in this browser — you can type instead.
        </p>
      )}
    </div>
  );
}
