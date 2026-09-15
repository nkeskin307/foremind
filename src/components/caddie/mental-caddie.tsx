"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MicIcon } from "@/components/icons/mic-icon";
import { HistoryIcon } from "@/components/icons/history-icon";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";
import { useCaddieContext } from "@/lib/caddie/caddie-context";
import { appendCaddieLogEntry, loadCaddieLog } from "@/lib/caddie/caddie-log-storage";
import { loadActiveRound } from "@/lib/play/active-round-storage";
import {
  loadCompletedRounds,
  toCaddieHistoryPayload,
  type CaddieHistoryRound,
  type CompletedRound,
} from "@/lib/mental-game/completed-rounds";

const FALLBACK_ERROR_MESSAGE =
  "The Mental Caddie couldn't respond right now. Please try again in a moment.";

const MAX_HISTORY_ROUNDS = 5;

// TEMPORARY DEV-ONLY DIAGNOSTIC LOGGING (requested to verify the localStorage
// history flow). Reports key names, a round count, and dates only — never
// reflection text or other sensitive content. Safe to remove once verified.
function logCaddieLocalStorageDebugInfo(completedRounds: CompletedRound[]): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;

  const foreMindKeys = Object.keys(window.localStorage).filter((key) =>
    key.startsWith("foremind:"),
  );

  console.log("[caddie] localStorage check on Caddie open:", {
    foreMindKeys,
    completedRoundsFound: completedRounds.length,
    dates: completedRounds.map((round) => round.date),
  });
}

function formatLogTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MentalCaddie() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<"ask" | "history">("ask");

  const { supported, isListening, start, stop } = useSpeechRecognition(
    (transcript) => {
      setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
    },
  );

  const { context, isPanelOpen, closePanel } = useCaddieContext();

  // AppHeader's desktop pill and mobile icon button both call openPanel()
  // directly, so history is derived here from the panel being open rather
  // than loaded inside a single trigger's click handler.
  const history = useMemo<CaddieHistoryRound[]>(() => {
    if (!isPanelOpen) return [];

    const allCompletedRounds = loadCompletedRounds();
    logCaddieLocalStorageDebugInfo(allCompletedRounds);

    return allCompletedRounds
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_HISTORY_ROUNDS)
      .map(toCaddieHistoryPayload);
  }, [isPanelOpen]);

  // Not memoized: read fresh every render the History tab is showing, so it
  // always includes entries logged earlier in the same panel session (e.g.
  // a question just asked) rather than a stale snapshot from panel-open.
  const caddieLog = isPanelOpen && view === "history" ? loadCaddieLog() : [];

  function closeCaddie() {
    if (isListening) stop();
    closePanel();
    setMessage("");
    setResponse(null);
    setIsLoading(false);
    setView("ask");
  }

  async function handleAsk() {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/caddie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, context, history }),
      });

      const data = await res.json();

      if (!res.ok || typeof data.response !== "string") {
        setResponse(
          typeof data.error === "string" ? data.error : FALLBACK_ERROR_MESSAGE,
        );
        return;
      }

      setResponse(data.response);
      const activeRound = loadActiveRound();
      appendCaddieLogEntry(trimmed, data.response, {
        roundId: activeRound?.id,
        course: activeRound?.course,
        hole: activeRound ? activeRound.currentHole + 1 : undefined,
      });
    } catch {
      setResponse(FALLBACK_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }

  if (pathname === "/") return null;

  // AppHeader owns both Caddie triggers (desktop pill and mobile icon
  // button); this component only owns the drawer and its contents.
  return (
    <>
      {isPanelOpen && (
        <div
          className="motion-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4 sm:items-center sm:px-6"
          onClick={closeCaddie}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mental-caddie-heading"
            onClick={(event) => event.stopPropagation()}
            className="motion-modal w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="mental-caddie-heading"
                  className="text-lg font-semibold text-foreground"
                >
                  Your Mental Caddie
                </h2>
                <p className="mt-1 text-sm text-muted">What&apos;s going on?</p>
                {history.length > 0 && (
                  <p className="motion-fade mt-1 flex items-center gap-1 text-xs text-sage">
                    <HistoryIcon className="h-3.5 w-3.5" />
                    Remembering {history.length} past round{history.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView((current) => (current === "ask" ? "history" : "ask"))}
                  aria-pressed={view === "history"}
                  title={view === "history" ? "Back to Ask" : "History"}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-sage-soft hover:text-foreground"
                >
                  <HistoryIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={closeCaddie}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-sage-soft hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>

            {view === "history" ? (
              <div className="motion-fade mt-5">
                {caddieLog.length === 0 ? (
                  <p className="text-sm text-muted">
                    Your conversations with Fore!Mind will show up here.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {caddieLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-border bg-background px-4 py-3"
                      >
                        <p className="text-xs text-muted">
                          {formatLogTimestamp(entry.timestamp)}
                          {entry.course ? ` · ${entry.course}` : ""}
                          {entry.hole ? ` · Hole ${entry.hole}` : ""}
                        </p>
                        <p className="mt-1.5 text-sm text-foreground">{entry.message}</p>
                        <p className="mt-1.5 text-sm text-sage">{entry.response}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="relative mt-5">
                  <input
                    type="text"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="I can't stop thinking about my last hole…"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted focus:border-forest focus:outline-none"
                  />
                  {supported && (
                    <button
                      type="button"
                      onClick={isListening ? stop : start}
                      aria-pressed={isListening}
                      title={isListening ? "Stop listening" : "Speak to your caddie"}
                      className={`absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border transition-colors ${
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
                  <p className="mt-1.5 text-xs text-sage">
                    Listening… tap the mic to stop.
                  </p>
                )}
                {!supported && (
                  <p className="mt-1.5 text-xs text-muted">
                    Voice input isn&apos;t supported in this browser — you can type
                    instead.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={isLoading || !message.trim()}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-60 disabled:hover:bg-forest"
                >
                  {isLoading ? "Asking…" : "Ask My Caddie"}
                </button>

                {response && (
                  <p className="motion-fade mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                    {response}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
