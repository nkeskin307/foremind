export type AppLanguage = "en" | "tr" | "fr" | "es" | "de" | "it" | "zh";

export type AppLanguageInfo = {
  code: AppLanguage;
  /** Shown in switchers — each language in its own name. */
  label: string;
  /** Used in prompts to Gemini. */
  englishName: string;
  /** BCP-47 tag for Intl formatting, speech recognition and read-aloud voices. */
  locale: string;
};

export const APP_LANGUAGES: AppLanguageInfo[] = [
  { code: "en", label: "English", englishName: "English", locale: "en-US" },
  { code: "tr", label: "Türkçe", englishName: "Turkish", locale: "tr-TR" },
  { code: "fr", label: "Français", englishName: "French", locale: "fr-FR" },
  { code: "es", label: "Español", englishName: "Spanish", locale: "es-ES" },
  { code: "de", label: "Deutsch", englishName: "German", locale: "de-DE" },
  { code: "it", label: "Italiano", englishName: "Italian", locale: "it-IT" },
  { code: "zh", label: "中文", englishName: "Chinese (Simplified)", locale: "zh-CN" },
];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

/** Accepts "tr", "tr-TR", "TR_tr", … and returns a supported language or null. */
export function toAppLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== "string" || !value) return null;
  const base = value.replace("_", "-").toLowerCase().split("-")[0];
  return APP_LANGUAGES.find((language) => language.code === base)?.code ?? null;
}

export function getLanguageInfo(code: AppLanguage): AppLanguageInfo {
  return APP_LANGUAGES.find((language) => language.code === code) ?? APP_LANGUAGES[0];
}
