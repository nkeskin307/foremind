import type { AppLanguage } from "@/lib/i18n/languages";
import { en, type Messages } from "@/lib/i18n/messages/en";
import { tr } from "@/lib/i18n/messages/tr";
import { fr } from "@/lib/i18n/messages/fr";
import { es } from "@/lib/i18n/messages/es";
import { de } from "@/lib/i18n/messages/de";
import { it } from "@/lib/i18n/messages/it";
import { zh } from "@/lib/i18n/messages/zh";

export type { Messages };

const DICTIONARIES: Record<AppLanguage, Messages> = { en, tr, fr, es, de, it, zh };

export function getMessages(lang: AppLanguage): Messages {
  return DICTIONARIES[lang] ?? en;
}

/** Display name for a stored (English-key) mental state. */
export function stateLabel(messages: Messages, state: string): string {
  return messages.mentalStates[state] ?? state;
}

/** All languages' routine keywords, so a note in any language is understood. */
export function allRoutineKeywords(): Messages["routine"]["keywords"] {
  const merged = { focus: [] as string[], confidence: [] as string[], energy: [] as string[] };
  for (const messages of Object.values(DICTIONARIES)) {
    merged.focus.push(...messages.routine.keywords.focus);
    merged.confidence.push(...messages.routine.keywords.confidence);
    merged.energy.push(...messages.routine.keywords.energy);
  }
  return merged;
}

/** "Not enough data" phrases in every language (analyses may be in any of them). */
export function allNoDataPhrases(): string[] {
  return Object.values(DICTIONARIES).flatMap((messages) => messages.analysis.noDataPhrases);
}
