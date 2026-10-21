import { normalizeRoundData, summarizeScores, type RoundData } from "@/lib/play/round-data";
import { normalizeRecap, type RoundRecap } from "@/lib/mental-game/round-recap";

export type ReflectionAnswers = {
  whatWorked: string;
  whatGotInHead: string;
  whatToRemember: string;
};

/** The saved post-round review — now a "Round Recap" (old reviews are migrated on read). */
export type PostRoundAnalysis = RoundRecap;

export type CompletedRound = RoundData & {
  id: string;
  reflection: ReflectionAnswers;
  analysis?: PostRoundAnalysis;
  /** Example data from "Load sample rounds" — always badged, never sent to the Caddie. */
  sample?: boolean;
  /** When the post-round analysis was last requested / last failed (for "Retry analysis"). */
  analysisRequestedAt?: string;
  analysisFailedAt?: string;
};

const STORAGE_KEY = "foremind:completed-rounds";
/** Fired on window after every write, so the same tab updates (the storage event only fires in other tabs). */
export const ROUNDS_CHANGED_EVENT = "foremind:rounds-changed";

export function subscribeToRounds(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(ROUNDS_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ROUNDS_CHANGED_EVENT, callback);
  };
}

/** Real rounds only — what the Caddie and the Proactive Caddie may learn from. */
export function withoutSamples(rounds: CompletedRound[]): CompletedRound[] {
  return rounds.filter((round) => !round.sample);
}

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
function normalizeAnalysis(value: unknown): PostRoundAnalysis | undefined {
  return normalizeRecap(value);
}

/** A stored entry is usable only if its core shape is right; anything else is skipped. */
function isUsableEntry(raw: Record<string, unknown>): boolean {
  return (
    Array.isArray(raw.scores) &&
    (raw.id === undefined || typeof raw.id === "string") &&
    (raw.course === undefined || typeof raw.course === "string") &&
    (raw.holes === undefined || typeof raw.holes === "number")
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function normalizeCompletedRound(value: unknown, index: number): CompletedRound | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isUsableEntry(raw)) return null;

  try {
    const analysis = normalizeAnalysis(raw.analysis);
    return {
      ...normalizeRoundData(raw),
      id: typeof raw.id === "string" && raw.id ? raw.id : `legacy-${index}`,
      reflection: normalizeReflection(raw.reflection),
      ...(analysis ? { analysis } : {}),
      ...(raw.sample === true ? { sample: true } : {}),
      ...(optionalString(raw.analysisRequestedAt)
        ? { analysisRequestedAt: raw.analysisRequestedAt as string }
        : {}),
      ...(optionalString(raw.analysisFailedAt)
        ? { analysisFailedAt: raw.analysisFailedAt as string }
        : {}),
    };
  } catch {
    return null;
  }
}

let lastWarnedSnapshot = "";

/**
 * Splits stored entries into usable rounds and badly shaped ones. Bad
 * entries are skipped (with one console warning) so they can't crash the
 * dashboard or the Caddie — but kept in storage untouched on later writes.
 */
function parseRoundsWithInvalid(raw: string): { rounds: CompletedRound[]; invalid: unknown[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { rounds: [], invalid: [] };
  }
  if (!Array.isArray(parsed)) return { rounds: [], invalid: [] };

  const rounds: CompletedRound[] = [];
  const invalid: unknown[] = [];
  parsed.forEach((item, index) => {
    const round = normalizeCompletedRound(item, index);
    if (round) rounds.push(round);
    else invalid.push(item);
  });

  if (invalid.length > 0 && raw !== lastWarnedSnapshot) {
    lastWarnedSnapshot = raw;
    console.warn(
      `[foremind] Skipped ${invalid.length} saved round(s) with an unexpected shape.`,
      invalid,
    );
  }
  return { rounds, invalid };
}

export function parseRoundsSnapshot(raw: string): CompletedRound[] {
  return parseRoundsWithInvalid(raw).rounds;
}

export function findCompletedRound(id: string): CompletedRound | null {
  return loadCompletedRounds().find((round) => round.id === id) ?? null;
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
    // Keep any skipped (badly shaped) entries as they were rather than deleting them.
    const { invalid } = parseRoundsWithInvalid(getRoundsSnapshot());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...rounds, ...invalid]));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
  window.dispatchEvent(new Event(ROUNDS_CHANGED_EVENT));
}

function updateRound(id: string, change: (round: CompletedRound) => CompletedRound): void {
  const rounds = loadCompletedRounds();
  const index = rounds.findIndex((round) => round.id === id);
  if (index === -1) return;
  const next = [...rounds];
  next[index] = change(rounds[index]);
  persistRounds(next);
}

export function markAnalysisRequested(id: string): void {
  updateRound(id, (round) => {
    const { analysisFailedAt: _failed, ...rest } = round;
    void _failed;
    return { ...rest, analysisRequestedAt: new Date().toISOString() };
  });
}

export function markAnalysisFailed(id: string): void {
  updateRound(id, (round) => ({ ...round, analysisFailedAt: new Date().toISOString() }));
}

/** Adds rounds (used by sample data); skips ids that already exist. */
export function addCompletedRounds(newRounds: CompletedRound[]): void {
  const rounds = loadCompletedRounds();
  const existing = new Set(rounds.map((round) => round.id));
  persistRounds([...rounds, ...newRounds.filter((round) => !existing.has(round.id))]);
}

/** Removes every sample round; returns their ids (so photos can be removed too). */
export function removeSampleRounds(): string[] {
  const rounds = loadCompletedRounds();
  persistRounds(rounds.filter((round) => !round.sample));
  return rounds.filter((round) => round.sample).map((round) => round.id);
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

  const normalized = normalizeRecap(analysis);
  if (!normalized) return null;
  const updated: CompletedRound = { ...rounds[index], analysis: normalized };
  const next = [...rounds];
  next[index] = updated;
  persistRounds(next);
  return updated;
}
