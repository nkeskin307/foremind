"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { MicIcon } from "@/components/icons/mic-icon";
import { TargetIcon } from "@/components/icons/target-icon";
import { EnergyIcon } from "@/components/icons/energy-icon";
import { ShieldIcon } from "@/components/icons/shield-icon";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";
import type { CheckInField, CheckInRatings } from "@/lib/prepare/generate-routine";
import { useCaddieContext } from "@/lib/caddie/caddie-context";
import { checkInToQueryString, type CheckInQueryData } from "@/lib/prepare/check-in-params";
import {
  clearCheckInDraft,
  getCheckInDraftSnapshot,
  parseCheckInDraftSnapshot,
  saveCheckInDraft,
  type CheckInDraft,
} from "@/lib/prepare/check-in-draft-storage";
import {
  getLatestCheckInSnapshot,
  parseLatestCheckInSnapshot,
  saveLatestCheckIn,
} from "@/lib/prepare/latest-check-in-storage";

const RATING_FIELDS: {
  key: CheckInField;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { key: "focus", label: "Focus", Icon: TargetIcon },
  { key: "energy", label: "Energy", Icon: EnergyIcon },
  { key: "confidence", label: "Confidence", Icon: ShieldIcon },
];

const SCALE = [1, 2, 3, 4, 5];

function subscribeToNothing() {
  return () => {};
}

function getServerEmptySnapshot() {
  return "";
}

export function PreRoundCheckIn({
  initialCheckIn,
}: {
  initialCheckIn: CheckInQueryData;
}) {
  const router = useRouter();

  // localStorage is read through useSyncExternalStore so the server render
  // and the first client (hydration) render both see "" — the saved values
  // appear right after mount, with no hydration mismatch.
  const rawDraft = useSyncExternalStore(
    subscribeToNothing,
    getCheckInDraftSnapshot,
    getServerEmptySnapshot,
  );
  const rawLatestCheckIn = useSyncExternalStore(
    subscribeToNothing,
    getLatestCheckInSnapshot,
    getServerEmptySnapshot,
  );

  // Priority: an in-progress draft, then a submitted check-in that hasn't
  // started a round yet (what makes Back from /routine show the same
  // answers now that the draft is cleared on submit), then the URL.
  const savedValues = useMemo<CheckInDraft>(() => {
    const draft = parseCheckInDraftSnapshot(rawDraft);
    const latest = parseLatestCheckInSnapshot(rawLatestCheckIn);
    const source = draft ?? (latest && !latest.handled ? latest : null);
    return {
      focus: source?.focus ?? initialCheckIn.focus,
      energy: source?.energy ?? initialCheckIn.energy,
      confidence: source?.confidence ?? initialCheckIn.confidence,
      note: source?.note ?? initialCheckIn.note,
    };
  }, [rawDraft, rawLatestCheckIn, initialCheckIn]);

  // null until the golfer changes something; until then the saved values show.
  const [edits, setEdits] = useState<CheckInDraft | null>(null);
  const current = edits ?? savedValues;
  const notes = current.note;
  const ratings = useMemo<CheckInRatings>(
    () => ({ focus: current.focus, energy: current.energy, confidence: current.confidence }),
    [current],
  );

  const setNotes = useCallback(
    (note: string) => setEdits((prev) => ({ ...(prev ?? savedValues), note })),
    [savedValues],
  );

  const handleTranscript = useCallback(
    (transcript: string) => {
      setEdits((prev) => {
        const base = prev ?? savedValues;
        return { ...base, note: base.note ? `${base.note} ${transcript}` : transcript };
      });
    },
    [savedValues],
  );

  const { supported, isListening, error, start, stop } =
    useSpeechRecognition(handleTranscript);

  const { setPreRoundContext } = useCaddieContext();

  useEffect(() => {
    setPreRoundContext({
      focus: ratings.focus,
      energy: ratings.energy,
      confidence: ratings.confidence,
      note: notes,
    });
  }, [ratings, notes, setPreRoundContext]);

  useEffect(() => {
    return () => setPreRoundContext(null);
  }, [setPreRoundContext]);

  // Only persist once the golfer has actually changed something, so simply
  // opening the page never overwrites a saved draft.
  useEffect(() => {
    if (edits) saveCheckInDraft(edits);
  }, [edits]);

  function setRating(field: CheckInField, value: number) {
    setEdits((prev) => ({ ...(prev ?? savedValues), [field]: value }));
  }

  const isValid =
    ratings.focus !== null &&
    ratings.energy !== null &&
    ratings.confidence !== null &&
    notes.trim().length > 0;

  function handleBuildRoutine() {
    if (!isValid) return;

    const submitted = {
      focus: ratings.focus,
      energy: ratings.energy,
      confidence: ratings.confidence,
      note: notes.trim(),
    };
    const query = checkInToQueryString(submitted);

    // The submitted check-in becomes the "latest" one (used by /play and
    // Restart Round); the draft is done and is cleared.
    saveLatestCheckIn(submitted);
    clearCheckInDraft();

    router.push(`/routine?${query}`);
  }

  return (
    <div className="relative overflow-hidden">
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[420px] w-auto opacity-[0.36]"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[320px] w-auto -scale-x-100 opacity-[0.3]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 py-16">
      <h1 className="motion-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Before you tee off
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        Take a minute to check in with yourself.
      </p>

      <div className="mt-8 space-y-5">
        {RATING_FIELDS.map(({ key, label, Icon }) => (
          <div key={key}>
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Icon className="h-3.5 w-3.5 text-sage" />
              {label}
            </span>
            <div className="mt-2 flex gap-2">
              {SCALE.map((value) => {
                const isSelected = ratings[key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setRating(key, value)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-forest bg-forest text-foreground"
                        : "border-border bg-surface text-muted hover:border-forest"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <label
          htmlFor="pre-round-notes"
          className="text-sm font-medium text-foreground"
        >
          What&apos;s on your mind before today&apos;s round?
        </label>

        <div className="relative mt-2">
          <textarea
            id="pre-round-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="I want to stay present, trust my game, and not let one bad shot affect the next…"
            rows={4}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted focus:border-forest focus:outline-none"
          />

          {supported && (
            <button
              type="button"
              onClick={isListening ? stop : start}
              aria-pressed={isListening}
              title={isListening ? "Stop listening" : "Speak your thoughts"}
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

      <button
        type="button"
        onClick={handleBuildRoutine}
        disabled={!isValid}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-40 disabled:hover:bg-forest"
      >
        Build My Pre-Game Routine
      </button>
      </div>
      </div>
    </div>
  );
}
