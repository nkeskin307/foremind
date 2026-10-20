"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MicIcon } from "@/components/icons/mic-icon";
import { HistoryIcon } from "@/components/icons/history-icon";
import {
  describeSpeechError,
  useSpeechRecognition,
  type SpeechEndInfo,
} from "@/lib/speech/use-speech-recognition";
import {
  CADDIE_LANGUAGES,
  findCaddieLanguage,
  getCaddieLanguageSnapshot,
  getServerCaddieLanguageSnapshot,
  setCaddieLanguage,
  subscribeToCaddieLanguage,
} from "@/lib/speech/caddie-language";
import {
  isSpeechSynthesisSupported,
  primeSpeechSynthesis,
  speak,
  stopSpeaking,
} from "@/lib/speech/speak";
import { useCaddieContext } from "@/lib/caddie/caddie-context";
import { appendCaddieLogEntry, loadCaddieLog } from "@/lib/caddie/caddie-log-storage";
import { loadActiveRound } from "@/lib/play/active-round-storage";
import {
  loadCompletedRounds,
  toCaddieHistoryPayload,
  type CaddieHistoryRound,
  type CompletedRound,
} from "@/lib/mental-game/completed-rounds";
import {
  buildCourseHistories,
  findCourseHistory,
  toCaddieCourseHistory,
  type CaddieCourseHistory,
} from "@/lib/mental-game/course-history";

const FALLBACK_ERROR_MESSAGE =
  "The Mental Caddie couldn't respond right now. Please try again in a moment.";

const MAX_HISTORY_ROUNDS = 5;

type HandsFreePhase = "idle" | "listening" | "thinking" | "speaking";

const PHASE_LABELS: Record<Exclude<HandsFreePhase, "idle">, string> = {
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

type AskResult = { ok: boolean; text: string };

function subscribeToNothing() {
  return () => {};
}

function getServerFalse() {
  return false;
}

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

  const languageCode = useSyncExternalStore(
    subscribeToCaddieLanguage,
    getCaddieLanguageSnapshot,
    getServerCaddieLanguageSnapshot,
  );
  const language = findCaddieLanguage(languageCode) ?? CADDIE_LANGUAGES[0];
  const ttsSupported = useSyncExternalStore(
    subscribeToNothing,
    isSpeechSynthesisSupported,
    getServerFalse,
  );

  // Text-box dictation (mic inside the input).
  const dictation = useSpeechRecognition(
    (transcript) => {
      setMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
    },
    { lang: language.code },
  );

  // Hands-Free: one utterance per turn, sent when the golfer stops talking.
  const [handsFreePhase, setHandsFreePhase] = useState<HandsFreePhase>("idle");
  const [handsFreeNote, setHandsFreeNote] = useState<string | null>(null);
  const [heardText, setHeardText] = useState("");
  const [isFollowUp, setIsFollowUp] = useState(false);
  const runIdRef = useRef(0);
  const activeRunRef = useRef(0);
  const followUpUsedRef = useRef(false);
  const heardRef = useRef("");
  const fetchAbortRef = useRef<AbortController | null>(null);

  const handsFreeMic = useSpeechRecognition(
    (transcript) => {
      heardRef.current = heardRef.current ? `${heardRef.current} ${transcript}` : transcript;
      setHeardText(heardRef.current);
    },
    {
      lang: language.code,
      continuous: false,
      onEnd: (info) => {
        void handleHandsFreeHeard(info);
      },
    },
  );

  const handsFreeActive = handsFreePhase !== "idle";

  const { context, isPanelOpen, closePanel } = useCaddieContext();

  // AppHeader's desktop pill and mobile icon button both call openPanel()
  // directly, so history is derived here from the panel being open rather
  // than loaded inside a single trigger's click handler.
  const roundCourse = context.round?.course ?? "";
  const { history, courseHistory } = useMemo<{
    history: CaddieHistoryRound[];
    courseHistory: CaddieCourseHistory | null;
  }>(() => {
    if (!isPanelOpen) return { history: [], courseHistory: null };

    const allCompletedRounds = loadCompletedRounds();
    logCaddieLocalStorageDebugInfo(allCompletedRounds);

    return {
      history: allCompletedRounds
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, MAX_HISTORY_ROUNDS)
        .map(toCaddieHistoryPayload),
      // Only during a round: past rounds at this course (or an explicit
      // "none yet" so the Caddie never invents course history).
      courseHistory: roundCourse.trim()
        ? toCaddieCourseHistory(
            roundCourse,
            findCourseHistory(buildCourseHistories(allCompletedRounds), roundCourse),
          )
        : null,
    };
  }, [isPanelOpen, roundCourse]);

  // Never keep talking after this component goes away.
  useEffect(() => () => stopSpeaking(), []);

  // Not memoized: read fresh every render the History tab is showing, so it
  // always includes entries logged earlier in the same panel session (e.g.
  // a question just asked) rather than a stale snapshot from panel-open.
  const caddieLog = isPanelOpen && view === "history" ? loadCaddieLog() : [];

  async function askCaddie(text: string, mode: "text" | "hands-free"): Promise<AskResult> {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/caddie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context,
          history,
          courseHistory,
          language: language.code,
          mode,
        }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || typeof data.response !== "string") {
        const errorText = typeof data.error === "string" ? data.error : FALLBACK_ERROR_MESSAGE;
        setResponse(errorText);
        return { ok: false, text: errorText };
      }

      setResponse(data.response);
      const activeRound = loadActiveRound();
      appendCaddieLogEntry(text, data.response, {
        roundId: activeRound?.id,
        course: activeRound?.course,
        hole: activeRound ? activeRound.currentHole + 1 : undefined,
      });
      return { ok: true, text: data.response };
    } catch {
      // Aborted (Stop / panel closed) — stay quiet.
      if (controller.signal.aborted) return { ok: false, text: "" };
      setResponse(FALLBACK_ERROR_MESSAGE);
      return { ok: false, text: FALLBACK_ERROR_MESSAGE };
    } finally {
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
        setIsLoading(false);
      }
    }
  }

  function listenHandsFree() {
    heardRef.current = "";
    setHeardText("");
    setHandsFreePhase("listening");
    handsFreeMic.start(); // a failed start reports back through onEnd
  }

  function endHandsFree(note: string | null) {
    activeRunRef.current = 0;
    setHandsFreePhase("idle");
    setIsFollowUp(false);
    setHandsFreeNote(note);
  }

  function startHandsFree() {
    dictation.abort();
    stopSpeaking();
    // Must run inside the tap so iOS Safari lets us speak the reply later.
    primeSpeechSynthesis();
    runIdRef.current += 1;
    activeRunRef.current = runIdRef.current;
    followUpUsedRef.current = false;
    setIsFollowUp(false);
    setResponse(null);
    setHandsFreeNote(null);
    listenHandsFree();
  }

  function stopHandsFree() {
    activeRunRef.current = 0;
    handsFreeMic.abort();
    stopSpeaking();
    fetchAbortRef.current?.abort();
    setHandsFreePhase("idle");
    setIsFollowUp(false);
  }

  async function handleHandsFreeHeard(info: SpeechEndInfo) {
    const run = activeRunRef.current;
    if (!run) return;
    const isStillRunning = () => activeRunRef.current === run;

    const text = heardRef.current.trim();
    if (!text) {
      if (followUpUsedRef.current) {
        endHandsFree(
          info.errorCode && info.errorCode !== "no-speech"
            ? "Tap Hands-Free to ask a follow-up."
            : "No follow-up heard — Hands-Free is off.",
        );
      } else {
        endHandsFree(
          info.errorCode && info.errorCode !== "no-speech"
            ? describeSpeechError(info.errorCode)
            : "I didn't hear anything. Tap Hands-Free to try again.",
        );
      }
      return;
    }

    setHandsFreePhase("thinking");
    const reply = await askCaddie(text, "hands-free");
    if (!isStillRunning()) return;
    if (!reply.ok) {
      endHandsFree(null);
      return;
    }

    setHandsFreePhase("speaking");
    const spoken = await speak(reply.text, language.code);
    if (!isStillRunning()) return;
    if (spoken === "unsupported") {
      setHandsFreeNote("This browser can't read replies aloud, so the reply is shown below.");
    } else if (spoken === "no-voice") {
      setHandsFreeNote(
        `No ${language.englishName} voice is installed on this device, so the reply is shown below.`,
      );
    } else if (spoken === "error") {
      setHandsFreeNote("Couldn't read the reply aloud, so it's shown below.");
    }

    if (!followUpUsedRef.current) {
      followUpUsedRef.current = true;
      setIsFollowUp(true);
      listenHandsFree();
    } else {
      endHandsFree("Hands-Free is off. Tap it again to ask more.");
    }
  }

  function closeCaddie() {
    // Stop every mic and voice; aborted sessions drop late results, so
    // nothing can refill the input after closing.
    dictation.abort();
    dictation.clearError();
    stopHandsFree();
    closePanel();
    setMessage("");
    setResponse(null);
    setIsLoading(false);
    setHandsFreeNote(null);
    setView("ask");
  }

  async function handleAsk() {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    dictation.stop();
    await askCaddie(trimmed, "text");
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
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  Voice language
                  <select
                    value={language.code}
                    onChange={(event) => setCaddieLanguage(event.target.value)}
                    disabled={handsFreeActive || dictation.isListening}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:border-forest focus:outline-none disabled:opacity-60"
                  >
                    {CADDIE_LANGUAGES.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                {handsFreeActive ? (
                  <>
                    <div
                      className="motion-fade mt-5 rounded-2xl border border-forest bg-sage-soft px-4 py-6 text-center"
                      aria-live="polite"
                    >
                      <p className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
                        {handsFreePhase === "listening" && (
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                        )}
                        {PHASE_LABELS[handsFreePhase as Exclude<HandsFreePhase, "idle">]}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {handsFreePhase === "listening"
                          ? isFollowUp
                            ? "Any follow-up? I'll send it when you stop talking."
                            : "Ask your question — I'll send it when you stop talking."
                          : handsFreePhase === "thinking"
                            ? "Your caddie is thinking."
                            : "Reading the reply aloud."}
                      </p>
                      {heardText && (
                        <p className="mt-3 text-sm text-foreground">&ldquo;{heardText}&rdquo;</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={stopHandsFree}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-border bg-background px-6 py-4 text-base font-semibold text-foreground transition-colors hover:border-forest"
                    >
                      Stop
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startHandsFree}
                      disabled={!handsFreeMic.supported || isLoading}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-6 py-4 text-base font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-40 disabled:hover:bg-forest"
                    >
                      <MicIcon className="h-5 w-5" />
                      Hands-Free
                    </button>
                    {!handsFreeMic.supported ? (
                      <p className="mt-1.5 text-xs text-muted">
                        Hands-Free needs voice input, which this browser doesn&apos;t support. Type
                        your question below instead.
                      </p>
                    ) : !ttsSupported ? (
                      <p className="mt-1.5 text-xs text-muted">
                        This browser can&apos;t read replies aloud — replies will appear as text.
                      </p>
                    ) : null}
                    <p className="mt-4 text-center text-xs text-muted">or type your question</p>

                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="I can't stop thinking about my last hole…"
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted focus:border-forest focus:outline-none"
                      />
                      {dictation.supported && (
                        <button
                          type="button"
                          onClick={dictation.isListening ? dictation.stop : () => dictation.start()}
                          aria-pressed={dictation.isListening}
                          title={dictation.isListening ? "Stop listening" : "Speak to your caddie"}
                          className={`absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border transition-colors ${
                            dictation.isListening
                              ? "border-forest bg-forest text-foreground"
                              : "border-border bg-surface text-muted hover:border-forest"
                          }`}
                        >
                          <MicIcon className="h-4 w-4" />
                          {dictation.isListening && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                          )}
                        </button>
                      )}
                    </div>

                    {dictation.supported && dictation.isListening && (
                      <p className="mt-1.5 text-xs text-sage">Listening… tap the mic to stop.</p>
                    )}
                    {dictation.error && (
                      <p className="mt-1.5 text-xs text-muted">{dictation.error}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleAsk}
                      disabled={isLoading || !message.trim()}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-60 disabled:hover:bg-forest"
                    >
                      {isLoading ? "Asking…" : "Ask My Caddie"}
                    </button>
                  </>
                )}

                {handsFreeNote && (
                  <p className="motion-fade mt-3 text-xs text-muted">{handsFreeNote}</p>
                )}

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
