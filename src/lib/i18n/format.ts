import { getLanguageInfo, type AppLanguage } from "@/lib/i18n/languages";

function toDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string, lang: AppLanguage, fallback: string): string {
  const date = toDate(iso);
  if (!date) return fallback;
  return date.toLocaleDateString(getLanguageInfo(lang).locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(
  iso: string,
  lang: AppLanguage,
  fallback: string,
  withYear = false,
): string {
  const date = toDate(iso);
  if (!date) return fallback;
  return date.toLocaleString(getLanguageInfo(lang).locale, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One decimal place max, with the language's decimal separator (3,5 in German). */
export function formatDecimal(value: number, lang: AppLanguage): string {
  return new Intl.NumberFormat(getLanguageInfo(lang).locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

/** Average vs par, e.g. "+2,5" / "E" / "−1.5". */
export function formatAverageToPar(value: number, lang: AppLanguage): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "E";
  const text = formatDecimal(Math.abs(rounded), lang);
  return rounded > 0 ? `+${text}` : `−${text}`;
}

/** "3, 7 and 12" / "3, 7 et 12" / "3、7和12". */
export function formatList(items: (string | number)[], lang: AppLanguage): string {
  const strings = items.map(String);
  try {
    return new Intl.ListFormat(getLanguageInfo(lang).locale, {
      style: "long",
      type: "conjunction",
    }).format(strings);
  } catch {
    return strings.join(", ");
  }
}
