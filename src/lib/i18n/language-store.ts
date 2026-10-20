import { DEFAULT_LANGUAGE, toAppLanguage, type AppLanguage } from "@/lib/i18n/languages";

const STORAGE_KEY = "foremind:language";
// Stage 3 stored only the Caddie's voice language; reuse it once if supported.
const LEGACY_VOICE_KEY = "foremind:caddie-language";

const listeners = new Set<() => void>();

export function subscribeToLanguage(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getDeviceLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  for (const candidate of [...(navigator.languages ?? []), navigator.language]) {
    const match = toAppLanguage(candidate);
    if (match) return match;
  }
  return DEFAULT_LANGUAGE;
}

/** Saved language, else the old Caddie voice language, else the device language, else English. */
export function getLanguageSnapshot(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const saved =
      toAppLanguage(window.localStorage.getItem(STORAGE_KEY)) ??
      toAppLanguage(window.localStorage.getItem(LEGACY_VOICE_KEY));
    if (saved) return saved;
  } catch {
    // localStorage may be unavailable — fall back to the device language.
  }
  return getDeviceLanguage();
}

export function getServerLanguageSnapshot(): AppLanguage {
  return DEFAULT_LANGUAGE;
}

export function setLanguage(code: AppLanguage): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // localStorage may be unavailable (private mode, quota) — safe to ignore for this prototype.
  }
  listeners.forEach((callback) => callback());
}
