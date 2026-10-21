import { normalizeInterventions, type Intervention } from "@/lib/play/interventions";

export type PreRoundCheckIn = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

/** A hole's score — null until the golfer actually enters one. */
export type HoleScore = number | null;

export type RoundData = {
  course: string;
  holes: number;
  scores: HoleScore[];
  pars: number[];
  /** Sum of scored holes only. */
  total: number;
  mentalNotes: (string | null)[];
  preRound: PreRoundCheckIn;
  date: string;
  /** Proactive Caddie cards shown during the round (empty for older rounds). */
  interventions: Intervention[];
};

export const DEFAULT_PAR = 4;
export const PAR_OPTIONS = [3, 4, 5] as const;

export type ScoreSummary = {
  /** Sum of scores on scored holes. */
  total: number;
  /** Sum of pars on scored holes only, so vs-par is never skewed by unplayed holes. */
  totalPar: number;
  toPar: number;
  holesScored: number;
  /** 1-based hole numbers with no score entered. */
  unscoredHoles: number[];
};

export function summarizeScores(scores: HoleScore[], pars: number[]): ScoreSummary {
  let total = 0;
  let totalPar = 0;
  let holesScored = 0;
  const unscoredHoles: number[] = [];

  scores.forEach((score, index) => {
    if (score === null) {
      unscoredHoles.push(index + 1);
      return;
    }
    total += score;
    totalPar += pars[index] ?? DEFAULT_PAR;
    holesScored += 1;
  });

  return { total, totalPar, toPar: total - totalPar, holesScored, unscoredHoles };
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `−${Math.abs(toPar)}`;
}

/**
 * Normalizes a stored scores array to exactly `holes` entries. Old saved
 * rounds stored plain numbers (kept as-is); anything missing or invalid
 * becomes null (unscored).
 */
export function normalizeScores(value: unknown, holes: number): HoleScore[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from({ length: holes }, (_, index) => {
    const score = raw[index];
    return typeof score === "number" && Number.isFinite(score) ? score : null;
  });
}

/** Rounds saved before par existed have no `pars` — every hole defaults to par 4. */
export function normalizePars(value: unknown, holes: number): number[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from({ length: holes }, (_, index) => {
    const par = raw[index];
    return typeof par === "number" && Number.isInteger(par) && par >= 3 && par <= 6
      ? par
      : DEFAULT_PAR;
  });
}

export function normalizeMentalNotes(value: unknown, holes: number): (string | null)[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from({ length: holes }, (_, index) => {
    const note = raw[index];
    return typeof note === "string" && note ? note : null;
  });
}

/** Rounds have at most 36 holes — a corrupted huge value can't freeze the page. */
const MAX_HOLES = 36;

export function normalizeHoleCount(holes: unknown, scores: unknown): number {
  if (typeof holes === "number" && Number.isInteger(holes) && holes > 0) return Math.min(holes, MAX_HOLES);
  return Array.isArray(scores) && scores.length > 0 ? Math.min(scores.length, MAX_HOLES) : 18;
}

function emptyRoundData(): RoundData {
  return {
    course: "",
    holes: 18,
    scores: Array(18).fill(null),
    pars: Array(18).fill(DEFAULT_PAR),
    total: 0,
    mentalNotes: Array(18).fill(null),
    preRound: { focus: null, energy: null, confidence: null, note: "" },
    date: new Date().toISOString(),
    interventions: [],
  };
}

export function parsePreRound(value: unknown): PreRoundCheckIn {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    focus: typeof raw.focus === "number" ? raw.focus : null,
    energy: typeof raw.energy === "number" ? raw.energy : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

/** Builds a RoundData from any stored/serialized shape, migrating old rounds. */
export function normalizeRoundData(value: unknown): RoundData {
  if (!value || typeof value !== "object") return emptyRoundData();
  const raw = value as Record<string, unknown>;
  const holes = normalizeHoleCount(raw.holes, raw.scores);
  const scores = normalizeScores(raw.scores, holes);
  const pars = normalizePars(raw.pars, holes);

  return {
    course: typeof raw.course === "string" ? raw.course : "",
    holes,
    scores,
    pars,
    total: summarizeScores(scores, pars).total,
    mentalNotes: normalizeMentalNotes(raw.mentalNotes, holes),
    preRound: parsePreRound(raw.preRound),
    date: typeof raw.date === "string" ? raw.date : new Date().toISOString(),
    interventions: normalizeInterventions(raw.interventions),
  };
}

export function parseRoundData(raw: string | undefined): RoundData {
  if (!raw) return emptyRoundData();

  try {
    return normalizeRoundData(JSON.parse(raw));
  } catch {
    return emptyRoundData();
  }
}
