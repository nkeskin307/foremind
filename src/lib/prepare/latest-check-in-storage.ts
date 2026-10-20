import type { CheckInQueryData } from "@/lib/prepare/check-in-params";

/**
 * The most recently *submitted* check-in. Unlike the draft (cleared on
 * submit), this survives so /play can use it even when the URL has no
 * query (e.g. after Restart Round), and so /play can tell that a new
 * check-in arrived while an older round is still unfinished.
 */
export type LatestCheckIn = CheckInQueryData & {
  submittedAt: string;
  /** True once a round has been started (or resumed) after this check-in. */
  handled: boolean;
};

const STORAGE_KEY = "foremind:latest-check-in";

function isLatestCheckIn(value: unknown): value is LatestCheckIn {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    (raw.focus === null || typeof raw.focus === "number") &&
    (raw.energy === null || typeof raw.energy === "number") &&
    (raw.confidence === null || typeof raw.confidence === "number") &&
    typeof raw.note === "string" &&
    typeof raw.submittedAt === "string" &&
    typeof raw.handled === "boolean"
  );
}

export function getLatestCheckInSnapshot(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseLatestCheckInSnapshot(raw: string): LatestCheckIn | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isLatestCheckIn(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadLatestCheckIn(): LatestCheckIn | null {
  return parseLatestCheckInSnapshot(getLatestCheckInSnapshot());
}

export function saveLatestCheckIn(checkIn: CheckInQueryData): void {
  if (typeof window === "undefined") return;

  try {
    const record: LatestCheckIn = {
      focus: checkIn.focus,
      energy: checkIn.energy,
      confidence: checkIn.confidence,
      note: checkIn.note,
      submittedAt: new Date().toISOString(),
      handled: false,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
}

export function markLatestCheckInHandled(): void {
  const latest = loadLatestCheckIn();
  if (!latest || latest.handled) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...latest, handled: true }));
  } catch {
    // localStorage may be unavailable — safe to ignore for this prototype.
  }
}

export function clearLatestCheckIn(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable — safe to ignore for this prototype.
  }
}
