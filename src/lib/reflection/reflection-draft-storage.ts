export type ReflectionDraft = {
  whatWorked: string;
  whatGotInHead: string;
  whatToRemember: string;
};

const STORAGE_PREFIX = "foremind:reflection-draft:";

function draftKey(roundId: string): string {
  return `${STORAGE_PREFIX}${roundId}`;
}

function isReflectionDraft(value: unknown): value is ReflectionDraft {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.whatWorked === "string" &&
    typeof raw.whatGotInHead === "string" &&
    typeof raw.whatToRemember === "string"
  );
}

export function getReflectionDraftSnapshot(roundId: string): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(draftKey(roundId)) ?? "";
  } catch {
    return "";
  }
}

export function parseReflectionDraftSnapshot(raw: string): ReflectionDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isReflectionDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadReflectionDraft(roundId: string): ReflectionDraft | null {
  return parseReflectionDraftSnapshot(getReflectionDraftSnapshot(roundId));
}

export function saveReflectionDraft(roundId: string, draft: ReflectionDraft): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(draftKey(roundId), JSON.stringify(draft));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
}

export function clearReflectionDraft(roundId: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(draftKey(roundId));
  } catch {
    // localStorage may be unavailable — safe to ignore for this prototype.
  }
}
