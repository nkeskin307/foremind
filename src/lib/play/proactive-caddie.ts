import { formatToPar, type HoleScore } from "@/lib/play/round-data";
import type {
  Intervention,
  InterventionDetail,
  InterventionTrigger,
} from "@/lib/play/interventions";
import type { Messages } from "@/lib/i18n";
import type { CompletedRound } from "@/lib/mental-game/completed-rounds";

export const NEGATIVE_STATES = ["Frustrated", "Rushed", "Overthinking"];
const BLOW_UP_OVER_PAR = 2;
/** At most one card per this many holes. */
export const COOLDOWN_HOLES = 3;
const LOW_CONFIDENCE = 2;
export const RESET_TIMEOUT_MS = 8000;
export const MIN_RECOVERY_CASES = 3;

export type TriggerHit = {
  trigger: InterventionTrigger;
  /** 1-based hole the card is about. */
  hole: number;
  /** Short English reason, e.g. "The golfer scored 7 on a par 4 (+3) on hole 4". */
  reason: string;
  /** Facts for the card's "why" sentence; saved on the intervention. */
  detail: InterventionDetail;
};

type TriggerInput = {
  scores: HoleScore[];
  pars: number[];
  mentalNotes: (string | null)[];
  preRoundConfidence: number | null;
  /** 0-based hole that was just scored or had a mental state logged. */
  holeIndex: number;
  /** Which kind of change happened, so each rule only runs on its own event. */
  change: "score" | "mental-state";
};

function isNegative(state: string | null | undefined): state is string {
  return Boolean(state && NEGATIVE_STATES.includes(state));
}

/** Simple in-browser rules — no AI. Returns the highest-priority hit for this hole. */
export function detectTrigger(input: TriggerInput): TriggerHit | null {
  const { scores, pars, mentalNotes, preRoundConfidence, holeIndex: h, change } = input;
  const hole = h + 1;

  if (change === "score") {
    const score = scores[h];
    if (score === null || score === undefined) return null; // only scored holes
    const toPar = score - pars[h];

    // c. Hole 1 at double bogey or worse.
    if (h === 0 && toPar >= BLOW_UP_OVER_PAR) {
      return {
        trigger: "rough-start",
        hole,
        reason: `The golfer opened with ${score} on a par ${pars[h]} (${formatToPar(toPar)}) on hole 1`,
        detail: { toPar, states: [], holes: [hole] },
      };
    }

    // d. Low pre-round confidence and the first scored hole is over par.
    const firstScored = scores.findIndex((value) => value !== null);
    if (
      preRoundConfidence !== null &&
      preRoundConfidence <= LOW_CONFIDENCE &&
      firstScored === h &&
      toPar > 0
    ) {
      return {
        trigger: "low-confidence-start",
        hole,
        reason: `Pre-round confidence was ${preRoundConfidence}/5 and the first scored hole, hole ${hole}, was ${formatToPar(toPar)}`,
        detail: { toPar, states: [], holes: [hole] },
      };
    }

    // b. Par +2 or worse.
    if (toPar >= BLOW_UP_OVER_PAR) {
      return {
        trigger: "blow-up",
        hole,
        reason: `The golfer scored ${score} on a par ${pars[h]} (${formatToPar(toPar)}) on hole ${hole}`,
        detail: { toPar, states: [], holes: [hole] },
      };
    }
    return null;
  }

  // a. A negative state on two holes in a row.
  const state = mentalNotes[h];
  if (!isNegative(state)) return null;
  const pairWith = isNegative(mentalNotes[h - 1]) ? h - 1 : isNegative(mentalNotes[h + 1]) ? h + 1 : -1;
  if (pairWith === -1) return null;
  const first = Math.min(h, pairWith) + 1;
  const second = Math.max(h, pairWith) + 1;
  const states = [mentalNotes[first - 1], mentalNotes[second - 1]];
  const label = states[0] === states[1] ? `${states[0]}` : `${states[0]} then ${states[1]}`;
  return {
    trigger: "negative-streak",
    hole: second,
    reason: `${label} logged on holes ${first} and ${second} in a row`,
    detail: {
      toPar: null,
      states: states.filter((s): s is string => Boolean(s)),
      holes: [first, second],
    },
  };
}

/** Never the same hole twice, and at least COOLDOWN_HOLES holes from any earlier card. */
export function canIntervene(hole: number, interventions: Intervention[]): boolean {
  return interventions.every(
    (intervention) => Math.abs(intervention.hole - hole) >= COOLDOWN_HOLES,
  );
}

/** The next scored hole after `hole` (1-based), and its result vs par. */
export function nextScoredHoleResult(
  scores: HoleScore[],
  pars: number[],
  hole: number,
): { hole: number; toPar: number } | null {
  for (let index = hole; index < scores.length; index += 1) {
    const score = scores[index];
    if (score !== null && score !== undefined) {
      return { hole: index + 1, toPar: score - pars[index] };
    }
  }
  return null;
}

export function withNextHoleResults(
  interventions: Intervention[],
  scores: HoleScore[],
  pars: number[],
): Intervention[] {
  return interventions.map((intervention) => {
    const next = nextScoredHoleResult(scores, pars, intervention.hole);
    return { ...intervention, nextHole: next?.hole ?? null, nextHoleToPar: next?.toPar ?? null };
  });
}

/** Static message used when the AI is slow, fails, or is offline. Under 40 words. */
export function fallbackResetMessage(hit: TriggerHit, messages: Messages): string {
  return messages.resetCard.fallbacks[hit.trigger];
}

export type RecoveryCase = { nextToPar: number };

export type RecoveryStats = {
  afterCard: { count: number; average: number | null };
  afterBadHoleNoCard: { count: number; average: number | null };
};

function averageOf(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Next-hole result vs par after a Proactive Caddie card, compared with
 * after bad holes (par +2 or worse) that had no card. Computed from the
 * saved scores, one case per card / bad hole that has a later scored hole.
 */
export function computeRecoveryStats(rounds: CompletedRound[]): RecoveryStats {
  const afterCard: number[] = [];
  const afterBadHoleNoCard: number[] = [];

  for (const round of rounds) {
    const cardHoles = new Set(round.interventions.map((intervention) => intervention.hole));

    for (const intervention of round.interventions) {
      const next = nextScoredHoleResult(round.scores, round.pars, intervention.hole);
      if (next) afterCard.push(next.toPar);
    }

    round.scores.forEach((score, index) => {
      if (score === null) return;
      const hole = index + 1;
      if (score - round.pars[index] < BLOW_UP_OVER_PAR || cardHoles.has(hole)) return;
      const next = nextScoredHoleResult(round.scores, round.pars, hole);
      if (next) afterBadHoleNoCard.push(next.toPar);
    });
  }

  return {
    afterCard: { count: afterCard.length, average: averageOf(afterCard) },
    afterBadHoleNoCard: {
      count: afterBadHoleNoCard.length,
      average: averageOf(afterBadHoleNoCard),
    },
  };
}

/**
 * From completed rounds: how often the hole after a blow-up (par +2 or
 * worse) was also over par. Returned as a sentence only when it's usually
 * true (at least half of 3+ cases).
 */
export function describeBlowUpPattern(rounds: CompletedRound[]): string | null {
  let cases = 0;
  let overPar = 0;
  for (const round of rounds) {
    round.scores.forEach((score, index) => {
      if (score === null || score - round.pars[index] < BLOW_UP_OVER_PAR) return;
      const next = nextScoredHoleResult(round.scores, round.pars, index + 1);
      if (!next) return;
      cases += 1;
      if (next.toPar > 0) overPar += 1;
    });
  }
  if (cases < MIN_RECOVERY_CASES || overPar / cases < 0.5) return null;
  return `In the golfer's completed rounds, the hole after a blow-up (par +2 or worse) was also over par in ${overPar} of ${cases} cases.`;
}

/**
 * Asks /api/caddie for a short reset card in the golfer's language.
 * Returns null on any failure or after RESET_TIMEOUT_MS, so the caller
 * can show the static fallback instead.
 */
export async function fetchResetMessage({
  hit,
  pattern,
  language,
  context,
}: {
  hit: TriggerHit;
  pattern: string | null;
  language: string;
  context: unknown;
}): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESET_TIMEOUT_MS);
  const situation = `Proactive reset card for hole ${hit.hole}. Trigger: ${hit.trigger}. What happened: ${hit.reason}.${
    pattern ? ` ${pattern}` : ""
  }`;

  try {
    const res = await fetch("/api/caddie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: situation, context, language, mode: "reset" }),
      signal: controller.signal,
    });
    const data = await res.json();
    return res.ok && typeof data.response === "string" && data.response.trim()
      ? data.response.trim()
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
