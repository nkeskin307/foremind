"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PreRoundCheckIn, RoundData } from "@/lib/play/round-data";
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
const DEFAULT_SCORE = 4;

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
  const [scores, setScores] = useState<number[]>(
    () => initialActiveRound?.scores ?? Array(totalHoles).fill(DEFAULT_SCORE),
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

  const total = scores.reduce((sum, score) => sum + score, 0);
  const currentScore = scores[currentHole];
  const currentMentalNote = mentalNotes[currentHole];
  const isLastHole = currentHole === totalHoles - 1;

  const roundMoments: CaddieRoundMoment[] = useMemo(
    () =>
      mentalNotes.flatMap((state, index) =>
        state ? [{ hole: index + 1, holeScore: scores[index], mentalState: state }] : [],
      ),
    [mentalNotes, scores],
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
      totalScore: total,
      currentHoleScore: currentScore,
      currentHoleMentalState: currentMentalNote,
      moments: roundMoments,
    });
  }, [
    courseName,
    totalHoles,
    currentHole,
    total,
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
    saveActiveRound({
      id: roundId,
      course: courseName,
      date: roundDate,
      holes: totalHoles,
      currentHole,
      scores,
      mentalNotes,
      preRound,
    });
  }, [roundId, courseName, roundDate, totalHoles, currentHole, scores, mentalNotes, preRound]);

  function adjustScore(delta: number) {
    setScores((prev) => {
      const next = [...prev];
      next[currentHole] = Math.min(
        MAX_SCORE,
        Math.max(MIN_SCORE, next[currentHole] + delta),
      );
      return next;
    });
  }

  function closeMentalCheck() {
    setShowMentalCheck(false);
    setPendingMentalState(null);
  }

  function handleBackToRound() {
    if (pendingMentalState) {
      setMentalNotes((prev) => {
        const next = [...prev];
        next[currentHole] = pendingMentalState;
        return next;
      });
    }
    closeMentalCheck();
  }

  function handleFinishRound() {
    const roundData: RoundData = {
      course: courseName,
      holes: totalHoles,
      scores,
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
        <p className="motion-body mt-2 whitespace-nowrap text-xs text-muted">
          Total: {total}
        </p>
      </div>

      <div className="motion-body">
      <div className="mt-6 grid grid-cols-9 gap-1.5">
        {Array.from({ length: totalHoles }, (_, index) => {
          const isCurrent = index === currentHole;
          return (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentHole(index)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Go to hole ${index + 1}`}
              className={`flex aspect-square w-full items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-forest text-foreground"
                  : "text-muted hover:bg-sage-soft hover:text-foreground"
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        <p className="text-center text-sm font-medium text-foreground">Score</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => adjustScore(-1)}
            disabled={currentScore <= MIN_SCORE}
            aria-label="Decrease score"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
          >
            −
          </button>
          <span className="w-10 text-center text-3xl font-bold text-foreground">
            {currentScore}
          </span>
          <button
            type="button"
            onClick={() => adjustScore(1)}
            disabled={currentScore >= MAX_SCORE}
            aria-label="Increase score"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
          >
            +
          </button>
        </div>
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
            onClick={handleFinishRound}
            className="flex-1 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
          >
            Finish Round →
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
                      onClick={() => setPendingMentalState(state)}
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
