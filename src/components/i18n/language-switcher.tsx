"use client";

import { APP_LANGUAGES, type AppLanguage } from "@/lib/i18n/languages";
import { useI18n } from "@/lib/i18n/use-i18n";

/** Compact select — each language shown in its own name. */
export function LanguageSelect({ className = "" }: { className?: string }) {
  const { lang, t, setLanguage } = useI18n();
  return (
    <label className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      {t.common.language}
      <select
        value={lang}
        onChange={(event) => setLanguage(event.target.value as AppLanguage)}
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-forest focus:outline-none"
      >
        {APP_LANGUAGES.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Menu rows for the header's Session menu. */
export function LanguageMenuItems({ onPick }: { onPick: () => void }) {
  const { lang, t, setLanguage } = useI18n();
  return (
    <div className="border-t border-border pt-1">
      <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {t.common.language}
      </p>
      {APP_LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          role="menuitemradio"
          aria-checked={lang === option.code}
          lang={option.locale}
          onClick={() => {
            setLanguage(option.code);
            onPick();
          }}
          className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-sage-soft ${
            lang === option.code ? "text-sage" : "text-foreground"
          }`}
        >
          {option.label}
          {lang === option.code && <span aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>
  );
}
