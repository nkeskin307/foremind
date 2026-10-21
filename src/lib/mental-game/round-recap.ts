import { formatToPar, summarizeScores, type HoleScore } from "@/lib/play/round-data";
import { stateLabel, type Messages } from "@/lib/i18n";
import { formatAverageToPar } from "@/lib/i18n/format";
import type { AppLanguage } from "@/lib/i18n/languages";

/** The saved post-round review ("Round Recap"). AI or fallback — same shape. */
export type RoundRecap = {
  version: 2;
  /** One sentence summarizing the round's mental story ("" for migrated old reviews). */
  headline: string;
  /** Hole is chosen in code; the text explains it. null when the round had no clear turn. */
  turningPoint: { hole: number | null; text: string } | null;
  /** 1–2 bullets citing specific holes and the golfer's own words. */
  whatWorked: string[];
  /** Exactly one concrete action tied to this round. */
  tryThis: string;
  /** Only when there were at least 3 earlier real rounds; otherwise null. */
  patternWatch: string | null;
  generatedAt: string;
  source: "ai" | "fallback";
};

/** Minimal round shape the recap needs (works for saved rounds and the API's parsed round). */
export type RecapRound = {
  course: string;
  holes: number;
  scores: HoleScore[];
  pars: number[];
  mentalNotes: (string | null)[];
  reflection: { whatWorked: string; whatGotInHead: string; whatToRemember: string };
  interventions: { hole: number }[];
};

/** Compact summary of an earlier real round, for "Pattern watch". */
export type RecapHistoryRound = {
  course: string;
  date: string;
  toPar: number | null;
  holesScored: number;
  states: string[];
};

export const MIN_EARLIER_ROUNDS_FOR_PATTERN = 3;
export const RECAP_MAX_WORDS = 120;
const POSITIVE_STATES = ["Confident", "Focused", "Calm"];

// ---------- At a glance (computed in code, never by AI) ----------

export type RecapGlance = {
  holesScored: number;
  holes: number;
  toPar: number | null;
  bestStretch: { first: number; last: number; toPar: number } | null;
  toughestHole: { hole: number; toPar: number } | null;
  moodsLogged: number;
  resetCards: number;
};

function scoredHoles(round: RecapRound) {
  return round.scores.flatMap((score, index) =>
    score === null || score === undefined
      ? []
      : [{ hole: index + 1, toPar: score - (round.pars[index] ?? 4), mood: round.mentalNotes[index] ?? null }],
  );
}

export function computeRecapGlance(round: RecapRound): RecapGlance {
  const summary = summarizeScores(round.scores, round.pars);
  const scored = scoredHoles(round);

  // Best 3 consecutive holes (all scored), lowest total vs par; earliest wins ties.
  let bestStretch: RecapGlance["bestStretch"] = null;
  for (let i = 0; i + 2 < scored.length; i += 1) {
    const window = scored.slice(i, i + 3);
    if (window[2].hole - window[0].hole !== 2) continue;
    const toPar = window.reduce((sum, item) => sum + item.toPar, 0);
    if (!bestStretch || toPar < bestStretch.toPar) {
      bestStretch = { first: window[0].hole, last: window[2].hole, toPar };
    }
  }

  let toughestHole: RecapGlance["toughestHole"] = null;
  for (const item of scored) {
    if (!toughestHole || item.toPar > toughestHole.toPar) toughestHole = { hole: item.hole, toPar: item.toPar };
  }

  return {
    holesScored: summary.holesScored,
    holes: round.holes,
    toPar: summary.holesScored > 0 ? summary.toPar : null,
    bestStretch,
    toughestHole,
    moodsLogged: round.mentalNotes.filter(Boolean).length,
    resetCards: round.interventions.length,
  };
}

// ---------- Turning point (chosen in code) ----------

export type TurningPoint = {
  kind: "bounce-back" | "slide";
  hole: number;
  fromHole: number;
  fromToPar: number;
  /** Average vs par on the holes after the turn. */
  afterAverage: number;
  mood: string | null;
  afterReset: boolean;
};

function avg(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * The hole where the round changed: a bounce-back (bad hole, then the next
 * holes at about par) or a slide (good holes, then the next holes clearly
 * over par). Picks the biggest swing; null if nothing changed by ≥1 stroke/hole.
 */
export function findTurningPoint(round: RecapRound): TurningPoint | null {
  const scored = scoredHoles(round);
  const resetHoles = new Set(round.interventions.map((item) => item.hole));
  let best: (TurningPoint & { swing: number }) | null = null;

  for (let i = 1; i < scored.length; i += 1) {
    const after = scored.slice(i, i + 3);
    if (after.length < 2) break;
    const afterAverage = avg(after.map((item) => item.toPar));
    const prev = scored[i - 1];
    const prevTwo = scored[i - 2];

    const badBefore = prev.toPar >= 2 || (prev.toPar >= 1 && prevTwo !== undefined && prevTwo.toPar >= 1);
    if (badBefore && afterAverage <= 0.34) {
      const swing = prev.toPar - afterAverage;
      if (swing >= 1 && (!best || swing > best.swing)) {
        const mood =
          [scored[i].mood, prev.mood].find((state) => state && POSITIVE_STATES.includes(state)) ??
          scored[i].mood ??
          null;
        best = {
          kind: "bounce-back",
          hole: scored[i].hole,
          fromHole: prev.hole,
          fromToPar: prev.toPar,
          afterAverage,
          mood,
          afterReset: resetHoles.has(prev.hole),
          swing,
        };
      }
    }

    const before = scored.slice(Math.max(0, i - 3), i);
    if (before.length >= 2) {
      const beforeAverage = avg(before.map((item) => item.toPar));
      if (beforeAverage <= 0.34 && afterAverage >= 1) {
        const swing = afterAverage - beforeAverage;
        if (!best || swing > best.swing) {
          best = {
            kind: "slide",
            hole: scored[i].hole,
            fromHole: prev.hole,
            fromToPar: prev.toPar,
            afterAverage,
            mood: scored[i].mood ?? after.find((item) => item.mood)?.mood ?? null,
            afterReset: false,
            swing,
          };
        }
      }
    }
  }

  if (!best) return null;
  const { swing: _swing, ...turningPoint } = best;
  void _swing;
  return turningPoint;
}

// ---------- History for "Pattern watch" ----------

export function toRecapHistory(
  rounds: { course: string; date: string; scores: HoleScore[]; pars: number[]; mentalNotes: (string | null)[] }[],
): RecapHistoryRound[] {
  return rounds.map((round) => {
    const summary = summarizeScores(round.scores, round.pars);
    return {
      course: round.course,
      date: round.date,
      toPar: summary.holesScored > 0 ? summary.toPar : null,
      holesScored: summary.holesScored,
      states: [...new Set(round.mentalNotes.filter((s): s is string => Boolean(s)))],
    };
  });
}

function sameCourse(a: string, b: string): boolean {
  return a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
}

function topMood(round: RecapRound): string | null {
  const counts = new Map<string, number>();
  for (const state of round.mentalNotes) if (state) counts.set(state, (counts.get(state) ?? 0) + 1);
  let top: string | null = null;
  for (const [state, count] of counts) if (!top || count > (counts.get(top) ?? 0)) top = state;
  return top;
}

// ---------- Fallback recap (no AI), same structure ----------

export function buildFallbackRecap(
  round: RecapRound,
  earlier: RecapHistoryRound[],
  t: Messages,
  lang: AppLanguage,
): RoundRecap {
  const r = t.recap;
  const glance = computeRecapGlance(round);
  const turn = findTurningPoint(round);
  const mood = topMood(round);
  const label = (state: string) => stateLabel(t, state);

  const headline = turn
    ? turn.kind === "bounce-back"
      ? r.headlineBounce(turn.fromHole, turn.hole)
      : r.headlineSlide(turn.hole)
    : glance.toPar === null
      ? r.headlineNoScores
      : mood
        ? r.headlineSteadyMood(formatToPar(glance.toPar), label(mood))
        : r.headlineSteady(formatToPar(glance.toPar));

  let turningPoint: RoundRecap["turningPoint"] = null;
  if (turn) {
    const fromResult = formatToPar(turn.fromToPar);
    const text =
      turn.kind === "bounce-back"
        ? turn.afterReset
          ? r.tpBounceReset(turn.hole, turn.fromHole, fromResult)
          : turn.mood
            ? r.tpBounceMood(turn.hole, turn.fromHole, fromResult, label(turn.mood))
            : r.tpBounce(turn.hole, turn.fromHole, fromResult)
        : turn.mood
          ? r.tpSlideMood(turn.hole, formatAverageToPar(turn.afterAverage, lang), label(turn.mood))
          : r.tpSlide(turn.hole, formatAverageToPar(turn.afterAverage, lang));
    turningPoint = { hole: turn.hole, text };
  }

  const whatWorked: string[] = [];
  if (glance.bestStretch) {
    whatWorked.push(
      r.workedStretch(glance.bestStretch.first, glance.bestStretch.last, formatToPar(glance.bestStretch.toPar)),
    );
  }
  if (round.reflection.whatWorked.trim()) whatWorked.push(r.workedOwnWords(round.reflection.whatWorked.trim()));

  const toughest = glance.toughestHole;
  const toughestMood = toughest ? round.mentalNotes[toughest.hole - 1] : null;
  const tryThis =
    toughest && toughestMood
      ? r.tryMood(toughest.hole, label(toughestMood))
      : round.reflection.whatToRemember.trim()
        ? r.tryRemember(round.reflection.whatToRemember.trim())
        : toughest
          ? r.tryToughest(toughest.hole)
          : r.tryRemember(t.routine.resetReminder);

  let patternWatch: string | null = null;
  if (earlier.length >= MIN_EARLIER_ROUNDS_FOR_PATTERN) {
    const atCourse = earlier.filter((item) => sameCourse(item.course, round.course) && item.toPar !== null);
    const recent = earlier.slice(0, 5);
    const moodCount = mood ? recent.filter((item) => item.states.includes(mood)).length : 0;
    if (atCourse.length > 0 && glance.toPar !== null) {
      patternWatch = r.patternCourse(
        round.course,
        formatToPar(glance.toPar),
        formatAverageToPar(avg(atCourse.map((item) => item.toPar as number)), lang),
        atCourse.length,
      );
    } else if (mood && moodCount >= 2) {
      patternWatch = r.patternMood(label(mood), moodCount, recent.length);
    }
  }

  return {
    version: 2,
    headline,
    turningPoint,
    whatWorked: whatWorked.slice(0, 2),
    tryThis,
    patternWatch,
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

// ---------- Word limit (AI parts ≤ 120 words) ----------

function isCjk(text: string): boolean {
  return /[㐀-鿿぀-ヿ]/.test(text);
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  if (isCjk(text)) return Math.ceil(text.replace(/\s/g, "").length / 2);
  return text.trim().split(/\s+/).length;
}

function truncateWords(text: string, max: number): string {
  if (countWords(text) <= max) return text;
  if (isCjk(text)) {
    const cut = text.slice(0, max * 2);
    const end = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"), cut.lastIndexOf("？"));
    return end > max ? cut.slice(0, end + 1) : `${cut}…`;
  }
  const cut = text.trim().split(/\s+/).slice(0, max).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("."));
  return end > cut.length / 2 ? cut.slice(0, end + 1) : `${cut}…`;
}

export function recapWordCount(recap: RoundRecap): number {
  return [recap.headline, recap.turningPoint?.text ?? "", ...recap.whatWorked, recap.tryThis, recap.patternWatch ?? ""]
    .reduce((sum, text) => sum + countWords(text), 0);
}

/** Keeps the AI-written parts within RECAP_MAX_WORDS: drop the 2nd bullet, then trim each part. */
export function enforceRecapLimit(recap: RoundRecap): RoundRecap {
  let next = recap;
  if (recapWordCount(next) > RECAP_MAX_WORDS && next.whatWorked.length > 1) {
    next = { ...next, whatWorked: next.whatWorked.slice(0, 1) };
  }
  if (recapWordCount(next) <= RECAP_MAX_WORDS) return next;
  return {
    ...next,
    headline: truncateWords(next.headline, 20),
    turningPoint: next.turningPoint ? { ...next.turningPoint, text: truncateWords(next.turningPoint.text, 30) } : null,
    whatWorked: next.whatWorked.map((item) => truncateWords(item, 25)),
    tryThis: truncateWords(next.tryThis, 22),
    patternWatch: next.patternWatch ? truncateWords(next.patternWatch, 22) : null,
  };
}

// ---------- Reading saved reviews (with migration of the old 4-section format) ----------

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Reads a saved review. New recaps are validated; old reviews
 * ({whatHelped, whatGotInYourWay, patternToWatch, takeIntoNextRound}) are
 * mapped onto the recap sections so they still display.
 */
export function normalizeRecap(value: unknown): RoundRecap | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const generatedAt = str(raw.generatedAt);
  const source = raw.source === "ai" ? "ai" : "fallback";

  if (raw.version === 2) {
    const tryThis = str(raw.tryThis);
    const whatWorked = Array.isArray(raw.whatWorked)
      ? raw.whatWorked.map(str).filter(Boolean).slice(0, 2)
      : [];
    if (!tryThis && whatWorked.length === 0 && !str(raw.headline)) return undefined;
    const tp = raw.turningPoint && typeof raw.turningPoint === "object"
      ? (raw.turningPoint as Record<string, unknown>)
      : null;
    return {
      version: 2,
      headline: str(raw.headline),
      turningPoint:
        tp && str(tp.text)
          ? { hole: typeof tp.hole === "number" ? tp.hole : null, text: str(tp.text) }
          : null,
      whatWorked,
      tryThis,
      patternWatch: str(raw.patternWatch) || null,
      generatedAt,
      source,
    };
  }

  const legacy = ["whatHelped", "whatGotInYourWay", "patternToWatch", "takeIntoNextRound"];
  if (!legacy.every((field) => typeof raw[field] === "string")) return undefined;
  return {
    version: 2,
    headline: "",
    turningPoint: str(raw.whatGotInYourWay) ? { hole: null, text: str(raw.whatGotInYourWay) } : null,
    whatWorked: str(raw.whatHelped) ? [str(raw.whatHelped)] : [],
    tryThis: str(raw.takeIntoNextRound),
    patternWatch: str(raw.patternToWatch) || null,
    generatedAt,
    source,
  };
}
