"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_PAR,
  PAR_OPTIONS,
  formatToPar,
  summarizeScores,
  type HoleScore,
  type PreRoundCheckIn,
  type RoundData,
} from "@/lib/play/round-data";
import { FlagIcon } from "@/components/icons/flag-icon";
import { useCaddieContext, type CaddieRoundMoment } from "@/lib/caddie/caddie-context";
import {
  createActiveRoundId,
  saveActiveRound,
  clearActiveRound,
  type ActiveRoundRecord,
} from "@/lib/play/active-round-storage";
import { createCompletedRound } from "@/lib/mental-game/completed-rounds";

const MIN_SCORE = 1;
const MAX_SCORE = 12;

const MENTAL_STATES = [
  "Confident",
  "Focused",
  "Calm",
  "Frustrated",
  "Rushed",
  "Overthinking",
] as const;

type MentalState = (typeof MENTAL_STATES)[number];

const RESET_MESSAGES: Record<MentalState, string> = {
  Confident:
    "Trust what's working. Stay committed to your routine and don't force anything.",
  Focused: "Stay with the process. Keep your attention on the shot in front of you.",
  Calm: "Keep this tempo. Let the round come to you.",
  Frustrated:
    "Leave the last shot where it happened. Your only job now is the next target.",
  Rushed:
    "Slow your routine down. Your group's pace does not have to become your swing tempo.",
  Overthinking:
    "Stop adding swing thoughts. Pick one target, trust your game, and commit.",
};

export function ActiveRound({
  courseName,
  totalHoles,
  preRound,
  initialActiveRound,
}: {
  courseName: string;
  totalHoles: number;
  preRound: PreRoundCheckIn;
  initialActiveRound: ActiveRoundRecord | null;
}) {
  const router = useRouter();
  const [roundId] = useState(() => initialActiveRound?.id ?? createActiveRoundId());
  const [roundDate] = useState(() => initialActiveRound?.date ?? new Date().toISOString());
  // Scores start empty (null) so unplayed holes never count toward totals.
  const [scores, setScores] = useState<HoleScore[]>(
    () => initialActiveRound?.scores ?? Array(totalHoles).fill(null),
  );
  const [pars, setPars] = useState<number[]>(
    () => initialActiveRound?.pars ?? Array(totalHoles).fill(DEFAULT_PAR),
  );
  const [mentalNotes, setMentalNotes] = useState<(MentalState | null)[]>(
    () => (initialActiveRound?.mentalNotes as (MentalState | null)[] | undefined) ??
      Array(totalHoles).fill(null),
  );
  const [currentHole, setCurrentHole] = useState(() => initialActiveRound?.currentHole ?? 0);
  const [showMentalCheck, setShowMentalCheck] = useState(false);
  const [pendingMentalState, setPendingMentalState] = useState<MentalState | null>(
    null,
  );
  const [showUnscoredWarning, setShowUnscoredWarning] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  // Synchronous guard: state updates aren't visible until the next render,
  // so a fast double tap could otherwise run handleFinishRound twice.
  const finishingRef = useRef(false);

  const summary = summarizeScores(scores, pars);
  const { total, totalPar, toPar, holesScored, unscoredHoles } = summary;
  const currentScore = scores[currentHole];
  const currentPar = pars[currentHole];
  const currentMentalNote = mentalNotes[currentHole];
  const isLastHole = currentHole === totalHoles - 1;

  const roundMoments: CaddieRoundMoment[] = useMemo(
    () =>
      mentalNotes.flatMap((state, index) =>
        state
          ? [{ hole: index + 1, holeScore: scores[index], par: pars[index], mentalState: state }]
          : [],
      ),
    [mentalNotes, scores, pars],
  );

  const { setPreRoundContext, setRoundContext } = useCaddieContext();

  useEffect(() => {
    setPreRoundContext(preRound);
  }, [preRound, setPreRoundContext]);

  useEffect(() => {
    setRoundContext({
      course: courseName,
      holes: totalHoles,
      currentHole: currentHole + 1,
      currentHolePar: currentPar,
      totalScore: total,
      totalPar,
      holesScored,
      currentHoleScore: currentScore,
      currentHoleMentalState: currentMentalNote,
      moments: roundMoments,
    });
  }, [
    courseName,
    totalHoles,
    currentHole,
    currentPar,
    total,
    totalPar,
    holesScored,
    currentScore,
    currentMentalNote,
    roundMoments,
    setRoundContext,
  ]);

  useEffect(() => {
    return () => {
      setPreRoundContext(null);
      setRoundContext(null);
    };
  }, [setPreRoundContext, setRoundContext]);

  // Autosave the active round to localStorage on every relevant change, so
  // it survives a page refresh while the golfer is still playing.
  useEffect(() => {
    // Once Finish Round has run, the round lives in completed history —
    // never write it back as an active round.
    if (finishingRef.current) return;
    saveActiveRound({
      id: roundId,
      course: courseName,
      date: roundDate,
      holes: totalHoles,
      currentHole,
      scores,
      pars,
      mentalNotes,
      preRound,
    });
  }, [
    roundId,
    courseName,
    roundDate,
    totalHoles,
    currentHole,
    scores,
    pars,
    mentalNotes,
    preRound,
  ]);

  // The first tap on an unscored hole starts it at par; after that, +/−
  // adjust by one stroke.
  function adjustScore(delta: number) {
    setScores((prev) => {
      const next = [...prev];
      const existing = next[currentHole];
      next[currentHole] =
        existing === null
          ? pars[currentHole]
          : Math.min(MAX_SCORE, Math.max(MIN_SCORE, existing + delta));
      return next;
    });
  }

  function clearScore() {
    setScores((prev) => {
      const next = [...prev];
      next[currentHole] = null;
      return next;
    });
  }

  function setPar(par: number) {
    setPars((prev) => {
      const next = [...prev];
      next[currentHole] = par;
      return next;
    });
  }

  function closeMentalCheck() {
    setShowMentalCheck(false);
    setPendingMentalState(null);
  }

  // Save the mental state the moment it's tapped, so closing the picker any
  // way (backdrop, Back to My Round) never loses it.
  function handleSelectMentalState(state: MentalState) {
    setMentalNotes((prev) => {
      const next = [...prev];
      next[currentHole] = state;
      return next;
    });
    setPendingMentalState(state);
  }

  function handleBackToRound() {
    closeMentalCheck();
  }

  function handleFinishClick() {
    if (finishingRef.current) return;
    if (unscoredHoles.length > 0) {
      setShowUnscoredWarning(true);
      return;
    }
    handleFinishRound();
  }

  function handleKeepScoring() {
    setShowUnscoredWarning(false);
    if (unscoredHoles.length > 0) setCurrentHole(unscoredHoles[0] - 1);
  }

  function handleFinishRound() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    setShowUnscoredWarning(false);

    const roundData: RoundData = {
      course: courseName,
      holes: totalHoles,
      scores,
      pars,
      mentalNotes,
      total,
      preRound,
      date: new Date().toISOString(),
    };
    createCompletedRound(roundId, roundData);
    clearActiveRound();
    const params = new URLSearchParams();
    params.set("data", JSON.stringify(roundData));
    params.set("id", roundId);
    router.push(`/reflection?${params.toString()}`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          {courseName && (
            <p className="motion-heading text-sm font-medium text-sage">{courseName}</p>
          )}
          <h1 className="motion-heading mt-1 flex items-center gap-2.5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            <FlagIcon className="h-6 w-6 shrink-0 text-sage" />
            Hole {currentHole + 1} of {totalHoles}
          </h1>
        </div>
        <div className="motion-body mt-2 text-right text-xs text-muted">
          <p className="whitespace-nowrap">
            Total: {holesScored > 0 ? `${total} (${formatToPar(toPar)})` : "—"}
          </p>
          <p className="mt-0.5 whitespace-nowrap">
            {holesScored} of {totalHoles} scored
          </p>
        </div>
      </div>

      <div className="motion-body">
      <div className="mt-6 grid grid-cols-9 gap-1.5">
        {Array.from({ length: totalHoles }, (_, index) => {
          const isCurrent = index === currentHole;
          const holeScore = scores[index];
          const isScored = holeScore !== null;
          return (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentHole(index)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Go to hole ${index + 1}, ${
                isScored ? `scored ${holeScore}` : "not scored yet"
              }`}
              className={`flex aspect-square w-full items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-forest text-foreground"
                  : isScored
                    ? "bg-sage-soft text-foreground hover:bg-forest-light"
                    : "text-muted hover:bg-sage-soft hover:text-foreground"
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center text-xs text-muted">
        Shaded holes have a score.
      </p>

      <div className="mt-8">
        <p className="text-center text-sm font-medium text-foreground">Par</p>
        <div className="mt-2 flex justify-center gap-2">
          {PAR_OPTIONS.map((par) => {
            const isSelected = currentPar === par;
            return (
              <button
                key={par}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setPar(par)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-forest bg-forest text-foreground"
                    : "border-border bg-surface text-muted hover:border-forest"
                }`}
              >
                {par}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-center text-sm font-medium text-foreground">Score</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => adjustScore(-1)}
            disabled={currentScore !== null && currentScore <= MIN_SCORE}
            aria-label="Decrease score"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
          >
            −
          </button>
          <span
            className={`w-10 text-center text-3xl font-bold ${
              currentScore === null ? "text-muted" : "text-foreground"
            }`}
          >
            {currentScore ?? "—"}
          </span>
          <button
            type="button"
            onClick={() => adjustScore(1)}
            disabled={currentScore !== null && currentScore >= MAX_SCORE}
            aria-label="Increase score"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
          >
            +
          </button>
        </div>
        {currentScore === null ? (
          <p className="mt-2 text-center text-xs text-muted">
            Not scored yet — tap + or − to start at par.
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-muted">
            {formatToPar(currentScore - currentPar)} on this hole ·{" "}
            <button
              type="button"
              onClick={clearScore}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowMentalCheck(true)}
          className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground"
        >
          How am I feeling?
        </button>

        {currentMentalNote && (
          <p className="mt-2 text-xs text-sage">
            Mental note: {currentMentalNote}
          </p>
        )}
      </div>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => setCurrentHole((hole) => Math.max(0, hole - 1))}
          disabled={currentHole === 0}
          className="flex-1 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
        >
          Previous
        </button>
        {isLastHole ? (
          <button
            type="button"
            onClick={handleFinishClick}
            disabled={isFinishing}
            className="flex-1 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-60 disabled:hover:bg-forest"
          >
            {isFinishing ? "Saving…" : "Finish Round →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentHole((hole) => Math.min(totalHoles - 1, hole + 1))}
            className="flex-1 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
          >
            Next Hole →
          </button>
        )}
      </div>
      </div>

      {showUnscoredWarning && (
        <div
          className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setShowUnscoredWarning(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unscored-warning-heading"
            onClick={(event) => event.stopPropagation()}
            className="motion-modal w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
          >
            <h2
              id="unscored-warning-heading"
              className="text-base font-semibold text-foreground"
            >
              {unscoredHoles.length === 1
                ? "1 hole has no score"
                : `${unscoredHoles.length} holes have no score`}
            </h2>
            <p className="mt-3 text-sm text-foreground">
              Hole{unscoredHoles.length === 1 ? "" : "s"} {unscoredHoles.join(", ")}{" "}
              {unscoredHoles.length === 1 ? "isn't" : "aren't"} scored. Unscored holes
              won&apos;t count toward your total or analysis.
            </p>
            <button
              type="button"
              onClick={handleKeepScoring}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              Keep Scoring
            </button>
            <button
              type="button"
              onClick={handleFinishRound}
              disabled={isFinishing}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-60"
            >
              {isFinishing ? "Saving…" : "Finish Anyway"}
            </button>
          </div>
        </div>
      )}

      {showMentalCheck && (
        <div
          className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={closeMentalCheck}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mental-check-heading"
            onClick={(event) => event.stopPropagation()}
            className="motion-modal w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
          >
            {pendingMentalState ? (
              <>
                <h2
                  id="mental-check-heading"
                  className="text-base font-semibold text-foreground"
                >
                  {pendingMentalState}
                </h2>
                <p className="mt-3 text-sm text-foreground">
                  {RESET_MESSAGES[pendingMentalState]}
                </p>
                <button
                  type="button"
                  onClick={handleBackToRound}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
                >
                  Back to My Round
                </button>
              </>
            ) : (
              <>
                <h2
                  id="mental-check-heading"
                  className="text-base font-semibold text-foreground"
                >
                  What&apos;s affecting you right now?
                </h2>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {MENTAL_STATES.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => handleSelectMentalState(state)}
                      className="rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-forest"
                    >
                      {state}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={closeMentalCheck}
                  className="mt-4 w-full text-center text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
