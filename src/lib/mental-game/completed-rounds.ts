import { normalizeRoundData, summarizeScores, type RoundData } from "@/lib/play/round-data";

export type ReflectionAnswers = {
  whatWorked: string;
  whatGotInHead: string;
  whatToRemember: string;
};

export type PostRoundAnalysis = {
  whatHelped: string;
  whatGotInYourWay: string;
  patternToWatch: string;
  takeIntoNextRound: string;
  generatedAt: string;
  source: "ai" | "fallback";
};

export type CompletedRound = RoundData & {
  id: string;
  reflection: ReflectionAnswers;
  analysis?: PostRoundAnalysis;
};

const STORAGE_KEY = "foremind:completed-rounds";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getRoundsSnapshot(): string {
  if (typeof window === "undefined") return "[]";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function normalizeReflection(value: unknown): ReflectionAnswers {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    whatWorked: typeof raw.whatWorked === "string" ? raw.whatWorked : "",
    whatGotInHead: typeof raw.whatGotInHead === "string" ? raw.whatGotInHead : "",
    whatToRemember: typeof raw.whatToRemember === "string" ? raw.whatToRemember : "",
  };
}

/**
 * Safely migrates a stored round: rounds saved before par existed get
 * par 4 on every hole, old numeric scores are kept, and the total is
 * recomputed from scored holes only.
 */
function normalizeCompletedRound(value: unknown, index: number): CompletedRound | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const analysis =
    raw.analysis && typeof raw.analysis === "object"
      ? (raw.analysis as PostRoundAnalysis)
      : undefined;

  return {
    ...normalizeRoundData(raw),
    id: typeof raw.id === "string" && raw.id ? raw.id : `legacy-${index}`,
    reflection: normalizeReflection(raw.reflection),
    ...(analysis ? { analysis } : {}),
  };
}

export function parseRoundsSnapshot(raw: string): CompletedRound[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeCompletedRound(item, index))
      .filter((round): round is CompletedRound => round !== null);
  } catch {
    return [];
  }
}

export function loadCompletedRounds(): CompletedRound[] {
  return parseRoundsSnapshot(getRoundsSnapshot());
}

export type CaddieHistoryMoment = {
  hole: number;
  /** null when the hole was never scored. */
  holeScore: number | null;
  par: number;
  mentalState: string;
};

export type CaddieHistoryRound = {
  date: string;
  course: string;
  holes: number;
  holesScored: number;
  /** Sum of scored holes only. */
  total: number;
  /** Score relative to par across scored holes only. */
  toPar: number;
  preRound: {
    focus: number | null;
    energy: number | null;
    confidence: number | null;
  };
  moments: CaddieHistoryMoment[];
  reflection: ReflectionAnswers;
};

export function toCaddieHistoryPayload(round: CompletedRound): CaddieHistoryRound {
  const moments: CaddieHistoryMoment[] = [];
  round.mentalNotes.forEach((state, index) => {
    if (state) {
      moments.push({
        hole: index + 1,
        holeScore: round.scores[index] ?? null,
        par: round.pars[index],
        mentalState: state,
      });
    }
  });
  const summary = summarizeScores(round.scores, round.pars);

  return {
    date: round.date,
    course: round.course,
    holes: round.holes,
    holesScored: summary.holesScored,
    total: summary.total,
    toPar: summary.toPar,
    preRound: {
      focus: round.preRound.focus,
      energy: round.preRound.energy,
      confidence: round.preRound.confidence,
    },
    moments,
    reflection: round.reflection,
  };
}

export function createCompletedRoundId(): string {
  return generateId();
}

function persistRounds(rounds: CompletedRound[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
}

const EMPTY_REFLECTION: ReflectionAnswers = {
  whatWorked: "",
  whatGotInHead: "",
  whatToRemember: "",
};

/**
 * Saves a round into completed-round history immediately (e.g. when
 * "Finish Round" is clicked), before reflection answers exist. The round is
 * stored under `id` with an empty reflection, so it already appears in My
 * Mental Game and Caddie history even if the golfer never reaches or
 * completes the reflection step.
 */
export function createCompletedRound(id: string, round: RoundData): CompletedRound {
  // Idempotent: a second Finish Round tap (or a retry) for the same id
  // returns the already-saved round instead of appending a duplicate.
  const existing = loadCompletedRounds().find((saved) => saved.id === id);
  if (existing) return existing;

  const completedRound: CompletedRound = { ...round, id, reflection: EMPTY_REFLECTION };
  persistRounds([...loadCompletedRounds(), completedRound]);
  return completedRound;
}

/**
 * Fills in the reflection answers on the completed round already saved
 * under `id` (from "Finish Round"), rather than creating a new entry — so
 * saving the reflection never produces a duplicate round. Falls back to
 * creating the round (with `round` and `reflection`) only if no round with
 * that id exists yet — a defensive path for the unexpected case, e.g. a
 * hand-edited URL missing the id.
 */
export function upsertCompletedRoundReflection(
  id: string,
  round: RoundData,
  reflection: ReflectionAnswers,
): CompletedRound {
  const rounds = loadCompletedRounds();
  const index = rounds.findIndex((existing) => existing.id === id);

  if (index !== -1) {
    const updated: CompletedRound = { ...rounds[index], reflection };
    const next = [...rounds];
    next[index] = updated;
    persistRounds(next);
    return updated;
  }

  const created: CompletedRound = { ...round, id, reflection };
  persistRounds([...rounds, created]);
  return created;
}

/**
 * Attaches a generated post-round analysis to the completed round already
 * saved under `id`. Returns null if no round with that id exists (analysis
 * generation is best-effort and always happens after the round is saved, so
 * this should not occur in normal use).
 */
export function updateCompletedRoundAnalysis(
  id: string,
  analysis: PostRoundAnalysis,
): CompletedRound | null {
  const rounds = loadCompletedRounds();
  const index = rounds.findIndex((round) => round.id === id);
  if (index === -1) return null;

  const updated: CompletedRound = { ...rounds[index], analysis };
  const next = [...rounds];
  next[index] = updated;
  persistRounds(next);
  return updated;
}
