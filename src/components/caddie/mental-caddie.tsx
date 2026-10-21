"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MicIcon } from "@/components/icons/mic-icon";
import { HistoryIcon } from "@/components/icons/history-icon";
import { useSpeechRecognition, type SpeechEndInfo } from "@/lib/speech/use-speech-recognition";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatDateTime } from "@/lib/i18n/format";
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
  withoutSamples,
  toCaddieHistoryPayload,
  type CaddieHistoryRound,
} from "@/lib/mental-game/completed-rounds";
import {
  buildCourseHistories,
  findCourseHistory,
  toCaddieCourseHistory,
  type CaddieCourseHistory,
} from "@/lib/mental-game/course-history";


const MAX_HISTORY_ROUNDS = 5;

type HandsFreePhase = "idle" | "listening" | "thinking" | "speaking";


type AskResult = { ok: boolean; text: string };

function subscribeToNothing() {
  return () => {};
}

function getServerFalse() {
  return false;
}

/** Client-side limit for a Caddie call (the server also caps its own Gemini time). */
const CADDIE_TIMEOUT_MS = 15_000;
/** Matches the server's message limit. */
const MAX_MESSAGE_CHARS = 1000;

export function MentalCaddie() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // The last typed question that failed, so "Try again" can resend it.
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [view, setView] = useState<"ask" | "history">("ask");

  // One app-wide language drives the UI, speech recognition, read-aloud and replies.
  const { lang, t, info } = useI18n();
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
    { lang: info.locale },
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
      lang: info.locale,
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

    // Sample rounds are example data — never sent to the Caddie as real history.
    const allCompletedRounds = withoutSamples(loadCompletedRounds());

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
    setFailedQuestion(null);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CADDIE_TIMEOUT_MS);
    const fail = (errorText: string): AskResult => {
      setResponse(errorText);
      if (mode === "text") setFailedQuestion(text);
      return { ok: false, text: errorText };
    };

    try {
      const res = await fetch("/api/caddie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context,
          history,
          courseHistory,
          language: lang,
          mode,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || typeof data.response !== "string") {
        return fail(
          res.status === 429
            ? t.caddie.rateLimited
            : res.status === 503
              ? t.caddie.busy
              : t.caddie.unavailable,
        );
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
      if (timedOut) return fail(t.caddie.timeout);
      // Aborted (Stop / panel closed) — stay quiet.
      if (controller.signal.aborted) return { ok: false, text: "" };
      return fail(t.caddie.unavailable);
    } finally {
      clearTimeout(timer);
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

  async function handleHandsFreeHeard(endInfo: SpeechEndInfo) {
    const run = activeRunRef.current;
    if (!run) return;
    const isStillRunning = () => activeRunRef.current === run;

    const text = heardRef.current.trim();
    if (!text) {
      if (followUpUsedRef.current) {
        endHandsFree(
          endInfo.errorCode && endInfo.errorCode !== "no-speech"
            ? t.caddie.noteTapForFollowUp
            : t.caddie.noteNoFollowUp,
        );
      } else {
        endHandsFree(
          endInfo.errorCode && endInfo.errorCode !== "no-speech"
            ? (t.voice.errors[endInfo.errorCode] ?? t.voice.errors.other)
            : t.caddie.noteDidntHear,
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
    const spoken = await speak(reply.text, info.locale);
    if (!isStillRunning()) return;
    if (spoken === "unsupported") {
      setHandsFreeNote(t.caddie.noteNoReadAloud);
    } else if (spoken === "no-voice") {
      setHandsFreeNote(t.caddie.noteNoVoice(info.label));
    } else if (spoken === "error") {
      setHandsFreeNote(t.caddie.noteReadError);
    }

    if (!followUpUsedRef.current) {
      followUpUsedRef.current = true;
      setIsFollowUp(true);
      listenHandsFree();
    } else {
      endHandsFree(t.caddie.noteOff);
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
                  {t.caddie.title}
                </h2>
                <p className="mt-1 text-sm text-muted">{t.caddie.subtitle}</p>
                {history.length > 0 && (
                  <p className="motion-fade mt-1 flex items-center gap-1 text-xs text-sage">
                    <HistoryIcon className="h-3.5 w-3.5" />
                    {t.caddie.remembering(history.length)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView((current) => (current === "ask" ? "history" : "ask"))}
                  aria-pressed={view === "history"}
                  title={view === "history" ? t.caddie.backToAsk : t.caddie.history}
                  aria-label={view === "history" ? t.caddie.backToAsk : t.caddie.history}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-sage-soft hover:text-foreground"
                >
                  <HistoryIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={closeCaddie}
                  aria-label={t.common.close}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-sage-soft hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>

            {view === "history" ? (
              <div className="motion-fade mt-5">
                {caddieLog.length === 0 ? (
                  <p className="text-sm text-muted">
                    {t.caddie.historyEmpty}
                  </p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {caddieLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-border bg-background px-4 py-3"
                      >
                        <p className="text-xs text-muted">
                          {formatDateTime(entry.timestamp, lang, t.common.unknownDate)}
                          {entry.course ? ` · ${entry.course}` : ""}
                          {entry.hole ? ` · ${t.common.hole(entry.hole)}` : ""}
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
                        {t.caddie.phases[handsFreePhase as Exclude<HandsFreePhase, "idle">]}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {handsFreePhase === "listening"
                          ? isFollowUp
                            ? t.caddie.hintFollowUp
                            : t.caddie.hintListening
                          : handsFreePhase === "thinking"
                            ? t.caddie.hintThinking
                            : t.caddie.hintSpeaking}
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
                      {t.common.stop}
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
                      {t.caddie.handsFree}
                    </button>
                    {!handsFreeMic.supported ? (
                      <p className="mt-1.5 text-xs text-muted">
                        {t.caddie.handsFreeUnsupported}
                      </p>
                    ) : !ttsSupported ? (
                      <p className="mt-1.5 text-xs text-muted">
                        {t.caddie.ttsUnsupported}
                      </p>
                    ) : null}
                    <p className="mt-4 text-center text-xs text-muted">{t.caddie.orType}</p>

                    <div className="relative mt-2">
                      <textarea
                        value={message}
                        rows={2}
                        maxLength={MAX_MESSAGE_CHARS}
                        aria-label={t.caddie.placeholder}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                          // Enter sends; Shift+Enter adds a line. Never send mid-IME composition (e.g. Chinese input).
                          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void handleAsk();
                          }
                        }}
                        placeholder={t.caddie.placeholder}
                        className="block w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 pr-16 text-base text-foreground placeholder:text-muted focus:border-forest focus:outline-none sm:text-sm"
                      />
                      {dictation.supported && (
                        <button
                          type="button"
                          onClick={dictation.isListening ? dictation.stop : () => dictation.start()}
                          aria-pressed={dictation.isListening}
                          title={dictation.isListening ? t.voice.stopListening : t.caddie.speakToCaddie}
                          aria-label={dictation.isListening ? t.voice.stopListening : t.caddie.speakToCaddie}
                          className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border transition-colors ${
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

                    <p className="mt-1.5 hidden text-[11px] text-muted sm:block">{t.caddie.enterHint}</p>
                    {dictation.supported && dictation.isListening && (
                      <p className="mt-1.5 text-xs text-sage">{t.voice.listening}</p>
                    )}
                    {dictation.errorCode && (
                      <p className="mt-1.5 text-xs text-muted">
                        {t.voice.errors[dictation.errorCode] ?? t.voice.errors.other}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleAsk}
                      disabled={isLoading || !message.trim()}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-60 disabled:hover:bg-forest"
                    >
                      {isLoading ? t.caddie.asking : t.caddie.ask}
                    </button>
                  </>
                )}

                {handsFreeNote && (
                  <p className="motion-fade mt-3 text-xs text-muted">{handsFreeNote}</p>
                )}

                {response && (
                  <div className="motion-fade mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                    <p className="whitespace-pre-line">{response}</p>
                    {failedQuestion && !isLoading && (
                      <button
                        type="button"
                        onClick={() => void askCaddie(failedQuestion, "text")}
                        className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-xs font-semibold text-foreground transition-colors hover:border-forest"
                      >
                        {t.caddie.tryAgain}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
