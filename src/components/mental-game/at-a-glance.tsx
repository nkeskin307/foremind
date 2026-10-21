"use client";

import type { ReactNode } from "react";
import type { CompletedRound } from "@/lib/mental-game/completed-rounds";
import {
  MIN_HOLES_PER_STATE,
  MIN_ROUNDS_FOR_FIRST_HOLE,
  MIN_ROUNDS_FOR_PATTERNS,
  averageToPar,
  firstHoleEffect,
  scoreByState,
  stateRoundCounts,
  type FirstHoleGroup,
} from "@/lib/mental-game/insights";
import { useI18n } from "@/lib/i18n/use-i18n";
import { stateLabel } from "@/lib/i18n";
import { formatAverageToPar } from "@/lib/i18n/format";

const CARD = "card-hover rounded-2xl border border-border bg-surface px-4 py-4";

function Locked({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-muted">{children}</p>;
}

/** Phone-first summary tiles; each one explains what unlocks it when there isn't enough data. */
export function AtAGlance({ rounds }: { rounds: CompletedRound[] }) {
  const { lang, t } = useI18n();
  const g = t.glance;
  const avg = averageToPar(rounds);
  const states = stateRoundCounts(rounds).slice(0, 3);
  const byState = scoreByState(rounds).slice(0, 4);
  const first = firstHoleEffect(rounds);
  const enoughForPatterns = rounds.length >= MIN_ROUNDS_FOR_PATTERNS;

  const firstHoleValue = (group: FirstHoleGroup) =>
    group.restAveragePerHole !== null ? formatAverageToPar(group.restAveragePerHole, lang) : g.notYet;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className={`${CARD} text-center`}>
          <p className="text-2xl font-bold text-foreground">{rounds.length}</p>
          <p className="mt-1 text-xs text-muted">{t.dashboard.roundsPlayed}</p>
        </div>
        <div className={`${CARD} text-center`}>
          {avg.value !== null ? (
            <p className="text-2xl font-bold text-foreground">{formatAverageToPar(avg.value, lang)}</p>
          ) : (
            <p className="text-xs text-muted">{t.dashboard.notEnoughData}</p>
          )}
          <p className="mt-1 text-xs text-muted">{g.avgVsPar}</p>
          <p className="mt-0.5 text-[10px] text-muted">{g.avgVsParNote}</p>
        </div>
      </div>
      {avg.value === null && <Locked>{g.unlockAvg}</Locked>}

      <div className={CARD}>
        <p className="text-sm font-medium text-foreground">{g.commonStates}</p>
        {!enoughForPatterns ? (
          <Locked>{g.unlockRounds(MIN_ROUNDS_FOR_PATTERNS - rounds.length)}</Locked>
        ) : states.length === 0 ? (
          <Locked>{g.unlockStates}</Locked>
        ) : (
          <ul className="mt-2 space-y-1">
            {states.map(({ state, rounds: count }) => (
              <li key={state} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{stateLabel(t, state)}</span>
                <span className="whitespace-nowrap text-xs text-muted">
                  {g.rounds(count)} / {rounds.length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={CARD}>
        <p className="text-sm font-medium text-foreground">{g.byState}</p>
        <p className="mt-1 text-xs text-muted">{g.byStateNote}</p>
        {byState.length === 0 ? (
          <Locked>{g.unlockByState(MIN_HOLES_PER_STATE)}</Locked>
        ) : (
          <ul className="mt-2 space-y-1">
            {byState.map((row) => (
              <li key={row.state} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{stateLabel(t, row.state)}</span>
                <span className="whitespace-nowrap">
                  <span className="font-semibold text-foreground">
                    {formatAverageToPar(row.averageToPar, lang)}
                  </span>{" "}
                  <span className="text-xs text-muted">· {g.holes(row.holes)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={CARD}>
        <p className="text-sm font-medium text-foreground">{g.firstHole}</p>
        {first.roundsWithFirstHole < MIN_ROUNDS_FOR_FIRST_HOLE ? (
          <Locked>{g.unlockFirstHole(MIN_ROUNDS_FOR_FIRST_HOLE - first.roundsWithFirstHole)}</Locked>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted">{g.restPerHole}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              {[
                { label: g.firstHoleOver, group: first.overPar },
                { label: g.firstHoleGood, group: first.parOrBetter },
              ].map(({ label, group }) => (
                <div key={label}>
                  <p className="text-xl font-bold text-foreground">{firstHoleValue(group)}</p>
                  <p className="mt-1 text-xs text-muted">{label}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{g.rounds(group.rounds)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
