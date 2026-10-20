"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getMessages } from "@/lib/i18n";
import { getLanguageInfo } from "@/lib/i18n/languages";
import {
  getLanguageSnapshot,
  getServerLanguageSnapshot,
  setLanguage,
  subscribeToLanguage,
} from "@/lib/i18n/language-store";

/** The app-wide language plus its dictionary. Server/hydration render uses English. */
export function useI18n() {
  const lang = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  );
  return { lang, t: getMessages(lang), info: getLanguageInfo(lang), setLanguage };
}

/** Keeps <html lang> in sync with the chosen language. */
export function HtmlLang() {
  const { info } = useI18n();
  useEffect(() => {
    document.documentElement.lang = info.locale;
  }, [info.locale]);
  return null;
}
