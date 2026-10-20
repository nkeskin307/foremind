export type CaddieLanguage = {
  /** BCP-47 tag used for speech recognition and speech synthesis. */
  code: string;
  /** Shown in the picker, in the language itself. */
  label: string;
  /** Used in the prompt to /api/caddie. */
  englishName: string;
};

export const CADDIE_LANGUAGES: CaddieLanguage[] = [
  { code: "en-US", label: "English", englishName: "English" },
  { code: "tr-TR", label: "Türkçe", englishName: "Turkish" },
  { code: "es-ES", label: "Español", englishName: "Spanish" },
  { code: "fr-FR", label: "Français", englishName: "French" },
  { code: "de-DE", label: "Deutsch", englishName: "German" },
  { code: "it-IT", label: "Italiano", englishName: "Italian" },
  { code: "pt-BR", label: "Português", englishName: "Portuguese" },
  { code: "zh-CN", label: "中文", englishName: "Chinese (Simplified)" },
  { code: "ja-JP", label: "日本語", englishName: "Japanese" },
  { code: "ko-KR", label: "한국어", englishName: "Korean" },
  { code: "ar-SA", label: "العربية", englishName: "Arabic" },
];

const STORAGE_KEY = "foremind:caddie-language";
const DEFAULT_CODE = "en-US";

/** Exact tag match first, then the same base language (e.g. "es-MX" → Español). */
export function findCaddieLanguage(code: string | null | undefined): CaddieLanguage | null {
  if (!code) return null;
  const normalized = code.replace("_", "-").toLowerCase();
  const exact = CADDIE_LANGUAGES.find((language) => language.code.toLowerCase() === normalized);
  if (exact) return exact;
  const base = normalized.split("-")[0];
  return (
    CADDIE_LANGUAGES.find((language) => language.code.toLowerCase().split("-")[0] === base) ??
    null
  );
}

function getDeviceLanguageCode(): string {
  if (typeof navigator === "undefined") return DEFAULT_CODE;
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const candidate of candidates) {
    const match = findCaddieLanguage(candidate);
    if (match) return match.code;
  }
  return DEFAULT_CODE;
}

const listeners = new Set<() => void>();

export function subscribeToCaddieLanguage(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** The saved language, or the device language when nothing is saved yet. */
export function getCaddieLanguageSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_CODE;
  try {
    const stored = findCaddieLanguage(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored.code;
  } catch {
    // localStorage may be unavailable — fall back to the device language.
  }
  return getDeviceLanguageCode();
}

export function getServerCaddieLanguageSnapshot(): string {
  return DEFAULT_CODE;
}

export function setCaddieLanguage(code: string): void {
  const language = findCaddieLanguage(code);
  if (!language) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language.code);
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
  listeners.forEach((callback) => callback());
}
