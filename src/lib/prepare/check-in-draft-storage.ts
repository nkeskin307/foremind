export type CheckInDraft = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

const STORAGE_KEY = "foremind:prepare-draft";

function isCheckInDraft(value: unknown): value is CheckInDraft {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    (raw.focus === null || typeof raw.focus === "number") &&
    (raw.energy === null || typeof raw.energy === "number") &&
    (raw.confidence === null || typeof raw.confidence === "number") &&
    typeof raw.note === "string"
  );
}

export function getCheckInDraftSnapshot(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseCheckInDraftSnapshot(raw: string): CheckInDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isCheckInDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadCheckInDraft(): CheckInDraft | null {
  return parseCheckInDraftSnapshot(getCheckInDraftSnapshot());
}

export function saveCheckInDraft(draft: CheckInDraft): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
}

export function clearCheckInDraft(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable — safe to ignore for this prototype.
  }
}
