export type CaddieLogEntry = {
  id: string;
  timestamp: string;
  roundId?: string;
  course?: string;
  hole?: number;
  message: string;
  response: string;
};

export type CaddieLogEntryContext = {
  roundId?: string;
  course?: string;
  hole?: number;
};

const STORAGE_KEY = "foremind:caddie-history";
const CADDIE_LOG_CHANGED_EVENT = "foremind:caddie-log-changed";

/** storage event (other tabs) + a same-tab event fired after every write. */
export function subscribeToCaddieLog(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CADDIE_LOG_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CADDIE_LOG_CHANGED_EVENT, callback);
  };
}
const MAX_ENTRIES = 20;

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isCaddieLogEntry(value: unknown): value is CaddieLogEntry {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.id === "string" &&
    typeof raw.timestamp === "string" &&
    typeof raw.message === "string" &&
    typeof raw.response === "string" &&
    (raw.roundId === undefined || typeof raw.roundId === "string") &&
    (raw.course === undefined || typeof raw.course === "string") &&
    (raw.hole === undefined || typeof raw.hole === "number")
  );
}

export function getCaddieLogSnapshot(): string {
  if (typeof window === "undefined") return "[]";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseCaddieLogSnapshot(raw: string): CaddieLogEntry[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCaddieLogEntry) : [];
  } catch {
    return [];
  }
}

export function loadCaddieLog(): CaddieLogEntry[] {
  return parseCaddieLogSnapshot(getCaddieLogSnapshot());
}

// Records a real exchange the golfer had with the Caddie, most-recent first,
// so "History" reflects actual conversations rather than anything
// fabricated. Capped to avoid unbounded localStorage growth.
export function appendCaddieLogEntry(
  message: string,
  response: string,
  context?: CaddieLogEntryContext,
): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CaddieLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      roundId: context?.roundId,
      course: context?.course,
      hole: context?.hole,
      message,
      response,
    };
    const next = [entry, ...loadCaddieLog()].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CADDIE_LOG_CHANGED_EVENT));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
}
