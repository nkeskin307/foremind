import {
  normalizeMentalNotes,
  normalizePars,
  normalizeScores,
  parsePreRound,
  type HoleScore,
  type PreRoundCheckIn,
} from "@/lib/play/round-data";
import { normalizeInterventions, type Intervention } from "@/lib/play/interventions";

export type ActiveRoundRecord = {
  id: string;
  course: string;
  date: string;
  holes: number;
  currentHole: number;
  scores: HoleScore[];
  pars: number[];
  mentalNotes: (string | null)[];
  preRound: PreRoundCheckIn;
  interventions: Intervention[];
  /** "Stop interruptions for this round" — Proactive Caddie off until the round ends. */
  proactiveCaddieOff: boolean;
};

const STORAGE_KEY = "foremind:active-round";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createActiveRoundId(): string {
  return generateId();
}

function isValidRecord(value: unknown): value is ActiveRoundRecord {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.id === "string" &&
    typeof raw.course === "string" &&
    typeof raw.date === "string" &&
    typeof raw.holes === "number" &&
    Number.isInteger(raw.holes) &&
    raw.holes > 0 &&
    raw.holes <= 36 &&
    typeof raw.currentHole === "number" &&
    Array.isArray(raw.scores) &&
    Array.isArray(raw.mentalNotes) &&
    typeof raw.preRound === "object" &&
    raw.preRound !== null
  );
}

export function getActiveRoundSnapshot(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseActiveRoundSnapshot(raw: string): ActiveRoundRecord | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isValidRecord(parsed)) return null;
    // Migrate rounds saved before par/unscored holes existed: missing pars
    // default to 4, existing numeric scores are kept.
    const holes = parsed.holes;
    return {
      ...parsed,
      scores: normalizeScores(parsed.scores, holes),
      pars: normalizePars((parsed as { pars?: unknown }).pars, holes),
      mentalNotes: normalizeMentalNotes(parsed.mentalNotes, holes),
      preRound: parsePreRound(parsed.preRound),
      interventions: normalizeInterventions((parsed as { interventions?: unknown }).interventions),
      proactiveCaddieOff: (parsed as { proactiveCaddieOff?: unknown }).proactiveCaddieOff === true,
      currentHole: Math.min(Math.max(0, Math.floor(parsed.currentHole)), holes - 1),
    };
  } catch {
    return null;
  }
}

export function loadActiveRound(): ActiveRoundRecord | null {
  return parseActiveRoundSnapshot(getActiveRoundSnapshot());
}

export function saveActiveRound(record: ActiveRoundRecord): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
}

export function clearActiveRound(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable — safe to ignore for this prototype.
  }
}
