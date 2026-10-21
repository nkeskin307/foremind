import { summarizeScores } from "@/lib/play/round-data";
import type { CompletedRound } from "@/lib/mental-game/completed-rounds";

export const MIN_ROUNDS_FOR_PATTERNS = 3;
export const MIN_HOLES_PER_STATE = 3;
export const MIN_ROUNDS_FOR_FIRST_HOLE = 3;

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Average score vs par per round (scored holes only), over rounds with at least one scored hole. */
export function averageToPar(rounds: CompletedRound[]): { value: number | null; rounds: number } {
  const values = rounds
    .map((round) => summarizeScores(round.scores, round.pars))
    .filter((summary) => summary.holesScored > 0)
    .map((summary) => summary.toPar);
  return { value: average(values), rounds: values.length };
}

/** Rounds (not holes) each mental state appeared in, most first. */
export function stateRoundCounts(rounds: CompletedRound[]): { state: string; rounds: number }[] {
  const counts = new Map<string, number>();
  for (const round of rounds) {
    for (const state of new Set(round.mentalNotes.filter((s): s is string => Boolean(s)))) {
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, rounds: count }))
    .sort((a, b) => b.rounds - a.rounds);
}

/** Average hole result vs par on scored holes where each state was logged. */
export function scoreByState(
  rounds: CompletedRound[],
): { state: string; averageToPar: number; holes: number }[] {
  const byState = new Map<string, number[]>();
  for (const round of rounds) {
    round.mentalNotes.forEach((state, index) => {
      const score = round.scores[index];
      if (!state || score === null || score === undefined) return;
      const list = byState.get(state) ?? [];
      list.push(score - round.pars[index]);
      byState.set(state, list);
    });
  }
  return [...byState.entries()]
    .filter(([, values]) => values.length >= MIN_HOLES_PER_STATE)
    .map(([state, values]) => ({
      state,
      averageToPar: average(values) as number,
      holes: values.length,
    }))
    .sort((a, b) => b.holes - a.holes);
}

export type FirstHoleGroup = { rounds: number; restAveragePerHole: number | null };

/**
 * How hole 1 relates to the rest: for rounds where hole 1 was scored, the
 * average result vs par per hole over the remaining scored holes, split by
 * whether hole 1 was over par or par-or-better.
 */
export function firstHoleEffect(rounds: CompletedRound[]): {
  roundsWithFirstHole: number;
  overPar: FirstHoleGroup;
  parOrBetter: FirstHoleGroup;
} {
  const over: number[] = [];
  const good: number[] = [];
  let roundsWithFirstHole = 0;
  let overRounds = 0;
  let goodRounds = 0;

  for (const round of rounds) {
    const first = round.scores[0];
    if (first === null || first === undefined) continue;
    const rest = round.scores
      .map((score, index) => (index > 0 && score !== null ? score - round.pars[index] : null))
      .filter((value): value is number => value !== null);
    if (rest.length === 0) continue;
    roundsWithFirstHole += 1;
    if (first - round.pars[0] > 0) {
      overRounds += 1;
      over.push(...rest);
    } else {
      goodRounds += 1;
      good.push(...rest);
    }
  }

  return {
    roundsWithFirstHole,
    overPar: { rounds: overRounds, restAveragePerHole: average(over) },
    parOrBetter: { rounds: goodRounds, restAveragePerHole: average(good) },
  };
}
