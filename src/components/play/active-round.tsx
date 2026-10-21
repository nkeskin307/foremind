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
import { ModalPortal } from "@/components/layout/modal-portal";
import { useCaddieContext, type CaddieRoundMoment } from "@/lib/caddie/caddie-context";
import {
  createActiveRoundId,
  saveActiveRound,
  clearActiveRound,
  type ActiveRoundRecord,
} from "@/lib/play/active-round-storage";
import {
  createCompletedRound,
  loadCompletedRounds,
  withoutSamples,
} from "@/lib/mental-game/completed-rounds";
import type { Intervention } from "@/lib/play/interventions";
import {
  canIntervene,
  describeBlowUpPattern,
  detectTrigger,
  fallbackResetMessage,
  fetchResetMessage,
  withNextHoleResults,
} from "@/lib/play/proactive-caddie";
import { describeWhy } from "@/lib/play/reset-card-copy";
import { useI18n } from "@/lib/i18n/use-i18n";
import { getMessages, stateLabel } from "@/lib/i18n";
import { formatList } from "@/lib/i18n/format";
import { getLanguageSnapshot } from "@/lib/i18n/language-store";

// Score taps settle for this long before the Proactive Caddie checks the
// hole (so tapping + from par to +3 doesn't fire at +2 mid-tap). Moving to
// another hole checks immediately.
const SCORE_CHECK_DELAY_MS = 1500;

const MIN_SCORE = 1;
const MAX_SCORE = 12;

// Stored as stable English keys; only translated for display.
const MENTAL_STATES = [
  "Confident",
  "Focused",
  "Calm",
  "Frustrated",
  "Rushed",
  "Overthinking",
] as const;

type MentalState = (typeof MENTAL_STATES)[number];

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
  const [interventions, setInterventions] = useState<Intervention[]>(
    () => initialActiveRound?.interventions ?? [],
  );
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [proactiveOff, setProactiveOff] = useState(
    () => initialActiveRound?.proactiveCaddieOff ?? false,
  );
  // Read synchronously by the delayed score check.
  const proactiveOffRef = useRef(proactiveOff);
  const { lang, t } = useI18n();
  const cardLabels = t.resetCard;
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [showUnscoredWarning, setShowUnscoredWarning] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  // Synchronous guard: state updates aren't visible until the next render,
  // so a fast double tap could otherwise run handleFinishRound twice.
  const finishingRef = useRef(false);
  // Latest values for the delayed score check (read only in handlers/timers).
  const latestRef = useRef<{
    scores: HoleScore[];
    pars: number[];
    mentalNotes: (string | null)[];
    interventions: Intervention[];
  }>({ scores, pars, mentalNotes, interventions });
  const scoreCheckRef = useRef<{ hole: number; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  );


  useEffect(
    () => () => {
      if (scoreCheckRef.current) clearTimeout(scoreCheckRef.current.timer);
    },
    [],
  );

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

  const { setPreRoundContext, setRoundContext, openPanel } = useCaddieContext();

  useEffect(() => {
    setPreRoundContext(preRound);
  }, [preRound, setPreRoundContext]);

  // Latest round context, also sent with Proactive Caddie reset requests.
  const roundContextRef = useRef<unknown>(null);

  useEffect(() => {
    const roundContext = {
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
    };
    roundContextRef.current = roundContext;
    setRoundContext(roundContext);
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
    latestRef.current = { scores, pars, mentalNotes, interventions };
  });

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
      interventions: withNextHoleResults(interventions, scores, pars),
      proactiveCaddieOff: proactiveOff,
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
    interventions,
    proactiveOff,
  ]);

  // Proactive Caddie: simple in-browser rules decide whether to show a
  // reset card; the AI only writes the wording.
  function runTriggerCheck(
    holeIndex: number,
    change: "score" | "mental-state",
    overrides: { mentalNotes?: (string | null)[] } = {},
  ) {
    if (finishingRef.current || proactiveOffRef.current) return;
    const latest = latestRef.current;
    const hit = detectTrigger({
      scores: latest.scores,
      pars: latest.pars,
      mentalNotes: overrides.mentalNotes ?? latest.mentalNotes,
      preRoundConfidence: preRound.confidence,
      holeIndex,
      change,
    });
    if (!hit || !canIntervene(hit.hole, latest.interventions)) return;

    const id = createActiveRoundId();
    const intervention: Intervention = {
      id,
      hole: hit.hole,
      trigger: hit.trigger,
      reason: hit.reason,
      // Saved immediately so the round always has a message, even if the
      // AI is slow or the round is finished before it answers.
      message: fallbackResetMessage(hit, getMessages(getLanguageSnapshot())),
      source: "fallback",
      outcome: "ignored",
      createdAt: new Date().toISOString(),
      nextHole: null,
      nextHoleToPar: null,
      detail: hit.detail,
    };
    latestRef.current = { ...latest, interventions: [...latest.interventions, intervention] };
    setInterventions((prev) => [...prev, intervention]);
    setActiveCardId(id);
    setLoadingCardId(id);

    const pattern =
      hit.trigger === "blow-up" || hit.trigger === "rough-start"
        ? describeBlowUpPattern(withoutSamples(loadCompletedRounds()))
        : null;

    void fetchResetMessage({
      hit,
      pattern,
      language: getLanguageSnapshot(),
      context: { preRound, round: roundContextRef.current },
    }).then((message) => {
      setLoadingCardId((current) => (current === id ? null : current));
      if (!message) return;
      setInterventions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, message, source: "ai" } : item)),
      );
    });
  }

  function flushScoreCheck() {
    const pending = scoreCheckRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    scoreCheckRef.current = null;
    runTriggerCheck(pending.hole, "score");
  }

  function scheduleScoreCheck(holeIndex: number) {
    if (scoreCheckRef.current) {
      clearTimeout(scoreCheckRef.current.timer);
      if (scoreCheckRef.current.hole !== holeIndex) runTriggerCheck(scoreCheckRef.current.hole, "score");
    }
    scoreCheckRef.current = {
      hole: holeIndex,
      timer: setTimeout(() => {
        scoreCheckRef.current = null;
        runTriggerCheck(holeIndex, "score");
      }, SCORE_CHECK_DELAY_MS),
    };
  }

  function goToHole(index: number) {
    flushScoreCheck();
    setCurrentHole(Math.min(totalHoles - 1, Math.max(0, index)));
  }

  function hideCardIfOtherHoleScored() {
    const card = interventions.find((item) => item.id === activeCardId);
    if (card && card.hole !== currentHole + 1) setActiveCardId(null);
  }

  function handleCardDismiss(id: string) {
    setInterventions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, outcome: "dismissed" } : item)),
    );
    setActiveCardId(null);
  }

  function handleCardTalk(id: string) {
    setInterventions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, outcome: "opened" } : item)),
    );
    setActiveCardId(null);
    openPanel();
  }

  function handleStopInterruptions(id: string) {
    proactiveOffRef.current = true;
    setProactiveOff(true);
    if (scoreCheckRef.current) clearTimeout(scoreCheckRef.current.timer);
    scoreCheckRef.current = null;
    handleCardDismiss(id);
  }

  const activeCard = interventions.find((item) => item.id === activeCardId) ?? null;

  // The first tap on an unscored hole starts it at par; after that, +/−
  // adjust by one stroke.
  function adjustScore(delta: number) {
    // An unanswered card goes away once the golfer scores a different hole
    // (it stays "ignored").
    hideCardIfOtherHoleScored();
    scheduleScoreCheck(currentHole);
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
    if (scoreCheckRef.current?.hole === currentHole) {
      clearTimeout(scoreCheckRef.current.timer);
      scoreCheckRef.current = null;
    }
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
    const next = [...mentalNotes];
    next[currentHole] = state;
    setMentalNotes(next);
    setPendingMentalState(state);
    runTriggerCheck(currentHole, "mental-state", { mentalNotes: next });
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
    if (unscoredHoles.length > 0) goToHole(unscoredHoles[0] - 1);
  }

  function handleFinishRound() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (scoreCheckRef.current) clearTimeout(scoreCheckRef.current.timer);
    scoreCheckRef.current = null;
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
      interventions: withNextHoleResults(interventions, scores, pars),
    };
    createCompletedRound(roundId, roundData);
    clearActiveRound();
    const params = new URLSearchParams();
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
            {t.play.holeOf(currentHole + 1, totalHoles)}
          </h1>
        </div>
        <div className="motion-body mt-2 text-right text-xs text-muted">
          <p className="whitespace-nowrap">
            {t.play.total}: {holesScored > 0 ? `${total} (${formatToPar(toPar)})` : "—"}
          </p>
          <p className="mt-0.5 whitespace-nowrap">
            {t.play.scoredOf(holesScored, totalHoles)}
          </p>
        </div>
      </div>

      <div className="motion-body">
      <div className="mt-6 grid grid-cols-6 gap-2 sm:grid-cols-9 sm:gap-1.5">
        {Array.from({ length: totalHoles }, (_, index) => {
          const isCurrent = index === currentHole;
          const holeScore = scores[index];
          const isScored = holeScore !== null;
          return (
            <button
              key={index}
              type="button"
              onClick={() => goToHole(index)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={t.play.goToHole(index + 1, holeScore)}
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
        {t.play.shadedHint}
      </p>


      <div className="mt-8">
        <p className="text-center text-sm font-medium text-foreground">{t.play.par}</p>
        <div className="mt-2 flex justify-center gap-2">
          {PAR_OPTIONS.map((par) => {
            const isSelected = currentPar === par;
            return (
              <button
                key={par}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setPar(par)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
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
        <p className="text-center text-sm font-medium text-foreground">{t.play.score}</p>
        <div className="mt-3 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => adjustScore(-1)}
            disabled={currentScore !== null && currentScore <= MIN_SCORE}
            aria-label={t.play.decrease}
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
            aria-label={t.play.increase}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
          >
            +
          </button>
        </div>
        {currentScore === null ? (
          <p className="mt-2 text-center text-xs text-muted">
            {t.play.notScoredHint}
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-muted">
            {t.play.onThisHole(formatToPar(currentScore - currentPar))} ·{" "}
            <button
              type="button"
              onClick={clearScore}
              className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
            >
              {t.play.clear}
            </button>
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowMentalCheck(true)}
          className="min-h-11 inline-flex items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground"
        >
          {t.play.howFeeling}
        </button>

        {currentMentalNote && (
          <p className="mt-2 text-xs text-sage">
            {t.play.mentalNote(stateLabel(t, currentMentalNote))}
          </p>
        )}
      </div>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => goToHole(currentHole - 1)}
          disabled={currentHole === 0}
          className="flex-1 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-40 disabled:hover:border-border"
        >
          {t.play.previous}
        </button>
        {isLastHole ? (
          <button
            type="button"
            onClick={handleFinishClick}
            disabled={isFinishing}
            className="flex-1 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-60 disabled:hover:bg-forest"
          >
            {isFinishing ? t.play.saving : t.play.finish}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goToHole(currentHole + 1)}
            className="flex-1 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
          >
            {t.play.nextHole}
          </button>
        )}
      </div>
      </div>

      {activeCard && (
        <ModalPortal>
        <div
          className="motion-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 sm:items-center"
          onClick={() => setActiveCardId(null)}
        >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-card-title"
          onClick={(event) => event.stopPropagation()}
          className="motion-modal w-full max-w-sm rounded-2xl border border-forest bg-sage-soft px-5 py-5"
        >
          <p
            id="reset-card-title"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sage"
          >
            <FlagIcon className="h-3.5 w-3.5" />
            {cardLabels.title}
          </p>
          <p className="mt-1.5 text-xs text-muted">{describeWhy(activeCard, t)}</p>
          <p className="mt-2 text-sm text-foreground">
            {loadingCardId === activeCard.id ? (
              <span className="animate-pulse text-muted">{cardLabels.loading}</span>
            ) : (
              activeCard.message
            )}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleCardDismiss(activeCard.id)}
              className="min-h-11 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-forest"
            >
              {cardLabels.reset}
            </button>
            <button
              type="button"
              onClick={() => handleCardTalk(activeCard.id)}
              className="min-h-11 flex-1 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              {cardLabels.talk}
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleStopInterruptions(activeCard.id)}
            className="inline-flex min-h-11 items-center mt-3 w-full text-center text-xs text-muted underline underline-offset-2 hover:text-foreground"
          >
            {cardLabels.stop}
          </button>
        </div>
        </div>
        </ModalPortal>
      )}

      {showUnscoredWarning && (
        <ModalPortal>
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
              {t.play.unscoredTitle(unscoredHoles.length)}
            </h2>
            <p className="mt-3 text-sm text-foreground">
              {t.play.unscoredBody(formatList(unscoredHoles, lang), unscoredHoles.length)}
            </p>
            <button
              type="button"
              onClick={handleKeepScoring}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              {t.play.keepScoring}
            </button>
            <button
              type="button"
              onClick={handleFinishRound}
              disabled={isFinishing}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-60"
            >
              {isFinishing ? t.play.saving : t.play.finishAnyway}
            </button>
          </div>
        </div>
      </ModalPortal>
      )}

      {showMentalCheck && (
        <ModalPortal>
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
                  {stateLabel(t, pendingMentalState)}
                </h2>
                <p className="mt-3 text-sm text-foreground">
                  {t.play.resetMessages[pendingMentalState]}
                </p>
                <button
                  type="button"
                  onClick={handleBackToRound}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
                >
                  {t.play.backToRound}
                </button>
              </>
            ) : (
              <>
                <h2
                  id="mental-check-heading"
                  className="text-base font-semibold text-foreground"
                >
                  {t.play.mentalCheckTitle}
                </h2>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {MENTAL_STATES.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => handleSelectMentalState(state)}
                      className="min-h-11 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-forest"
                    >
                      {stateLabel(t, state)}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={closeMentalCheck}
                  className="mt-2 min-h-11 w-full text-center text-xs text-muted hover:text-foreground"
                >
                  {t.common.cancel}
                </button>
              </>
            )}
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
